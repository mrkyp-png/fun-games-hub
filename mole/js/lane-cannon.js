(function (root) {
  'use strict';

  // 무기 스킨: 대포. lane-hammer.js 와 같은 인터페이스
  // (create({layer}) → { strike, update, isBusy, home, clear }).
  //
  // 조준 = 스프라이트 1개 회전이 아니라 **3포즈**. 목표 구멍 각도로 가장 가까운
  // 포즈를 골라 표시하고, 존 안에서만 살짝 회전(tweak)해 정확히 겨눈다.
  // 포구는 항상 보드의 고정점(MZX,MZY)에 고정 — 포탄·화염·연기는 **무조건 거기서**
  // 포신 각도로 나간다. 본체는 거기서 우하단으로 뻗어 거의 화면 밖.
  //
  // 순서: 포즈 선택 + 미세 조준 → 발사(화염·연기·포탄) → 반동 → 원위치.
  // 명중감은 game.js HitFx (impactCb = 포탄 도착 시).

  const MZX = 0.865, MZY = 0.83;           // 포구 고정점 (보드 분수) — 여기서 포탄이 나간다.
                                          //  대포 본체는 여기서 우하단으로 뻗어 대부분 화면 밖(입체감).

  // 포즈 표 (튜닝 노브). 화면좌표 각도: 0=오른쪽, -90=위, 좌상향은 -180~-90.
  //  w    : 본체 폭 (보드 정사각 분수)
  //  ar   : 이미지 높이/폭 비 (cannon-low 586x479=0.817, cannon 287x340=1.185, cannon-steep 333x512=1.538)
  //  mu,mv: 스프라이트 안 포구(포탄이 나오는 지점, 0~1) — 이 점이 (MZX,MZY) 에 온다
  //  aim  : 이 포즈 포신이 겨누는 방향 (deg, 화면좌표)
  //  tweak: 존 안에서 허용하는 미세 회전 최대치 (deg)
  const POSES = [
    { key: 'low',   src: 'assets/weapons/cannon-low.png',   w: 0.34, ar: 0.817,
      mu: 0.055, mv: 0.15, aim: -152, tweak: 13 },
    { key: 'mid',   src: 'assets/weapons/cannon.png',       w: 0.28, ar: 1.185,
      mu: 0.07,  mv: 0.15, aim: -138, tweak: 20 },
    { key: 'steep', src: 'assets/weapons/cannon-steep.png', w: 0.235, ar: 1.538,
      mu: 0.50,  mv: 0.05, aim: -94,  tweak: 8 }
  ];

  const REST_KEY = 'mid';                  // 발사 후 되돌아갈 기본 대기 포즈
  const FLASH_BASE_DEG = -150;             // 화염·연기 스프라이트가 기본으로 향한 방향
  const FLASH_W = 0.30, FLASH_AR = 294 / 371;  // 화염 폭(보드분수) / 높이비 (cannon-flash 371x294)
  const SMOKE_W = 0.16, SMOKE_AR = 254 / 211;  // 연기 폭 / 높이비 (cannon-smoke 211x254)
  const AIM_MS = 90;                       // 포즈 전환 + 미세 조준
  const RECOIL = [0.012, 0.024, 0.040];    // 살짝/보통/강 (보드 분수)
  const KICK_SEC = 0.06, SETTLE_SEC = 0.34;
  const BALL_MS = 105;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function ease(k) { return k * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }
  function angDiff(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }

  function create({ layer }) {
    const el = document.createElement('div');
    el.className = 'lane-cannon';
    el.innerHTML =
      '<img class="lc-ball" alt="" src="assets/weapons/cannon-ball.png">' +
      '<div class="lc-rig">' +
      '  <img class="lc-smoke" alt="" src="assets/weapons/cannon-smoke.png">' +
      '  <img class="lc-flash" alt="" src="assets/weapons/cannon-flash.png">' +
      POSES.map((p) => '  <img class="lc-body" data-pose="' + p.key + '" alt="" src="' + p.src + '" hidden>').join('') +
      '</div>';
    layer.appendChild(el);
    const rig = el.querySelector('.lc-rig');
    const flash = el.querySelector('.lc-flash');
    const smoke = el.querySelector('.lc-smoke');
    const ball = el.querySelector('.lc-ball');
    const bodies = {};
    POSES.forEach((p) => { bodies[p.key] = el.querySelector('.lc-body[data-pose="' + p.key + '"]'); });

    // 회전축 = 포구 고정점. 미세 조준·반동 모두 rig 통째로.
    rig.style.transformOrigin = (MZX * 100).toFixed(2) + '% ' + (MZY * 100).toFixed(2) + '%';
    // 각 포즈 본체 배치 (top-left 기준) — 포즈의 포구점이 (MZX,MZY) 에 오도록.
    POSES.forEach((p) => {
      const hFrac = p.w * p.ar;
      const im = bodies[p.key];
      im.style.width = (p.w * 100).toFixed(2) + '%';
      im.style.left = ((MZX - p.mu * p.w) * 100).toFixed(2) + '%';
      im.style.top = ((MZY - p.mv * hFrac) * 100).toFixed(2) + '%';
    });
    // 화염·연기: 오른쪽-중앙(포구 부착점)이 (MZX,MZY) 에 오도록 배치
    function placeFx(im, w, ar) {
      im.style.width = (w * 100).toFixed(2) + '%';
      im.style.left = ((MZX - w) * 100).toFixed(2) + '%';
      im.style.top = ((MZY - w * ar / 2) * 100).toFixed(2) + '%';
    }
    placeFx(flash, FLASH_W, FLASH_AR);
    placeFx(smoke, SMOKE_W, SMOKE_AR);

    const restPose = POSES.find((p) => p.key === REST_KEY) || POSES[0];
    let pose = null;
    let phase = 'home', t = 0;
    let residual = 0, resFrom = 0, resTo = 0, resT = 0;
    let recoilAmt = 0;
    let timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function showPose(p) {
      if (pose !== p) {
        if (pose) bodies[pose.key].hidden = true;
        bodies[p.key].hidden = false;
        pose = p;
      }
    }

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.3;
      clearTimers();

      // 포구 → 목표 방향
      const want = Math.atan2(ty - MZY, tx - MZX) * 180 / Math.PI;
      let best = POSES[0], bestD = 1e9;
      POSES.forEach((p) => { const d = Math.abs(angDiff(want, p.aim)); if (d < bestD) { bestD = d; best = p; } });
      showPose(best);

      resFrom = residual;
      resTo = clamp(angDiff(want, best.aim), -best.tweak, best.tweak);
      resT = 0;
      phase = 'aim'; t = 0;
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];

      after(AIM_MS, () => {
        phase = 'kick'; t = 0;
        const rot = (best.aim + resTo - FLASH_BASE_DEG).toFixed(1) + 'deg';
        [flash, smoke].forEach((im) => im.style.setProperty('--lc-rot', rot));
        flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
        after(70, () => { smoke.classList.remove('is-on'); void smoke.offsetWidth; smoke.classList.add('is-on'); });

        ball.style.transition = 'none';
        ball.style.left = (MZX * 100).toFixed(2) + '%';
        ball.style.top = (MZY * 100).toFixed(2) + '%';
        ball.style.opacity = '1';
        ball.style.transform = 'translate(-50%,-50%) scale(1.15) rotate(0deg)';
        void ball.offsetWidth;
        ball.style.transition = 'left ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), top ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), transform ' + BALL_MS + 'ms linear';
        ball.style.left = (tx * 100).toFixed(2) + '%';
        ball.style.top = (ty * 100).toFixed(2) + '%';
        ball.style.transform = 'translate(-50%,-50%) scale(0.8) rotate(220deg)';
        after(BALL_MS, () => { ball.style.opacity = '0'; if (onImpact) onImpact(); });
      });
      paint();
    }

    function update(dt) {
      if (phase === 'aim') {
        resT += dt;
        const k = easeOut(clamp01(resT / (AIM_MS / 1000)));
        residual = resFrom + (resTo - resFrom) * k;
      } else if (phase === 'kick') {
        t += dt;
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; }
      } else if (phase === 'settle') {
        t += dt;
        const k = easeOut(clamp01(t / SETTLE_SEC));
        residual = resTo * (1 - k);
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; residual = 0; showPose(restPose); }
      }
      paint();
    }

    function paint() {
      let amt = 0;
      if (phase === 'kick') amt = recoilAmt * ease(clamp01(t / KICK_SEC));
      else if (phase === 'settle') amt = recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC)));
      const aim = (pose ? pose.aim : FLASH_BASE_DEG) + residual;
      const rdir = (aim + 180) * Math.PI / 180;
      const dx = Math.cos(rdir) * amt, dy = Math.sin(rdir) * amt;
      rig.style.transform =
        'translate(' + (dx * 100).toFixed(3) + '%, ' + (dy * 100).toFixed(3) + '%) ' +
        'rotate(' + residual.toFixed(2) + 'deg)';
    }

    function isBusy() { return phase === 'aim' || phase === 'kick'; }

    function home() {
      clearTimers();
      phase = 'home'; t = 0; resT = 0;
      residual = resFrom = resTo = 0;
      flash.classList.remove('is-on'); smoke.classList.remove('is-on');
      ball.style.opacity = '0';
      showPose(restPose);
      paint();
    }

    function clear() { clearTimers(); el.remove(); }

    showPose(restPose);
    paint();
    return { strike, update, isBusy, home, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneCannon = api; }
})(typeof window !== 'undefined' ? window : null);
