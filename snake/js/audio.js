(function (root) {
  'use strict';

  let ctx = null;
  function getCtx() {
    if (!ctx) {
      const AC = (root && (root.AudioContext || root.webkitAudioContext));
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null; // 생성 자체가 실패해도(제한된 환경 등) 게임 진행에 영향 없이 조용히 무시
      }
    }
    return ctx;
  }

  // 스펙 §14: 먹이 획득 시 짧은 "뿅!" 효과음. 과도한 이펙트 금지 요구에 맞춰 0.12초로 짧게.
  function playEatSound() {
    const c = getCtx();
    if (!c) return; // WebAudio 미지원 환경은 조용히 무시 — 게임 진행에 영향 없음
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, c.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.12);
    } catch (e) { /* 재생 실패는 무시 — 사운드는 부가 기능 */ }
  }

  const api = { playEatSound };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Audio = api; }
})(typeof window !== 'undefined' ? window : null);
