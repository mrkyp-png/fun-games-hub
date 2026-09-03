(function (root) {
  'use strict';

  // 타격 연출 스포너 (기획서 §5 v1.4). 전부 fire-and-forget.
  // 좌표는 #mole-board 기준 분수(0~1). hammer-fx.js 를 대체한다.

  let audioCtx = null;

  // ---- 타격음 튜닝 (미리보기에서 이 값만 만져도 됨) ----
  const HIT_GAIN = 0.55;          // 두더지 처치 타격음 전체 볼륨
  const HIT_PITCH_JITTER = 0.08;  // 매 타격 ±8% 재생속도(피치) 흔들기 (반복돼도 복붙처럼 안 들리게)
  const HIT_GAIN_JITTER = 0.15;   // 매 타격 ±15% 볼륨 흔들기
  const TAP_GAIN = 0.32;          // 다타 중간타(빼꼼/모자, 안 죽음) 볼륨
  const TAP_RATE = 1.35;          // 다타 중간타는 재생속도를 올려 더 가볍고 높게

  // 두더지 처치 타격음 파일 (사용자 제공, 바탕화면 타격소리1~4 → 정규화/트리밍). 타격마다 랜덤 1개 + 지터.
  const HIT_URLS = ['audio/hit1.mp3', 'audio/hit2.mp3', 'audio/hit3.mp3', 'audio/hit4.mp3'];
  let hitBuffers = null;   // AudioBuffer[] (디코드 완료 후)
  let hitLoading = false;

  function loadHitBuffers(ctx) {
    if (hitBuffers || hitLoading || typeof fetch !== 'function') return;
    hitLoading = true;
    Promise.all(HIT_URLS.map((u) =>
      fetch(u).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
    )).then((bufs) => { hitBuffers = bufs; })
      .catch(() => { hitLoading = false; }); // 실패 시 punchSynth 폴백
  }

  // 파일 로드 전/실패 시 폴백용 합성 프리셋 5종.
  // [몸통시작Hz, 몸통끝Hz, 몸통길이s, 노이즈 로우패스Hz, 노이즈길이s, 노이즈비중]
  const PUNCH_PRESETS = [
    [140, 50, 0.090, 900, 0.045, 0.40],  // 묵직한 퍽
    [120, 52, 0.080, 1500, 0.038, 0.52], // 단단한 팍
    [100, 48, 0.070, 2200, 0.030, 0.62], // 짝 (표면음 강조)
    [150, 60, 0.060, 1200, 0.028, 0.45], // 톡 (짧고 타이트)
    [95, 45, 0.110, 1100, 0.050, 0.48]   // 낮게 울리는 붐
  ];

  let noiseBuf = null;
  function whiteNoise(ctx) {
    if (noiseBuf) return noiseBuf;
    const n = Math.floor(ctx.sampleRate * 0.2);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function getCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    loadHitBuffers(audioCtx); // ctx 생기는 즉시 타격음 파일 프리로드
    return audioCtx;
  }

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

  function sfxOff() {
    return window.FGH && window.FGH.Settings && !window.FGH.Settings.sfxEnabled();
  }

  function tone(freq, type) {
    if (sfxOff()) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq * (0.92 + Math.random() * 0.16);
      g.gain.setValueAtTime(0.14, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.13);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  // 주먹으로 내려치는 타격음. 우선 사용자 제공 파일(랜덤 1/4 + 재생속도·볼륨 지터),
  // 파일이 아직 로드 안 됐거나 디코드 실패 시 합성(punchSynth) 폴백.
  // opts.light: 다타 두더지의 안 죽은 타격 — 높고 가볍게 (아직 살아있다는 신호).
  function punch(opts) {
    if (sfxOff()) return;
    const light = !!(opts && opts.light);
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const gain = Math.max(0.02, (light ? TAP_GAIN : HIT_GAIN) *
        (1 + (Math.random() * 2 - 1) * HIT_GAIN_JITTER));
      const rate = (light ? TAP_RATE : 1) * (1 + (Math.random() * 2 - 1) * HIT_PITCH_JITTER);

      if (hitBuffers && hitBuffers.length) {
        const src = ctx.createBufferSource();
        src.buffer = hitBuffers[(Math.random() * hitBuffers.length) | 0];
        src.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(g).connect(ctx.destination);
        src.start();
        return;
      }
      punchSynth(ctx, light);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  function punchSynth(ctx, light) {
    try {
      const t = ctx.currentTime;
      const p = PUNCH_PRESETS[(Math.random() * PUNCH_PRESETS.length) | 0];
      const pitch = 1 + (Math.random() * 2 - 1) * HIT_PITCH_JITTER;
      const bodyMul = light ? 1.7 : 1;
      const level = (light ? TAP_GAIN : HIT_GAIN) * (1 + (Math.random() * 2 - 1) * HIT_GAIN_JITTER);

      const master = ctx.createGain();
      master.gain.value = Math.max(0.02, level);
      master.connect(ctx.destination);

      // 몸통 — 사인, 피치가 빠르게 떨어진다 = "퍽"의 무게
      const bodyDur = p[2] * (light ? 0.6 : 1);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(p[0] * pitch * bodyMul, t);
      o.frequency.exponentialRampToValueAtTime(p[1] * pitch * bodyMul, t + bodyDur);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(light ? 0.5 : 1, t + 0.004);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + bodyDur);
      o.connect(bg).connect(master);
      o.start(t);
      o.stop(t + bodyDur + 0.02);

      // 임팩트 — 로우패스로 깎은 노이즈 버스트 = 표면 "짝/툭"
      const nDur = p[4];
      const ns = ctx.createBufferSource();
      ns.buffer = whiteNoise(ctx);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = p[3] * (light ? 1.6 : 1);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(p[5] * (light ? 0.8 : 1), t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + nDur);
      ns.connect(lp).connect(ng).connect(master);
      ns.start(t);
      ns.stop(t + nDur + 0.02);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  function vibrate(pattern) {
    if (window.FGH && window.FGH.Settings) {
      window.FGH.Settings.vibrate(pattern); // 진동 설정 반영
    } else if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* noop */ }
    }
  }

  function moleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.bam') + '</span>');
    spawnAt(boardEl, 'hit-fx-helmet', xFrac, yFrac);
    for (let i = 0; i < 5; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 60)) + 'px');
    }
    vibrate([0, 15, 35, 12]); // 짧은 더블 — 뭉툭한 "쿵" 대신 또렷한 "탁"
    punch();
  }

  // 저글 보너스 — 잡은 두더지가 내려갈 때 한 번 더 맞힘. 가볍고 경쾌하게 + "더블!" 텍스트.
  function juggle(boardEl, xFrac, yFrac) {
    spawnAt(boardEl, 'hit-fx-burst hit-fx-burst--juggle', xFrac, yFrac,
      '<span>' + window.FGH.I18N.t('mole.fx.double') + '</span>');
    vibrate(12);
    punch({ light: true });
  }

  // 다타 두더지의 마지막이 아닌 타격 (빼꼼/모자 단계) — 처치는 아니지만 맞은 느낌을 준다.
  function moleTap(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.tap') + '</span>');
    vibrate(15);
    punch({ light: true }); // 처치 펀치보다 높고 가볍게 — "아직 안 죽음"
  }

  function obstacleHit(boardEl, xFrac, yFrac /*, kind */) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-clang', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.clang') + '</span>');
    vibrate([10, 25, 10]);
    tone(140, 'sawtooth');
  }

  function whiff(boardEl, xFrac, yFrac) {
    const y = (typeof yFrac === 'number') ? yFrac : 0.9;
    for (let i = 0; i < 3; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, y);
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

  // 게임 시작(사용자 제스처) 직후 호출 — 카운트다운 동안 오디오 컨텍스트 + 타격음 파일을 미리 준비.
  function warmup() { try { getCtx(); } catch (e) { /* noop */ } }

  const api = { moleHit, juggle, moleTap, obstacleHit, whiff, emerge, warmup };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HitFx = api; }
})(typeof window !== 'undefined' ? window : null);
