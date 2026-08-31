(function (root) {
  'use strict';

  // 배경 이모지 위의 어두운 실루엣 막 (사용자 확정): 칸별로 뚫는 게 아니라, 전체가
  // 90% 실루엣에서 시작해 두더지를 한 칸 잡을 때마다 5%씩 통째로 옅어진다.
  // 16칸 다 잡으면 0.90 - 16*0.05 = 0.10 → 그림이 거의 다 드러난다.

  const START = 0.90;
  const STEP = 0.05;
  const MIN = 0.08;

  function create({ canvas }) {
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, 8, 8); // 단색 채우고 불투명도만 CSS 로 조절
    canvas.style.transition = 'opacity 0.5s ease';
    let darkness = START;

    function apply() { canvas.style.opacity = String(darkness); }
    function reset() { darkness = START; apply(); }
    function lighten() { darkness = Math.max(MIN, darkness - STEP); apply(); }

    return { reset, lighten };
  }

  const api = { create, START, STEP, MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RegionReveal = api; }
})(typeof window !== 'undefined' ? window : null);
