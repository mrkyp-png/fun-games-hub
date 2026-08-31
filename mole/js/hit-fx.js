(function (root) {
  'use strict';

  // 타격 연출 스포너 (기획서 §5 v1.4). 전부 fire-and-forget.
  // 좌표는 #mole-board 기준 분수(0~1). hammer-fx.js 를 대체한다.

  let audioCtx = null;

  function spawnAt(boardEl, cls, xFrac, yFrac, html) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = (xFrac * 100) + '%';
    d.style.top = (yFrac * 100) + '%';
    if (html) d.innerHTML = html;
    boardEl.appendChild(d);
    d.addEventListener('animationend', () => d.remove(), { once: true });
    setTimeout(() => d.remove(), 1200); // 애니메이션 미동작 환경 대비 안전 제거
    return d;
  }

  function shake(boardEl) {
    boardEl.classList.remove('mole-board--shake');
    void boardEl.offsetWidth; // reflow 로 애니메이션 재시작
    boardEl.classList.add('mole-board--shake');
  }

  function tone(freq, type) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq * (0.92 + Math.random() * 0.16);
      g.gain.setValueAtTime(0.14, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.13);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  function vibrate(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* noop */ } }
  }

  function moleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>쾅!</span>');
    spawnAt(boardEl, 'hit-fx-helmet', xFrac, yFrac);
    for (let i = 0; i < 5; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 60)) + 'px');
    }
    vibrate(15);
    tone(320);
  }

  function obstacleHit(boardEl, xFrac, yFrac /*, kind */) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-clang', xFrac, yFrac, '<span>깡!</span>');
    vibrate([10, 25, 10]);
    tone(140, 'sawtooth');
  }

  function whiff(boardEl, xFrac) {
    for (let i = 0; i < 3; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, 0.9);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 40)) + 'px');
    }
    tone(90, 'sine');
  }

  // 두더지가 구멍에서 올라오는 순간: 흙먼지 + 충격파 링 + 구멍 글로우 (동물엔 안 붙임).
  function emerge(boardEl, xFrac, yFrac) {
    for (let i = 0; i < 5; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac + 0.02);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 46)) + 'px');
    }
    spawnAt(boardEl, 'hit-fx-ring', xFrac, yFrac).style.setProperty('--ring', '#ffe9a8');
    spawnAt(boardEl, 'hit-fx-glow', xFrac, yFrac).style.setProperty('--glow', 'rgba(255,225,150,0.6)');
  }

  const api = { moleHit, obstacleHit, whiff, emerge };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HitFx = api; }
})(typeof window !== 'undefined' ? window : null);
