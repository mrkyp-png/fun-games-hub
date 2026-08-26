(function (root) {
  'use strict';

  // 스펙 §5(먹이)/§18(적 지렁이)의 고정 수치. emojiId는 스펙 §41에서 Claude가 선정한
  // 우주 테마 10종(assets/emoji/<emojiId>.svg로 존재) — 순서·값 임의 변경 금지.
  const PLAYER_SPEED = 140;   // px/s, 스펙 §9: 전 Level 동일
  const MAX_PLAYER_LENGTH = 30; // 스펙 §10: 성장 상한, 전 Level 동일

  const EMOJI_IDS = [
    'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
    'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
  ];

  const LEVELS = [];
  for (let i = 0; i < 10; i++) {
    const level = i + 1;
    LEVELS.push({
      level,
      foodCount: 20 + i * 5,
      enemyWormCount: [2, 2, 3, 3, 4, 5, 6, 7, 8, 10][i],
      mapWidth: 2000 + i * 150,
      mapHeight: 1400 + i * 70,
      playerSpeed: PLAYER_SPEED,
      enemySpeed: 60 + i * 3, // 스펙 §20: Level 상승에 따라 소폭 증가, playerSpeed 미만 유지
      maxPlayerLength: MAX_PLAYER_LENGTH,
      emojiId: EMOJI_IDS[i]
    });
  }

  const api = { LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; Object.assign(root.SnakeGame, api); }
})(typeof window !== 'undefined' ? window : null);
