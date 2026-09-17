(function (root) {
  'use strict';

  // 라운드 난이도 키프레임 표 — 전체 챕터 기획서(2026-09-14) 이후 챕터→라운드 재구조화
  // (2026-09-17)로 "LEVELS[단일 라운드 인덱스]" 방식을 폐기하고, 이 원본 배열들을 그대로
  // interpolate() 로 라운드 전체 시간(60s/140s)에 걸쳐 연속 보간하는 방식으로 바뀌었다.
  // 값 자체(동시출현·유지시간·확률)는 사용자가 여러 차례 재조정한 기존 값 그대로 — 더 이상
  // "임의 변경 금지" 아님, 사용자 지시로 계속 바뀔 수 있음.
  const MOLE_DURATION = [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0];
  const MAX_CONCURRENT_MOLES = [3, 4, 4, 5, 5, 5, 6, 6, 7, 7];
  const MAX_CONCURRENT_ANIMALS = [0, 1, 2, 2, 2, 2, 3, 3, 3, 3];
  const MAX_CONCURRENT_BOMBS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0.08, 0.08, 0.09, 0.11, 0.12, 0.14];
  const STRONG_BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0, 0.02, 0.03, 0.04, 0.05, 0.06];
  // 라운드1(구 챕터1~2~3 병합) 전용 — 9홀 보드는 위 10단계 표로는 너무 쉬워서(사용자 지적)
  // 별도로 더 빡빡하게 지정한 5단계 표.
  const SMALL_CHAPTER_MOLES = [3, 4, 5, 6, 7];
  // 이미 죽은 코드(어디서도 안 읽힘) — 챕터→라운드 재구조화와 무관, 사용자 승인 없이 삭제하지 않음.
  const TIME_LIMIT = [60, 60, 60, 55, 55, 55, 50, 50, 45, 45];

  // keyframes 를 elapsedSec/totalSec 비율로 선형 보간. elapsedSec 이 범위를 벗어나면 양 끝값에 clamp.
  function interpolate(keyframes, elapsedSec, totalSec) {
    const n = keyframes.length;
    if (n === 0) return 0;
    if (n === 1) return keyframes[0];
    const pos = Math.max(0, Math.min(1, elapsedSec / totalSec)) * (n - 1);
    const i = Math.floor(pos);
    if (i >= n - 1) return keyframes[n - 1];
    const frac = pos - i;
    return keyframes[i] + (keyframes[i + 1] - keyframes[i]) * frac;
  }

  const api = {
    MOLE_DURATION, MAX_CONCURRENT_MOLES, MAX_CONCURRENT_ANIMALS, MAX_CONCURRENT_BOMBS,
    BOMB_CHANCE_BY_ROUND, STRONG_BOMB_CHANCE_BY_ROUND, SMALL_CHAPTER_MOLES, TIME_LIMIT,
    interpolate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; Object.assign(root.MoleGame, api); }
})(typeof window !== 'undefined' ? window : null);
