// Background Service Worker
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
