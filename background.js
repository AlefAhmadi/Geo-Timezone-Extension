// Background Service Worker
importScripts('proxy.js');

// ---- Per-site kill switch ----
// The listed domains only load while the VPN is the active connection (see proxy.js).
// "mandatory" stops Chrome from falling back to a direct connection if the PAC script fails.

const CHECK_ALARM = 'siteProxyCheck';
const probeWaiters = [];
let checkInFlight = null;
let lastGoodEndpoint = 0;

function getSiteProxyConfig() {
  return chrome.storage.local.get([SiteProxy.STORAGE_KEY]).then(function(res) {
    return SiteProxy.normalizeConfig(res[SiteProxy.STORAGE_KEY]);
  });
}

function getProxySettings() {
  return new Promise(function(resolve) {
    chrome.proxy.settings.get({ incognito: false }, function(details) {
      resolve(chrome.runtime.lastError || !details ? {} : details);
    });
  });
}

function setPac(data) {
  return new Promise(function(resolve) {
    chrome.proxy.settings.set({
      value: { mode: 'pac_script', pacScript: { data: data, mandatory: true } },
      scope: 'regular'
    }, function() {
      if (chrome.runtime.lastError) {}
      resolve();
    });
  });
}

function clearPac() {
  return new Promise(function(resolve) {
    chrome.proxy.settings.clear({ scope: 'regular' }, function() {
      if (chrome.runtime.lastError) {}
      resolve();
    });
  });
}

// Installs the PAC script for this config, unless exactly the same script is already active.
async function ensurePac(cfg, ipBlocked) {
  const data = SiteProxy.buildPacScript(cfg, { ipBlocked: ipBlocked, ipHosts: SiteProxy.ipHosts() });
  const current = await getProxySettings();
  const active = current.value && current.value.pacScript && current.value.pacScript.data;
  if (current.levelOfControl === 'controlled_by_this_extension' && active === data) return;
  await setPac(data);
}

async function applySiteProxy(raw) {
  const cfg = SiteProxy.normalizeConfig(raw);
  if (cfg.enabled && SiteProxy.validate(cfg) === null) {
    // Without a tunnel address the public IP is the only guard: stay closed until it is confirmed
    await ensurePac(cfg, cfg.mode === 'tunnel' && !cfg.tunnelAddr);
    chrome.alarms.create(CHECK_ALARM, { periodInMinutes: 1 });
    await recheck();
  } else {
    // Let a running check finish first so it cannot re-install the PAC script afterwards
    if (checkInFlight) {
      try { await checkInFlight; } catch (e) {}
    }
    await clearPac();
    chrome.alarms.clear(CHECK_ALARM);
    await chrome.storage.session.remove(SiteProxy.STATUS_KEY);
    renderBadge();
  }
}

function loadAndApplySiteProxy() {
  return chrome.storage.local.get([SiteProxy.STORAGE_KEY]).then(function(res) {
    return applySiteProxy(res[SiteProxy.STORAGE_KEY]);
  });
}

// The PAC script answers a request for the probe host by throwing the system's current
// local address; Chrome hands that error to this listener.
chrome.proxy.onProxyError.addListener(function(details) {
  const addr = SiteProxy.parseProbeError(details && details.details);
  if (addr === undefined) return;
  probeWaiters.splice(0).forEach(function(waiter) { waiter(addr); });
});

// Only meaningful while a PAC script of this extension is active.
// Chrome holds every proxy decision back for about 2 seconds after a network change
// (requests wait, they are not sent), so the answer can take that long right after a VPN drop.
function probeLocalAddr() {
  return new Promise(function(resolve) {
    let done = false;
    const finish = function(addr) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const at = probeWaiters.indexOf(finish);
      if (at !== -1) probeWaiters.splice(at, 1);
      resolve(addr);
    };
    const timer = setTimeout(function() { finish(null); }, 4000);
    probeWaiters.push(finish);
    fetch('http://' + SiteProxy.PROBE_HOST + '/?' + Date.now(), { cache: 'no-store', credentials: 'omit' }).catch(function() {});
  });
}

