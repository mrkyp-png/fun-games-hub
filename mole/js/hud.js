(function (root) {
  'use strict';

  function update(state) {
    document.getElementById('hud-level').textContent = 'Level ' + state.level;
    document.getElementById('hud-hearts').textContent =
      '❤️'.repeat(state.lives) + '🖤'.repeat(Math.max(0, 3 - state.lives));
    document.getElementById('hud-time').textContent = Math.max(0, Math.ceil(state.timeRemaining)) + '초';
    document.getElementById('hud-combo').textContent =
      state.combo > 0 ? (state.isMaxCombo ? 'MAX COMBO ' : 'COMBO ') + state.combo : '';
    document.getElementById('hud-score').textContent = state.score + '점';
    document.getElementById('hud-region-count').textContent = state.completedRegions + ' / ' + state.regionCount;
  }

  const api = { update };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
