'use strict';
const assert = require('assert');
const { Economy } = require('../js/economy.js');

const MIN = 60 * 1000;

// regen: 경과 시간만큼 충전, 상한 클램프
(function testRegenBasic() {
  const r = Economy.regen(2, 0, 41 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 4, '2 + floor(41/20) = 4');
  assert.strictEqual(r.at, 40 * MIN, 'at 은 소비된 충전분만큼만 전진 (2*20)');
})();

(function testRegenClamp() {
  const r = Economy.regen(4, 0, 999 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 5, '상한 5');
  assert.strictEqual(r.at, 999 * MIN, '만땅이면 at = now');
})();

(function testRegenNoTime() {
  const r = Economy.regen(3, 1000, 1000 + 5 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 3, '20분 안 지남 → 그대로');
  assert.strictEqual(r.at, 1000, 'at 유지');
})();

(function testRegenAlreadyFull() {
  const r = Economy.regen(5, 0, 100 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 5);
  assert.strictEqual(r.at, 100 * MIN, '만땅에서 시간 지나도 at=now (충전 타이머 리셋)');
})();

console.log('test-economy: OK');
