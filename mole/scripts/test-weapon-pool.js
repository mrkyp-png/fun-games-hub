const assert = require('assert');
const WeaponPool = require('../js/weapon-pool.js');

// 게임 상태·DOM 없이 WeaponPool 만 검증하는 목(mock) 무기 인스턴스.
function makeMockInst() {
  const inst = {
    busy: false,
    strikes: [],
    updates: 0,
    homed: 0,
    cleared: 0,
    strike(tx, ty, onImpact, frameKey, regionId) {
      inst.busy = true;
      inst.strikes.push({ tx, ty, regionId, onImpact });
    },
    update() { inst.updates++; },
    isBusy() { return inst.busy; },
    home() { inst.busy = false; inst.homed++; },
    clear() { inst.cleared++; }
  };
  return inst;
}

// 실제 Promise 마이크로태스크 대신, 테스트가 직접 언제 배치를 흘려보낼지 제어하는 가짜 스케줄러.
function fakeScheduler() {
  let queued = null;
  return {
    schedule(fn) { queued = fn; },
    flush() { const fn = queued; queued = null; if (fn) fn(); }
  };
}

// 1) 혼자 눌리면 바로 실제 무기가 타격 — 오버플로(분신) 콜백 없음.
{
  const inst = makeMockInst();
  const mock = { create: () => inst };
  const sched = fakeScheduler();
  const overflowCalls = [];
  const pool = WeaponPool.create(mock, {}, {
    schedule: sched.schedule, rng: () => 0, onOverflow: (...a) => overflowCalls.push(a)
  });
  pool.strike(0.2, 0.3, () => {}, null, 1);
  sched.flush();
  assert.strictEqual(inst.strikes.length, 1);
  assert.strictEqual(overflowCalls.length, 0);
}

// 2) 같은 배치(같은 스케줄 틱) 안에 두 개가 들어오면 하나만 실제, 나머지는 오버플로.
{
  const inst = makeMockInst();
  const mock = { create: () => inst };
  const sched = fakeScheduler();
  const overflowCalls = [];
  const pool = WeaponPool.create(mock, {}, {
    schedule: sched.schedule, rng: () => 0, onOverflow: (...a) => overflowCalls.push(a)
  });
  pool.strike(0.1, 0.1, () => {}, null, 1);
  pool.strike(0.9, 0.9, () => {}, null, 2);
  sched.flush();
  assert.strictEqual(inst.strikes.length, 1);
  assert.strictEqual(overflowCalls.length, 1);
}

// 3) 배치 안 순서는 rng 로 섞인다 — rng 값이 다르면 실제 타격을 가져가는 항목도 달라져야 한다
//    (동시타격 시 "누가 진짜인지" 랜덤 배정된다는 요구사항 검증).
{
  const inst1 = makeMockInst();
  const sched1 = fakeScheduler();
  const pool1 = WeaponPool.create({ create: () => inst1 }, {}, { schedule: sched1.schedule, rng: () => 0 });
  pool1.strike(0.1, 0.1, () => {}, null, 'A');
  pool1.strike(0.9, 0.9, () => {}, null, 'B');
  sched1.flush();
  const winnerLowRng = inst1.strikes[0].regionId;

  const inst2 = makeMockInst();
  const sched2 = fakeScheduler();
  const pool2 = WeaponPool.create({ create: () => inst2 }, {}, { schedule: sched2.schedule, rng: () => 0.99 });
  pool2.strike(0.1, 0.1, () => {}, null, 'A');
  pool2.strike(0.9, 0.9, () => {}, null, 'B');
  sched2.flush();
  const winnerHighRng = inst2.strikes[0].regionId;

  assert.notStrictEqual(winnerLowRng, winnerHighRng, 'rng 값에 따라 실제 타격을 가져가는 항목이 달라져야 함');
}

