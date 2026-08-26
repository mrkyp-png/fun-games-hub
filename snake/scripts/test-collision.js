const assert = require('assert');
const {
  checkPlayerEnemyCollision, checkSelfCollision, checkBoundaryCollision
} = require('../js/collision.js');

// 플레이어-적: 반경 안이면 true
assert.strictEqual(
  checkPlayerEnemyCollision({ x: 0, y: 0 }, [{ x: 5, y: 0 }], 10),
  true,
  'within radius must collide'
);
assert.strictEqual(
  checkPlayerEnemyCollision({ x: 0, y: 0 }, [{ x: 100, y: 0 }], 10),
  false,
  'far away must not collide'
);

// 자기 몸: 머리 바로 뒤 skipCount 세그먼트는 무시해야 함 (항상 가까이 있으므로)
const nearSegments = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 100, y: 0 }];
assert.strictEqual(
  checkSelfCollision({ x: 0, y: 0 }, nearSegments, 10, 4),
  false,
  'segments within skipCount must be ignored'
);
const loopedBackSegments = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 1 }];
assert.strictEqual(
  checkSelfCollision({ x: 0, y: 0 }, loopedBackSegments, 10, 4),
  true,
  'a far-index segment that loops back near the head must trigger self-collision'
);

// 맵 경계
assert.strictEqual(checkBoundaryCollision(-1, 50, 1000, 800), true, 'negative x is out of bounds');
assert.strictEqual(checkBoundaryCollision(1001, 50, 1000, 800), true, 'x beyond mapWidth is out of bounds');
assert.strictEqual(checkBoundaryCollision(500, 400, 1000, 800), false, 'center point is in bounds');

console.log('test-collision.js: all assertions passed');
