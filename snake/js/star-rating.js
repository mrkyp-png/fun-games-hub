(function (root) {
  'use strict';

  // 스펙 §29: 클리어=⭐1, 충돌 1회 이하=⭐2, 충돌 0회=⭐3.
  function computeStars(collisions) {
    if (collisions === 0) return 3;
    if (collisions <= 1) return 2;
    return 1;
  }

  const api = { computeStars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.StarRating = api; }
})(typeof window !== 'undefined' ? window : null);
