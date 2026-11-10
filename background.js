// Background Service Worker
importScripts('proxy.js');

// Per-site proxy (kill switch): route the listed domains through the proxy only.
// "mandatory" stops Chrome from falling back to a direct connection if the PAC script fails.
function applySiteProxy(raw) {
  const cfg = SiteProxy.normalizeConfig(raw);
  if (cfg.enabled && SiteProxy.validate(cfg) === null) {
    chrome.proxy.settings.set({
      value: {
        mode: 'pac_script',
        pacScript: { data: SiteProxy.buildPacScript(cfg), mandatory: true }
      },
      scope: 'regular'
    }, function() {
      if (chrome.runtime.lastError) {}
    });
  } else {
    chrome.proxy.settings.clear({ scope: 'regular' }, function() {
      if (chrome.runtime.lastError) {}
    });
  }
}

function loadAndApplySiteProxy() {
  chrome.storage.local.get([SiteProxy.STORAGE_KEY], function(res) {
    applySiteProxy(res[SiteProxy.STORAGE_KEY]);
  });
}

chrome.runtime.onInstalled.addListener(loadAndApplySiteProxy);
chrome.runtime.onStartup.addListener(loadAndApplySiteProxy);

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['geoTzConfig'], function(res) {
    if (!res.geoTzConfig) {
      chrome.storage.local.set({
        geoTzConfig: {"enabled":true,"geo":{"latitude":34.0522,"longitude":-118.2437,"accuracy":20,"altitude":null,"altitudeAccuracy":null,"heading":null,"speed":null},"timezone":{"timezone":"America/Los_Angeles","locale":"en-US","offsetMinutes":480,"labelFa":"America/Los_Angeles"}}
      });
    }
    updateBadge(res.geoTzConfig ? res.geoTzConfig.enabled : true);
  });
});

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.geoTzConfig) {
    const isEnabled = changes.geoTzConfig.newValue?.enabled;
    updateBadge(isEnabled);
  }
  if (area === 'local' && changes[SiteProxy.STORAGE_KEY]) {
    applySiteProxy(changes[SiteProxy.STORAGE_KEY].newValue);
  }
});

function updateBadge(isEnabled) {
  if (isEnabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748B' });
  }
}
