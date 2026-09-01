(function (root) {
  'use strict';

  var S = root.FGH && root.FGH.Settings;
  var I = root.FGH && root.FGH.I18N;

  // 설정 모달 문구 (허브 전용). common.* 는 i18n.js 가 이미 등록해 둔다.
  if (I) I.register({
    ko: {
      'settings.title': '설정', 'settings.sound': '소리', 'settings.music': '배경음악',
      'settings.vibration': '진동', 'settings.lang': '언어',
      'lang.ko': '한국어', 'lang.en': 'English'
    },
    en: {
      'settings.title': 'Settings', 'settings.sound': 'Sound', 'settings.music': 'Music',
      'settings.vibration': 'Vibration', 'settings.lang': 'Language',
      'lang.ko': '한국어', 'lang.en': 'English'
    }
  });

  var SVG = {
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2-1.5.3-2.5-2.4-.9-1-2.3-2.5.5L12 2 9.9 3.8 7.4 3.3l-1 2.3-2.4.9.3 2.5L2 12l2 1.5-.3 2.5 2.4.9 1 2.3 2.5-.5L12 22l2.1-1.8 2.5.5 1-2.3 2.4-.9-.3-2.5z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17V5l10-2v12"/><circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/></svg>',
    vibrate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M3 9v6M21 9v6"/></svg>'
  };

  var mounted = false;

  function toggleRow(key, setName) {
    var on = S.get(setName);
    var ico = (setName === 'sound') ? (on ? SVG.soundOn : SVG.soundOff)
      : (setName === 'music') ? SVG.music : SVG.vibrate;
    return '<div class="fgh-set-row" data-set="' + setName + '">' +
      '<span class="fgh-set-ico">' + ico + '</span>' +
      '<span class="fgh-set-lbl" data-i18n="' + key + '"></span>' +
      '<button class="fgh-set-toggle" aria-pressed="' + on + '" aria-label="' + setName + '"></button>' +
      '</div>';
  }

  function mount() {
    if (mounted || !root.document || !root.document.body) return;
    mounted = true;
    var document = root.document;

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="fgh-topright">' +
        '<button id="fgh-lang-btn" class="fgh-icon-btn" aria-label="Language">' + SVG.globe + '</button>' +
        '<button id="fgh-settings-btn" class="fgh-icon-btn" aria-label="Settings">' + SVG.gear + '</button>' +
      '</div>' +
      '<div id="fgh-lang-menu" hidden>' +
        '<button type="button" data-lang="ko" data-i18n="lang.ko"></button>' +
        '<button type="button" data-lang="en" data-i18n="lang.en"></button>' +
      '</div>' +
      '<div id="fgh-settings-modal" hidden><div id="fgh-settings-card">' +
        '<h2 data-i18n="settings.title"></h2>' +
        toggleRow('settings.sound', 'sound') +
        toggleRow('settings.music', 'music') +
        toggleRow('settings.vibration', 'vibration') +
        '<button id="fgh-settings-close" data-i18n="common.close"></button>' +
      '</div></div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    var langBtn = document.getElementById('fgh-lang-btn');
    var langMenu = document.getElementById('fgh-lang-menu');
    var modal = document.getElementById('fgh-settings-modal');

    function markLang() {
      langMenu.querySelectorAll('[data-lang]').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-lang') === S.get('lang'));
      });
    }
    markLang();

    langBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      langMenu.hidden = !langMenu.hidden;
    });
    langMenu.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        I.setLang(b.getAttribute('data-lang'));
        markLang();
        langMenu.hidden = true;
      });
    });
    document.addEventListener('click', function (e) {
      if (!langMenu.hidden && e.target !== langBtn && !langMenu.contains(e.target)) {
        langMenu.hidden = true;
      }
    });

    document.getElementById('fgh-settings-btn').addEventListener('click', function () { modal.hidden = false; });
    document.getElementById('fgh-settings-close').addEventListener('click', function () { modal.hidden = true; });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

    modal.querySelectorAll('.fgh-set-row').forEach(function (row) {
      var setName = row.getAttribute('data-set');
      row.querySelector('.fgh-set-toggle').addEventListener('click', function () {
        S.set(setName, !S.get(setName));
      });
    });

    // 설정 바뀌면(같은 탭·다른 탭) 토글 상태와 소리 아이콘 갱신
    S.onChange(function (name) {
      var row = modal.querySelector('.fgh-set-row[data-set="' + name + '"]');
      if (!row) return;
      row.querySelector('.fgh-set-toggle').setAttribute('aria-pressed', String(S.get(name)));
      if (name === 'sound') row.querySelector('.fgh-set-ico').innerHTML = S.get('sound') ? SVG.soundOn : SVG.soundOff;
    });

    if (I) I.applyStatic(document);
  }

  var api = { mount: mount };
  if (root) { root.FGH = root.FGH || {}; root.FGH.SettingsUI = api; }
})(typeof window !== 'undefined' ? window : null);
