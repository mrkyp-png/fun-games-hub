const assert = require('assert');
const L = require('../js/levels.js');

assert.deepStrictEqual(L.MOLE_DURATION, [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0]);
assert.deepStrictEqual(L.MAX_CONCURRENT_MOLES, [3, 4, 4, 5, 5, 5, 6, 6, 7, 7]);
assert.deepStrictEqual(L.MAX_CONCURRENT_ANIMALS, [0, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
assert.deepStrictEqual(L.MAX_CONCURRENT_BOMBS, [0, 0, 0, 0, 1, 1, 2, 2, 3, 3]);
assert.deepStrictEqual(L.BOMB_CHANCE_BY_ROUND, [0.05, 0.05, 0.05, 0.05, 0.13, 0.13, 0.14, 0.16, 0.17, 0.19]);
assert.deepStrictEqual(L.STRONG_BOMB_CHANCE_BY_ROUND, [0.05, 0.05, 0.05, 0.05, 0.05, 0.07, 0.08, 0.09, 0.10, 0.11]);
assert.deepStrictEqual(L.SMALL_CHAPTER_MOLES, [3, 4, 5, 6, 7]);
assert.strictEqual(typeof L.interpolate, 'function');

// interpolate(): keyframe 정확히 맞아떨어지는 지점들 (5개 키프레임, 60초 = 15초 간격)
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 0, 60), 3);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 15, 60), 4);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 30, 60), 5);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 45, 60), 6);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 60, 60), 7);
// 중간값 보간
assert.ok(Math.abs(L.interpolate(L.SMALL_CHAPTER_MOLES, 7.5, 60) - 3.5) < 1e-9);
// 범위 밖은 양 끝값으로 clamp
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, -10, 60), 3);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 999, 60), 7);
// 10개 키프레임을 140초 기준으로 (0, 70, 140 지점)
assert.strictEqual(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 0, 140), 0.05);
// pos=(70/140)*9=4.5 → i=4,frac=0.5 → keyframes[4]=keyframes[5]=0.13 (인접 키프레임이 같은 값이라 그대로 0.13)
assert.ok(Math.abs(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 70, 140) - 0.13) < 1e-9);
assert.strictEqual(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 140, 140), 0.19);
// 단일 키프레임은 그 값 그대로
assert.strictEqual(L.interpolate([5], 30, 60), 5);

console.log('test-levels.js: all assertions passed');
