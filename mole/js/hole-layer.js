(function (root) {
  'use strict';

  // #mole-hole-layer: 레벨 시작 시 4x4 격자로 구멍 그림 16개를 깔고, 게임이 끝날 때까지
  // 그대로 유지한다 (사용자 확정 — 칸을 완성해도 구멍은 사라지지 않는다).
  // 구멍은 두 겹: hole.png(뒤, pop 레이어 아래) + hole-front.png(앞턱, pop 레이어 위).
  // 두더지는 그 사이에서 들락날락 → 아랫몸이 구멍 모양대로 앞턱에 가려진다.

  const MS = root.MoleGame.MoleSprites;

  function create({ container, frontContainer, spawnPoints, season }) {
    const backImgs = [];
    const frontImgs = [];

    function place(parent, cls, sprite, sp, list) {
      const img = document.createElement('img');
      img.className = cls;
      img.alt = '';
      img.src = MS.spriteUrl(sprite);
      img.style.left = (sp.x * 100) + '%';
      img.style.top = (sp.y * 100) + '%';
      parent.appendChild(img);
      list.push(img);
    }

    function applySeason(s) {
      const suffix = s ? '-' + s : '';
      backImgs.forEach((img) => { img.src = MS.spriteUrl('hole' + suffix); });
      frontImgs.forEach((img) => { img.src = MS.spriteUrl('hole-front' + suffix); });
    }

    spawnPoints.forEach((sp) => {
      place(container, 'mole-hole', 'hole', sp, backImgs);
      place(frontContainer, 'mole-hole-front', 'hole-front', sp, frontImgs);
    });
    applySeason(season);

    function clear() {
      backImgs.concat(frontImgs).forEach((img) => img.remove());
      backImgs.length = 0;
      frontImgs.length = 0;
    }

    // 피버타임 나이트 구멍(사용자 지정) — 보드 슬라이딩 시작 시 'night', 복귀 시작 시
    // 라운드 시즌으로 전환(game.js swapBoardPositions 에서 호출).
    return { clear, setSeason: applySeason };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HoleLayer = api; }
})(typeof window !== 'undefined' ? window : null);
