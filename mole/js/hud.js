(function (root) {
  'use strict';

  // 현재 모드 제목 — 모드 추가 시 이 값만 바꾸거나 모드 시스템이 세팅한다.
  var MODE_TITLE = '두더지만 때려잡자!';

  function setAll(cls, text) {
    var els = document.querySelectorAll('#hud-ticker .' + cls);
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function update(state) {
    setAll('tk-mode', MODE_TITLE);
    setAll('tk-lv', 'Level ' + state.level);
    setAll('tk-t', Math.max(0, Math.ceil(state.timeRemaining)) + '초');
    setAll('tk-c', state.combo > 0
      ? (state.isMaxCombo ? 'MAX COMBO ' : 'COMBO ') + state.combo
      : 'COMBO 0');
    setAll('tk-r', state.completedRegions + ' / ' + state.regionCount);

    var score = document.getElementById('hud-score');
    if (score) score.textContent = (state.score || 0).toLocaleString();

    var hearts = document.getElementById('hud-hearts');
    if (hearts) {
      hearts.textContent = '❤️'.repeat(state.lives) +
        '🖤'.repeat(Math.max(0, 3 - state.lives));
    }
  }

  var api = { update: update, MODE_TITLE: MODE_TITLE };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
