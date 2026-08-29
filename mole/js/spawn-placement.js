(function (root) {
  'use strict';

  // 영역 크기 등급별 출현 포인트 개수 (기획서 §3의 범위값 1~2/2~3 중 Claude가 고정값으로 결정).
  const SPAWN_COUNT_BY_SIZE = { small: 1, medium: 2, large: 3 };
  // 보드 최대 변 길이 대비 최소 간격 비율 (Claude 결정치).
  // .mole-pop 히트박스 width가 board의 12%이므로, 동시에 활성화된 두 pop의 히트박스가
  // 겹치지 않으려면 중심 간 거리가 최소 0.12(히트박스 폭의 합인 0.06+0.06) 이상이어야
  // 한다. 여유 마진을 두기 위해 0.13으로 설정 (기획서 §4: 동시 출현 두더지끼리 겹치지 않음).
  const DEFAULT_MIN_DISTANCE_FRAC = 0.13;
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
      // 방어: region-partition.js의 마지막 재할당 패스는 이론상 빈 영역을 만들 수 있다
      // (메인 k-means 루프의 재시드 보장이 적용되지 않는 구간). 그런 입력이 와도
      // 이 영역은 출현 포인트 0개로 조용히 건너뛰고 크래시하지 않는다.
      if (region.points.length === 0) return;

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

      // 단, 0개까지 떨어지면 그 영역은 영원히 클리어할 수 없는 레벨이 된다 (두더지가
      // 출현할 곳이 없으므로). 최소 거리 제약을 이 한 지점에 한해 우회해서, accepted된
      // 점들과의 최소 거리가 가장 먼(가장 안 겹치는) 후보 지점을 강제로 채택한다.
      if (placedForRegion === 0) {
        let bestPoint = region.points[0];
        let bestMinDist = -1;
        for (let i = 0; i < region.points.length; i++) {
          const p = region.points[i];
          const minDistToAccepted = accepted.reduce((min, a) => Math.min(min, dist(a, p)), Infinity);
          if (minDistToAccepted > bestMinDist) {
            bestMinDist = minDistToAccepted;
            bestPoint = p;
          }
        }
        accepted.push(bestPoint);
        spawnPoints.push({
          id: nextId++,
          regionId: region.id,
          x: bestPoint.x / width,
          y: bestPoint.y / height
        });
      }
    });

    return { spawnPoints };
  }

  const api = { place, SPAWN_COUNT_BY_SIZE, DEFAULT_MIN_DISTANCE_FRAC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnPlacement = api; }
})(typeof window !== 'undefined' ? window : null);
