/* 3D 홈 상태 제어기 (설계: 03_공용홈_아키텍처.md §6, 06_홈광장_설계.md §3).
   INTRO(땅속 첫 장면) / EXPLORE(광장) / FEATURE(기존 기능 화면·라운드 지도) / GAMEPLAY(게임). */
(function (root) {
  'use strict';
  // 광장 건물·사물 9개 + 톱니바퀴(settings)
  const ACTIONS = ['lightMode', 'rhythm', 'shop', 'locker', 'inventory', 'score', 'mail', 'daily', 'quest', 'settings'];

  function create(opts) {
    const o = opts || {};
    let saved = null;
    const h = { state: null, feature: null };
    function go(next) {
      if (h.state) o.onLeave && o.onLeave(h.state);
      h.state = next;
      o.onEnter && o.onEnter(next);
      return true;
    }
    h.boot = () => { h.feature = null; return go('INTRO'); };
    h.introDone = () => h.state === 'INTRO' && go('EXPLORE');
    h.openFeature = (action) => {
      if (h.state !== 'EXPLORE' || !ACTIONS.includes(action)) return false;
      h.feature = action;
      return go('FEATURE');
    };
    h.gameStarted = () => h.state !== 'GAMEPLAY' && (h.feature = null, go('GAMEPLAY'));
    h.homeShown = () => {
      if (h.state !== 'FEATURE' && h.state !== 'GAMEPLAY') return false;
      h.feature = null;
      return go('EXPLORE');
    };
    h.inputEnabled = () => h.state === 'EXPLORE';
    h.saveView = (v) => { saved = Object.assign({}, v); };
    h.view = () => (saved ? Object.assign({}, saved) : null);
    return h;
  }

  const api = { create, ACTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.MoleGame = root.MoleGame || {}; root.MoleGame.Home3DState = api; }
})(typeof window !== 'undefined' ? window : globalThis);
