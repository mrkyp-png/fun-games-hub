(function (root) {
  'use strict';

  // 무기 스킨: 대포. lane-hammer.js 와 같은 인터페이스
  // (create({layer}) → { strike, update, isBusy, home, clear }).
  //
  // 순서: 포신이 그 구멍 쪽으로 조준(회전) → 포탄 발사 → 뒤로 반동 → 원위치.
  // 본체 스프라이트·크기 고정. 우하단 낮게(다이얼러 바로 위) 앉혀 두더지 구멍을 안 가림.
  // 명중감은 game.js HitFx (impactCb = 포탄 도착 시).

  const PIVOT_X = 0.875, PIVOT_Y = 0.885;   // 회전축(캐리지 축) 보드 분수 — 없앤 우하단 구멍 자리
  const CANNON_W = 0.21;                    // 본체 폭 (+10%)
  const BODY_CY = -0.030;                   // 본체 중심 = 회전축보다 이만큼 위 (축이 스프라이트 하단쪽이라)
  const MUZZLE_R = 0.66, MUZZLE_A = -150;   // 회전축에서 포구까지 (본체폭 배수, 각도 deg 화면좌표)
  const REST_DEG = 0;                       // 스프라이트 기본 각도 (포신 이미 좌상향)
  const AIM_MS = 80;                        // 조준 회전
  const RECOIL = [0.010, 0.020, 0.036];     // 살짝/보통/강 (보드 분수)
  const KICK_SEC = 0.06, SETTLE_SEC = 0.34;
  const BALL_MS = 100;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }

  function create({ layer }) {
    const el = document.createElement('div');
    el.className = 'lane-cannon';
    el.innerHTML =
      '<img class="lc-ball" alt="" src="assets/weapons/cannon-ball.png">' +
      '<div class="lc-rig">' +
      '  <img class="lc-smoke" alt="" src="assets/weapons/cannon-smoke.png">' +
      '  <img class="lc-flash" alt="" src="assets/weapons/cannon-flash.png">' +
      '  <img class="lc-body" alt="" src="assets/weapons/cannon.png">' +
      '</div>';
    layer.appendChild(el);
    const rig = el.querySelector('.lc-rig');
    const body = el.querySelector('.lc-body');
    const flash = el.querySelector('.lc-flash');
    const smoke = el.querySelector('.lc-smoke');
    const ball = el.querySelector('.lc-ball');

    // 리그 = 레이어 전체 크기. transform-origin = 회전축. 회전/반동은 리그가 통째로.
    // 내부 요소는 % (레이어 = --sq 정사각) 로 배치.
    rig.style.transformOrigin = (PIVOT_X * 100).toFixed(2) + '% ' + (PIVOT_Y * 100).toFixed(2) + '%';
    body.style.width = (CANNON_W * 100).toFixed(2) + '%';
    body.style.left = (PIVOT_X * 100).toFixed(2) + '%';
    body.style.top = ((PIVOT_Y + BODY_CY) * 100).toFixed(2) + '%';
    // 포구 위치 (회전축 기준, 미회전)
    const mrad = MUZZLE_A * Math.PI / 180;
    const mox = Math.cos(mrad) * MUZZLE_R * CANNON_W;
    const moy = Math.sin(mrad) * MUZZLE_R * CANNON_W;
    [flash, smoke].forEach((im) => {
      im.style.left = ((PIVOT_X + mox) * 100).toFixed(2) + '%';
      im.style.top = ((PIVOT_Y + moy) * 100).toFixed(2) + '%';
    });

    let phase = 'home', t = 0;
    let aimDeg = REST_DEG, aimFrom = REST_DEG, aimTo = REST_DEG, aimT = 0;
    let recoilAmt = 0;
    let timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function worldMuzzle(deg) {
      const r = deg * Math.PI / 180;
      // 회전축 → 포구 벡터를 aim 만큼 추가 회전
      const base = MUZZLE_A * Math.PI / 180;
      const a = base + r;
      return {
        x: PIVOT_X + Math.cos(a) * MUZZLE_R * CANNON_W,
        y: PIVOT_Y + Math.sin(a) * MUZZLE_R * CANNON_W
      };
    }

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.3;
      clearTimers();

      // 조준각 = 회전축→목표 방향 - (회전축→포구 기본 방향)
      const want = Math.atan2(ty - PIVOT_Y, tx - PIVOT_X) * 180 / Math.PI;
      aimFrom = aimDeg;
      aimTo = Math.max(-42, Math.min(42, want - MUZZLE_A));
      aimT = 0;
      phase = 'aim'; t = 0;
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];

      // 조준 끝나면 발사
      after(AIM_MS, () => {
        phase = 'kick'; t = 0;
        flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
        after(70, () => { smoke.classList.remove('is-on'); void smoke.offsetWidth; smoke.classList.add('is-on'); });

        const m = worldMuzzle(aimTo);
        ball.style.transition = 'none';
        ball.style.left = (m.x * 100).toFixed(2) + '%';
        ball.style.top = (m.y * 100).toFixed(2) + '%';
        ball.style.opacity = '1';
        ball.style.transform = 'translate(-50%,-50%) scale(1.15) rotate(0deg)';
        void ball.offsetWidth;
        ball.style.transition = 'left ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), top ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), transform ' + BALL_MS + 'ms linear';
        ball.style.left = (tx * 100).toFixed(2) + '%';
        ball.style.top = (ty * 100).toFixed(2) + '%';
        // 회전 = 포탄이 굴러가는 느낌
        ball.style.transform = 'translate(-50%,-50%) scale(0.8) rotate(220deg)';
        after(BALL_MS, () => { ball.style.opacity = '0'; if (onImpact) onImpact(); });
      });
      paint();
    }

    function update(dt) {
      if (phase === 'aim') {
        aimT += dt;
        const k = easeOut(clamp01(aimT / (AIM_MS / 1000)));
        aimDeg = aimFrom + (aimTo - aimFrom) * k;
      } else if (phase === 'kick') {
        t += dt;
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; }
      } else if (phase === 'settle') {
        t += dt;
        const k = easeOut(clamp01(t / SETTLE_SEC));
        aimDeg = aimTo * (1 - k);   // 포신 원위치로
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; aimDeg = REST_DEG; }
      }
      paint();
    }

    function paint() {
      let amt = 0;
      if (phase === 'kick') amt = recoilAmt * ease(clamp01(t / KICK_SEC));
      else if (phase === 'settle') amt = recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC)));
      // 반동 = 조준된 포구방향의 반대 (우하단쪽으로 킥백).
      const rdir = (MUZZLE_A + aimDeg + 180) * Math.PI / 180;
      const dx = Math.cos(rdir) * amt, dy = Math.sin(rdir) * amt;
      rig.style.transform =
        'translate(' + (dx * 100).toFixed(3) + '%, ' + (dy * 100).toFixed(3) + '%) ' +
        'rotate(' + aimDeg.toFixed(2) + 'deg)';
    }

    function isBusy() { return phase === 'aim' || phase === 'kick'; }

    function home() {
      clearTimers();
      phase = 'home'; t = 0; aimT = 0;
      aimDeg = aimFrom = aimTo = REST_DEG;
      flash.classList.remove('is-on'); smoke.classList.remove('is-on');
      ball.style.opacity = '0';
      paint();
    }

    function clear() { clearTimers(); el.remove(); }

    paint();
    return { strike, update, isBusy, home, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneCannon = api; }
})(typeof window !== 'undefined' ? window : null);
