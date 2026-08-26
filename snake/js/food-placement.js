(function (root) {
  'use strict';

  function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }

  // 스펙 §11~12: 맵 전체에 분산, 먹이끼리 최소거리, 시작지점/적 시작지점과 최소거리를
  // 만족하는 위치를 거부표본추출(rejection sampling)로 찾는다. maxAttemptsPerFood 안에
  // 못 찾으면(고레벨에서 먹이 65개+적 10마리로 공간이 빡빡할 때) 최소거리 조건을 포기하고
  // 그냥 배치 — 먹이 "개수"가 스펙과 어긋나는 것이 최소거리 미세 위반보다 나쁜 실패이므로.
  function placeFood(opts) {
    const {
      count, mapWidth, mapHeight, playerStart, enemyStarts, rng,
      margin = 50, minFoodDistance = 70, minPlayerStartDistance = 150, minEnemyDistance = 120
    } = opts;

    const foods = [];
    const maxAttemptsPerFood = 200;

    for (let i = 0; i < count; i++) {
      let placed = null;
      for (let attempt = 0; attempt < maxAttemptsPerFood; attempt++) {
        const x = margin + rng() * Math.max(1, mapWidth - margin * 2);
        const y = margin + rng() * Math.max(1, mapHeight - margin * 2);
        if (dist(x, y, playerStart.x, playerStart.y) < minPlayerStartDistance) continue;
        if (enemyStarts.some((e) => dist(x, y, e.x, e.y) < minEnemyDistance)) continue;
        if (foods.some((f) => dist(x, y, f.x, f.y) < minFoodDistance)) continue;
        placed = { x, y };
        break;
      }
      if (!placed) {
        placed = {
          x: margin + rng() * Math.max(1, mapWidth - margin * 2),
          y: margin + rng() * Math.max(1, mapHeight - margin * 2)
        };
      }
      foods.push(placed);
    }
    return foods;
  }

  const api = { placeFood };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.FoodPlacement = api; }
})(typeof window !== 'undefined' ? window : null);
