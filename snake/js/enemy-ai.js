(function (root) {
  'use strict';

  // 스펙 §19: "복잡한 추적 AI 금지, 랜덤 이동 + 일정 시간마다 방향 전환"만 구현.
  // 향후 추적 AI를 얹을 수 있도록 update()가 항상 최신 방향을 반환하는 형태로 구조화.
  function randomDirection(rng) {
    const angle = rng() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function create(opts) {
    const rng = opts.rng;
    const minI = opts.changeIntervalMin != null ? opts.changeIntervalMin : 1.2;
    const maxI = opts.changeIntervalMax != null ? opts.changeIntervalMax : 2.5;

    let direction = randomDirection(rng);
    let timeUntilChange = minI + rng() * (maxI - minI);

    return {
      update(dt) {
        timeUntilChange -= dt;
        if (timeUntilChange <= 0) {
          direction = randomDirection(rng);
          timeUntilChange = minI + rng() * (maxI - minI);
        }
        return direction;
      },
      getDirection() { return direction; }
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.EnemyAI = api; }
})(typeof window !== 'undefined' ? window : null);
