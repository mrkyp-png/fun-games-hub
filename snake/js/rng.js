(function (root) {
  'use strict';

  // mulberry32 시드 PRNG — 색칠앱 app.js의 seededRegionColors()와 동일 알고리즘
  // (검증된 패턴 재사용, 임의로 다른 PRNG로 바꾸지 말 것).
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // FNV-1a 문자열 해시 — 문자열 시드(레벨명 등)를 mulberry32의 정수 시드로 변환
  function hashSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  const api = { mulberry32, hashSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.RNG = api; }
})(typeof window !== 'undefined' ? window : null);
