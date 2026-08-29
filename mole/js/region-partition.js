(function (root) {
  'use strict';

  const KMEANS_ITERATIONS = 12;

  function dist2(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // 이모지 모양(alpha mask의 채워진 픽셀들)을 regionCount개의 블롭으로 나눈다.
  // k-means로 "모양을 따르되 크기가 다를 수 있는" 영역을 만든다 (기획서 §3).
  function partition({ width, height, points, regionCount, rng }) {
    if (points.length < regionCount) {
      throw new Error('partition: not enough filled points for requested regionCount');
    }

    const usedIdx = new Set();
    const centroids = [];
    while (centroids.length < regionCount) {
      const idx = Math.floor(rng.next() * points.length);
      if (usedIdx.has(idx)) continue;
      usedIdx.add(idx);
      centroids.push({ x: points[idx].x, y: points[idx].y });
    }

    let assignment = new Array(points.length).fill(0);

    for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
      for (let i = 0; i < points.length; i++) {
        let best = 0, bestDist = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = dist2(points[i], centroids[c]);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        assignment[i] = best;
      }

      const sums = centroids.map(() => ({ x: 0, y: 0, n: 0 }));
      for (let i = 0; i < points.length; i++) {
        const s = sums[assignment[i]];
        s.x += points[i].x; s.y += points[i].y; s.n += 1;
      }
      for (let c = 0; c < centroids.length; c++) {
        if (sums[c].n === 0) {
          // 빈 클러스터: 현재 가장 먼 점을 새 중심으로 삼는다 (결정론 유지를 위해 첫 최댓값 사용).
          let farIdx = 0, farDist = -1;
          for (let i = 0; i < points.length; i++) {
            const d = dist2(points[i], centroids[assignment[i]]);
            if (d > farDist) { farDist = d; farIdx = i; }
          }
          centroids[c] = { x: points[farIdx].x, y: points[farIdx].y };
        } else {
          centroids[c] = { x: sums[c].x / sums[c].n, y: sums[c].y / sums[c].n };
        }
      }
    }

    const buckets = centroids.map(() => []);
    for (let i = 0; i < points.length; i++) buckets[assignment[i]].push(points[i]);

    // 크기 등급: 픽셀 수 기준 오름차순 순위를 3등분 (0=small, 1=medium, 2=large).
    const order = buckets.map((pts, id) => ({ id, size: pts.length }))
      .sort((a, b) => a.size - b.size);
    const sizeLabel = new Array(regionCount);
    order.forEach((entry, rank) => {
      const third = Math.floor(rank * 3 / regionCount);
      sizeLabel[entry.id] = third === 0 ? 'small' : third === 1 ? 'medium' : 'large';
    });

    const regions = buckets.map((pts, id) => ({
      id,
      points: pts,
      size: sizeLabel[id],
      centroid: { x: centroids[id].x, y: centroids[id].y }
    }));

    return { regions };
  }

  const api = { partition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RegionPartition = api; }
})(typeof window !== 'undefined' ? window : null);
