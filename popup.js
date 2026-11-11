// City presets and timezones data
const PRESETS = [{"id":"tehran","nameFa":"تهران","nameEn":"Tehran","countryFa":"ایران","countryEn":"Iran","flag":"🇮🇷","latitude":35.6892,"longitude":51.389,"timezone":"Asia/Tehran","locale":"fa-IR","offsetMinutes":-210,"descriptionFa":"پایتخت ایران - UTC+03:30"},{"id":"new_york","nameFa":"نیویورک (شرق آمریکا)","nameEn":"New York (East Coast)","countryFa":"ایالات متحده آمریکا","countryEn":"United States","flag":"🇺🇸","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York","locale":"en-US","offsetMinutes":300,"descriptionFa":"شرق ایالات متحده (EST) - ساحل آتلانتیک"},{"id":"los_angeles","nameFa":"لس‌آنجلس (غرب آمریکا)","nameEn":"Los Angeles (West Coast)","countryFa":"ایالات متحده آمریکا","countryEn":"United States","flag":"🇺🇸","latitude":34.0522,"longitude":-118.2437,"timezone":"America/Los_Angeles","locale":"en-US","offsetMinutes":480,"descriptionFa":"غرب ایالات متحده (PST) - ساحل اقیانوس آرام (کالیفرنیا)"},{"id":"amsterdam","nameFa":"آمستردام (هلند)","nameEn":"Amsterdam (Netherlands)","countryFa":"هلند","countryEn":"Netherlands","flag":"🇳🇱","latitude":52.3676,"longitude":4.9041,"timezone":"Europe/Amsterdam","locale":"nl-NL","offsetMinutes":-60,"descriptionFa":"هلند - اروپای غربی (CET)"},{"id":"helsinki","nameFa":"هلسینکی (فنلاند)","nameEn":"Helsinki (Finland)","countryFa":"فنلاند","countryEn":"Finland","flag":"🇫🇮","latitude":60.1699,"longitude":24.9384,"timezone":"Europe/Helsinki","locale":"fi-FI","offsetMinutes":-120,"descriptionFa":"فنلاند - شمال اروپا و حوزه بالتیک (EET)"},{"id":"london","nameFa":"لندن","nameEn":"London","countryFa":"بریتانیا","countryEn":"United Kingdom","flag":"🇬🇧","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London","locale":"en-GB","offsetMinutes":0,"descriptionFa":"بریتانیا - مبدا گرینویچ (UTC±0)"},{"id":"berlin","nameFa":"برلین","nameEn":"Berlin","countryFa":"آلمان","countryEn":"Germany","flag":"🇩🇪","latitude":52.52,"longitude":13.405,"timezone":"Europe/Berlin","locale":"de-DE","offsetMinutes":-60,"descriptionFa":"آلمان - اروپای مرکزی"},{"id":"paris","nameFa":"پاریس","nameEn":"Paris","countryFa":"فرانسه","countryEn":"France","flag":"🇫🇷","latitude":48.8566,"longitude":2.3522,"timezone":"Europe/Paris","locale":"fr-FR","offsetMinutes":-60,"descriptionFa":"فرانسه - پایتخت روشنایی"},{"id":"istanbul","nameFa":"استانبول","nameEn":"Istanbul","countryFa":"ترکیه","countryEn":"Turkey","flag":"🇹🇷","latitude":41.0082,"longitude":28.9784,"timezone":"Europe/Istanbul","locale":"tr-TR","offsetMinutes":-180,"descriptionFa":"ترکیه - منطقه زمانی UTC+3"},{"id":"dubai","nameFa":"دبی","nameEn":"Dubai","countryFa":"امارات متحده عربی","countryEn":"United Arab Emirates","flag":"🇦🇪","latitude":25.2048,"longitude":55.2708,"timezone":"Asia/Dubai","locale":"en-AE","offsetMinutes":-240,"descriptionFa":"امارات - خلیج فارس"},{"id":"tokyo","nameFa":"توکیو","nameEn":"Tokyo","countryFa":"ژاپن","countryEn":"Japan","flag":"🇯🇵","latitude":35.6762,"longitude":139.6503,"timezone":"Asia/Tokyo","locale":"ja-JP","offsetMinutes":-540,"descriptionFa":"ژاپن - شرق آسیا"},{"id":"sydney","nameFa":"سیدنی","nameEn":"Sydney","countryFa":"استرالیا","countryEn":"Australia","flag":"🇦🇺","latitude":-33.8688,"longitude":151.2093,"timezone":"Australia/Sydney","locale":"en-AU","offsetMinutes":-660,"descriptionFa":"استرالیا - قاره اقیانوسیه"}];
const TIMEZONES = ["Africa/Cairo","Africa/Johannesburg","America/Chicago","America/Denver","America/Los_Angeles","America/New_York","America/Phoenix","America/Sao_Paulo","America/Toronto","America/Vancouver","Asia/Bangkok","Asia/Dubai","Asia/Hong_Kong","Asia/Jakarta","Asia/Jerusalem","Asia/Kolkata","Asia/Riyadh","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Tehran","Asia/Tokyo","Australia/Melbourne","Australia/Sydney","Europe/Amsterdam","Europe/Berlin","Europe/Dublin","Europe/Helsinki","Europe/Istanbul","Europe/London","Europe/Madrid","Europe/Moscow","Europe/Paris","Europe/Rome","Europe/Stockholm","Europe/Vienna","Europe/Warsaw","Pacific/Auckland","Pacific/Honolulu","UTC"];

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusBadge = document.getElementById('statusBadge');
  const presetsGrid = document.getElementById('presetsGrid');
  const tzSelect = document.getElementById('tzSelect');
  const latInput = document.getElementById('latInput');
  const lngInput = document.getElementById('lngInput');
  const saveBtn = document.getElementById('saveBtn');
  const reloadTabBtn = document.getElementById('reloadTabBtn');
  const clockDisplay = document.getElementById('clockDisplay');
  const tzNameBadge = document.getElementById('tzNameBadge');

  let currentConfig = {"enabled":true,"geo":{"latitude":34.0522,"longitude":-118.2437,"accuracy":20,"altitude":null,"altitudeAccuracy":null,"heading":null,"speed":null},"timezone":{"timezone":"America/Los_Angeles","locale":"en-US","offsetMinutes":480,"labelFa":"America/Los_Angeles"}};

  // Populate Presets Grid
  PRESETS.forEach(function(city) {
    const btn = document.createElement('button');
    btn.className = 'preset-chip';
    btn.innerHTML = city.flag + ' ' + city.nameFa;
    btn.title = city.nameFa + ' - ' + city.timezone;
    btn.addEventListener('click', function() {
      selectCity(city);
    });
    presetsGrid.appendChild(btn);
  });

  // Populate Timezones Select
  TIMEZONES.forEach(function(tz) {
    const opt = document.createElement('option');
    opt.value = tz;
    opt.textContent = tz;
    tzSelect.appendChild(opt);
  });

  // Load from chrome.storage
  chrome.storage.local.get(['geoTzConfig'], function(data) {
    if (data && data.geoTzConfig) {
      currentConfig = data.geoTzConfig;
      latInput.value = currentConfig.geo.latitude;
      lngInput.value = currentConfig.geo.longitude;
      tzSelect.value = currentConfig.timezone.timezone;
      tzNameBadge.textContent = currentConfig.timezone.timezone;
      updateToggleUI(currentConfig.enabled);
      highlightActivePreset();
    }
  });

  function selectCity(city) {
    latInput.value = city.latitude;
    lngInput.value = city.longitude;
    tzSelect.value = city.timezone;
    tzNameBadge.textContent = city.timezone;

    currentConfig.geo.latitude = city.latitude;
    currentConfig.geo.longitude = city.longitude;
    currentConfig.timezone.timezone = city.timezone;
    currentConfig.timezone.locale = city.locale;
    currentConfig.timezone.offsetMinutes = city.offsetMinutes;

    highlightActivePreset();
    saveData();
    saveBtn.textContent = 'تنظیم شد به ' + city.nameFa + ' ✓';
    setTimeout(function() { saveBtn.textContent = 'ذخیره و اعمال در مرورگر ✓'; }, 1500);
  }

  function highlightActivePreset() {
    const chips = presetsGrid.querySelectorAll('.preset-chip');
    chips.forEach(function(c, i) {
      const city = PRESETS[i];
      if (city && Math.abs(city.latitude - parseFloat(latInput.value)) < 0.1 && Math.abs(city.longitude - parseFloat(lngInput.value)) < 0.1) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  function updateToggleUI(isEnabled) {
    if (isEnabled) {
      toggleBtn.classList.add('active');
      statusBadge.className = 'status-badge on';
      statusBadge.textContent = 'ON فعال';
    } else {
      toggleBtn.classList.remove('active');
      statusBadge.className = 'status-badge off';
      statusBadge.textContent = 'OFF غیرفعال';
    }
  }

  toggleBtn.addEventListener('click', function() {
    currentConfig.enabled = !toggleBtn.classList.contains('active');
    updateToggleUI(currentConfig.enabled);
    saveData();
  });

  tzSelect.addEventListener('change', function() {
    currentConfig.timezone.timezone = tzSelect.value;
    tzNameBadge.textContent = tzSelect.value;
    saveData();
  });

  saveBtn.addEventListener('click', function() {
    currentConfig.geo.latitude = parseFloat(latInput.value) || 0;
    currentConfig.geo.longitude = parseFloat(lngInput.value) || 0;
    currentConfig.timezone.timezone = tzSelect.value;
    saveData();
    saveBtn.textContent = 'اعمال شد ✓';
    setTimeout(function() { saveBtn.textContent = 'ذخیره و اعمال در مرورگر ✓'; }, 1500);
  });

  // Open GitHub links in a new browser tab
  document.querySelectorAll('.github-btn, .github-link').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      const url = this.getAttribute('href');
      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
  });

  // Reload current active tab so sites re-render immediately
  reloadTabBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });

  function saveData() {
    chrome.storage.local.set({ geoTzConfig: currentConfig });
    // Broadcast to open tabs
    chrome.tabs.query({}, function(tabs) {
      if (tabs) {
        tabs.forEach(function(tab) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: '__GEO_TZ_UPDATE__',
              config: currentConfig
            }, function() {
              if (chrome.runtime.lastError) {}
            });
          }
        });
      }
    });
  }

  // ---- Advanced Options Accordion & Proxy (kill switch) ----
  const advancedToggle = document.getElementById('advancedToggle');
  const advancedContent = document.getElementById('advancedContent');
  const proxyActiveBadge = document.getElementById('proxyActiveBadge');

  if (advancedToggle && advancedContent) {
    advancedToggle.addEventListener('click', function() {
      const isHidden = advancedContent.style.display === 'none';
      advancedContent.style.display = isHidden ? 'block' : 'none';
      advancedToggle.classList.toggle('open', isHidden);
    });
  }

  function updateProxyBadge(enabled) {
    if (proxyActiveBadge) {
      proxyActiveBadge.style.display = enabled ? 'inline-block' : 'none';
    }
  }

  const proxyToggleBtn = document.getElementById('proxyToggleBtn');
  const proxyDomains = document.getElementById('proxyDomains');
  const proxyScheme = document.getElementById('proxyScheme');
  const proxyHost = document.getElementById('proxyHost');
  const proxyPort = document.getElementById('proxyPort');
  const proxyOthers = document.getElementById('proxyOthers');
  const proxySaveBtn = document.getElementById('proxySaveBtn');
  const proxyStatus = document.getElementById('proxyStatus');

  const PROXY_ERRORS = {
    no_domains: 'برای فعال‌سازی، حداقل یک دامنه وارد کنید.',
    bad_host: 'آدرس پراکسی معتبر نیست.',
    bad_port: 'پورت باید عددی بین 1 تا 65535 باشد.'
  };

  function showProxyStatus(kind, text) {
    proxyStatus.className = 'proxy-status ' + kind;
    proxyStatus.textContent = text;
  }

  function fillProxyForm(cfg) {
    proxyDomains.value = cfg.domains.join('\n');
    proxyScheme.value = cfg.scheme;
    proxyHost.value = cfg.host || SiteProxy.DEFAULT_CONFIG.host;
    proxyPort.value = cfg.port || SiteProxy.DEFAULT_CONFIG.port;
    proxyOthers.value = cfg.others;
    proxyToggleBtn.classList.toggle('active', cfg.enabled);
    updateProxyBadge(cfg.enabled);
  }

  // Confirms that Chrome really handed the proxy settings to this extension
  function reportProxyControl(cfg) {
    if (!cfg.enabled) {
      showProxyStatus('off', 'غیرفعال است؛ تنظیمات پراکسی مرورگر دست‌نخورده می‌ماند.');
      return;
    }
    chrome.proxy.settings.get({ incognito: false }, function(details) {
      const level = details && details.levelOfControl;
      if (level === 'controlled_by_this_extension') {
        showProxyStatus('ok', 'فعال است: ' + cfg.domains.length + ' دامنه فقط از پراکسی ' + cfg.host + ':' + cfg.port + ' عبور می‌کنند.');
      } else if (level === 'controlled_by_other_extensions') {
        showProxyStatus('err', 'اعمال نشد: افزونه دیگری تنظیمات پراکسی مرورگر را در دست دارد. آن را غیرفعال کنید.');
      } else {
        showProxyStatus('err', 'اعمال نشد: مرورگر اجازه تغییر تنظیمات پراکسی را به این افزونه نداد.');
      }
    });
  }

  // Reads the form, validates it and stores it. background.js applies the stored config.
  function saveProxy(wantEnabled) {
    const parsed = SiteProxy.parseDomainList(proxyDomains.value);
    if (parsed.invalid.length) {
      showProxyStatus('err', 'دامنه نامعتبر: ' + parsed.invalid.slice(0, 3).join(' ، '));
      return false;
    }
    const cfg = SiteProxy.normalizeConfig({
      enabled: wantEnabled,
      domains: parsed.domains,
      scheme: proxyScheme.value,
      host: proxyHost.value,
      port: proxyPort.value,
      others: proxyOthers.value
    });
    const error = SiteProxy.validate(cfg);
    // An incomplete form may still be stored while the feature is off
    if (error && (wantEnabled || error !== 'no_domains')) {
      showProxyStatus('err', PROXY_ERRORS[error]);
      return false;
    }
    const data = {};
    data[SiteProxy.STORAGE_KEY] = cfg;
    chrome.storage.local.set(data, function() {
      fillProxyForm(cfg);
      // background.js reacts to the storage change; give it a moment before checking
      setTimeout(function() { reportProxyControl(cfg); }, 400);
    });
    return true;
  }

  chrome.storage.local.get([SiteProxy.STORAGE_KEY], function(data) {
    const cfg = SiteProxy.normalizeConfig(data && data[SiteProxy.STORAGE_KEY]);
    fillProxyForm(cfg);
    reportProxyControl(cfg);
  });

  proxyToggleBtn.addEventListener('click', function() {
    saveProxy(!proxyToggleBtn.classList.contains('active'));
  });

  proxySaveBtn.addEventListener('click', function() {
    if (saveProxy(proxyToggleBtn.classList.contains('active'))) {
      proxySaveBtn.textContent = 'ذخیره شد ✓';
      setTimeout(function() { proxySaveBtn.textContent = 'ذخیره تنظیمات پراکسی ✓'; }, 1500);
    }
  });

  // Live Clock Updater
  setInterval(function() {
    try {
      const tz = tzSelect.value || 'Asia/Tehran';
      const timeStr = new Intl.DateTimeFormat('fa-IR', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date());
      clockDisplay.textContent = timeStr;
    } catch (e) {
      clockDisplay.textContent = new Date().toLocaleTimeString();
    }
  }, 1000);
});
