// V1703 C: 일반 두더지(good, 때리면 안 됨) / 나쁜 두더지(behavior, 타겟) 스폰·판정 검사
const assert = require('assert');
const { create } = require('../mole/js/spawn-scheduler.js');
let s = 7; const rng = { next: () => ((s = (s * 16807) % 2147483647) / 2147483647) };
const regions = Array.from({ length: 16 }, (_, i) => ({ id: i }));
const spawnPoints = regions.map((r, i) => ({ id: i, regionId: r.id, col: i % 4, x: (i % 4 + .5) / 4, y: (Math.floor(i / 4) + .5) / 4 }));
const config = { maxConcurrentMoles: 16, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 2, molePoseCount: 8 };
const sch = create({ regions, spawnPoints, config, rng });
const moles = [];
for (let t = 0; t < 4000 && moles.length < 3000; t++) { const { spawned } = sch.tick(0.05); spawned.forEach(p => { if (p.type === 'mole') moles.push(p); }); }
const single = moles.filter(p => p.hitsRequired === 1), good = moles.filter(p => p.good);
assert(good.every(p => p.hitsRequired === 1 && !p.behavior), 'good moles: single hit, no prop');
assert(moles.filter(p => !p.good).every(p => ['drink', 'smoke', 'phone', 'thief'].includes(p.behavior)), 'non-good moles have a behavior');
const ratio = good.length / single.length;
assert(ratio > .15 && ratio < .25, 'about 1 in 5 single-hit moles is normal: ' + ratio.toFixed(3));
// 판정: 일반 두더지를 때리면 good:true, 영역 완성에 안 들어감
const sch2 = create({ regions, spawnPoints, config, rng });
let g = null; for (let t = 0; t < 2000 && !g; t++) { const { spawned } = sch2.tick(0.05); g = spawned.find(p => p.good); }
const before = sch2.completedRegionCount();
const r = sch2.resolveHit(g.id);
assert(r && r.done && r.good === true, 'hit result flags good');
assert.strictEqual(sch2.completedRegionCount(), before, 'hitting a normal mole does not complete a region');
// 게임 쪽 판정 분기 문자열 확인
const game = require('fs').readFileSync(__dirname + '/../mole/js/game.js', 'utf8');
assert(game.includes("const effType = r.good ? 'animal' : effectiveHitType(cfg, r.type);"), 'good → obstacle penalty');
assert(game.includes('e.timedOut && !e.bomb && !e.good'), 'missing a normal mole does not reset combo');
assert(game.includes('q.regionId === id && !q.good &&'), 'auto attacks skip normal moles');
console.log('PASS good moles: spawned', moles.length, 'normal ratio(single-hit)', ratio.toFixed(3), 'hit→good flag, no region completion, penalty/timeout/auto-attack guards');
