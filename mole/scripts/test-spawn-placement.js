const assert = require('assert');
const { place, DEFAULT_MIN_DISTANCE_FRAC } = require('../js/spawn-placement.js');
const { mulberry32 } = require('../js/rng.js');

function makeRegion(id, size, x0, y0, w, h) {
  const points = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) points.push({ x, y });
  return { id, size, points };
}

// 1) 충분한 공간이 있으면 모든 영역이 최소 1개의 출현 포인트를 갖는다
{
  const regions = [
    makeRegion(0, 'small', 0, 0, 20, 20),
    makeRegion(1, 'medium', 30, 0, 20, 20),
    makeRegion(2, 'large', 0, 30, 20, 20)
  ];
  const rng = { next: mulberry32(1) };
  const { spawnPoints } = place({ regions, width: 60, height: 60, rng });
  [0, 1, 2].forEach((id) => {
    assert.ok(spawnPoints.some((p) => p.regionId === id), `region ${id} must have at least one spawn point`);
  });
}

// 2) 모든 출현 포인트 쌍이 최소 거리 이상 떨어져 있다 (§4 중첩 방지)
{
  const regions = [
    makeRegion(0, 'large', 0, 0, 40, 40),
    makeRegion(1, 'large', 40, 0, 40, 40)
  ];
  const width = 80, height = 40;
  const { spawnPoints } = place({ regions, width, height, rng: { next: mulberry32(5) } });
  const minDistPx = DEFAULT_MIN_DISTANCE_FRAC * Math.max(width, height);
  for (let i = 0; i < spawnPoints.length; i++) {
    for (let j = i + 1; j < spawnPoints.length; j++) {
      const dx = (spawnPoints[i].x - spawnPoints[j].x) * width;
      const dy = (spawnPoints[i].y - spawnPoints[j].y) * height;
      const d = Math.sqrt(dx * dx + dy * dy);
      assert.ok(d >= minDistPx - 1e-6, `spawn points ${i},${j} must be at least minDist apart`);
    }
  }
}

// 3) 좌표가 0~1 정규화 범위 안에 있다
{
  const regions = [makeRegion(0, 'small', 0, 0, 10, 10)];
  const { spawnPoints } = place({ regions, width: 10, height: 10, rng: { next: mulberry32(2) } });
  spawnPoints.forEach((p) => {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1, 'coordinates must be normalized 0..1');
  });
}

// 4) 빽빽하게 붙은 작은 영역들 — 고정 전에는 일부 영역이 배치 공간 부족으로 0개까지
//    떨어질 수 있었던 케이스 (Critical 1 회귀 테스트). 20x20 공간에 3x3짜리 작은 영역
//    16개를 촘촘히 채워 넣고, minDistanceFrac을 크게 잡아 rejection-sampling이 거의
//    항상 실패하도록 강제한다.
{
  const regions = [];
  let id = 0;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      regions.push(makeRegion(id++, 'medium', gx * 5, gy * 5, 3, 3));
    }
  }
  const width = 20, height = 20;
  const { spawnPoints } = place({
    regions, width, height,
    rng: { next: mulberry32(7) },
    minDistanceFrac: 0.5 // 최대 변(20) * 0.5 = 10px, 3x3짜리 영역들 사이에서는 사실상 항상 충돌
  });
  regions.forEach((region) => {
    assert.ok(
      spawnPoints.some((p) => p.regionId === region.id),
      `region ${region.id} must have at least one spawn point even under tight packing (Critical 1 fix)`
    );
  });
}

console.log('test-spawn-placement.js: all assertions passed');
