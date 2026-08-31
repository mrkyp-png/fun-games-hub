(function (root) {
  'use strict';

  // 그림을 gridSize x gridSize 의 고정 격자로 나눈다 (사용자 확정: 4x4 = 16칸).
  // 칸마다 구멍/두더지 출현 포인트 1개(중앙). 배경 실루엣은 칸별로 뚫지 않고 통째로
  // 옅어지므로(region-reveal.js), 영역은 id 와 출현 지점 위치만 있으면 된다.

  // 세로로 위/아래 여백을 둔다: 윗줄 두더지가 올라올 머리 공간을 확보하려고
  // 격자를 보드 정중앙이 아니라 위 16% ~ 아래 86% 범위에 배치한다 (사용자 피드백).
  // 구멍/두더지가 배경 그림보다 살짝 아래에 있어서 격자 전체를 1mm(≈1%) 위로 올림.
  const V_TOP = 0.17;
  const V_BOTTOM = 0.84;

  function partition({ gridSize }) {
    const regions = [];
    const spawnPoints = [];
    const vStep = gridSize > 1 ? (V_BOTTOM - V_TOP) / (gridSize - 1) : 0;
    let id = 0;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        regions.push({ id });
        spawnPoints.push({
          id,
          regionId: id,
          col,
          row,
          x: (col + 0.5) / gridSize,
          y: V_TOP + row * vStep
        });
        id++;
      }
    }
    return { regions, spawnPoints };
  }

  const api = { partition };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.GridPartition = api; }
})(typeof window !== 'undefined' ? window : null);
