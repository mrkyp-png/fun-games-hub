// V1713 C: 아마추어 6라운드 릴레이 — 3마리씩, 1마리라도 잡으면 다음 묶음, 묶음당 일반 두더지 최대 1, 폭탄 없음
const assert = require('assert');
const { create } = require('../mole/js/spawn-scheduler.js');
let s = 11; const rng = { next: () => ((s = (s * 16807) % 2147483647) / 2147483647) };
const regions = Array.from({ length: 16 }, (_, i) => ({ id: i }));
const spawnPoints = regions.map((r, i) => ({ id: i, regionId: r.id, col: i % 4, x: (i % 4 + .5) / 4, y: (Math.floor(i / 4) + .5) / 4 }));
const config = { relay: true, maxConcurrentMoles: 10, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 2, molePoseCount: 8, multiHit: false, bombChance: 0.5 };
const sch = create({ regions, spawnPoints, config, rng });
const waves = []; let t = 0, killed = 0;
for (let step = 0; step < 4000; step++) {
  const { spawned } = sch.tick(0.05); t += 0.05;
  const fresh = spawned.filter((p) => p.type === 'mole' && !p.wobbled);
  if (fresh.length) waves.push({ t, n: fresh.length, goods: fresh.filter((p) => p.good).length, liveBadBefore: 0 });
  // 플레이어: 나쁜 두더지가 나오고 0.4초 뒤 잡음(일반 두더지는 안 침)
  if (step % 8 === 0) { const p = sch.getActivePops().find((p) => p.type === 'mole' && !p.good && !p.dying && !(p.sinkIn > 0)); if (p) { const r = sch.resolveHit(p.id); if (r && r.done) killed++; } } // 1마리만 잡음
  assert(!spawned.some((p) => p.bombKind), 'no bomb moles in relay');
}
console.log('sizes', JSON.stringify(waves.slice(0, 12).map((w) => w.n + '@' + w.t.toFixed(2))));
assert(waves.length > 20, 'many waves: ' + waves.length);
assert(waves.every((w) => w.n === 3), 'each wave has 3 moles');
assert(waves.every((w) => w.goods <= 1), 'at most one normal mole per wave');
assert(waves.some((w) => w.goods === 0) && waves.some((w) => w.goods === 1), 'normal mole is optional (0 or 1)');
console.log('PASS relay: waves', waves.length, 'kills', killed, 'waves with a normal mole', waves.filter((w) => w.goods).length);
