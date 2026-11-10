/**
 * Geo & Timezone Changer - Native Main World Hook
 * Runs at document_start in world: MAIN to intercept Date, Intl, and Geolocation APIs
 */
(function() {
  'use strict';

  // Try to load cached config from sessionStorage, or use initial build default
  let config = {"enabled":true,"geo":{"latitude":34.0522,"longitude":-118.2437,"accuracy":20,"altitude":null,"altitudeAccuracy":null,"heading":null,"speed":null},"timezone":{"timezone":"America/Los_Angeles","locale":"en-US","offsetMinutes":480,"labelFa":"America/Los_Angeles"}};
  try {
    const cached = sessionStorage.getItem('__GEO_TZ_CONFIG__');
    if (cached) {
      config = JSON.parse(cached);
    }
  } catch (e) {}

  window.__GEO_TZ_CONFIG__ = config;

  // 1. Precise Timezone Offset calculation in minutes (UTC - Local)
  function calcTzOffsetMinutes(tzName, date) {
    try {
      const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
      const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
      const tzStr = d.toLocaleString('en-US', { timeZone: tzName });
      return Math.round((new Date(utcStr).getTime() - new Date(tzStr).getTime()) / 60000);
    } catch (e) {
      return 0;
    }
  }

  // 2. Format Date string matching Chrome V8 native output for Date.prototype.toString()
  function formatTzDateString(date, tzName, mode) {
    try {
      const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
      const offsetMin = calcTzOffsetMinutes(tzName, d);
      const sign = offsetMin <= 0 ? '+' : '-';
      const absMin = Math.abs(offsetMin);
      const offH = String(Math.floor(absMin / 60)).padStart(2, '0');
      const offM = String(absMin % 60).padStart(2, '0');
      const gmtOffset = 'GMT' + sign + offH + offM;

      // Format parts in target timezone
      const formatter = new NativeDateTimeFormat('en-US', {
        timeZone: tzName,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'long',
      });

      const parts = formatter.formatToParts(d);
      const p = {};
      parts.forEach(function(item) { p[item.type] = item.value; });

      const weekday = p.weekday || 'Tue';
      const month = p.month || 'Nov';
      const day = p.day || '10';
      const year = p.year || '2026';
      const hour = p.hour || '00';
      const minute = p.minute || '00';
      const second = p.second || '00';
      const tzLongName = p.timeZoneName || tzName;

      if (mode === 'time') {
        return hour + ':' + minute + ':' + second + ' ' + gmtOffset + ' (' + tzLongName + ')';
      }
      return weekday + ' ' + month + ' ' + day + ' ' + year + ' ' + hour + ':' + minute + ':' + second + ' ' + gmtOffset + ' (' + tzLongName + ')';
    } catch (e) {
      return nativeDateToString.call(date);
    }
  }

  // Backup Native Prototypes
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const nativeResolvedOptions = NativeDateTimeFormat.prototype.resolvedOptions;
  const nativeGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  const nativeDateToString = Date.prototype.toString;
  const nativeDateToTimeString = Date.prototype.toTimeString;
  const nativeDateToLocaleString = Date.prototype.toLocaleString;
  const nativeDateToLocaleDateString = Date.prototype.toLocaleDateString;
  const nativeGetCurrentPosition = navigator.geolocation ? navigator.geolocation.getCurrentPosition.bind(navigator.geolocation) : null;
  const nativeWatchPosition = navigator.geolocation ? navigator.geolocation.watchPosition.bind(navigator.geolocation) : null;
  const nativeClearWatch = navigator.geolocation ? navigator.geolocation.clearWatch.bind(navigator.geolocation) : null;

  // Intercept Intl.DateTimeFormat constructor so websites without explicit options.timeZone receive spoofed timezone
  const DateTimeFormatProxy = function(locales, options) {
    if (!(this instanceof DateTimeFormatProxy)) {
      return new DateTimeFormatProxy(locales, options);
    }
    const opt = options ? Object.assign({}, options) : {};
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      if (!opt.timeZone) {
        opt.timeZone = config.timezone.timezone;
      }
    }
    return new NativeDateTimeFormat(locales, opt);
  };
  DateTimeFormatProxy.prototype = NativeDateTimeFormat.prototype;
  DateTimeFormatProxy.supportedLocalesOf = NativeDateTimeFormat.supportedLocalesOf.bind(NativeDateTimeFormat);
  Intl.DateTimeFormat = DateTimeFormatProxy;

  // Intercept Intl.DateTimeFormat.prototype.resolvedOptions
  NativeDateTimeFormat.prototype.resolvedOptions = function() {
    const orig = nativeResolvedOptions.call(this);
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      return Object.assign({}, orig, {
        timeZone: config.timezone.timezone,
        locale: orig.locale || config.timezone.locale || 'fa-IR',
      });
    }
    return orig;
  };

  // Intercept Date.prototype.getTimezoneOffset
  Date.prototype.getTimezoneOffset = function() {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      return calcTzOffsetMinutes(config.timezone.timezone, this);
    }
    return nativeGetTimezoneOffset.call(this);
  };

  // Intercept Date.prototype.toString
  Date.prototype.toString = function() {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      return formatTzDateString(this, config.timezone.timezone, 'full');
    }
    return nativeDateToString.call(this);
  };

  // Intercept Date.prototype.toTimeString
  Date.prototype.toTimeString = function() {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      return formatTzDateString(this, config.timezone.timezone, 'time');
    }
    return nativeDateToTimeString.call(this);
  };

  // Intercept Date.prototype.toLocaleString
  Date.prototype.toLocaleString = function(locales, options) {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      const opt = Object.assign({}, options);
      if (!opt.timeZone) {
        opt.timeZone = config.timezone.timezone;
      }
      return nativeDateToLocaleString.call(this, locales || config.timezone.locale || 'fa-IR', opt);
    }
    return nativeDateToLocaleString.call(this, locales, options);
  };

  // Intercept Date.prototype.toLocaleDateString
  Date.prototype.toLocaleDateString = function(locales, options) {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      const opt = Object.assign({}, options);
      if (!opt.timeZone) {
        opt.timeZone = config.timezone.timezone;
      }
      return nativeDateToLocaleDateString.call(this, locales || config.timezone.locale || 'fa-IR', opt);
    }
    return nativeDateToLocaleDateString.call(this, locales, options);
  };

  // Intercept Date.prototype.toLocaleTimeString
  Date.prototype.toLocaleTimeString = function(locales, options) {
    if (config && config.enabled && config.timezone && config.timezone.timezone) {
      const opt = Object.assign({}, options);
      if (!opt.timeZone) {
        opt.timeZone = config.timezone.timezone;
      }
      return nativeDateToLocaleTimeString.call(this, locales || config.timezone.locale || 'fa-IR', opt);
    }
    return nativeDateToLocaleTimeString.call(this, locales, options);
  };

  // Standard GeolocationPosition & GeolocationCoordinates Object Creator
  function createFakePosition(g) {
    const lat = parseFloat(g.latitude) || 0;
    const lng = parseFloat(g.longitude) || 0;
    const acc = parseFloat(g.accuracy) || 20;
    const alt = g.altitude !== null && g.altitude !== undefined ? parseFloat(g.altitude) : null;
    const altAcc = g.altitudeAccuracy !== null && g.altitudeAccuracy !== undefined ? parseFloat(g.altitudeAccuracy) : null;

    const coordsProto = window.GeolocationCoordinates ? window.GeolocationCoordinates.prototype : Object.prototype;
    const coords = Object.create(coordsProto);
    Object.defineProperties(coords, {
      latitude: { value: lat, enumerable: true, configurable: true },
      longitude: { value: lng, enumerable: true, configurable: true },
      accuracy: { value: acc, enumerable: true, configurable: true },
      altitude: { value: alt, enumerable: true, configurable: true },
      altitudeAccuracy: { value: altAcc, enumerable: true, configurable: true },
      heading: { value: null, enumerable: true, configurable: true },
      speed: { value: null, enumerable: true, configurable: true },
    });
    coords.toJSON = function() {
      return {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        altitude: alt,
        altitudeAccuracy: altAcc,
        heading: null,
        speed: null,
      };
    };

    const posProto = window.GeolocationPosition ? window.GeolocationPosition.prototype : Object.prototype;
    const pos = Object.create(posProto);
    const now = Date.now();
    Object.defineProperties(pos, {
      coords: { value: coords, enumerable: true, configurable: true },
      timestamp: { value: now, enumerable: true, configurable: true },
    });
    pos.toJSON = function() {
      return { coords: coords.toJSON(), timestamp: now };
    };
    return pos;
  }

  const activeWatches = new Map();
  let watchCounter = 100;

  function fakeGetCurrentPosition(success, error, options) {
    if (!config || !config.enabled || !config.geo) {
      if (nativeGetCurrentPosition) return nativeGetCurrentPosition.call(this, success, error, options);
      return;
    }
    const pos = createFakePosition(config.geo);
    setTimeout(function() {
      if (typeof success === 'function') {
        try {
          success(pos);
        } catch (e) {
          console.error('[GeoTime] Error in success callback:', e);
        }
      }
    }, 10);
  }

  function fakeWatchPosition(success, error, options) {
    if (!config || !config.enabled || !config.geo) {
      if (nativeWatchPosition) return nativeWatchPosition.call(this, success, error, options);
      return 0;
    }
    const id = watchCounter++;
    fakeGetCurrentPosition.call(this, success, error, options);
    const interval = window.setInterval(function() {
      if (config && config.enabled && config.geo) {
        fakeGetCurrentPosition.call(this, success, error, options);
      }
    }, 3000);
    activeWatches.set(id, interval);
    return id;
  }

  function fakeClearWatch(id) {
    if (activeWatches.has(id)) {
      window.clearInterval(activeWatches.get(id));
      activeWatches.delete(id);
      return;
    }
    if (nativeClearWatch) {
      try {
        nativeClearWatch.call(this, id);
      } catch (e) {}
    }
  }

  // Override on window.Geolocation.prototype (Crucial for Google Maps Closure Compiler bindings!)
  if (window.Geolocation && window.Geolocation.prototype) {
    window.Geolocation.prototype.getCurrentPosition = fakeGetCurrentPosition;
    window.Geolocation.prototype.watchPosition = fakeWatchPosition;
    window.Geolocation.prototype.clearWatch = fakeClearWatch;
  }

  // Override on navigator.geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = fakeGetCurrentPosition;
    navigator.geolocation.watchPosition = fakeWatchPosition;
    navigator.geolocation.clearWatch = fakeClearWatch;
  }

  // Override on navigator.permissions.query for geolocation
  if (navigator.permissions && navigator.permissions.query) {
    const nativePermQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(param) {
      if (config && config.enabled && param && param.name === 'geolocation') {
        const status = Object.create(EventTarget.prototype);
        Object.defineProperties(status, {
          state: { value: 'granted', enumerable: true },
          name: { value: 'geolocation', enumerable: true },
          onchange: { value: null, writable: true },
        });
        return Promise.resolve(status);
      }
      return nativePermQuery(param);
    };
  }

  // Update handler from content.js or postMessage
  function updateConfig(newConfig) {
    if (!newConfig) return;
    config = newConfig;
    window.__GEO_TZ_CONFIG__ = newConfig;
    try {
      sessionStorage.setItem('__GEO_TZ_CONFIG__', JSON.stringify(newConfig));
    } catch (e) {}
  }

  window.addEventListener('__GEO_TZ_UPDATE__', function(e) {
    if (e.detail) updateConfig(e.detail);
  });

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === '__GEO_TZ_CONFIG_MSG__' && e.data.config) {
      updateConfig(e.data.config);
    }
  });
})();
