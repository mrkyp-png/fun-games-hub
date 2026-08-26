const assert = require('assert');
const { mulberry32, hashSeed } = require('../js/rng.js');
const { placeFood } = require('../js/food-placement.js');

// RNG: 같은 시드 → 같은 시퀀스, 값은 항상 [0,1)
const seed = hashSeed('level-1');
const rngA = mulberry32(seed);
const rngB = mulberry32(seed);
for (let i = 0; i < 20; i++) {
  const a = rngA();
  const b = rngB();
  assert.strictEqual(a, b, 'same seed must produce same sequence');
  assert.ok(a >= 0 && a < 1, 'rng output must be in [0,1)');
}

// 먹이 배치: 개수 정확, 맵 범위 안, 서로 최소거리 이상, 시작지점/적과 최소거리 이상
const mapWidth = 2000, mapHeight = 1400;
const playerStart = { x: mapWidth / 2, y: mapHeight / 2 };
const enemyStarts = [{ x: 300, y: 300 }, { x: 1700, y: 1100 }];
const rng = mulberry32(hashSeed('level-1-food'));
const foods = placeFood({ count: 20, mapWidth, mapHeight, playerStart, enemyStarts, rng });

assert.strictEqual(foods.length, 20, 'must place exactly the requested count');
foods.forEach((f, i) => {
  assert.ok(f.x >= 0 && f.x <= mapWidth, `food ${i} x within map`);
  assert.ok(f.y >= 0 && f.y <= mapHeight, `food ${i} y within map`);
});

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// 서로 다른 먹이끼리 최소거리 확인 (넓은 맵에 20개면 여유 있게 만족되어야 정상)
let tooClosePairs = 0;
for (let i = 0; i < foods.length; i++) {
  for (let j = i + 1; j < foods.length; j++) {
    if (dist(foods[i], foods[j]) < 70) tooClosePairs++;
  }
}
assert.strictEqual(tooClosePairs, 0, 'no two foods should be closer than minFoodDistance on a roomy map');

foods.forEach((f, i) => {
  assert.ok(dist(f, playerStart) >= 150, `food ${i} too close to player start`);
});

// Level마다 새 배치가 가능해야 함 (다른 시드 → 다른 결과)
const rng2 = mulberry32(hashSeed('level-1-food-retry'));
const foods2 = placeFood({ count: 20, mapWidth, mapHeight, playerStart, enemyStarts, rng: rng2 });
const identical = foods.every((f, i) => f.x === foods2[i].x && f.y === foods2[i].y);
assert.ok(!identical, 'different seed should (almost certainly) produce a different layout');

// count가 배치 여유보다 훨씬 많아도(안전장치 fallback) 정확한 개수를 반환해야 함
const rngDense = mulberry32(hashSeed('dense'));
const denseFoods = placeFood({ count: 65, mapWidth: 400, mapHeight: 300, playerStart: { x: 200, y: 150 }, enemyStarts: [], rng: rngDense });
assert.strictEqual(denseFoods.length, 65, 'must still return exact count even under tight space (fallback path)');

console.log('test-rng-food-placement.js: all assertions passed');
