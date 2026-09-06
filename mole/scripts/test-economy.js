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

// 상한/충전 규칙: 무료 상한 3, 4시간, 2 이하일 때만 카운팅
(function testDefaults() {
  assert.strictEqual(Economy.HEART_MAX, 3, '무료 충전 상한 3');
  assert.strictEqual(Economy.REGEN_MS, 4 * 60 * 60 * 1000, '4시간');
})();

// setHearts: 상한 없음(콤보/광고로 3 초과 가능), 3 미만이면 nextHeartMs > 0
(function testSetHeartsOverflow() {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  Economy.setHearts(5);
  assert.strictEqual(Economy.getHearts(), 5, '콤보로 3 초과 보유 가능');
  assert.strictEqual(Economy.nextHeartMs(), 0, '3 이상이면 충전 타이머 없음');
  Economy.setHearts(1);
  assert.strictEqual(Economy.getHearts(), 1);
  assert.ok(Economy.nextHeartMs() > 0 && Economy.nextHeartMs() <= 4 * 60 * 60 * 1000, '2 이하면 충전 카운팅');
  delete global.localStorage;
})();

console.log('test-economy: OK');
