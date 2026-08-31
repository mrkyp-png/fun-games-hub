(function (root) {
  'use strict';

  // 기획서 §6(유지시간)/§7(동시 두더지)/§9(방해물 수)/§10(제한시간) 표.
  // emojiId 순서는 지렁이 게임(snake/js/levels.js)과 동일한 우주 테마 10종 재사용.
  // 방해물 종류별 개수(동물/폭탄) 분할은 스펙에 총합만 있어 Claude가 정한 값
  // (총합을 반씩 나누고 폭탄 쪽에 올림) — 임의 변경 금지.
  // §3 영역 수: 사용자 확정으로 전 레벨 4x4 = 16칸 고정 (레벨별 증가표 폐기).
  const REGION_COUNT = 16;
  const EMOJI_IDS = [
    'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
    'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
  ];
  const MOLE_DURATION = [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0];
  const MAX_CONCURRENT_MOLES = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  const MAX_CONCURRENT_ANIMALS = [0, 1, 1, 2, 0, 1, 1, 2, 2, 3];
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
