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

  const MZX = 0.827, MZY = 0.83;           // 포구 고정점 (보드 분수) — 여기서 포탄이 나간다.
                                          //  대포 본체는 여기서 우하단으로 뻗어 대부분 화면 밖(입체감).

  // 포즈 표 (튜닝 노브). 화면좌표 각도: 0=오른쪽, -90=위, 좌상향은 -180~-90.
  //  w    : 본체 폭 (보드 정사각 분수)
  //  ar   : 이미지 높이/폭 비 (cannon-low 586x479=0.817, cannon 287x340=1.185, cannon-steep 333x512=1.538)
  //  mu,mv: 스프라이트 안 포구(포탄이 나오는 지점, 0~1) — 이 점이 (MZX+dx, MZY+dy) 에 온다
  //  dx,dy: 이 포즈만 포구 고정점에서 살짝 이동 (보드 분수, 없으면 0)
  //  aim  : 이 포즈 포신이 겨누는 방향 (deg, 화면좌표)
  //  tweak: 존 안에서 허용하는 미세 회전 최대치 (deg)
  // tweak 전부 0: 미세조준 회전을 셋 다 없앤다. 회전축(포구)이 그림 위쪽에 있고 바퀴는
  // 한참 아래라, 조금만 돌아도 바퀴 쪽이 크게 휩쓸려 "넘어지는" 것처럼 보였다(steep에서
  // 스크린샷으로 확인). 각도 정확도보다 "항상 안정적으로 서있음"을 우선한다 — 포탄은
  // 어차피 실제 목표 좌표로 직접 날아가므로 명중에는 지장 없다.
  const POSES = [
    { key: 'low',   src: 'assets/weapons/cannon-low.png',   w: 0.291, ar: 0.817,
      mu: 0.055, mv: 0.15, aim: -152, tweak: 0, dx: -0.07 },
    { key: 'mid',   src: 'assets/weapons/cannon.png',       w: 0.266, ar: 1.185,
      mu: 0.07,  mv: 0.15, aim: -138, tweak: 0, dx: -0.014 },
    { key: 'steep', src: 'assets/weapons/cannon-steep.png', w: 0.223, ar: 1.538,
      mu: 0.50,  mv: 0.05, aim: -94,  tweak: 0, dx: 0.045, dy: -0.06 }
  ];

  // 3번 버튼(row0,col2) 구멍만 예외: steep 각도(-94°)와 15.4° 차이나서 tweak=0이면
  // 안 맞아 보임. 이 구멍만 "정확히 필요한 각도로 고정 회전 → 발사 → 반동" 순서로 처리
  // (범위 허용이 아니라 그 각도 하나로 딱 돈다) — 나머지 steep 구멍은 그대로 고정.
  const HOLE3_X = 0.625, HOLE3_Y = 0.27;

  const REST_KEY = 'mid';                  // 발사 후 되돌아갈 기본 대기 포즈
  const AIM_DEG_FALLBACK = -120;           // pose 없을 때 반동 방향 계산용

  // 발사 이펙트 = 스파크(fx1) → 불+연기(fx4) → 잔여 연기(fx5), 3장 순차 재생.
  // 앵커(mu,mv) = 그림에서 "이보다 뒤(포구 쪽)로는 실제로 그려진 게 없는" 뒷끝 좌표(실측) —
  // 코어(무게중심)를 쓰면 그림의 절반이 앵커보다 뒤로 처져 포신에 겹쳐 보였다(사용자 피드백:
  // "화염이 포신을 넘어옴"). 뒷끝을 포구에 대면 그림 전체가 앵커보다 앞으로만 펼쳐진다.
  // + FX_ADVANCE 만큼 포즈 각도 방향으로 더 밀어서 포신에서 확실히 떨어지게.
  // 회전 기준각(FX_BASE_AIM)은 세 장 다 하나로 통일 — 대포 몸통·화염·불꽃·연기가
  // 항상 같은 방향으로 같이 움직여야 하기 때문(사용자 피드백). 장별로 다르면 스파크→화염
  // 전환 때 각도가 살짝 튀어 보임. 앵커(mu,mv)는 그림마다 실측한 값 그대로 유지.
  const FX_ADVANCE = 0.015;                // 포구보다 이만큼(보드분수) 더 앞으로
  // mid 포즈만 화염(burn)이 포구와 위치가 안 맞음(사용자 실측) — 우측 0.2cm + 위쪽 0.4cm
  // 이동, 각도 우측(시계방향)으로 10도 추가 회전. 스파크/연기는 이상 없어 그대로 둠.
  // 보드 실측 가로폭을 안 주셔서 폰 화면 가로 ~7cm로 가정해 cm→보드분수 환산 — 실물이 다르면
  // 아래 dx/dy를 (원하는cm / 7 * 실제cm) 로 재계산.
  const BOARD_W_CM_ASSUMED = 7;
  const BURN_NUDGE = {
    mid: { dx: 0.2 / BOARD_W_CM_ASSUMED, dy: -0.4 / BOARD_W_CM_ASSUMED, rot: 10 },
    // steep(가장 오른쪽 구멍들) 화염 — 스크린샷 보며 2차 조정: 우측 0.1cm 이동 + 각도 추가 5도(누적 10도)
    steep: { dx: 0.1 / BOARD_W_CM_ASSUMED, rot: 10 },
    low: { rot: -5 }  // low(가장 왼쪽 구멍들) 화염 각도만 반시계 5도
  };
  const FX_BASE_AIM = -156;                // 세 장 공통 회전 기준각 (fx1 -149°, fx4 -163° 실측 평균)
  // 앵커(mu,mv) = 밝은 코어와 "뒷끝(포신에 안 겹치는 경계)"의 중간점. 뒷끝만 쓰면 안 겹치긴
  // 하는데 코어가 포구에서 26~30%나 멀어져 불빛이 동떨어져 보였다(실측 후 수정) — 코어 쪽으로
  // 절반 당겨서 포구에 붙어 보이면서도 포신 겹침은 최소화.
  const SPARK_SRC = 'assets/weapons/cannon-fx1.png', SPARK_W = 0.14; // 점화 스파크 — 아주 짧게
  const SPARK_MU = 0.763, SPARK_MV = 0.718; // fx1: 코어(0.701,0.601)~뒷끝(0.825,0.834) 중간
  const BURN_SRC  = 'assets/weapons/cannon-fx4.png', BURN_W  = 0.18; // 불+연기 — 메인
  const BURN_MU = 0.828, BURN_MV = 0.534;   // fx4: 코어(0.676,0.550)~뒷끝(0.980,0.518) 중간
  const SMOKE_SRC = 'assets/weapons/cannon-fx5.png', SMOKE_W = 0.17; // 잔여 연기 — 오래 옅어짐
  const SMOKE_MU = 0.740, SMOKE_MV = 0.686; // fx5: 무게중심(0.584,0.530)~뒷끝(0.896,0.841) 중간
  const AIM_MS = 90;                       // 포즈 전환 + 미세 조준
  const HOLE3_AIM_MS = 340;                // 3번 구멍만 — 15도 회전이 눈에 보이게 천천히
                                            // (사용자: "반시계 15도 간 후, 쏘고, 반동 후 원위치")
  const RECOIL = [0.012, 0.024, 0.040];    // 살짝/보통/강 (보드 분수)
  const KICK_SEC = 0.06, SETTLE_SEC = 0.34;
  const BALL_MS = 105;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function ease(k) { return k * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }
  function angDiff(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
  // 점 (px,py)를 축 (ox,oy) 기준으로 deg만큼 회전 (CSS rotate와 같은 방향, 화면좌표 y-down).
  function rotateAround(px, py, ox, oy, deg) {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const dx = px - ox, dy = py - oy;
    return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
  }

  function create({ layer }) {
    const el = document.createElement('div');
    el.className = 'lane-cannon';
    el.innerHTML =
      '<img class="lc-ball" alt="" src="assets/weapons/cannon-ball.png">' +
      '<div class="lc-rig">' +
      '  <img class="lc-smoke" alt="" src="' + SMOKE_SRC + '">' +
      '  <img class="lc-burn" alt="" src="' + BURN_SRC + '">' +
      '  <img class="lc-spark" alt="" src="' + SPARK_SRC + '">' +
      POSES.map((p) => '  <img class="lc-body" data-pose="' + p.key + '" alt="" src="' + p.src + '" hidden>').join('') +
      '</div>';
    layer.appendChild(el);
    const rig = el.querySelector('.lc-rig');
    const spark = el.querySelector('.lc-spark');
    const burn = el.querySelector('.lc-burn');
    const smoke = el.querySelector('.lc-smoke');
    const ball = el.querySelector('.lc-ball');
    const bodies = {};
    POSES.forEach((p) => { bodies[p.key] = el.querySelector('.lc-body[data-pose="' + p.key + '"]'); });

    // 포즈별 유효 포구 고정점 (dx/dy 반영)
    function ax(p) { return MZX + (p && p.dx || 0); }
    function ay(p) { return MZY + (p && p.dy || 0); }

    // steep 포즈의 바퀴(캐리지) 위치 — 3번 구멍 회전축용. 포구(mv=0.05)에서 세로로
    // STEEP_WHEEL_MV 지점까지 내려간 곳(그림 세로 92% 부근, 바퀴가 있는 자리).
    const steepPose = POSES.find((p) => p.key === 'steep');
    const STEEP_WHEEL_MV = 0.92;
    function steepWheelPivot() {
      const height = steepPose.w * steepPose.ar;
      return { x: ax(steepPose), y: ay(steepPose) + (STEEP_WHEEL_MV - steepPose.mv) * height };
    }

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
    // 화염·연기 배치: 그림의 뒷끝 앵커(mu,mv, 정사각이라 ar=1)를 포구보다 FX_ADVANCE만큼
    // 더 앞(포즈 각도 방향)에 두고, 그 지점을 축으로 포즈 각도만큼 회전 — 그림 전체가
    // 앵커보다 앞으로만 펼쳐져서 포신에 안 넘치고, 포구에서 살짝 떨어져 나온다.
    function placeOverlay(im, w, mu, mv, p, nudge) {
      const rad = p.aim * Math.PI / 180;
      const nx = (nudge && nudge.dx) || 0, ny = (nudge && nudge.dy) || 0, nrot = (nudge && nudge.rot) || 0;
      const fx0 = ax(p) + Math.cos(rad) * FX_ADVANCE + nx;
      const fy0 = ay(p) + Math.sin(rad) * FX_ADVANCE + ny;
      im.style.width = (w * 100).toFixed(2) + '%';
      im.style.left = ((fx0 - mu * w) * 100).toFixed(2) + '%';
      im.style.top = ((fy0 - mv * w) * 100).toFixed(2) + '%';
      im.style.transformOrigin = (mu * 100).toFixed(2) + '% ' + (mv * 100).toFixed(2) + '%';
      im.style.setProperty('--rot', (p.aim - FX_BASE_AIM + nrot).toFixed(1) + 'deg');
    }
    function placeFx(p) {
      placeOverlay(spark, SPARK_W, SPARK_MU, SPARK_MV, p);
      placeOverlay(burn, BURN_W, BURN_MU, BURN_MV, p, BURN_NUDGE[p.key]);
      placeOverlay(smoke, SMOKE_W, SMOKE_MU, SMOKE_MV, p);
    }

    const restPose = POSES.find((p) => p.key === REST_KEY) || POSES[0];
    let pose = null;
    let phase = 'home', t = 0;
    let residual = 0, resFrom = 0, resTo = 0, resT = 0, curAimMs = AIM_MS;
    let aimingHole3 = false; // 3번 조준(340ms) 도중 3번을 또 누르면 매번 처음부터 다시 시작돼서
                              // 영원히 발사가 안 되는 문제 방지용 (사용자 보고: "포탄이 안 나온다")
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

    // 스파크 → 불+연기 → 잔여 연기 순서로 (CSS 애니메이션 — is-on 토글).
    function playFx() {
      spark.classList.remove('is-on'); void spark.offsetWidth; spark.classList.add('is-on');
      after(50, () => { burn.classList.remove('is-on'); void burn.offsetWidth; burn.classList.add('is-on'); });
      after(150, () => { smoke.classList.remove('is-on'); void smoke.offsetWidth; smoke.classList.add('is-on'); });
    }
    function resetFx() { spark.classList.remove('is-on'); burn.classList.remove('is-on'); smoke.classList.remove('is-on'); }

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.3;

      // 3번 구멍이면 tweak 무시하고 정확히 필요한 각도로 고정 회전(회전축도 바퀴로 교체 —
      // 아래에서 계속 설명).
      const isHole3 = Math.abs(tx - HOLE3_X) < 0.01 && Math.abs(ty - HOLE3_Y) < 0.01;
      // 3번 발사 시퀀스(조준→발사→반동→원위치) 진행 중에 3번을 또 누르면 무시 — 끝까지
      // 쏘고 원위치할 때까지 둔다. clearTimers() 보다 반드시 먼저 체크해야 한다 — 아래로
      // 내려가면 clearTimers() 가 이미 실행된 뒤라 매번 처음부터 다시 시작되며 영원히
      // 발사가 안 되는 버그가 났었다(사용자 보고: "포탄이 안 나온다"). 다른 구멍을 누르면
      // (isHole3 다름) 여전히 즉시 재조준(원래 동작).
      if (isHole3 && aimingHole3) return;
      aimingHole3 = isHole3;

      clearTimers();

      // 포구 → 목표 방향
      const want = Math.atan2(ty - MZY, tx - MZX) * 180 / Math.PI;
      let best = POSES[0], bestD = 1e9;
      POSES.forEach((p) => { const d = Math.abs(angDiff(want, p.aim)); if (d < bestD) { bestD = d; best = p; } });
      showPose(best);

      resFrom = residual;
      resTo = isHole3 ? angDiff(want, best.aim) : clamp(angDiff(want, best.aim), -best.tweak, best.tweak);
      resT = 0;
      curAimMs = isHole3 ? HOLE3_AIM_MS : AIM_MS;
      phase = 'aim'; t = 0;
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];

      const pivot = isHole3 ? steepWheelPivot() : { x: MZX, y: MZY };
      rig.style.transformOrigin = (pivot.x * 100).toFixed(2) + '% ' + (pivot.y * 100).toFixed(2) + '%';

      after(curAimMs, () => {
        phase = 'kick'; t = 0;
        playFx();

        // 포탄은 회전된 실제 포구 위치(바퀴축 기준으로 resTo만큼 돈 자리)에서 나간다.
        const muzzle = isHole3
          ? rotateAround(ax(best), ay(best), pivot.x, pivot.y, resTo)
          : { x: ax(best), y: ay(best) };
        ball.style.transition = 'none';
        ball.style.left = (muzzle.x * 100).toFixed(2) + '%';
        ball.style.top = (muzzle.y * 100).toFixed(2) + '%';
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
        const k = easeOut(clamp01(resT / (curAimMs / 1000)));
        residual = resFrom + (resTo - resFrom) * k;
      } else if (phase === 'kick') {
        t += dt;
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; }
      } else if (phase === 'settle') {
        t += dt;
        const k = easeOut(clamp01(t / SETTLE_SEC));
        residual = resTo * (1 - k);
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; residual = 0; showPose(restPose); aimingHole3 = false; }
      }
      paint();
    }

    function paint() {
      let amt = 0;
      if (phase === 'kick') amt = recoilAmt * ease(clamp01(t / KICK_SEC));
      else if (phase === 'settle') amt = recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC)));
      // 반동 방향 = 몸통이 지금 실제로 향하는 각도(pose.aim+residual) 그대로.
      // 몸통(머리-꼬리 축)·화염·불꽃이 항상 같은 방향으로 움직여야 하므로, 반동도 같은
      // 값을 써야 몸통 각도와 밀리는 방향이 항상 일치한다(사용자 피드백).
      const rdir = ((pose ? pose.aim : AIM_DEG_FALLBACK) + residual + 180) * Math.PI / 180;
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
      aimingHole3 = false;
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