// Used by auto-detection, which may run while the kill switch is off. In that case a
// probe-only PAC script is installed for a moment (everything stays on a direct connection).
async function probeLocalAddrAnyState() {
  const current = await getProxySettings();
  if (current.levelOfControl === 'controlled_by_this_extension') return probeLocalAddr();
  if (current.levelOfControl !== 'controllable_by_this_extension') return null;
  await setPac(SiteProxy.buildProbePac());
  try {
    return await probeLocalAddr();
  } finally {
    await loadAndApplySiteProxy();
  }
}

function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  return fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: controller.signal })
    .then(function(res) {
      return res.text().then(function(text) { return { status: res.status, ok: res.ok, text: text }; });
    })
    .catch(function() { return null; })
    .finally(function() { clearTimeout(timer); });
}

// Asks the IP services one at a time, starting with the one that answered last.
async function fetchPublicIp() {
  const endpoints = SiteProxy.IP_ENDPOINTS;
  for (let i = 0; i < endpoints.length; i++) {
    const index = (lastGoodEndpoint + i) % endpoints.length;
    const res = await fetchText(endpoints[index], 3000);
    if (res && res.ok) {
      const parsed = SiteProxy.parseIpResponse(res.text);
      if (parsed.ip) {
        lastGoodEndpoint = index;
        return parsed;
      }
    }
  }
  return { ip: null, country: null };
}

// Looks for a VPN client's local proxy. An HTTP proxy answers a plain (non-proxy) request
// with "400 Bad Request" or "407 Proxy Authentication Required".
async function scanLocalProxies() {
  const found = await Promise.all(SiteProxy.LOCAL_PROXY_PORTS.map(function(port) {
    return fetchText('http://127.0.0.1:' + port + '/', 1500).then(function(res) {
      return res && (res.status === 400 || res.status === 407) ? port : null;
    });
  }));
  return found.filter(Boolean).map(function(port) {
    return { scheme: 'http', host: '127.0.0.1', port: port };
  });
}

// The tunnel answer is instant while the IP services can take seconds (or time out),
// so a dropped tunnel is reported on its own, without waiting for them.
async function reportTunnelDrop(cfg) {
  if (cfg.mode !== 'tunnel' || !cfg.tunnelAddr) return null;
  const localAddr = await probeLocalAddr();
  if (!localAddr || localAddr === cfg.tunnelAddr) return localAddr;
  const stored = (await chrome.storage.session.get([SiteProxy.STATUS_KEY]))[SiteProxy.STATUS_KEY];
  // Keep a finished "tunnel down" report (it already shows the current public IP)
  if (!stored || stored.state !== 'tunnel_down' || stored.tunnelAddr !== cfg.tunnelAddr) {
    await publishStatus(cfg, SiteProxy.computeStatus(cfg, { localAddr: localAddr, publicIp: null }), {
      localAddr: localAddr, publicIp: null, country: null, pending: true
    });
  }
  return localAddr;
}

async function quickTunnelCheck() {
  const cfg = await getSiteProxyConfig();
  if (cfg.enabled && SiteProxy.validate(cfg) === null) await reportTunnelDrop(cfg);
}

async function runCheck() {
  const cfg = await getSiteProxyConfig();
  if (!cfg.enabled || SiteProxy.validate(cfg) !== null) return null;

  const started = Date.now();
  const publicIpRequest = fetchPublicIp();
  let localAddr = await reportTunnelDrop(cfg);
  const pub = await publicIpRequest;
  // The tunnel may have changed while the IP services were answering: look again
  if (cfg.mode === 'tunnel' && cfg.tunnelAddr && Date.now() - started > 300) {
    localAddr = await probeLocalAddr();
  }

  // The settings changed while this check was running: drop the result, the change starts its own check
  const latest = await getSiteProxyConfig();
  if (JSON.stringify(latest) !== JSON.stringify(cfg)) return null;

  // Proxy mode: remember the proxy's exit IP the first time it is seen
  if (cfg.mode === 'proxy' && !cfg.vpnIp && pub.ip) {
    cfg.vpnIp = pub.ip;
    const data = {};
    data[SiteProxy.STORAGE_KEY] = cfg;
    await chrome.storage.local.set(data);
  }

  const verdict = SiteProxy.computeStatus(cfg, { localAddr: localAddr, publicIp: pub.ip });
  await ensurePac(cfg, verdict.ipBlocked);

  return publishStatus(cfg, verdict, { localAddr: localAddr, publicIp: pub.ip, country: pub.country, pending: false });
}

