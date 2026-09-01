const assert = require('assert');
const { partition } = require('../js/grid-partition.js');

// 4x4 = 16칸 고정 격자 (사용자 확정). 칸마다 구멍/두더지 1개, 배경은 통째로 옅어짐.

// 1) gridSize 4 → 정확히 16개 영역, 16개 출현 포인트
{
  const { regions, spawnPoints } = partition({ gridSize: 4 });
  assert.strictEqual(regions.length, 16);
  assert.strictEqual(spawnPoints.length, 16);
}

// 2) 영역 id 는 0..15, 출현 포인트는 regionId 로 1:1 대응
{
  const { regions, spawnPoints } = partition({ gridSize: 4 });
  assert.deepStrictEqual(regions.map((r) => r.id), [...Array(16).keys()]);
  assert.deepStrictEqual(spawnPoints.map((s) => s.regionId), [...Array(16).keys()]);
}

// 3) 열은 각 칸 중앙(1/8..7/8), 행은 위 27% ~ 아래 88% 범위에 균등 배치
//    (윗줄 구멍이 배경 지평선 아래 잔디 위에 앉도록)
{
  const { spawnPoints } = partition({ gridSize: 4 });
  assert.ok(Math.abs(spawnPoints[0].x - 1 / 8) < 1e-9, 'first column center');
  assert.ok(Math.abs(spawnPoints[15].x - 7 / 8) < 1e-9, 'last column center');
  assert.ok(Math.abs(spawnPoints[0].y - 0.27) < 1e-9, 'top row at 27%');
  assert.ok(Math.abs(spawnPoints[15].y - 0.88) < 1e-9, 'bottom row at 88%');
}

// 4) 출현 포인트가 격자 행/열을 순서대로 채운다 (행 우선), 한 행은 y가 같다
{
  const { spawnPoints } = partition({ gridSize: 4 });
  assert.deepStrictEqual(spawnPoints.slice(0, 4).map((s) => s.x), [1 / 8, 3 / 8, 5 / 8, 7 / 8]);
  assert.strictEqual(new Set(spawnPoints.slice(0, 4).map((s) => s.y)).size, 1, 'first row shares one y');
  assert.ok(spawnPoints[4].y > spawnPoints[0].y, 'rows increase downward');
}

// 5) 각 출현 지점에 col(0..3), row(0..3) 가 붙고 regionId = row*4 + col
{
  const { spawnPoints } = partition({ gridSize: 4 });
  assert.strictEqual(spawnPoints.length, 16);
  spawnPoints.forEach((sp) => {
    assert.ok(Number.isInteger(sp.col) && sp.col >= 0 && sp.col < 4, `col in range (got ${sp.col})`);
    assert.ok(Number.isInteger(sp.row) && sp.row >= 0 && sp.row < 4, `row in range (got ${sp.row})`);
    assert.strictEqual(sp.regionId, sp.row * 4 + sp.col, 'regionId must equal row*4 + col');
  });
  assert.deepStrictEqual(spawnPoints.slice(0, 4).map((s) => s.col), [0, 1, 2, 3]);
  assert.deepStrictEqual(spawnPoints.slice(0, 4).map((s) => s.row), [0, 0, 0, 0]);
  assert.strictEqual(spawnPoints[15].col, 3);
  assert.strictEqual(spawnPoints[15].row, 3);
}

console.log('test-grid-partition.js: all assertions passed');
