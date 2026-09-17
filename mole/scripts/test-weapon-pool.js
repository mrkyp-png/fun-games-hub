const assert = require('assert');
const WeaponPool = require('../js/weapon-pool.js');

// 게임 상태·DOM 없이 WeaponPool 만 검증하는 목(mock) 무기 모듈.
function makeMockWeaponMod() {
  const instances = [];
  function create() {
    const inst = {
      busy: false,
      cleared: false,
      strikes: 0,
      updates: 0,
      lastTarget: null,
      strike(tx, ty, onImpact, frameKey, regionId) {
        inst.busy = true;
        inst.strikes++;
        inst.lastTarget = { tx, ty, regionId };
      },
      update() { inst.updates++; },
      isBusy() { return inst.busy; },
      home() { inst.busy = false; },
      clear() { inst.cleared = true; }
    };
    instances.push(inst);
    return inst;
  }
  return { create, instances };
}

// 1) 여유 인스턴스가 없으면 strike() 마다 새 인스턴스를 만든다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0.2, 0.3, () => {}, null, 1);          // 기존 instances[0] 사용
  assert.strictEqual(mock.instances.length, 1);
  pool.strike(0.6, 0.7, () => {}, null, 2);          // instances[0] 이 busy → 새로 생성
  assert.strictEqual(mock.instances.length, 2);
  assert.strictEqual(mock.instances[1].lastTarget.regionId, 2);
}

// 2) update(dt) 가 모든 인스턴스에 전파된다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.update(16);
  assert.strictEqual(mock.instances[0].updates, 1);
  assert.strictEqual(mock.instances[1].updates, 1);
}

// 3) 안 바쁜 여분 인스턴스는 pruneAfterMs 가 지나야 정리된다(그 전엔 유지).
{
  const mock = makeMockWeaponMod();
  let clock = 0;
  const pool = WeaponPool.create(mock, {}, { pruneAfterMs: 100, now: () => clock });
  pool.strike(0, 0, () => {});           // instances[0], lastStrikeAt=0
  clock = 10;
  pool.strike(0.5, 0.5, () => {});       // instances[1] 생성, lastStrikeAt=10
  mock.instances[1].busy = false;        // 스윙 끝나고 대기 위치 복귀했다고 가정
  clock = 50;                            // 경과 40ms < 100ms
  pool.update(16);
  assert.strictEqual(mock.instances[1].cleared, false, '아직 정리되면 안 됨');
  clock = 200;                           // 경과 190ms > 100ms
  pool.update(16);
  assert.strictEqual(mock.instances[1].cleared, true, '정리돼야 함');
}

// 4) maxConcurrent 를 넘으면 새 인스턴스 대신 가장 오래된 걸 리다이렉트한다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { maxConcurrent: 2, now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.strike(0.9, 0.9, () => {});       // 캡(2) 초과 → 새로 안 만들고 instances[0] 재사용
  assert.strictEqual(mock.instances.length, 2);
  assert.strictEqual(mock.instances[0].strikes, 2);
}

// 5) home()/clear() 후 인스턴스가 1개/0개로 수렴한다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.home();
  assert.strictEqual(mock.instances[1].cleared, true, '여분 인스턴스는 home() 에서 정리');
  assert.strictEqual(mock.instances[0].cleared, false, '기본 인스턴스는 유지');
  pool.clear();
  assert.strictEqual(mock.instances[0].cleared, true, 'clear() 는 기본 인스턴스도 정리');
}

console.log('test-weapon-pool.js: all assertions passed');
