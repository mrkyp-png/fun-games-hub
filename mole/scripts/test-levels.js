const assert = require('assert');
const { LEVELS } = require('../js/levels.js');

assert.strictEqual(LEVELS.length, 10, 'LEVELS must have exactly 10 entries');

const expectedMoleDuration = [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0];
const expectedMaxMoles = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
const expectedMaxAnimals = [0, 1, 1, 2, 0, 1, 1, 2, 2, 3];
const expectedMaxBombs = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
const expectedTimeLimit = [60, 60, 60, 55, 55, 55, 50, 50, 45, 45];
const expectedEmoji = [
  'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
  'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
];

LEVELS.forEach((lv, i) => {
  assert.strictEqual(lv.level, i + 1, `level field must be ${i + 1}`);
  assert.strictEqual(lv.regionCount, 16, `Level ${i + 1} regionCount is a fixed 4x4 grid`);
  assert.strictEqual(lv.moleDuration, expectedMoleDuration[i], `Level ${i + 1} moleDuration`);
  assert.strictEqual(lv.maxConcurrentMoles, expectedMaxMoles[i], `Level ${i + 1} maxConcurrentMoles`);
  assert.strictEqual(lv.maxConcurrentAnimals, expectedMaxAnimals[i], `Level ${i + 1} maxConcurrentAnimals`);
  assert.strictEqual(lv.maxConcurrentBombs, expectedMaxBombs[i], `Level ${i + 1} maxConcurrentBombs`);
  assert.strictEqual(lv.timeLimit, expectedTimeLimit[i], `Level ${i + 1} timeLimit`);
  assert.strictEqual(lv.emojiId, expectedEmoji[i], `Level ${i + 1} emojiId`);
});

console.log('test-levels.js: all assertions passed');
