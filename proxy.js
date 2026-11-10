/**
 * Per-site proxy (kill switch) helpers.
 * Shared by background.js (importScripts) and popup.html (<script>).
 *
 * The listed domains are routed through one proxy with NO direct fallback,
 * so when the proxy / VPN is down those sites fail instead of leaking the real IP.
 */
var SiteProxy = (function() {
  'use strict';

  var STORAGE_KEY = 'siteProxyConfig';

  var DEFAULT_CONFIG = {
    enabled: false,
    domains: [],
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    // What happens to every site that is NOT in the list:
    //   'direct' -> plain direct connection
    //   'proxy'  -> same proxy, falling back to direct when it is down
    others: 'direct'
  };

  // PAC result keyword for each supported proxy type
  var PAC_TOKENS = { socks5: 'SOCKS5', socks4: 'SOCKS', http: 'PROXY', https: 'HTTPS' };

  var HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
  var IPV6_RE = /^\[[0-9a-f:.]+\]$/;

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
      domains: domains,
      scheme: Object.prototype.hasOwnProperty.call(PAC_TOKENS, r.scheme) ? r.scheme : DEFAULT_CONFIG.scheme,
      host: normalizeHost(r.host),
      port: normalizePort(r.port),
      others: r.others === 'proxy' ? 'proxy' : 'direct'
    };
  }

  // Returns null when the config can be applied, otherwise an error code.
  function validate(cfg) {
    if (!cfg.host) return 'bad_host';
    if (!cfg.port) return 'bad_port';
    if (!cfg.domains.length) return 'no_domains';
    return null;
  }

  // Builds the PAC script. The listed domains (and their subdomains) get the
  // proxy ONLY - there is deliberately no "; DIRECT" fallback for them.
  function buildPacScript(cfg) {
    var proxy = PAC_TOKENS[cfg.scheme] + ' ' + cfg.host + ':' + cfg.port;
    var fallback = cfg.others === 'proxy' ? proxy + '; DIRECT' : 'DIRECT';
    return [
      'function FindProxyForURL(url, host) {',
      '  var domains = ' + JSON.stringify(cfg.domains) + ';',
      '  host = String(host).toLowerCase();',
      '  if (host.charAt(host.length - 1) === ".") host = host.slice(0, -1);',
      '  for (var i = 0; i < domains.length; i++) {',
      '    var d = domains[i];',
      '    if (host === d || host.slice(-(d.length + 1)) === "." + d) {',
      '      return ' + JSON.stringify(proxy) + ';',
      '    }',
      '  }',
      '  return ' + JSON.stringify(fallback) + ';',
      '}'
    ].join('\n');
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    normalizeDomain: normalizeDomain,
    parseDomainList: parseDomainList,
    normalizeHost: normalizeHost,
    normalizePort: normalizePort,
    normalizeConfig: normalizeConfig,
    validate: validate,
    buildPacScript: buildPacScript
  };
})();
