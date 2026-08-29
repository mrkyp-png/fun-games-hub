const assert = require('assert');
const { partition } = require('../js/region-partition.js');
const { mulberry32 } = require('../js/rng.js');

function makeSquarePoints(w, h) {
  const points = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) points.push({ x, y });
  return points;
}

// 1) regionCount만큼 정확히 나뉘고, 모든 점이 정확히 하나의 영역에 속한다.
{
  const points = makeSquarePoints(40, 40);
  const rng = { next: mulberry32(1) };
  const { regions } = partition({ width: 40, height: 40, points, regionCount: 9, rng });
  assert.strictEqual(regions.length, 9, 'must produce exactly regionCount regions');
  const totalAssigned = regions.reduce((sum, r) => sum + r.points.length, 0);
  assert.strictEqual(totalAssigned, points.length, 'every filled point must be assigned to exactly one region');
  regions.forEach((r) => assert.ok(['small', 'medium', 'large'].includes(r.size), 'each region must have a size label'));
}

// 2) 같은 시드 입력 → 결정론적으로 같은 결과
{
  const points = makeSquarePoints(30, 30);
  const runOnce = () => partition({ width: 30, height: 30, points, regionCount: 6, rng: { next: mulberry32(7) } });
  const a = runOnce();
  const b = runOnce();
  assert.deepStrictEqual(
    a.regions.map((r) => r.points.length),
    b.regions.map((r) => r.points.length),
    'same seed must produce identical region sizes'
  );
}

// 3) 소/중/대 등급이 최소 1개씩은 존재 (regionCount>=3일 때)
{
  const points = makeSquarePoints(50, 50);
  const rng = { next: mulberry32(3) };
  const { regions } = partition({ width: 50, height: 50, points, regionCount: 12, rng });
  const sizes = new Set(regions.map((r) => r.size));
  assert.ok(sizes.has('small') && sizes.has('medium') && sizes.has('large'), 'all three size tiers must appear');
}

console.log('test-region-partition.js: all assertions passed');
