(function (root) {
  'use strict';

  // 영역 크기 등급별 출현 포인트 개수 (기획서 §3의 범위값 1~2/2~3 중 Claude가 고정값으로 결정).
  const SPAWN_COUNT_BY_SIZE = { small: 1, medium: 2, large: 3 };
  const DEFAULT_MIN_DISTANCE_FRAC = 0.09; // 보드 최대 변 길이 대비 최소 간격 비율 (Claude 결정치)
  const MAX_TRIES_PER_POINT = 200;

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function place({ regions, width, height, rng, spawnCountBySize, minDistanceFrac }) {
    const countBySize = spawnCountBySize || SPAWN_COUNT_BY_SIZE;
    const minDistPx = (minDistanceFrac === undefined ? DEFAULT_MIN_DISTANCE_FRAC : minDistanceFrac) * Math.max(width, height);
    const accepted = []; // 지금까지 확정된 지점 (원본 mask 픽셀 좌표), 영역 구분 없이 전역 검사
    const spawnPoints = [];
    let nextId = 0;

    regions.forEach((region) => {
      const want = countBySize[region.size];
      let placedForRegion = 0;
      for (let attempt = 0; attempt < want * MAX_TRIES_PER_POINT && placedForRegion < want; attempt++) {
        const candidate = region.points[Math.floor(rng.next() * region.points.length)];
        const tooClose = accepted.some((p) => dist(p, candidate) < minDistPx);
        if (tooClose) continue;
        accepted.push(candidate);
        spawnPoints.push({
          id: nextId++,
          regionId: region.id,
          x: candidate.x / width,
          y: candidate.y / height
        });
        placedForRegion++;
      }
      // 배치 공간이 부족하면 placedForRegion < want인 채로 다음 영역으로 넘어간다
      // (기획서 §4: "배치 가능한 공간이 부족하면 강제로 겹치지 않고 실제 동시 출현 수를 줄인다").
    });

    return { spawnPoints };
  }

  const api = { place, SPAWN_COUNT_BY_SIZE, DEFAULT_MIN_DISTANCE_FRAC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnPlacement = api; }
})(typeof window !== 'undefined' ? window : null);
