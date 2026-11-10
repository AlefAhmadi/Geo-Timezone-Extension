// Content script bridging chrome.storage.local to MAIN world
(function() {
  'use strict';

  function forwardConfig(config) {
    try {
      window.dispatchEvent(new CustomEvent('__GEO_TZ_UPDATE__', { detail: config }));
      window.postMessage({ type: '__GEO_TZ_CONFIG_MSG__', config: config }, '*');
    } catch (e) {}
  }

  // Load from extension storage
  chrome.storage.local.get(['geoTzConfig'], function(data) {
    if (data && data.geoTzConfig) {
      forwardConfig(data.geoTzConfig);
    }
  });

  // Listen to runtime changes from popup
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.geoTzConfig && changes.geoTzConfig.newValue) {
      forwardConfig(changes.geoTzConfig.newValue);
    }
  });

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg && msg.type === '__GEO_TZ_UPDATE__' && msg.config) {
      forwardConfig(msg.config);
    }
  });
})();
