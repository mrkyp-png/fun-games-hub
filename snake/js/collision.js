(function (root) {
  'use strict';

  function circleHit(x1, y1, x2, y2, radius) {
    return Math.hypot(x1 - x2, y1 - y2) < radius;
  }

  // 스펙 §21.1: 플레이어 머리 vs 적 지렁이 몸 전체(세그먼트 배열) 중 하나라도 겹치면 충돌.
  function checkPlayerEnemyCollision(playerHead, enemySegments, radius) {
    return enemySegments.some((seg) => circleHit(playerHead.x, playerHead.y, seg.x, seg.y, radius));
  }

  // 스펙 §21.2: 자기 몸통과 충돌. 머리 바로 뒤 skipCount칸은 물리적으로 항상 가까이 있으므로
  // (몸통이 머리를 그대로 따라오는 구조 특성상) 판정에서 제외 — 안 그러면 가만히 있어도 충돌 처리됨.
  function checkSelfCollision(playerHead, playerSegments, radius, skipCount) {
    const skip = skipCount != null ? skipCount : 4;
    for (let i = skip; i < playerSegments.length; i++) {
      if (circleHit(playerHead.x, playerHead.y, playerSegments[i].x, playerSegments[i].y, radius)) {
        return true;
      }
    }
    return false;
  }

  // 스펙 §21.3: 맵 경계와 충돌.
  function checkBoundaryCollision(x, y, mapWidth, mapHeight, margin) {
    const m = margin || 0;
    return x < m || y < m || x > mapWidth - m || y > mapHeight - m;
  }

  const api = { checkPlayerEnemyCollision, checkSelfCollision, checkBoundaryCollision };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Collision = api; }
})(typeof window !== 'undefined' ? window : null);
