const assert = require('assert');
const { create } = require('../js/spawn-scheduler.js');
const { mulberry32 } = require('../js/rng.js');

function makeRng(seed) { return { next: mulberry32(seed) }; }
function makeSpawnPoints(regionIds) {
  return regionIds.map((regionId, i) => ({ id: i, regionId, x: i / regionIds.length, y: 0.5 }));
}

// 1) 동시 활성 개수가 절대 max를 넘지 않는다
{
  const regions = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
  const spawnPoints = makeSpawnPoints([0, 0, 1, 1, 2, 2, 3, 3]);
  const config = { maxConcurrentMoles: 2, maxConcurrentAnimals: 1, maxConcurrentBombs: 0, popDuration: 2.5 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(1) });
  for (let t = 0; t < 200; t++) {
    scheduler.tick(0.1);
    const pops = scheduler.getActivePops();
    assert.ok(pops.filter((p) => p.type === 'mole').length <= config.maxConcurrentMoles, 'mole concurrency must not exceed max');
    assert.ok(pops.filter((p) => p.type === 'animal').length <= config.maxConcurrentAnimals, 'animal concurrency must not exceed max');
  }
}

// 2) 유지시간이 지나면 자동으로 사라진다 (expired로 보고됨)
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 1.0 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(2) });
  let sawSpawn = false, sawExpire = false;
  for (let t = 0; t < 30; t++) {
    const { spawned, expired } = scheduler.tick(0.1);
    if (spawned.length) sawSpawn = true;
    if (expired.length) sawExpire = true;
  }
  assert.ok(sawSpawn, 'a pop must have spawned within 3 seconds');
  assert.ok(sawExpire, 'a pop must have expired after its duration elapsed');
}

// 3) 두더지를 맞히면 해당 영역이 완성 처리되고, 모든 영역 완성 시 isComplete()가 true
{
  const regions = [{ id: 0 }, { id: 1 }];
  const spawnPoints = makeSpawnPoints([0, 1]);
  const config = { maxConcurrentMoles: 2, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 5 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(3) });
  for (let t = 0; t < 100 && !scheduler.isComplete(); t++) {
    scheduler.tick(0.1);
    scheduler.getActivePops().forEach((p) => scheduler.resolveHit(p.id));
  }
  assert.ok(scheduler.isComplete(), 'all regions must complete after every mole is hit');
}

// 4) 같은 순간에 두 pop이 같은 spawnPointId를 공유할 수 없다
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 1, maxConcurrentBombs: 1, popDuration: 3 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(4) });
  for (let t = 0; t < 100; t++) {
    scheduler.tick(0.1);
    const ids = scheduler.getActivePops().map((p) => p.spawnPointId);
    assert.strictEqual(new Set(ids).size, ids.length, 'no two active pops may share a spawn point');
  }
}

// 5) forceCompleteAll (디버그/재시도용): 모든 영역을 즉시 완성 처리
{
  const regions = [{ id: 0 }, { id: 1 }, { id: 2 }];
  const spawnPoints = makeSpawnPoints([0, 1, 2]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 2 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(5) });
  assert.ok(!scheduler.isComplete());
  scheduler.forceCompleteAll();
  assert.ok(scheduler.isComplete(), 'forceCompleteAll must mark every region complete');
}

// 6) 한 영역에 여러 스폰 포인트가 있어도 동시에 최대 한 개의 두더지만 활성화된다
{
  const regions = [{ id: 0 }, { id: 1 }];
  const spawnPoints = makeSpawnPoints([0, 0, 1, 1]); // region 0: spawn points [0, 1], region 1: spawn points [2, 3]
  const config = { maxConcurrentMoles: 2, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 3 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(6) });
  for (let t = 0; t < 150; t++) {
    scheduler.tick(0.1);
    const pops = scheduler.getActivePops().filter((p) => p.type === 'mole');
    const regionCounts = new Map();
    pops.forEach((p) => {
      regionCounts.set(p.regionId, (regionCounts.get(p.regionId) || 0) + 1);
    });
    regionCounts.forEach((count, regionId) => {
      assert.strictEqual(count, 1, `region ${regionId} must have at most 1 active mole, but has ${count}`);
    });
  }
}

console.log('test-spawn-scheduler.js: all assertions passed');
