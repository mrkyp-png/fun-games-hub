const assert = require('assert');
const { mulberry32, hashSeed } = require('../js/rng.js');
const { create } = require('../js/enemy-ai.js');

const rng = mulberry32(hashSeed('enemy-0'));
const ai = create({ rng, changeIntervalMin: 1.0, changeIntervalMax: 1.0 }); // 고정 1초 간격으로 결정적 테스트

const d0 = ai.getDirection();
assert.ok(Math.abs(Math.hypot(d0.x, d0.y) - 1) < 1e-6, 'direction must be a unit vector');

// 0.5초 후에는 아직 방향이 바뀌면 안 됨 (간격 1.0초)
ai.update(0.5);
const d1 = ai.getDirection();
assert.deepStrictEqual(d1, d0, 'direction should not change before the interval elapses');

// 나머지 0.6초를 더 지나면(총 1.1초) 방향이 바뀌어야 함
ai.update(0.6);
const d2 = ai.getDirection();
assert.ok(Math.abs(Math.hypot(d2.x, d2.y) - 1) < 1e-6, 'new direction must also be a unit vector');
assert.ok(d2.x !== d0.x || d2.y !== d0.y, 'direction should change after the interval elapses');

console.log('test-enemy-ai.js: all assertions passed');
