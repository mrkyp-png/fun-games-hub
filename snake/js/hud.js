(function (root) {
  'use strict';

  function update(state) {
    const levelEl = document.getElementById('hud-level');
    const heartsEl = document.getElementById('hud-hearts');
    const foodEl = document.getElementById('hud-food-count');

    levelEl.textContent = 'Level ' + state.level;
    heartsEl.textContent = '❤️'.repeat(state.hearts) + '🖤'.repeat(Math.max(0, 3 - state.hearts));
    foodEl.textContent = state.foodCollected + ' / ' + state.foodCount;
  }

  const api = { update };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