// 4) 이전 스윙이 아직 진행 중(busy)이면, 새 배치는 전부 오버플로(분신)로만 간다.
{
  const inst = makeMockInst();
  inst.busy = true;
  const mock = { create: () => inst };
  const sched = fakeScheduler();
  const overflowCalls = [];
  const pool = WeaponPool.create(mock, {}, {
    schedule: sched.schedule, rng: () => 0, onOverflow: (...a) => overflowCalls.push(a)
  });
  pool.strike(0.5, 0.5, () => {}, null, 9);
  sched.flush();
  assert.strictEqual(inst.strikes.length, 0);
  assert.strictEqual(overflowCalls.length, 1);
  assert.strictEqual(overflowCalls[0][4], 9, 'onOverflow 에 regionId 가 그대로 전달돼야 함');
}

// 5) update/home/clear/isBusy 는 내부 인스턴스에 그대로 위임된다.
{
  const inst = makeMockInst();
  const pool = WeaponPool.create({ create: () => inst }, {}, {});
  pool.update(16);
  assert.strictEqual(inst.updates, 1);
  assert.strictEqual(pool.isBusy(), false);
  pool.home();
  assert.strictEqual(inst.homed, 1);
  pool.clear();
  assert.strictEqual(inst.cleared, 1);
}

// 6) meet/demo/spinIn/popIn 은 내부 인스턴스가 실제로 가진 것만 조건부로 붙는다.
{
  const instWithExtras = makeMockInst();
  instWithExtras.spinIn = () => 'spun';
  const pool = WeaponPool.create({ create: () => instWithExtras }, {}, {});
  assert.strictEqual(typeof pool.spinIn, 'function');
  assert.strictEqual(typeof pool.meet, 'undefined');
  assert.strictEqual(pool.spinIn(), 'spun');
}

// 7) isBusyForRegion 이 있으면(알리펀치처럼 좌/우 독립 부위가 있는 무기) 그걸로 부위별
//    판단한다 — 같은 배치에서 서로 다른 부위(L/R)면 "둘 다 실제로" 처리되고, 같은
//    부위끼리면 나중 것만 오버플로로 간다.
function makeMockInstWithSides() {
  const inst = makeMockInst();
  const busySide = { L: false, R: false };
  const SIDE_OF = { 1: 'L', 2: 'R' }; // regionId 1=L구역, 2=R구역(테스트용 임의 매핑)
  const realStrike = inst.strike;
  inst.strike = (tx, ty, onImpact, frameKey, regionId) => {
    busySide[SIDE_OF[regionId]] = true;
    realStrike(tx, ty, onImpact, frameKey, regionId);
  };
  inst.isBusyForRegion = (regionId) => !!busySide[SIDE_OF[regionId]];
  return inst;
}
{
  const inst = makeMockInstWithSides();
  const sched = fakeScheduler();
  const overflowCalls = [];
  const pool = WeaponPool.create({ create: () => inst }, {}, {
    schedule: sched.schedule, rng: () => 0, onOverflow: (...a) => overflowCalls.push(a)
  });
  pool.strike(0.1, 0.1, () => {}, null, 1); // L구역
  pool.strike(0.9, 0.9, () => {}, null, 2); // R구역 — 서로 다른 부위라 둘 다 실제로 처리돼야 함
  sched.flush();
  assert.strictEqual(inst.strikes.length, 2, '좌우가 다르면 둘 다 실제 타격으로 처리돼야 함');
  assert.strictEqual(overflowCalls.length, 0);
}
{
  const inst = makeMockInstWithSides();
  const sched = fakeScheduler();
  const overflowCalls = [];
  const pool = WeaponPool.create({ create: () => inst }, {}, {
    schedule: sched.schedule, rng: () => 0, onOverflow: (...a) => overflowCalls.push(a)
  });
  pool.strike(0.1, 0.1, () => {}, null, 1); // L구역
  pool.strike(0.2, 0.2, () => {}, null, 1); // 같은 L구역 — 두 번째는 오버플로로 가야 함
  sched.flush();
  assert.strictEqual(inst.strikes.length, 1, '같은 부위 두 번째는 실제 타격이 아니어야 함');
  assert.strictEqual(overflowCalls.length, 1);
}

console.log('test-weapon-pool.js: all assertions passed');
