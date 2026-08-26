const assert = require('assert');
const { LEVELS } = require('../js/levels.js');

assert.strictEqual(LEVELS.length, 10, 'LEVELS must have exactly 10 entries');

const expectedFood = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
const expectedEnemies = [2, 2, 3, 3, 4, 5, 6, 7, 8, 10];
const expectedEmoji = [
  'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
  'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
];

LEVELS.forEach((lv, i) => {
  assert.strictEqual(lv.level, i + 1, `level field must be ${i + 1}`);
  assert.strictEqual(lv.foodCount, expectedFood[i], `Level ${i + 1} foodCount`);
  assert.strictEqual(lv.enemyWormCount, expectedEnemies[i], `Level ${i + 1} enemyWormCount`);
  assert.strictEqual(lv.emojiId, expectedEmoji[i], `Level ${i + 1} emojiId`);
  assert.strictEqual(lv.playerSpeed, LEVELS[0].playerSpeed, 'playerSpeed must be constant across all levels');
  assert.strictEqual(lv.maxPlayerLength, LEVELS[0].maxPlayerLength, 'maxPlayerLength must be constant across all levels');
  assert.ok(lv.mapWidth > 0 && lv.mapHeight > 0, `Level ${i + 1} must have positive map size`);
  assert.ok(lv.enemySpeed > 0 && lv.enemySpeed < lv.playerSpeed, `Level ${i + 1} enemySpeed must stay below playerSpeed`);
});

// 맵 크기는 Level이 올라갈수록 넓어져야 함 (먹이/적 수 증가를 감당)
for (let i = 1; i < LEVELS.length; i++) {
  assert.ok(LEVELS[i].mapWidth >= LEVELS[i - 1].mapWidth, `mapWidth should not shrink at level ${i + 1}`);
  assert.ok(LEVELS[i].mapHeight >= LEVELS[i - 1].mapHeight, `mapHeight should not shrink at level ${i + 1}`);
}

console.log('test-levels.js: all assertions passed');
