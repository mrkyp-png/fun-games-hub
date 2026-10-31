(function (root) {
  'use strict';

  // 무기 스킨: 대포. lane-hammer.js 와 같은 인터페이스
  // (create({layer}) → { strike, update, isBusy, home, clear }).
  //
  // 조준 = 스프라이트 회전이 아니라 **5포즈**(키패드 버튼 그룹별). 목표 구멍 각도로 가장
  // 가까운 포즈를 골라 표시한다 (tweak=0 = 포즈 각도 그대로, 미세회전 없음 — 모든 구멍 동일).
  // 포구는 항상 보드의 고정점(MZX,MZY) 기준 — 포탄·화염·연기는 거기서 포신 각도로 나간다.
  // 본체는 거기서 우하단으로 뻗어 거의 화면 밖.
  //
  // 순서: 포즈 선택 → 발사(화염·연기·포탄) → 반동 → 원위치.
  // 명중감은 game.js HitFx (impactCb = 포탄 도착 시).

  const MZX = 0.870, MZY = 0.801;          // 포구 고정점 (보드 분수) — 여기서 포탄이 나간다.
                                          //  v289: 위로 0.2cm(≈0.029). v293: 우측으로 0.3cm(≈0.043). (사용자 요청)
                                          //  대포 본체는 여기서 우하단으로 뻗어 대부분 화면 밖(입체감).

  // 포즈 표 (튜닝 노브). 화면좌표 각도: 0=오른쪽, -90=위, 좌상향은 -180~-90.
  //  w    : 본체 폭 (보드 정사각 분수)  ·  ar : 이미지 높이/폭 비 (실측)
  //  mu,mv: 스프라이트 안 포구(포탄이 나오는 지점, 0~1) — 이 점이 (MZX+dx, MZY+dy) 에 온다
  //  dx,dy: 이 포즈만 포구 고정점에서 살짝 이동 (보드 분수, 없으면 0)
  //  blx,bly: 포탄 발사시작점 = 배럴 입구(포구) 중심. V1394 C 사용자: 포신 입구와 안 겹치게 — 포구 가운데 축 위, 포구 끝보다 (포탄 반지름+0.003) 앞(실측 계산). (fu-mu)*w, (fv-mv)*w*ar 로 계산
  //           (fu,fv = 스프라이트 안 포구 opening 중심 실측). 스프라이트는 안 움직임.
  //  aim  : 이 포즈 포신이 겨누는 방향 (deg, 화면좌표)  ·  tweak : 미세 회전 허용치 (0 = 고정)
  // 새 대포 아트 5포즈 (Desktop 대포1~5 → cannon-a1~a5, 굵은 검은 외곽선). 얕은각→수직 순.
  // 값은 grid 스크린샷 실측 기반 1차치 — 스크린샷 보며 mu/mv/dx/dy/aim/w 조정.
  // w 는 "최대 변(가로 or 세로*ar)이 대략 0.28" 이 되도록 ar 로 나눠 정규화 — 어떤 포즈든
  // 화면상 크기가 대기(a1) 자세와 비슷하게 보인다 (급각 a3~a5 가 너무 컸던 것 보정, 사용자 요청).
  // aim 은 키패드 버튼 그룹핑(사용자 지정, 포구기준 각도 최근접 선택)에 맞춰 조정:
  //   a2(-191°) = ✱ 0 #(제일 아래줄)   a1(-164°) = 4 7 8   a3(-144°, 기본 대기포) = 1 2 5 9
  //   a5(-120°) = 3 6   a4(-92°) = 오른쪽 내비열(거의 수직)
  // v293 에서 MZX 우측 0.3cm 이동에 맞춰 aim 재보정. a4(최대각포)만 dx 로 상쇄해 제자리 고정(사용자 요청).
  const POSES = [
    { key: 'a2', src: 'assets/weapons/cannon-a2-nol-v1392.png', w: 0.270, ar: 0.924, mu: 0.08, mv: 0.52, aim: -191, tweak: 0, dx: -0.103, dy: 0.03, blx: -0.048, bly: -0.002 },
    { key: 'a1', src: 'assets/weapons/cannon-a1-nol-v1392.png', w: 0.280, ar: 0.833, mu: 0.07, mv: 0.14, aim: -164, tweak: 0, dx: -0.05, dy: 0.03, blx: -0.043, bly: -0.008 },
    { key: 'a3', src: 'assets/weapons/cannon-a3-nol-v1392.png', w: 0.242, ar: 1.159, mu: 0.32, mv: 0.09, aim: -144, tweak: 0, dx: 0.004, dy: -0.006, blx: -0.073, bly: -0.025 },
    { key: 'a5', src: 'assets/weapons/cannon-a5-nol-v1392.png', w: 0.225, ar: 1.256, mu: 0.17, mv: 0.09, aim: -120, tweak: 0, dx: -0.009, dy: -0.03, blx: -0.010, bly: -0.043 },
    { key: 'a4', src: 'assets/weapons/cannon-a4-nol-v1392.png', w: 0.216, ar: 1.220, mu: 0.48, mv: 0.06, aim: -92,  tweak: 0, dx: 0.001, dy: -0.04, blx: 0.002, bly: -0.044 }
  ];

  const REST_KEY = 'a3';                   // 발사 후 되돌아갈 기본 대기 포즈 (1·2·5·9 담당, 사용자 지정)
  const AIM_DEG_FALLBACK = -120;           // pose 없을 때 반동 방향 계산용

  // 발사 이펙트 = 스파크(fx1) → 불+연기(fx4) → 잔여 연기(fx5), 3장 순차 재생.
  // 앵커(mu,mv) = 그림에서 "이보다 뒤(포구 쪽)로는 실제로 그려진 게 없는" 뒷끝 좌표(실측) —
  // 코어(무게중심)를 쓰면 그림의 절반이 앵커보다 뒤로 처져 포신에 겹쳐 보였다(사용자 피드백:
  // "화염이 포신을 넘어옴"). 뒷끝을 포구에 대면 그림 전체가 앵커보다 앞으로만 펼쳐진다.
  // + FX_ADVANCE 만큼 포즈 각도 방향으로 더 밀어서 포신에서 확실히 떨어지게.
  // 회전 기준각(FX_BASE_AIM)은 세 장 다 하나로 통일 — 대포 몸통·화염·불꽃·연기가
  // 항상 같은 방향으로 같이 움직여야 하기 때문(사용자 피드백). 장별로 다르면 스파크→화염
  // 전환 때 각도가 살짝 튀어 보임. 앵커(mu,mv)는 그림마다 실측한 값 그대로 유지.
  const FX_ADVANCE = 0.0085;               // 포구보다 이만큼(보드분수) 더 앞으로 — V1392 C: 검은 테두리 빠져 포구 끝이 물러난 만큼 당김(이전 0.015)
  // mid 포즈만 화염(burn)이 포구와 위치가 안 맞음(사용자 실측) — 우측 0.2cm + 위쪽 0.4cm
  // 이동, 각도 우측(시계방향)으로 10도 추가 회전. 스파크/연기는 이상 없어 그대로 둠.
  // 보드 실측 가로폭을 안 주셔서 폰 화면 가로 ~7cm로 가정해 cm→보드분수 환산 — 실물이 다르면
  // 아래 dx/dy를 (원하는cm / 7 * 실제cm) 로 재계산.
  // 포즈별 이펙트 3겹 미세보정. 각 { dx, dy, rot } (보드분수 / CSS deg, + = 시계).
  //   spark = 불꽃(fx1)   flame = 화염(fx4, 불+연기 메인)   smoke = 연기(fx5, 잔여)
  // V1392 C 사용자: 3번(a3)처럼 '포구 가운데·불꽃 안쪽·불꽃 바깥'이 포신 방향 일직선이 되게 — a3 의 포구 가운데↔이펙트 관계(포신 기준)를
  // 모든 포즈에 적용. 포구 가운데 = 포신 끝 노란 테두리 고리 중심(실측). 회전 보정 flame 22·smoke 10 통일.
  // V1392 C 사용자: 불꽃(스파크·연기) = 포신 방향 일직선 + 포구와 안 겹치게. 그림별 원래 방향(fx1 -146.6°, fx5 -155.5°) 상쇄,
  // 그림 가운데 줄을 포구 가운데(노란 테두리 고리) 축에 맞추고, 최대 확대 때 그림 뒤끝이 포구 끝보다 0.004 앞에 오게(실측 계산).
  const FX_NUDGE = {
    a2: { spark: { rot: -9.4, dx: -0.040, dy: 0.006 }, flame: { rot: 5.9 }, smoke: { rot: -0.5, dx: -0.077, dy: 0.018 } },  // ✱·0·# 제일아래줄
    a1: { spark: { rot: -4.4, dx: -0.039, dy: 0.002 }, flame: { rot: 5.9 }, smoke: { rot: 4.5, dx: -0.077, dy: -0.003 } },  // 4·7·8번  사용자: 각도 시계 5°
    a3: { spark: { rot: 0.6, dx: -0.073, dy: -0.014 }, flame: { rot: 5.9 }, smoke: { rot: 9.5, dx: -0.107, dy: -0.032 } },  // 대기포 1·2·5·9  사용자: 각도 시계 5°+5°
    a4: { spark: { rot: -9.4, dx: -0.007, dy: -0.037 }, flame: { rot: 5.9 }, smoke: { rot: -0.5, dx: -0.014, dy: -0.075 } },  // 제일우측 내비열
    a5: { spark: { rot: -9.4, dx: -0.014, dy: -0.033 }, flame: { rot: 5.9 }, smoke: { rot: -0.5, dx: -0.038, dy: -0.063 } },  // 3·6번
  };




  function fxn(key, which) { return (FX_NUDGE[key] || {})[which]; }
  const FX_BASE_AIM = -156;                // fx 스프라이트가 그려진 기준각 (fx1 -149°, fx4 -163° 평균)
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
  const RECOIL = [0.012, 0.024, 0.040];    // 살짝/보통/강 (보드 분수)
  const KICK_SEC = 0.06, SETTLE_SEC = 0.34;
  const BALL_MS = 105;
  const AIM_FAST_MS = 40, QUEUE_MAX = 3; // V1534 C: 밀린 발 조준 시간·최대 대기 발 수
  const BALL_START_ADVANCE_PX = 0.3 * 96 / 2.54; // V1533 C 사용자: 0.3cm(CSS) = 11.34px
  const IDLE_DELAY = 2.5;                  // 대기 애니메이션(사용자 지정) — 이만큼 조용해야 시작
  const IDLE_KICK_CYCLE = 3;               // 이 주기로 반복 반동
  const IDLE_RECOIL = 0.040;               // 대기 반동 = 가장 강한 반동(RECOIL 중 최대, 사용자 지정 "가장 크게")

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
    const model = root.MoleGame.GameCannonModel ? root.MoleGame.GameCannonModel.create(el) : null;

    // 포즈별 유효 포구 고정점 (dx/dy 반영)
    function ax(p) { return p && p.muzzle ? p.muzzle.x : MZX + (p && p.dx || 0); }
    function ay(p) { return p && p.muzzle ? p.muzzle.y : MZY + (p && p.dy || 0); }

    // 회전축 = 포구 고정점. 미세 조준·반동 모두 rig 통째로.
    rig.style.transformOrigin = (MZX * 100).toFixed(2) + '% ' + (MZY * 100).toFixed(2) + '%';
    // 각 포즈 본체 배치 (top-left 기준) — 포즈의 포구점이 (ax,ay) 에 오도록.
    POSES.forEach((p) => {
      const bw = p.w * 1.02; // V1392 C 사용자: 검은 테두리 뺀 만큼 본체 102%(포구 고정점 기준)
      const hFrac = bw * p.ar;
      const im = bodies[p.key];
      im.style.width = (bw * 100).toFixed(2) + '%';
      im.style.left = ((ax(p) - p.mu * bw) * 100).toFixed(2) + '%';
      im.style.top = ((ay(p) - p.mv * hFrac) * 100).toFixed(2) + '%';
    });
    // 화염·연기 배치: 그림의 뒷끝 앵커(mu,mv, 정사각이라 ar=1)를 포구보다 FX_ADVANCE만큼
    // 더 앞(포즈 각도 방향)에 두고, 그 지점을 축으로 포즈 각도만큼 회전 — 그림 전체가
    // 앵커보다 앞으로만 펼쳐져서 포신에 안 넘치고, 포구에서 살짝 떨어져 나온다.
    function placeOverlay(im, w, mu, mv, p, nudge) {
      const rad = p.aim * Math.PI / 180;
      const nx = p.muzzle ? 0 : (nudge && nudge.dx) || 0, ny = p.muzzle ? 0 : (nudge && nudge.dy) || 0, nrot = p.muzzle ? 0 : (nudge && nudge.rot) || 0;
      let fx0 = ax(p) + Math.cos(rad) * FX_ADVANCE + nx;
      const yScale = p.muzzle ? p.muzzle.yScale : 1;
      let fy0 = ay(p) + Math.sin(rad) * FX_ADVANCE * yScale + ny;
      // V1533 C 사용자: 화염·연기도 포탄과 같이 포구→구멍 직선을 따라 구멍 쪽으로 0.3cm.
      if (p.muzzle && fxTarget) {
        const W = layerW, H = layerH, dx = (fxTarget.x - ax(p)) * W, dy = (fxTarget.y - ay(p)) * H, len = Math.hypot(dx, dy) || 1, step = Math.min(BALL_START_ADVANCE_PX, len);
        fx0 += dx / len * step / W; fy0 += dy / len * step / H;
      }
      im.style.width = (w * 100).toFixed(2) + '%';
      im.style.left = ((fx0 - mu * w) * 100).toFixed(2) + '%';
      im.style.top = ((fy0 - mv * w * yScale) * 100).toFixed(2) + '%';
      im.style.transformOrigin = (mu * 100).toFixed(2) + '% ' + (mv * 100).toFixed(2) + '%';
      const baseAim = p.muzzle ? (im === spark ? -146.6 : im === smoke ? -155.5 : -163) : FX_BASE_AIM;
      im.style.setProperty('--rot', (p.aim - baseAim + nrot).toFixed(1) + 'deg');
    }
    function placeFx(p) {
      placeOverlay(spark, SPARK_W, SPARK_MU, SPARK_MV, p, fxn(p.key, 'spark'));
      placeOverlay(burn, BURN_W, BURN_MU, BURN_MV, p, fxn(p.key, 'flame'));
      placeOverlay(smoke, SMOKE_W, SMOKE_MU, SMOKE_MV, p, fxn(p.key, 'smoke'));
    }

    const restPose = POSES.find((p) => p.key === REST_KEY) || POSES[0];
    let pose = null;
    let phase = 'home', t = 0;
    let residual = 0, resFrom = 0, resTo = 0, resT = 0, curAimMs = AIM_MS;
    let recoilAmt = 0;
    let currentAim = restPose.aim, aimFrom = currentAim, aimTo = currentAim;
    let lastModelVisual = null;
    let fxTarget = null;
    const queue = [];
    // V1534 C: 레이어 크기는 바뀔 때만 읽어 둔다(화염·연기 위치 계산마다 읽으면 매 프레임 강제 배치 계산 → 버벅임).
    let layerW = el.clientWidth || 1, layerH = el.clientHeight || 1;
    const sizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { layerW = el.clientWidth || 1; layerH = el.clientHeight || 1; }) : null;
    if (sizeWatch) sizeWatch.observe(el); // V1533 C: 마지막 포격점(화염·연기 0.3cm 앞당김 방향)
    let idleT = 0, idleKick = 0; // 대기 애니메이션(사용자 지정) — 잠깐 조용하면 가장 센 반동으로 훅 밀렸다 복귀
    let timers = [];
    let flightTimers = [];
    function clearTimers(keepFlights) { timers.forEach(clearTimeout); timers = []; if(!keepFlights){flightTimers.forEach(clearTimeout);flightTimers=[];el.querySelectorAll('.lc-flight').forEach(function(projectile){projectile.remove();});} }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function afterFlight(ms, fn) { const timer=setTimeout(function(){flightTimers=flightTimers.filter(function(id){return id!==timer;});fn();},ms);flightTimers.push(timer); }

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
      // V1392 C 사용자: 중간 메인 화염(fx4) 삭제 — 스파크 → 잔여 연기만.
      after(150, () => { smoke.classList.remove('is-on'); void smoke.offsetWidth; smoke.classList.add('is-on'); });
    }
    function resetFx() { spark.classList.remove('is-on'); burn.classList.remove('is-on'); smoke.classList.remove('is-on'); }

    function launchBall(visual, best, tx, ty, onImpact) {
      // 포탄 발사시작점. blx/bly = 이 포즈만 추가 미세이동 (스프라이트는 그대로).
      const muzzle = visual ? {x:visual.x+Math.cos(visual.aim*Math.PI/180)*.012,y:visual.y+Math.sin(visual.aim*Math.PI/180)*.012*visual.yScale} : { x: ax(best) + (best.blx || 0), y: ay(best) + (best.bly || 0) };
      // V1533 C 사용자: 포탄 출발점을 포구→구멍 직선을 따라 구멍 쪽으로 0.3cm 앞으로(포격점은 그대로).
      {
        const W = layerW, H = layerH, dx = (tx - muzzle.x) * W, dy = (ty - muzzle.y) * H, len = Math.hypot(dx, dy) || 1, step = Math.min(BALL_START_ADVANCE_PX, len);
        muzzle.x += dx / len * step / W; muzzle.y += dy / len * step / H;
      }
      const projectile = ball.cloneNode(false); projectile.classList.add('lc-flight'); el.appendChild(projectile);
      projectile.style.transition = 'none';
      projectile.style.left = (muzzle.x * 100).toFixed(2) + '%';
      projectile.style.top = (muzzle.y * 100).toFixed(2) + '%';
      projectile.style.opacity = '1';
      projectile.style.transform = 'translate(-50%,-50%) scale(1.15) rotate(0deg)';
      void projectile.offsetWidth;
      projectile.style.transition = 'left ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), top ' + BALL_MS + 'ms cubic-bezier(.2,.5,.6,1), transform ' + BALL_MS + 'ms linear';
      projectile.style.left = (tx * 100).toFixed(2) + '%';
      projectile.style.top = (ty * 100).toFixed(2) + '%';
      projectile.style.transform = 'translate(-50%,-50%) scale(0.8) rotate(220deg)';
      afterFlight(BALL_MS, () => { projectile.remove(); if (onImpact) onImpact(); });
    }

    function strike(targetXFrac, targetYFrac, onImpact, fast) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.3;
      fxTarget = { x: tx, y: ty };

      idleT = 0; idleKick = 0; // 대기 반동 중이었으면 리셋 — residual 은 곧바로 아래서 aim 값으로 덮어씀
      clearTimers(true);

      // 포구 → 목표 방향
      const want = model && model.ready ? model.aimAt(tx,ty) : Math.atan2(ty - MZY, tx - MZX) * 180 / Math.PI;
      aimFrom = currentAim; aimTo = currentAim + angDiff(want,currentAim);
      let best = POSES[0], bestD = 1e9;
      POSES.forEach((p) => { const d = Math.abs(angDiff(want, p.aim)); if (d < bestD) { bestD = d; best = p; } });
      showPose(best);

      resFrom = residual;
      resTo = clamp(angDiff(want, best.aim), -best.tweak, best.tweak);
      resT = 0;
      curAimMs = fast ? AIM_FAST_MS : AIM_MS;
      phase = 'aim'; t = 0;
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];

      after(curAimMs, () => {
        phase = 'kick'; t = 0;
        currentAim = aimTo;
        const visual = model && model.render(currentAim,0,{phase:'kick',force:true});
        if (visual) placeFx({aim:visual.aim,muzzle:visual});
        playFx();

        launchBall(visual, best, tx, ty, onImpact);
      });
      paint();
    }

    function update(dt) {
      if (phase === 'aim') {
        resT += dt;
        const k = easeOut(clamp01(resT / (curAimMs / 1000)));
        residual = resFrom + (resTo - resFrom) * k;
        currentAim = aimFrom + (aimTo-aimFrom)*k;
      } else if (phase === 'kick') {
        t += dt;
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; if (queue.length) { const n = queue.shift(); strike(n.x, n.y, n.onImpact, true); } }
      } else if (phase === 'settle') {
        t += dt;
        const k = easeOut(clamp01(t / SETTLE_SEC));
        // V1528 C 사용자: 쏜 뒤 대기 위치로 돌아가지 않고 마지막 조준 방향 유지(반동만 풀림).
        if (!model) { currentAim = aimTo + angDiff(restPose.aim,aimTo)*k; residual = resTo * (1 - k); }
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; if (!model) { residual = 0; showPose(restPose); } }
      } else if (phase === 'home') {
        idleT += dt;
        const cyclePos = idleT > IDLE_DELAY ? (idleT - IDLE_DELAY) % IDLE_KICK_CYCLE : -1;
        if (cyclePos >= 0 && cyclePos < KICK_SEC) {
          idleKick = IDLE_RECOIL * ease(clamp01(cyclePos / KICK_SEC));
        } else if (cyclePos >= KICK_SEC && cyclePos < KICK_SEC + SETTLE_SEC) {
          idleKick = IDLE_RECOIL * (1 - easeOut(clamp01((cyclePos - KICK_SEC) / SETTLE_SEC)));
        } else {
          idleKick = 0;
        }
      }
      paint();
    }

    function paint() {
      let amt = 0;
      if (phase === 'kick') amt = recoilAmt * ease(clamp01(t / KICK_SEC));
      else if (phase === 'settle') amt = recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC)));
      else if (phase === 'home') amt = idleKick;
      // 반동 방향 = 몸통이 지금 실제로 향하는 각도(pose.aim+residual) 그대로.
      // 몸통(머리-꼬리 축)·화염·불꽃이 항상 같은 방향으로 움직여야 하므로, 반동도 같은
      // 값을 써야 몸통 각도와 밀리는 방향이 항상 일치한다(사용자 피드백).
      const rdir = ((pose ? pose.aim : AIM_DEG_FALLBACK) + residual + 180) * Math.PI / 180;
      const dx = Math.cos(rdir) * amt, dy = Math.sin(rdir) * amt;
      if (model) {
        const visual = model.render(currentAim,amt/.040,{phase,progress:phase==='aim'?clamp01(resT/(curAimMs/1000)):phase==='settle'?clamp01(t/SETTLE_SEC):0});
        if (visual) { if(rig.style.transform!=='none')rig.style.transform='none';if(visual!==lastModelVisual){placeFx({aim:visual.aim,muzzle:visual});lastModelVisual=visual;}return; }
      }
      rig.style.transform =
        'translate(' + (dx * 100).toFixed(3) + '%, ' + (dy * 100).toFixed(3) + '%) ' +
        'rotate(' + residual.toFixed(2) + 'deg)';
    }

    function isBusy() { return phase === 'aim' || phase === 'kick' || queue.length > 0; }
    // V1534 C 사용자(A안): 분신 없이 캐논 하나가 차례로 쏜다. 밀린 발은 조준을 빠르게(0.04초),
    // 3발 넘게 밀리면 넘친 발은 캐논 동작 없이 지금 포구에서 포탄만 바로 쏜다(판정은 누를 때 이미 끝남).
    function enqueue(targetXFrac, targetYFrac, onImpact) {
      if (phase !== 'aim' && phase !== 'kick' && !queue.length) { strike(targetXFrac, targetYFrac, onImpact); return; }
      if (queue.length < QUEUE_MAX) { queue.push({ x: targetXFrac, y: targetYFrac, onImpact }); return; }
      launchBall(lastModelVisual, pose || restPose, targetXFrac, targetYFrac, onImpact);
    }
    function flushQueue() { const q = queue.splice(0); q.forEach((n) => { if (n.onImpact) n.onImpact(); }); }

    function home() {
      flushQueue();
      clearTimers();
      phase = 'home'; t = 0; resT = 0; idleT = 0; idleKick = 0;
      residual = resFrom = resTo = 0;
      currentAim = aimFrom = aimTo = restPose.aim;
      resetFx();
      ball.style.opacity = '0';
      showPose(restPose);
      if(model)model.render(restPose.aim,0,{phase:'home',force:true});
      paint();
    }

    function clear() { flushQueue(); if (sizeWatch) sizeWatch.disconnect(); clearTimers(); if(model)model.clear(); el.remove(); }

    showPose(restPose);
    paint();
    return { strike, enqueue, update, isBusy, home, clear, intro3D:model?function(travelMs,turnMs,onDone){model.intro(travelMs,turnMs,onDone);}:null, prewarm:model?function(points){model.prewarm(points);}:null };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneCannon = api; }
})(typeof window !== 'undefined' ? window : null);
