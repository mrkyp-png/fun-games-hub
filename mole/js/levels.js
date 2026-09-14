(function (root) {
  'use strict';

  // emojiId 순서는 지렁이 게임(snake/js/levels.js)과 동일한 우주 테마 10종 재사용.
  // §3 영역 수: 사용자 확정으로 전 레벨 4x4 = 16칸 고정 (레벨별 증가표 폐기).
  // 동시출현(두더지/동물/폭탄) 표는 전체 챕터 기획서 작업(2026-09-14) 중 사용자가 직접
  // 여러 차례 재조정한 값 — 더 이상 "임의 변경 금지" 아님, 사용자 지시로 계속 바뀔 수 있음.
  const REGION_COUNT = 16;
  const EMOJI_IDS = [
    'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
    'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
  ];
  const MOLE_DURATION = [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0];
  // 챕터4~10(10라운드) 전용 동시 출현 표(사용자 재조정, 2026-09-14).
  // 챕터1~3(9홀)은 이 표대로 하면 너무 쉬워서(사용자 지적) game.js 에 별도 표로 뺌.
  const MAX_CONCURRENT_MOLES = [3, 4, 4, 5, 5, 5, 6, 6, 7, 7];
  const MAX_CONCURRENT_ANIMALS = [0, 1, 2, 2, 2, 2, 3, 3, 3, 3];
  const MAX_CONCURRENT_BOMBS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const TIME_LIMIT = [60, 60, 60, 55, 55, 55, 50, 50, 45, 45];

  const LEVELS = [];
  for (let i = 0; i < 10; i++) {
    LEVELS.push({
      level: i + 1,
      regionCount: REGION_COUNT,
      moleDuration: MOLE_DURATION[i],
      maxConcurrentMoles: MAX_CONCURRENT_MOLES[i],
      maxConcurrentAnimals: MAX_CONCURRENT_ANIMALS[i],
      maxConcurrentBombs: MAX_CONCURRENT_BOMBS[i],
      timeLimit: TIME_LIMIT[i],
      emojiId: EMOJI_IDS[i]
    });
  }

  const api = { LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; Object.assign(root.MoleGame, api); }
})(typeof window !== 'undefined' ? window : null);
