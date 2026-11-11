/**
 * Per-site kill switch helpers.
 * Shared by background.js (importScripts) and popup.html (<script>).
 *
 * The listed domains only load while the user's VPN is the active connection.
 * Two kinds of VPN are supported:
 *   - 'proxy'  : the VPN app exposes a proxy (v2ray, Clash, ...). The domains are routed
 *                through that proxy with NO direct fallback.
 *   - 'tunnel' : the VPN is a system tunnel (WireGuard, OpenVPN, ...). There is no proxy to
 *                point at, so the PAC script checks on every request which local address the
 *                system currently uses to reach the Internet and blocks the domains unless
 *                it is the tunnel's address.
 */
var SiteProxy = (function() {
  'use strict';

  var STORAGE_KEY = 'siteProxyConfig';
  // Last check result, kept in chrome.storage.session
  var STATUS_KEY = 'siteProxyStatus';

  var DEFAULT_CONFIG = {
    enabled: false,
    mode: 'proxy',
    domains: [],
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    // Proxy mode only - what happens to every site that is NOT in the list:
    //   'direct' -> plain direct connection
    //   'proxy'  -> same proxy, falling back to direct when it is down
    others: 'direct',
    // Tunnel mode: local address of the VPN interface (e.g. 10.8.0.2)
    tunnelAddr: null,
    // Public IP seen while the VPN is on. Compared with the current public IP.
    vpnIp: null
  };

  // PAC result keyword for each supported proxy type
  var PAC_TOKENS = { socks5: 'SOCKS5', socks4: 'SOCKS', http: 'PROXY', https: 'HTTPS' };

  // A request for this host makes the PAC script report the system's current local
  // address through chrome.proxy.onProxyError (the request itself never leaves the browser).
  var PROBE_HOST = 'geo-tz-probe.invalid';
  var PROBE_TAG = 'GEOTZ_ADDR:';

  // Nothing listens here, so a request sent to this "proxy" fails without leaving the machine.
  var BLOCK_RESULT = 'PROXY 127.0.0.1:9';

  // Public "what is my IP" services (IPv4 only, so the answer is comparable between checks).
  // They are tried in order until one answers.
  var IP_ENDPOINTS = [
    'https://1.1.1.1/cdn-cgi/trace',
    'https://ipv4.icanhazip.com/',
    'https://api.ipify.org/',
    'https://checkip.amazonaws.com/'
  ];

  // Default local ports of common VPN clients (v2rayN, sing-box / NekoBox, Clash, v2rayA,
  // Hiddify, Shadowsocks, Privoxy, Squid)
  var LOCAL_PROXY_PORTS = [10808, 10809, 2080, 2081, 7890, 7897, 7891, 20171, 12334, 1080, 1081, 8118, 3128];

  var HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  var IPV6_RE = /^\[[0-9a-f:.]+\]$/;
  var IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  // Accepts "example.com", "*.example.com", "https://example.com/path", "example.com:8080"
  // Returns a bare lowercase hostname, or null when the input is not usable.
  function normalizeDomain(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    s = s.replace(/^\*\./, '');
    var host;
    try {
      host = new URL('http://' + s).hostname;
    } catch (e) {
      return null;
    }
    host = host.replace(/\.$/, '');
    if (!host || host.length > 253 || !HOSTNAME_RE.test(host)) return null;
    return host;
  }

  // Splits free text (one domain per line, commas and spaces also allowed).
  // Returns { domains: [...unique valid], invalid: [...rejected raw entries] }
  function parseDomainList(text) {
    var domains = [];
    var invalid = [];
    String(text || '').split(/[\s,;]+/).forEach(function(raw) {
      if (!raw) return;
      var d = normalizeDomain(raw);
      if (!d) {
        invalid.push(raw);
      } else if (domains.indexOf(d) === -1) {
        domains.push(d);
      }
    });
    return { domains: domains, invalid: invalid };
  }

  function normalizeHost(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim().toLowerCase();
    if (!s) return null;
    if (IPV6_RE.test(s)) return s;
    if (s.length > 253 || !HOSTNAME_RE.test(s)) return null;
    return s;
  }

  function normalizePort(input) {
    var n = Number(input);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
    return n;
  }

  // Returns a canonical IPv4 / IPv6 address string (no brackets), or null.
  function normalizeIp(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (!s || s.length > 45) return null;
    var m = IPV4_RE.exec(s);
    if (m) {
      var parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      for (var i = 0; i < 4; i++) {
        if (parts[i] > 255) return null;
      }
      return parts.join('.');
    }
    if (s.indexOf(':') === -1 || !/^[0-9a-f:.]+$/.test(s)) return null;
    try {
      return new URL('http://[' + s + ']/').hostname.replace(/^\[|\]$/g, '');
    } catch (e) {
      return null;
    }
  }

  // Always returns a complete, sanitized config object (never trusts stored data as-is).
  function normalizeConfig(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var domains = [];
    if (Array.isArray(r.domains)) {
      r.domains.forEach(function(item) {
        var d = normalizeDomain(item);
        if (d && domains.indexOf(d) === -1) domains.push(d);
      });
    }
    return {
      enabled: r.enabled === true,
      mode: r.mode === 'tunnel' ? 'tunnel' : 'proxy',
      domains: domains,
      scheme: Object.prototype.hasOwnProperty.call(PAC_TOKENS, r.scheme) ? r.scheme : DEFAULT_CONFIG.scheme,
      host: normalizeHost(r.host),
      port: normalizePort(r.port),
      others: r.others === 'proxy' ? 'proxy' : 'direct',
      tunnelAddr: normalizeIp(r.tunnelAddr),
      vpnIp: normalizeIp(r.vpnIp)
    };
  }

  // Returns null when the config can be applied, otherwise an error code.
  function validate(cfg) {
    if (cfg.mode === 'tunnel') {
      if (!cfg.domains.length) return 'no_domains';
      if (!cfg.tunnelAddr && !cfg.vpnIp) return 'no_vpn';
      return null;
    }
    if (!cfg.host) return 'bad_host';
    if (!cfg.port) return 'bad_port';
    if (!cfg.domains.length) return 'no_domains';
    return null;
  }

  // Hostnames of the IP services (proxy mode sends them through the proxy as well,
  // so the reported IP is the one the listed sites see).
  function ipHosts() {
    var hosts = [];
    IP_ENDPOINTS.forEach(function(url) {
      try {
        var h = new URL(url).hostname;
        if (hosts.indexOf(h) === -1) hosts.push(h);
      } catch (e) {}
    });
    return hosts;
  }

  // Builds the PAC script.
  //   opts.ipBlocked : tunnel mode - block the listed domains because the public IP check failed
  //   opts.ipHosts   : proxy mode  - extra hosts that must use the proxy only
  // The listed domains never get a "DIRECT" fallback while the VPN is not confirmed.
  function buildPacScript(cfg, opts) {
    var o = opts || {};
    var lines = [
      'function FindProxyForURL(url, host) {',
      '  var domains = ' + JSON.stringify(cfg.domains) + ';',
      '  host = String(host).toLowerCase();',
      '  if (host.charAt(host.length - 1) === ".") host = host.slice(0, -1);',
      '  if (host === ' + JSON.stringify(PROBE_HOST) + ') throw new Error(' + JSON.stringify(PROBE_TAG) + ' + myIpAddress());',
      '  var listed = false;',
      '  for (var i = 0; i < domains.length; i++) {',
      '    var d = domains[i];',
      '    if (host === d || host.slice(-(d.length + 1)) === "." + d) { listed = true; break; }',
      '  }'
    ];
    if (cfg.mode === 'tunnel') {
      lines.push('  if (listed) {');
      if (o.ipBlocked) {
        lines.push('    return ' + JSON.stringify(BLOCK_RESULT) + ';');
      } else if (cfg.tunnelAddr) {
        lines.push('    if (myIpAddress() !== ' + JSON.stringify(cfg.tunnelAddr) + ') return ' + JSON.stringify(BLOCK_RESULT) + ';');
      }
      lines.push('  }');
      lines.push('  return "DIRECT";');
    } else {
      var proxy = PAC_TOKENS[cfg.scheme] + ' ' + cfg.host + ':' + cfg.port;
      var fallback = cfg.others === 'proxy' ? proxy + '; DIRECT' : 'DIRECT';
      lines.push('  var ipHosts = ' + JSON.stringify(Array.isArray(o.ipHosts) ? o.ipHosts : []) + ';');
      lines.push('  if (listed || ipHosts.indexOf(host) !== -1) return ' + JSON.stringify(proxy) + ';');
      lines.push('  return ' + JSON.stringify(fallback) + ';');
    }
    lines.push('}');
    return lines.join('\n');
  }

  // PAC script that only answers the local-address probe and leaves everything else direct.
  function buildProbePac() {
    return buildPacScript({ mode: 'tunnel', domains: [], tunnelAddr: null }, {});
  }

  // Extracts the address from a chrome.proxy.onProxyError "details" string.
  // Returns undefined when the error is not a probe answer, null when the address is unusable.
  function parseProbeError(details) {
    if (typeof details !== 'string') return undefined;
    var at = details.indexOf(PROBE_TAG);
    if (at === -1) return undefined;
    var addr = normalizeIp(details.slice(at + PROBE_TAG.length).split(/\s/)[0]);
    if (!addr || addr === '127.0.0.1' || addr === '::1') return null;
    return addr;
  }

  // Reads the answer of an IP service: either a bare address or Cloudflare's "key=value" trace.
  function parseIpResponse(text) {
    var body = String(text || '');
    var ipLine = /^ip=(.+)$/m.exec(body);
    var locLine = /^loc=([A-Za-z]{2})$/m.exec(body);
    return {
      ip: normalizeIp(ipLine ? ipLine[1] : body),
      country: locLine ? locLine[1].toUpperCase() : null
    };
  }

  // Compares what the system looks like now with the saved VPN.
  //   obs = { localAddr, publicIp }
  // Returns:
  //   state        : 'ok' | 'tunnel_only' | 'tunnel_down' | 'ip_changed' | 'proxy_down' | 'unknown'
  //   level        : 'ok' (green) | 'warn' (yellow) | 'bad' (red)
  //   ipBlocked    : value to bake into the PAC script (tunnel mode)
  //   sitesBlocked : whether the listed domains are currently blocked
  function computeStatus(cfg, obs) {
    var localAddr = obs && obs.localAddr ? obs.localAddr : null;
    var publicIp = obs && obs.publicIp ? obs.publicIp : null;
    var ipOk = cfg.vpnIp && publicIp ? publicIp === cfg.vpnIp : null;

    if (cfg.mode !== 'tunnel') {
      // The listed domains always use the proxy here, so nothing is blocked by this check
      if (!publicIp) return { state: 'proxy_down', level: 'bad', ipBlocked: false, sitesBlocked: false };
      if (ipOk === false) return { state: 'ip_changed', level: 'bad', ipBlocked: false, sitesBlocked: false };
      return { state: 'ok', level: 'ok', ipBlocked: false, sitesBlocked: false };
    }

    var tunnelOk = cfg.tunnelAddr && localAddr ? localAddr === cfg.tunnelAddr : null;
    // With a tunnel address the PAC script already guards every request, so the public IP
    // only blocks on a confirmed mismatch. Without one it is the only guard: fail closed.
    var ipBlocked = cfg.tunnelAddr ? ipOk === false : ipOk !== true;

    if (tunnelOk === false) return { state: 'tunnel_down', level: 'bad', ipBlocked: ipBlocked, sitesBlocked: true };
    if (ipOk === false) return { state: 'ip_changed', level: 'bad', ipBlocked: ipBlocked, sitesBlocked: true };
    if (ipOk === true) return { state: 'ok', level: 'ok', ipBlocked: ipBlocked, sitesBlocked: false };
    if (tunnelOk === true) return { state: 'tunnel_only', level: 'warn', ipBlocked: ipBlocked, sitesBlocked: false };
    return { state: 'unknown', level: ipBlocked ? 'bad' : 'warn', ipBlocked: ipBlocked, sitesBlocked: ipBlocked };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    STATUS_KEY: STATUS_KEY,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    PROBE_HOST: PROBE_HOST,
    IP_ENDPOINTS: IP_ENDPOINTS,
    LOCAL_PROXY_PORTS: LOCAL_PROXY_PORTS,
    normalizeDomain: normalizeDomain,
    parseDomainList: parseDomainList,
    normalizeHost: normalizeHost,
    normalizePort: normalizePort,
    normalizeIp: normalizeIp,
    normalizeConfig: normalizeConfig,
    validate: validate,
    ipHosts: ipHosts,
    buildPacScript: buildPacScript,
    buildProbePac: buildProbePac,
    parseProbeError: parseProbeError,
    parseIpResponse: parseIpResponse,
    computeStatus: computeStatus
  };
})();
