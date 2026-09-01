const assert = require('assert');
const { create } = require('../js/spawn-scheduler.js');
const { mulberry32 } = require('../js/rng.js');

function makeRng(seed) { return { next: mulberry32(seed) }; }
function makeSpawnPoints(regionIds) {
  return regionIds.map((regionId, i) => ({
    id: i, regionId, col: i % 4, row: Math.floor(i / 4), x: i / regionIds.length, y: 0.5
  }));
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

// 7) 두더지마다 hitsRequired(1/2/3) 와 poseIndex 가 붙는다.
// 잡지 않고 시간 초과로 순환시키며 표본을 모은다 (시간 초과는 영역을 완성시키지 않음).
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 0.15, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(11) });
  let seen = 0;
  for (let t = 0; t < 400 && seen < 6; t++) {
    const { spawned } = scheduler.tick(0.1);
    spawned.filter((p) => p.type === 'mole').forEach((p) => {
      seen++;
      assert.ok([1, 2, 3].includes(p.hitsRequired), 'mole must carry hitsRequired of 1, 2, or 3');
      assert.strictEqual(p.hitsTaken, 0, 'a fresh mole has taken 0 hits');
      assert.ok(Number.isInteger(p.poseIndex) && p.poseIndex >= 0 && p.poseIndex < 8, 'poseIndex within pose count');
    });
  }
  assert.ok(seen >= 6, `sampled at least 6 moles (got ${seen})`);
}

// 8) 다타(多打) 두더지: 마지막 타격 전까지는 영역이 완성되지 않는다
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  // 3히트 두더지가 나올 때까지 시드를 돌려 찾는다
  let scheduler, mole;
  for (let seed = 1; seed < 400 && !mole; seed++) {
    scheduler = create({ regions, spawnPoints, config, rng: makeRng(seed) });
    for (let t = 0; t < 40 && !mole; t++) {
      const { spawned } = scheduler.tick(0.1);
      const m = spawned.find((p) => p.type === 'mole' && p.hitsRequired === 3);
      if (m) mole = m;
    }
  }
  assert.ok(mole, 'expected to find a 3-hit mole within the seed sweep');

  const r1 = scheduler.resolveHit(mole.id);
  assert.strictEqual(r1.done, false, 'first hit on a 3-hit mole is not final');
  assert.ok(!scheduler.isComplete(), 'region must not complete on a non-final hit');
  scheduler.tick(0.2); // 쿨다운 해제

  const r2 = scheduler.resolveHit(mole.id);
  assert.strictEqual(r2.done, false, 'second hit still not final');
  assert.ok(!scheduler.isComplete(), 'region still incomplete after 2 of 3 hits');
  scheduler.tick(0.2);

  const r3 = scheduler.resolveHit(mole.id);
  assert.strictEqual(r3.done, true, 'third hit is final');
  assert.ok(scheduler.isComplete(), 'region completes immediately on the final hit');
}

// 9) 히트 쿨다운: 직후 재타격은 무시된다 (연타 방지)
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  let scheduler, mole;
  for (let seed = 1; seed < 400 && !mole; seed++) {
    scheduler = create({ regions, spawnPoints, config, rng: makeRng(seed) });
    for (let t = 0; t < 40 && !mole; t++) {
      const { spawned } = scheduler.tick(0.1);
      const m = spawned.find((p) => p.type === 'mole' && p.hitsRequired >= 2);
      if (m) mole = m;
    }
  }
  assert.ok(mole, 'expected a multi-hit mole');
  assert.strictEqual(scheduler.resolveHit(mole.id).done, false, 'first hit lands');
  assert.strictEqual(scheduler.resolveHit(mole.id), null, 'immediate second hit is swallowed by cooldown');
}

// 10) 다타 두더지 종류 분포 ~ 80/15/5 (시드 고정이라 결정론적, 여유 있게 검사)
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 0.15, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(99) });
  const counts = { 1: 0, 2: 0, 3: 0 };
  let total = 0;
  for (let t = 0; t < 30000; t++) {
    const { spawned } = scheduler.tick(0.1);
    spawned.filter((p) => p.type === 'mole').forEach((p) => { counts[p.hitsRequired]++; total++; });
  }
  assert.ok(total > 500, `sampled enough moles (got ${total})`);
  assert.ok(Math.abs(counts[1] / total - 0.80) < 0.06, `~80% single-hit (got ${(counts[1] / total * 100).toFixed(1)}%)`);
  assert.ok(Math.abs(counts[2] / total - 0.15) < 0.05, `~15% two-hit (got ${(counts[2] / total * 100).toFixed(1)}%)`);
  assert.ok(Math.abs(counts[3] / total - 0.05) < 0.04, `~5% three-hit (got ${(counts[3] / total * 100).toFixed(1)}%)`);
}

