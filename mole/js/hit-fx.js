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

  // 대포 무기 스킨 전용 타격음 = 폭발음 (사용자 제공, Pixabay 로열티 프리). 대포 장착 시
  // 위 HIT_URLS 대신 이 풀에서 랜덤 1개.
  const CANNON_URLS = ['audio/cannon-boom1.mp3', 'audio/cannon-boom2.mp3', 'audio/cannon-boom3.mp3',
    'audio/cannon-boom4.mp3', 'audio/cannon-boom5.mp3', 'audio/cannon-boom6.mp3',
    'audio/cannon-boom7.mp3', 'audio/cannon-boom8.mp3'];
  let cannonBuffers = null;
  let cannonLoading = false;

  function loadHitBuffers(ctx) {
    if (hitBuffers || hitLoading || typeof fetch !== 'function') return;
    hitLoading = true;
    Promise.all(HIT_URLS.map((u) =>
      fetch(u).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
    )).then((bufs) => { hitBuffers = bufs; })
      .catch(() => { hitLoading = false; }); // 실패 시 punchSynth 폴백
  }

  function loadCannonBuffers(ctx) {
    if (cannonBuffers || cannonLoading || typeof fetch !== 'function') return;
    cannonLoading = true;
    Promise.all(CANNON_URLS.map((u) =>
      fetch(u).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
    )).then((bufs) => { cannonBuffers = bufs; })
      .catch(() => { cannonLoading = false; }); // 실패 시 hitBuffers/punchSynth 폴백
  }

  function isCannonEquipped() {
    try { return localStorage.getItem('mole.weapon') === 'cannon'; } catch (e) { return false; }
  }

  // UI 탭음(다이얼패드 숫자/더보기 메뉴 아이콘) — 사용자 제공, 랜덤 1/2 + 지터. 게임 키패드
  // 타격(punch)과는 별개 — 연타 잦은 자리라 여기 안 씀, 가끔 누르는 UI 버튼 전용.
  const UI_TAP_URLS = ['audio/ui-tap1.mp3', 'audio/ui-tap2.mp3'];
  const UI_TAP_GAIN = 0.5;
  let tapBuffers = null;
  let tapLoading = false;

  function loadTapBuffers(ctx) {
    if (tapBuffers || tapLoading || typeof fetch !== 'function') return;
    tapLoading = true;
    Promise.all(UI_TAP_URLS.map((u) =>
      fetch(u).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b))
    )).then((bufs) => { tapBuffers = bufs; })
      .catch(() => { tapLoading = false; });
  }

  // idx 0 = 다이얼패드 전용(ui-tap1), idx 1 = 그 외 UI 버튼(더보기 아이콘/만들기/홈버튼/PLAY, ui-tap2).
  // 랜덤 아님 — 자리마다 항상 같은 소리로 고정(사용자 확정).
  function uiTap(idx) {
    if (sfxOff()) return;
    try {
      const ctx = getCtx();
      if (!ctx || !tapBuffers || !tapBuffers[idx]) return;
      const src = ctx.createBufferSource();
      src.buffer = tapBuffers[idx];
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * HIT_PITCH_JITTER;
      const g = ctx.createGain();
      g.gain.value = UI_TAP_GAIN * (1 + (Math.random() * 2 - 1) * HIT_GAIN_JITTER);
      src.connect(g).connect(ctx.destination);
      src.start();
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  // 챕터 인트로 타이핑 — 글자 하나당 아주 짧은 "톡" (합성, 파일 불필요). sfx 설정 따름.
  function typeTick() {
    if (sfxOff()) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 1500 + Math.random() * 500;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.045);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
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
    if (isCannonEquipped()) loadCannonBuffers(audioCtx); // 대포 장착 중일 때만 폭발음 로드(망치 유저는 불필요한 다운로드 안 함)
    loadTapBuffers(audioCtx); // UI 탭음도 같이 프리로드
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

      // 대포 장착 중이면 폭발음 풀에서, 아니면 기존 타격음 풀에서.
      const pool = (isCannonEquipped() && cannonBuffers && cannonBuffers.length) ? cannonBuffers : hitBuffers;
      if (pool && pool.length) {
        const src = ctx.createBufferSource();
        src.buffer = pool[(Math.random() * pool.length) | 0];
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

  // 타격 지점에서 노란 별들이 사방으로 튀어나간다 (스타버스트).
  function starBurst(boardEl, xFrac, yFrac) {
    const N = 6;
    for (let i = 0; i < N; i++) {
      const st = spawnAt(boardEl, 'hit-fx-star', xFrac, yFrac, '★');
      const ang = (i / N) * 360 + (Math.random() * 30 - 15);
      const dist = 40 + Math.random() * 26;
      st.style.setProperty('--sx', (Math.cos(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
      st.style.setProperty('--sy', (Math.sin(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
      st.style.setProperty('--sr', Math.round(Math.random() * 360 - 180) + 'deg');
      st.style.setProperty('--ss', (0.7 + Math.random() * 0.6).toFixed(2));
    }
  }

  // 타격으로 얻은 점수 — 히트 지점에서 "+N" 이 위로 떠오른다.
  // game.js 가 콤보·라이트·피버 배율이 이미 반영된 실제 증가분을 넘긴다.
  function scorePop(boardEl, xFrac, yFrac, points) {
    if (!points || points <= 0) return;
    return spawnAt(boardEl, 'hit-fx-score', xFrac, yFrac, '+' + points);
  }

  // 대포 연사 발동 — 그 두더지 흙더미 부근(중앙 아래)에서 "BURST!" 가 튀어나와 제자리서 사라진다.
  function burstWord(boardEl, xFrac, yFrac) {
    return spawnAt(boardEl, 'hit-fx-burstword', xFrac, yFrac + 0.06, 'BURST!');
  }

  function moleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.bam') + '</span>');
    spawnAt(boardEl, 'hit-fx-helmet', xFrac, yFrac);
    starBurst(boardEl, xFrac, yFrac);
    for (let i = 0; i < 5; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 60)) + 'px');
    }
    vibrate([0, 15, 35, 12]); // 짧은 더블 — 뭉툭한 "쿵" 대신 또렷한 "탁"
    punch();
  }

  // 대포 처치 — 두더지가 안 내려가고 그 자리에서 그을려 흔들리다 흩뿌리며 사라진다
  // (두더지 스프라이트 연출은 pop-elements.js, 여기선 명중 순간 번쩍 + 회재/불티 파편).
  function moleBlast(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-blast-flash', xFrac, yFrac);
    const N = 14;
    for (let i = 0; i < N; i++) {
      const p = spawnAt(boardEl, 'hit-fx-ash' + (i % 3 === 0 ? ' hit-fx-ash--ember' : ''), xFrac, yFrac);
      const ang = (i / N) * 360 + (Math.random() * 40 - 20);
      const dist = 34 + Math.random() * 46;
      p.style.setProperty('--ax', (Math.cos(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
      p.style.setProperty('--ay', (Math.sin(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
    }
    vibrate([0, 20, 40, 18]);
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

  // 구멍에서 올라오는 순간 = 흙 폭발: 흙덩어리 파편이 포물선으로 튀어오르고 작은 흙먼지가 뒤따른다.
  // opts.weak = 동물/폭탄용 (파편 적고 작게, 링 생략) — 타겟인 두더지와 구분.
  function emerge(boardEl, xFrac, yFrac, opts) {
    const weak = !!(opts && opts.weak);
    const N = weak ? 5 : 8;
    for (let i = 0; i < N; i++) {
      const c = spawnAt(boardEl, 'hit-fx-clod' + (weak ? ' hit-fx-clod--weak' : ''), xFrac, yFrac + 0.02);
      const ang = -155 + (i / (N - 1)) * 130 + (Math.random() * 20 - 10); // 위쪽 부채꼴
      const dist = (weak ? 26 : 40) + Math.random() * (weak ? 26 : 40);
      c.style.setProperty('--cx', (Math.cos(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
      c.style.setProperty('--cy', (Math.sin(ang * Math.PI / 180) * dist).toFixed(1) + 'px');
      c.style.setProperty('--cr', Math.round(Math.random() * 540 - 270) + 'deg');
      c.style.setProperty('--cs', ((weak ? 0.5 : 0.6) + Math.random() * (weak ? 0.5 : 0.85)).toFixed(2));
      c.style.animationDelay = Math.round(Math.random() * 45) + 'ms';
    }
    for (let i = 0; i < (weak ? 3 : 4); i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac + 0.02);
      p.style.setProperty('--dx', (Math.round((Math.random() - 0.5) * 46)) + 'px');
    }
    if (!weak) spawnAt(boardEl, 'hit-fx-ring', xFrac, yFrac).style.setProperty('--ring', '#d9b382');
  }

  // 골드해머 지진: 발동/피격 구멍의 갈색 먼지 파동 링 + 흙먼지.
  function quakeDust(boardEl, xFrac, yFrac) {
    const r = spawnAt(boardEl, 'hit-fx-ring hit-fx-ring--quake', xFrac, yFrac);
    r.style.setProperty('--ring', '#7a4b2b');
    for (let i = 0; i < 5; i++) {
      const p = spawnAt(boardEl, 'hit-fx-dust hit-fx-dust--quake', xFrac, yFrac + 0.01);
      p.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 60) + 'px');
    }
  }

  // 지진 분신 골드해머 하나 — 목표 구멍 근처(가장 가까운 가장자리 방향 위쪽)에서 날아와 내리치고 골드로 소멸.
  // onHit = 내리치는 순간 콜백(실제 타격 판정/연출은 game.js 가).
  // kind '0'/'45' = 머리 든 채 등장 → 아래로 내리침 → 그 자세 그대로 페이드 (위로 안 튕김).
  // kind '90'  = 정면 포즈. 직선으로 그 자리에 나타나 약간 커졌다 → 약간 작아짐(앞으로 쿡 찌르기). 회전 없음.
  function quakeClone(boardEl, spriteUrl, xFrac, yFrac, kind, onHit) {
    const el = document.createElement('img');
    el.className = 'quake-clone';
    el.src = spriteUrl;
    el.alt = '';
    const hitY = Math.max(0.05, yFrac - 0.05);
    el.style.left = (xFrac * 100) + '%';

    if (kind === '90') {
      el.style.top = (hitY * 100) + '%';
      el.style.transform = 'translate(-50%, -34%) scale(0.86)';
      el.style.opacity = '0';
      boardEl.appendChild(el);
      void el.offsetWidth;
      el.style.transition = 'opacity 0.07s ease-out, transform 0.11s cubic-bezier(.2,.7,.4,1)';
      el.style.opacity = '0.8'; // 분신 투명도 20%
      el.style.transform = 'translate(-50%, -34%) scale(1.12)';   // 약간 커짐 (앞으로 옴)
      setTimeout(() => {
        el.style.transition = 'transform 0.08s ease-in';
        el.style.transform = 'translate(-50%, -34%) scale(0.94)'; // 약간 작아짐 (때리고 물러남)
        try { if (onHit) onHit(); } catch (e) { /* 무시 */ }
      }, 120);
      setTimeout(() => { el.style.transition = 'opacity 0.24s ease-out'; el.style.opacity = '0'; }, 280);
      setTimeout(() => el.remove(), 560);
      return;
    }

    // '0' / '45' — 머리 든 채 위에서 등장 → 아래로 내리침 → 자세 유지 페이드
    // 타격 순간(CHOP) 각도는 위치와 무관하게 고정 — 항상 "머리 좌측·손잡이 우측"으로 찍혀야 함(사용자 지시).
    const upY = Math.max(0.02, hitY - 0.13);
    const RAISED = 135, CHOP = -90;
    const T = (deg) => 'translate(-50%, -30%) rotate(' + deg + 'deg)';
    el.style.top = (upY * 100) + '%';
    el.style.transform = T(RAISED);
    el.style.opacity = '0';
    boardEl.appendChild(el);
    void el.offsetWidth;
    el.style.transition = 'opacity 0.08s ease-out, top 0.12s cubic-bezier(.3,.6,.4,1), transform 0.12s cubic-bezier(.3,.6,.4,1)';
    el.style.opacity = '0.8'; // 분신 투명도 20%
    el.style.transform = T(RAISED * 0.7);
    setTimeout(() => {
      el.style.transition = 'top 0.08s ease-in, transform 0.08s ease-in';
      el.style.top = (hitY * 100) + '%';
      el.style.transform = T(CHOP);
      try { if (onHit) onHit(); } catch (e) { /* 무시 */ }
    }, 130);
    setTimeout(() => { el.style.transition = 'opacity 0.26s ease-out'; el.style.opacity = '0'; }, 300);
    setTimeout(() => el.remove(), 600);
  }

  // 게임 시작(사용자 제스처) 직후 호출 — 카운트다운 동안 오디오 컨텍스트 + 타격음 파일을 미리 준비.
  function warmup() { try { getCtx(); } catch (e) { /* noop */ } }

  const api = { moleHit, moleBlast, juggle, moleTap, obstacleHit, whiff, emerge, warmup, uiTap, typeTick, scorePop, burstWord, starBurst, shake, quakeDust, quakeClone };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HitFx = api; }
})(typeof window !== 'undefined' ? window : null);