// Stores the check result for the popup and updates the toolbar badge.
async function publishStatus(cfg, verdict, observed) {
  const status = Object.assign({}, verdict, observed, {
    mode: cfg.mode,
    tunnelAddr: cfg.tunnelAddr,
    vpnIp: cfg.vpnIp,
    checkedAt: Date.now()
  });
  const session = {};
  session[SiteProxy.STATUS_KEY] = status;
  await chrome.storage.session.set(session);
  renderBadge();
  return status;
}

// Runs one full check at a time; a caller that arrives during a check gets a fresh one afterwards.
async function recheck() {
  if (checkInFlight) {
    // Do not make a dropped tunnel wait behind a check that is stuck on a slow IP service
    quickTunnelCheck().catch(function() {});
    try { await checkInFlight; } catch (e) {}
  }
  if (!checkInFlight) {
    checkInFlight = runCheck().finally(function() { checkInFlight = null; });
  }
  return checkInFlight;
}

// Reports what the system looks like right now, for the popup's "auto-detect" button.
async function detectVpn(preferredMode) {
  const proxies = await scanLocalProxies();
  let localAddr = null;
  // Skipped when a local proxy was found, so a user of a system-wide proxy is not
  // switched to a direct connection for the duration of the probe.
  if (!proxies.length || preferredMode === 'tunnel') {
    localAddr = await probeLocalAddrAnyState();
  }
  const pub = await fetchPublicIp();
  return { proxies: proxies, localAddr: localAddr, publicIp: pub.ip, country: pub.country };
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  // Only the extension's own pages (the popup) may ask, not content scripts running in web pages
  const fromOwnPage = sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.indexOf(chrome.runtime.getURL('')) === 0;
  if (!msg || !fromOwnPage) return;
  if (msg.type === 'siteProxy:hello') {
    sendResponse({ api: SiteProxy.API_VERSION });
    return;
  }
  if (msg.type === 'siteProxy:check') {
    recheck().then(sendResponse, function() { sendResponse(null); });
    return true;
  }
  if (msg.type === 'siteProxy:detect') {
    detectVpn(msg.mode).then(sendResponse, function(err) {
      sendResponse({ error: String((err && err.message) || err) });
    });
    return true;
  }
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === CHECK_ALARM) recheck();
});

chrome.runtime.onInstalled.addListener(loadAndApplySiteProxy);
chrome.runtime.onStartup.addListener(loadAndApplySiteProxy);

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['geoTzConfig'], function(res) {
    if (!res.geoTzConfig) {
      chrome.storage.local.set({
        geoTzConfig: {"enabled":true,"geo":{"latitude":34.0522,"longitude":-118.2437,"accuracy":20,"altitude":null,"altitudeAccuracy":null,"heading":null,"speed":null},"timezone":{"timezone":"America/Los_Angeles","locale":"en-US","offsetMinutes":480,"labelFa":"America/Los_Angeles"}}
      });
    }
    renderBadge();
  });
});

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.geoTzConfig) {
    renderBadge();
  }
  if (area === 'local' && changes[SiteProxy.STORAGE_KEY]) {
    applySiteProxy(changes[SiteProxy.STORAGE_KEY].newValue);
  }
});

// Shows a red "!" while the kill switch reports a problem, otherwise the usual ON / OFF.
function renderBadge() {
  Promise.all([
    chrome.storage.local.get(['geoTzConfig', SiteProxy.STORAGE_KEY]),
    chrome.storage.session.get([SiteProxy.STATUS_KEY])
  ]).then(function(res) {
    const proxyCfg = SiteProxy.normalizeConfig(res[0][SiteProxy.STORAGE_KEY]);
    const status = res[1][SiteProxy.STATUS_KEY];
    if (proxyCfg.enabled && status && status.level === 'bad') {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
    } else {
      updateBadge(res[0].geoTzConfig ? res[0].geoTzConfig.enabled : true);
    }
  });
}

function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748B' });
  }
}