// 11) resolveRegion: 그 영역의 두더지 1마리 → 결과 1개 done:true, 영역 완성
{
  const regions = [{ id: 0 }, { id: 1 }];
  const spawnPoints = makeSpawnPoints([0, 1]);
  const config = { maxConcurrentMoles: 2, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(21) });
  let mole;
  for (let t = 0; t < 50 && !mole; t++) {
    const { spawned } = scheduler.tick(0.1);
    mole = spawned.find((p) => p.type === 'mole');
  }
  assert.ok(mole, 'a mole spawned');
  const res = scheduler.resolveRegion(mole.regionId);
  assert.strictEqual(res.length, 1, 'one result for the mole in that region');
  assert.strictEqual(res[0].type, 'mole');
  assert.strictEqual(res[0].done, true);
  assert.strictEqual(typeof res[0].xFrac, 'number');
  assert.strictEqual(typeof res[0].yFrac, 'number');
  assert.strictEqual(scheduler.resolveRegion(mole.regionId === 0 ? 1 : 0).length, 0);
}

// 12) resolveRegion: 빈 영역 → 빈 배열
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(22) });
  scheduler.tick(0.1);
  assert.deepStrictEqual(scheduler.resolveRegion(5), []);
}

// 13) resolveRegion: 동물이 뜬 영역을 치면 동물 결과가 나온다 (두더지 아님)
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 0, maxConcurrentAnimals: 1, maxConcurrentBombs: 0, popDuration: 30 };
  let scheduler, animal;
  for (let seed = 1; seed < 200 && !animal; seed++) {
    scheduler = create({ regions, spawnPoints, config, rng: makeRng(seed) });
    for (let t = 0; t < 60 && !animal; t++) {
      animal = scheduler.tick(0.1).spawned.find((p) => p.type === 'animal');
    }
  }
  assert.ok(animal, 'an animal spawned');
  const res = scheduler.resolveRegion(animal.regionId);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].type, 'animal');
  assert.ok(!scheduler.isComplete(), 'hitting an animal does not complete a region');
}

// 14) resolveRegion: 2히트 두더지는 두 번에 처치
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 60, molePoseCount: 8 };
  let scheduler, mole;
  for (let seed = 1; seed < 400 && !mole; seed++) {
    scheduler = create({ regions, spawnPoints, config, rng: makeRng(seed) });
    for (let t = 0; t < 40 && !mole; t++) {
      const m = scheduler.tick(0.1).spawned.find((p) => p.type === 'mole' && p.hitsRequired === 2);
      if (m) mole = m;
    }
  }
  assert.ok(mole, 'found a 2-hit mole');
  const r1 = scheduler.resolveRegion(0);
  assert.strictEqual(r1[0].done, false, 'first hit knocks it down');
  assert.ok(!scheduler.isComplete());
  scheduler.tick(0.2);
  const r2 = scheduler.resolveRegion(0);
  assert.strictEqual(r2[0].done, true, 'second hit finishes it');
  assert.ok(scheduler.isComplete());
}

// 15) 점수 어택: 두더지를 잡은 칸에도 잠시 뒤 새 두더지가 다시 등장한다
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(7) });

  let first;
  for (let t = 0; t < 50 && !first; t++) {
    first = scheduler.tick(0.1).spawned.find((p) => p.type === 'mole');
  }
  assert.ok(first, 'a first mole spawned');

  assert.strictEqual(scheduler.resolveRegion(0)[0].done, true, 'first mole killed');

  let second;
  for (let t = 0; t < 60 && !second; t++) {
    scheduler.tick(0.1);
    second = scheduler.getActivePops().find((p) => p.type === 'mole' && !p.dying && p.id !== first.id);
  }
  assert.ok(second, 'a new mole must re-spawn in the same (already-cleared) cell');
}

console.log('test-spawn-scheduler.js: all assertions passed');
