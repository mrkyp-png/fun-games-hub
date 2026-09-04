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

  const MZX = 0.822, MZY = 0.83;           // 포구 고정점 (보드 분수) — 여기서 포탄이 나간다.
                                          //  대포 본체는 여기서 우하단으로 뻗어 대부분 화면 밖(입체감).

  // 포즈 표 (튜닝 노브). 화면좌표 각도: 0=오른쪽, -90=위, 좌상향은 -180~-90.
  //  w    : 본체 폭 (보드 정사각 분수)
  //  ar   : 이미지 높이/폭 비 (cannon-low 586x479=0.817, cannon 287x340=1.185, cannon-steep 333x512=1.538)
  //  mu,mv: 스프라이트 안 포구(포탄이 나오는 지점, 0~1) — 이 점이 (MZX+dx, MZY+dy) 에 온다
  //  dx,dy: 이 포즈만 포구 고정점에서 살짝 이동 (보드 분수, 없으면 0)
  //  aim  : 이 포즈 포신이 겨누는 방향 (deg, 화면좌표)
  //  tweak: 존 안에서 허용하는 미세 회전 최대치 (deg)
  const POSES = [
    { key: 'low',   src: 'assets/weapons/cannon-low.png',   w: 0.291, ar: 0.817,
      mu: 0.055, mv: 0.15, aim: -152, tweak: 13, dx: -0.07 },
    { key: 'mid',   src: 'assets/weapons/cannon.png',       w: 0.266, ar: 1.185,
      mu: 0.07,  mv: 0.15, aim: -138, tweak: 20, dx: -0.014 },
    { key: 'steep', src: 'assets/weapons/cannon-steep.png', w: 0.223, ar: 1.538,
      mu: 0.50,  mv: 0.05, aim: -94,  tweak: 15, dx: 0.045 }
  ];

  const REST_KEY = 'mid';                  // 발사 후 되돌아갈 기본 대기 포즈
  const AIM_DEG_FALLBACK = -120;           // pose 없을 때 반동 방향 계산용

  // 발사 이펙트 = 5프레임 연속 (사용자 제공 '화염, 연기.png' → cannon-fx1~5).
  // 스파크 → 폭발 → 불+연기 → 사그라짐 → 연기. 모든 프레임 560² 캔버스, 밝은 코어가 (0.58,0.52).
  const FX_FRAMES = [1, 2, 3, 4, 5].map((n) => 'assets/weapons/cannon-fx' + n + '.png');
  const FX_DUR = [40, 70, 80, 95, 260];   // 프레임별 노출 ms (연기 프레임 150→260, 더 오래 보이게)
  const FX_W = 0.24;                       // 이펙트 폭 (보드 정사각 분수, 캔버스가 정사각이라 높이도 동일) — 화염 과함 피드백으로 0.32→0.24
  const FX_CORE_X = 0.58, FX_CORE_Y = 0.52;
  const FX_BASE_AIM = -138;                // 이펙트 원화가 그려진 기준 방향(=mid 포즈 aim) — 다른 포즈는 이 차이만큼 회전시켜 포신 방향에 맞춘다
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
      '  <img class="lc-fx" alt="">' +
      POSES.map((p) => '  <img class="lc-body" data-pose="' + p.key + '" alt="" src="' + p.src + '" hidden>').join('') +
      '</div>';
    layer.appendChild(el);
    const rig = el.querySelector('.lc-rig');
    const fx = el.querySelector('.lc-fx');
    const ball = el.querySelector('.lc-ball');
    FX_FRAMES.forEach((s) => { const im = new Image(); im.src = s; }); // 프리로드 (디코드 hitch 방지)
    const bodies = {};
    POSES.forEach((p) => { bodies[p.key] = el.querySelector('.lc-body[data-pose="' + p.key + '"]'); });

    // 포즈별 유효 포구 고정점 (dx/dy 반영)
    function ax(p) { return MZX + (p && p.dx || 0); }
    function ay(p) { return MZY + (p && p.dy || 0); }

    // 회전축 = 포구 고정점. 미세 조준·반동 모두 rig 통째로.
    rig.style.transformOrigin = (MZX * 100).toFixed(2) + '% ' + (MZY * 100).toFixed(2) + '%';
    // 각 포즈 본체 배치 (top-left 기준) — 포즈의 포구점이 (ax,ay) 에 오도록.
    POSES.forEach((p) => {
      const hFrac = p.w * p.ar;
      const im = bodies[p.key];
      im.style.width = (p.w * 100).toFixed(2) + '%';
      im.style.left = ((ax(p) - p.mu * p.w) * 100).toFixed(2) + '%';
      im.style.top = ((ay(p) - p.mv * hFrac) * 100).toFixed(2) + '%';
    });
    // 발사 이펙트: 프레임 밝은 코어(FX_CORE)가 포구(ax,ay)에 오도록 배치.
    // 회전/확대 기준점도 같은 코어 지점으로 잡아, 포즈별 회전이나 프레임별 확대에도
    // 코어가 포구에서 이탈하지 않게 한다.
    function placeFx(p) {
      fx.style.width = (FX_W * 100).toFixed(2) + '%';
      fx.style.left = ((ax(p) - FX_CORE_X * FX_W) * 100).toFixed(2) + '%';
      fx.style.top = ((ay(p) - FX_CORE_Y * FX_W) * 100).toFixed(2) + '%';
      fx.style.transformOrigin = (FX_CORE_X * 100).toFixed(2) + '% ' + (FX_CORE_Y * 100).toFixed(2) + '%';
    }

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
        placeFx(p);
      }
    }

    // 5프레임 발사 이펙트 재생. 이펙트 원화는 mid 포즈 방향으로 그려져 있으므로,
    // 현재 포즈 각도(pose.aim)와의 차이만큼 회전시켜 포신 방향에 맞춘다.
    function playFx() {
      const rot = (pose ? pose.aim : FX_BASE_AIM) - FX_BASE_AIM;
      let acc = 0;
      FX_FRAMES.forEach((srcp, i) => {
        after(acc, () => {
          fx.src = srcp;
          fx.style.transition = 'none';
          fx.style.opacity = '1';
          fx.style.transform = 'rotate(' + rot.toFixed(1) + 'deg) scale(' + (0.70 + i * 0.07).toFixed(2) + ')';
        });
        acc += FX_DUR[i];
      });
      // 마지막 프레임 페이드아웃
      after(acc - FX_DUR[FX_FRAMES.length - 1] + 30, () => {
        fx.style.transition = 'opacity 220ms ease-out, transform 260ms ease-out';
        fx.style.opacity = '0';
        fx.style.transform = 'rotate(' + rot.toFixed(1) + 'deg) scale(1.3)';
      });
    }
    function resetFx() { fx.style.transition = 'none'; fx.style.opacity = '0'; fx.style.transform = 'scale(0.7)'; fx.removeAttribute('src'); }

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
        playFx();

        ball.style.transition = 'none';
        ball.style.left = (ax(best) * 100).toFixed(2) + '%';
        ball.style.top = (ay(best) * 100).toFixed(2) + '%';
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
      const aim = (pose ? pose.aim : AIM_DEG_FALLBACK) + residual;
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
      resetFx();
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
