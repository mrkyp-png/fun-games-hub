(function (root) {
  'use strict';

  var Settings = root && root.FGH && root.FGH.Settings;
  if (typeof module !== 'undefined' && module.exports && !Settings) {
    Settings = require('./settings.js').Settings;
  }

  var DICT = { ko: {}, en: {} };

  function register(dict) {
    ['ko', 'en'].forEach(function (l) {
      if (dict && dict[l]) {
        for (var k in dict[l]) DICT[l][k] = dict[l][k];
      }
    });
  }

  // 모든 화면 공통 문구 — i18n.js 는 허브·게임 어디서나 로드되므로 여기 둔다.
  // (허브 전용인 settings.*/lang.* 는 settings-ui.js 가 등록한다.)
  register({
    ko: { 'common.close': '닫기', 'common.toHub': '허브로', 'common.back': '나가기', 'common.retry': '다시하기' },
    en: { 'common.close': 'Close', 'common.toHub': 'Hub', 'common.back': 'Exit', 'common.retry': 'Retry' }
  });

  function currentLang() { return Settings ? Settings.get('lang') : 'en'; }

  function t(key, vars) {
    var l = currentLang();
    var s = (DICT[l] && DICT[l][key]);
    if (s == null) s = (DICT.en && DICT.en[key]);
    if (s == null) s = key;
    if (vars) {
      for (var name in vars) s = s.split('{' + name + '}').join(String(vars[name]));
    }
    return s;
  }

  function applyStatic(rootEl) {
    rootEl = rootEl || (root && root.document);
    if (!rootEl || !rootEl.querySelectorAll) return;
    rootEl.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    rootEl.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  var subs = [];
  function onChange(cb) {
    subs.push(cb);
    return function () { var i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
  }
  function fireChange(l) {
    subs.slice().forEach(function (cb) { try { cb(l); } catch (e) { /* 격리 */ } });
  }

  function setLang(l) {
    if (Settings) {
      // Settings.set → 아래 onChange 구독이 applyStatic + fireChange 를 한 번만 돌린다.
      Settings.set('lang', l);
    } else {
      applyStatic();
      fireChange(currentLang());
    }
  }

  // 언어가 바뀌면(setLang, 또는 다른 탭의 storage 이벤트) 화면을 다시 칠하고 구독자에 통지.
  if (Settings && Settings.onChange) {
    Settings.onChange(function (name, value) {
      if (name !== 'lang') return;
      applyStatic();
      fireChange(value);
    });
  }

  var api = {
    t: t, register: register, setLang: setLang, applyStatic: applyStatic, onChange: onChange,
    get lang() { return currentLang(); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { I18N: api };
  if (root) { root.FGH = root.FGH || {}; root.FGH.I18N = api; }
})(typeof window !== 'undefined' ? window : null);
