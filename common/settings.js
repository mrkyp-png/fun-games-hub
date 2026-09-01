(function (root) {
  'use strict';

  // 설정 단일 소스. 색칠앱과 저장키를 통일한다(appLang/soundOn/musicOn/vibrationOn).
  // 같은 origin(mrkyp-png.github.io)이라 배포된 색칠앱과도 설정이 공유된다 — 의도된 동작.
  var KEYS = { lang: 'appLang', sound: 'soundOn', music: 'musicOn', vibration: 'vibrationOn' };
  var BOOL_DEFAULT = { sound: true, music: false, vibration: true };

  function ls() { return root && root.localStorage ? root.localStorage : null; }
  function nav() { return root && root.navigator ? root.navigator : null; }

  function detectLang() {
    var n = nav();
    var l = (n && (n.language || (n.languages && n.languages[0]))) || 'en';
    return /^ko/i.test(l) ? 'ko' : 'en';
  }

  function get(name) {
    if (name === 'lang') {
      var v = ls() && ls().getItem(KEYS.lang);
      return (v === 'ko' || v === 'en') ? v : detectLang();
    }
    if (!(name in BOOL_DEFAULT)) return undefined;
    var raw = ls() && ls().getItem(KEYS[name]);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return BOOL_DEFAULT[name];
  }

  var subs = [];
  function notify(name, value) {
    subs.slice().forEach(function (cb) { try { cb(name, value); } catch (e) { /* 구독자 예외 격리 */ } });
  }

  function set(name, value) {
    if (name === 'lang') {
      var l = (value === 'ko') ? 'ko' : 'en';
      if (ls()) ls().setItem(KEYS.lang, l);
      notify('lang', l);
      return;
    }
    if (!(name in BOOL_DEFAULT)) return;
    var b = !!value;
    if (ls()) ls().setItem(KEYS[name], b ? '1' : '0');
    notify(name, b);
  }

  function onChange(cb) {
    subs.push(cb);
    return function () {
      var i = subs.indexOf(cb);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  // 다른 탭/창에서 바뀌면 storage 이벤트로 들어온다 (허브에서 바꾸고 게임 탭이 열려 있을 때).
  if (root && root.addEventListener) {
    root.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      for (var name in KEYS) {
        if (KEYS[name] === e.key) { notify(name, get(name)); return; }
      }
    });
  }

  function vibrate(pattern) {
    if (!get('vibration')) return;
    var n = nav();
    if (n && n.vibrate) { try { n.vibrate(pattern); } catch (e) { /* noop */ } }
  }

  function sfxEnabled() { return get('sound'); }

  var api = { get: get, set: set, onChange: onChange, vibrate: vibrate, sfxEnabled: sfxEnabled, KEYS: KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Settings: api };
  if (root) { root.FGH = root.FGH || {}; root.FGH.Settings = api; }
})(typeof window !== 'undefined' ? window : null);
