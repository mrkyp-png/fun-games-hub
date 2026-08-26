(function (root) {
  'use strict';

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // 스펙 §7: 플레이어를 따라가되 "화면이 흔들리는 느낌"이 없도록 부드럽게(lerp) 추적.
  function create(opts) {
    const { mapWidth, mapHeight, viewWidth, viewHeight } = opts;
    const smoothing = opts.smoothing != null ? opts.smoothing : 0.12;
    let x = clamp(0, 0, Math.max(0, mapWidth - viewWidth));
    let y = clamp(0, 0, Math.max(0, mapHeight - viewHeight));

    return {
      update(targetX, targetY) {
        const desiredX = clamp(targetX - viewWidth / 2, 0, Math.max(0, mapWidth - viewWidth));
        const desiredY = clamp(targetY - viewHeight / 2, 0, Math.max(0, mapHeight - viewHeight));
        x += (desiredX - x) * smoothing;
        y += (desiredY - y) * smoothing;
        return { x, y };
      },
      getPosition() { return { x, y }; }
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Camera = api; }
})(typeof window !== 'undefined' ? window : null);
