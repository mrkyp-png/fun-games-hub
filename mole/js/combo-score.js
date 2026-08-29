(function (root) {
  'use strict';

  // 기획서 §12 콤보 점수표: 임의 변경 금지.
  function comboToPoints(combo) {
    if (combo <= 0) return 0;
    if (combo === 1) return 100;
    if (combo === 2) return 120;
    if (combo === 3) return 140;
    if (combo === 4) return 160;
    return 200; // 5콤보 이상
  }

  function create() {
    let combo = 0;
    let score = 0;

    function onMoleHit() {
      combo += 1;
      score += comboToPoints(combo);
    }

    function onObstacleHit() {
      combo = 0;
    }

    function isMaxCombo() {
      return combo >= 5;
    }

    return {
      onMoleHit,
      onObstacleHit,
      isMaxCombo,
      get combo() { return combo; },
      get score() { return score; }
    };
  }

  // 기획서 §15: 클리어 시 남은 목숨 기준 별 등급 (Claude 결정치, 사용자 확정).
  function computeStars(remainingLives, maxLives) {
    const lost = maxLives - remainingLives;
    if (lost <= 0) return 3;
    if (lost === 1) return 2;
    return 1;
  }

  const api = { create, comboToPoints, computeStars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ComboScore = api; }
})(typeof window !== 'undefined' ? window : null);
