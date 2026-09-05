(function (root) {
  'use strict';

  function setAll(cls, text) {
    var els = document.querySelectorAll('#hud-ticker .' + cls);
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function update(state) {
    var I = window.FGH.I18N;
    setAll('tk-mode', I.t('mole.mode'));
    // 티커의 "두더지팡" 뒤에 이어지는 게임 팁 — 계속 추가될 예정, tk-tip{n} 패턴으로 늘려간다.
    setAll('tk-tip1', I.t('mole.tip.juggle'));
    setAll('tk-tip2', I.t('mole.tip.maxCombo'));

    var score = document.getElementById('hud-score');
    if (score) score.textContent = (state.score || 0).toLocaleString();

    var hearts = document.getElementById('hud-hearts');
    if (hearts) {
      hearts.textContent = '❤️'.repeat(state.lives) +
        '🖤'.repeat(Math.max(0, 3 - state.lives));
    }

    // 시간 = 홈버튼(⊞) 중앙 숫자로 표기 ("초" 단위 생략).
    var timer = document.getElementById('hud-timer');
    if (timer) timer.textContent = String(Math.max(0, Math.ceil(state.timeRemaining)));

    // 콤보 = 게임화면 하단 중앙(하트가 있는 줄)에 표기. 0이면 표시 안 함.
    var combo = document.getElementById('hud-combo');
    if (combo) {
      combo.textContent = state.combo > 0
        ? I.t(state.isMaxCombo ? 'mole.hud.maxCombo' : 'mole.hud.combo', { n: state.combo })
        : '';
    }
  }

  var api = { update: update };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
