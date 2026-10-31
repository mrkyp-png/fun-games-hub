(function (root) {
  'use strict';

  // 망치 하나. 평소 우측 하단 홀스터 → 버튼 누르면 손잡이(grip)를 목표 구멍의 오른쪽 아래에
  // 두고, 머리를 대각선 아래로 휘둘러 두더지 모자를 내리찍는다 (기획서 §5, v1.5 / 레퍼런스 영상).
  // V1379 G: 승인된 짧은 크림 손잡이/파란 그립 뿅망치. transform-origin 을 grip 에 둔다.
  // 순수 비주얼 — 게임 상태 모름. update(dt) 를 메인 루프가 매 프레임 호출.

  const FLY_SEC = 0.09;    // 홀스터/이전 위치 → 조준 (예비동작)
  const CHOP_SEC = 0.045;  // 내리찍기 — 빠르게 스냅
  const RISE_SEC = 0.10;
  const HOME_SEC = 0.22;

  const GRIP_X = 33.0;   // 선택한 yaw10/15도 스프라이트의 파란 그립 중심(%)
  const GRIP_Y = 83.0;
  const HOME_X = 0.90, HOME_Y = 0.965; // 대기 위치 (보드 분수) — 우측 맨 아래 구석. 16번 구멍
                                       // (~0.86,0.84) 아래로 비켜서 안 겹치고, 보드 안(<1)이라 버튼 안 닿음
  const HOME_DEG = 18;                 // 대기: 살짝 눕힘 (머리는 좌상단 잔디 쪽 — 화면 밖으로 안 나가게)
  const READY_DEG = -30;               // 조준: 오른쪽에서 머리 들어올림
  const HIT_DEG = -82;                 // 타격: 머리를 대각선 아래로 휘두름
  // V1380 C: 새 뿅망치 그림(27.2%)의 머리 중심을 V1375 C 와 같은 기준으로 HIT_DEG 회전해 재계산.
  const GRIP_OFF_X = 0.134;            // grip 을 목표보다 이만큼 오른쪽 (보드 폭 분수) — V1381 C 사용자: 타격점 0.2cm 왼쪽
  const GRIP_OFF_Y = 0.042;            // grip 을 목표보다 이만큼 아래 (보드 높이 분수)
  const MALLET_BAKED_DEG = 15;         // V1380 C: 새 뿅망치 그림 자체가 시계방향 15도 기울어 있음 → 상쇄해 예전 각도 유지
  const CLAMP = -0.45;                 // grip 이 보드 가장자리에서 이만큼까지 나가도 됨 (- = 밖 허용)
                                       // 레이어가 보드 밖(클리핑 없음)이라 우측 끝 스윙이 다 보인다
  const AIM_DX = 0.022;                // 타격점 미세보정: + = 오른쪽 (보드 폭 분수, 0.5mm ≈ 0.005 / 1cm ≈ 0.1)
  const AIM_DY = -0.055;               // 프레임 미상(빈 구멍 헛스윙 등) 시 폴백
  // 두더지 프레임별 타격점 세로보정 (사용자 지정, 스폰점 대비 보드 높이 분수) — 망치가 그 프레임의 헬멧을 때린다.
  const AIM_DY_BY_FRAME = { full: -0.142, peek1: -0.076, peek2: -0.051, helmet: -0.031, mole2: -0.142 }; // v1018: 새 그림(115%) 높이 비례로 재계산 — 깊이1=머리, 2=빼꼼 / V1541 C: mole2 = 새 두더지(95%, 헬멧 높이는 예전과 같게 — 사용자: 이전 높이)
  const AIM_DX_BY_FRAME = { mole2: 0.0046 }; // V1541 C: 새 두더지는 구멍 입구 가운데로 7px(보드 폭 0.46%) 오른쪽

  // 대기 애니메이션(사용자 지정) — 유저가 잠깐 자리 비웠을 때(화장실 등) 심심하지 않게.
  // 실제 타격이 계속 이어지는 동안엔 안 뜨도록 "조용한 시간"이 IDLE_DELAY 를 넘어야 시작.
  const IDLE_DELAY = 2.5;     // 이만큼 조용해야 대기 애니메이션 시작
  const BOUNCE_CYCLE = 3.2, BOUNCE_DUR = 0.5;  // 뿅망치: 통통 튀는 주기·지속(Claude 제안)
  const SPIN_CYCLE = 3.6, SPIN_DUR = 0.6;      // 골드해머: 제자리 360도 회전 주기·지속(사용자 지정)

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * k; }

  function create({ layer, sprite, introSprite, grip, cssClass, degOffset, homeMarginTop, gripOff, homeDegOffset, emptyDy, idle, homeXFrac, homeYFrac, strikeDurationScale, strikeFlyDurationScale }) {
    // grip = 스프라이트 안 손잡이 잡는 점(%) — 스킨마다 다르면 넘긴다. 없으면 뿅망치 기본값.
    // degOffset = 스킨 스프라이트가 기준 포즈에서 이미 돌아가 있으면 그만큼 상쇄(모든 회전상태에 더함).
    // homeMarginTop = 대기 위치 세로 미세보정 (기본 '0.2cm' 아래로).
    // gripOff = HIT_DEG 에서 머리가 grip 로부터 떨어진 정도(보드 분수). 스킨 스프라이트마다 다름 —
    //           grip 을 목표에서 이만큼 비켜 놔야 머리가 목표(두더지 헬멧)에 착지. 없으면 뿅망치 기본값.
    // homeDegOffset = 대기 위치 각도만 이만큼 추가 회전(+ = 시계방향). 조준/타격 각도는 영향 없음.
    // emptyDy = 빈 구멍 헛스윙(frameKey 없음) 전용 세로보정. 없으면 공용 AIM_DY(뿅망치 기준).
    const gripX = grip && grip.x != null ? grip.x : GRIP_X;
    const gripY = grip && grip.y != null ? grip.y : GRIP_Y;
    const goX = gripOff && gripOff.x != null ? gripOff.x : GRIP_OFF_X;
    const goY = gripOff && gripOff.y != null ? gripOff.y : GRIP_OFF_Y;
    const eDy = emptyDy != null ? emptyDy : AIM_DY;
    const dOff = degOffset != null ? degOffset : (sprite ? 0 : -MALLET_BAKED_DEG);
    const homeMT = homeMarginTop != null ? homeMarginTop : '0.2cm';
    const homeX = homeXFrac != null ? homeXFrac : HOME_X;
    const homeY = homeYFrac != null ? homeYFrac : HOME_Y;
    const strikeScale = strikeDurationScale != null ? strikeDurationScale : 1;
    const flySec = FLY_SEC * (strikeFlyDurationScale != null ? strikeFlyDurationScale : strikeScale);
    const chopSec = CHOP_SEC * strikeScale;
    const hDeg = HOME_DEG + (homeDegOffset || 0);
    const el = document.createElement('div');
    el.className = 'lane-hammer' + (cssClass ? ' ' + cssClass : '');
    const img = document.createElement('img');
    img.src = sprite || 'assets/weapons/mallet-yaw10-rest15-v1379.png';
    img.alt = '';
    el.appendChild(img);
    // 골드해머 보석 글로우 — 아이템보관창(.inv-gem-glow)엔 있었는데 게임화면엔 빠져있던 것 추가.
    // el(회전 대상) 안에 넣어서 스윙 각도에 따라 같이 회전.
    const gemGlow = document.createElement('span');
    gemGlow.className = 'lane-hammer-gem-glow';
    el.appendChild(gemGlow);
    layer.appendChild(el); // transform-origin 은 paint() 가 anchorX/Y 기준으로 매번 설정

    let phase = 'home';   // 'home' | 'fly' | 'chop' | 'rise' | 'return'
    let t = 0;
    let fromX = homeX, fromY = homeY, fromDeg = hDeg;
    let aimX = homeX, aimY = homeY, gx = homeX, gy = homeY, deg = hDeg;
    let impactCb = null;
    let fired = false;
    let scaleXVal = 1, scaleYVal = 1; // 라운드 인트로 등장 연출 전용(평소엔 항상 1,1)
    let anchorX = gripX, anchorY = gripY; // translate·transform-origin 공통 기준점(평소엔 그립)
    let idleT = 0; // 대기 애니메이션용 — phase==='home' 인 채로 흐른 시간(타격하면 리셋)
    let spinDir = 1, lastSpinCycleIdx = -1; // 골드해머 회전 방향 — 매 회전 시작마다 랜덤(사용자 지정)

    function strike(targetXFrac, targetYFrac, onImpact, frameKey) {
      // 대기 애니메이션 중이었으면 깨끗한 대기 포즈로 스냅 후 스윙 시작(어중간한 각도/높이에서
      // 시작하지 않게). rise·return 도중 끼어든 연타는 원래대로 현재 위치에서 부드럽게 redirect.
      if (phase === 'home') { deg = hDeg; gx = homeX; gy = homeY; scaleXVal = 1; scaleYVal = 1; }
      idleT = 0; lastSpinCycleIdx = -1;
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      const aimDy = (frameKey && AIM_DY_BY_FRAME[frameKey] != null) ? AIM_DY_BY_FRAME[frameKey] : eDy;
      fromX = gx; fromY = gy; fromDeg = deg;
      aimX = Math.max(CLAMP, Math.min(1 - CLAMP, tx + goX + AIM_DX + ((frameKey && AIM_DX_BY_FRAME[frameKey]) || 0)));
      aimY = Math.max(CLAMP, Math.min(1 - CLAMP, ty + goY + aimDy));
      impactCb = onImpact || null;
      fired = false;
      phase = 'fly';
      t = 0;
    }

    function update(dt) {
      if (phase !== 'home') t += dt;

      if (phase === 'fly') {
        const k = ease(clamp01(t / flySec));
        gx = lerp(fromX, aimX, k);
        gy = lerp(fromY, aimY, k);
        deg = lerp(fromDeg, READY_DEG, k);
        if (t >= flySec) { phase = 'chop'; t = 0; fromDeg = deg; }
      } else if (phase === 'chop') {
        const k = ease(clamp01(t / chopSec));
        gx = aimX; gy = aimY;
        deg = lerp(READY_DEG, HIT_DEG, k);
        if (!fired && t >= chopSec) {
          fired = true;
          img.classList.remove('lane-hammer-img--hit');
          void img.offsetWidth;
          img.classList.add('lane-hammer-img--hit');
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
          phase = 'rise'; t = 0; fromDeg = deg;
        }
      } else if (phase === 'rise') {
        const k = clamp01(t / RISE_SEC);
        deg = lerp(fromDeg, READY_DEG, k);
        if (t >= RISE_SEC) { phase = 'return'; t = 0; fromX = gx; fromY = gy; fromDeg = deg; }
      } else if (phase === 'return') {
        const k = clamp01(t / HOME_SEC);
        gx = lerp(fromX, homeX, k);
        gy = lerp(fromY, homeY, k);
        deg = lerp(fromDeg, hDeg, k);
        if (t >= HOME_SEC) { phase = 'home'; t = 0; }
      } else if (phase === 'home' && idle) {
        idleT += dt;
        if (idleT > IDLE_DELAY) {
          if (idle === 'spin') {
            const cycleIdx = Math.floor((idleT - IDLE_DELAY) / SPIN_CYCLE);
            const cyclePos = (idleT - IDLE_DELAY) % SPIN_CYCLE;
            if (cycleIdx !== lastSpinCycleIdx) { lastSpinCycleIdx = cycleIdx; spinDir = Math.random() < 0.5 ? 1 : -1; }
            if (cyclePos < SPIN_DUR) { deg = hDeg + spinDir * 360 * ease(cyclePos / SPIN_DUR); }
            else { deg = hDeg; }
            gx = homeX; gy = homeY;
          } else if (idle === 'bounce') {
            const cyclePos = (idleT - IDLE_DELAY) % BOUNCE_CYCLE;
            if (cyclePos < BOUNCE_DUR) {
              const k = cyclePos / BOUNCE_DUR;
              const hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.018; // 위로 튀는 높이(보드분수)
              gy = homeY - hop;
              deg = hDeg + Math.sin(k * Math.PI * 2) * 4; // 착지·도약에 맞춰 살짝 까닥
              scaleYVal = 1 - hop * 3; scaleXVal = 1 + hop * 1.5; // 튈 때 살짝 스쿼시
            } else {
              gy = homeY; deg = hDeg; scaleXVal = 1; scaleYVal = 1;
            }
            gx = homeX;
          }
        }
      }
      paint();
    }

    function paint() {
      // V1379 G: retain the enlarged resting size throughout gameplay (latest user direction).
      if (!sprite) el.style.width = '27.2%';
      el.style.left = (gx * 100).toFixed(2) + '%';
      el.style.top = (gy * 100).toFixed(2) + '%';
      // translate 기준점과 transform-origin(회전·확대 축)을 항상 같은 점으로 맞춘다 — 서로
      // 다르면(그립점 translate + 중앙 회전축 등) 확대·축소 시 그 어긋난 만큼 위치가 밀려 보인다.
      el.style.transformOrigin = anchorX + '% ' + anchorY + '%';
      el.style.transform = 'translate(-' + anchorX + '%, -' + anchorY + '%) rotate(' + (deg + dOff).toFixed(1) + 'deg) scale(' + scaleXVal.toFixed(3) + ', ' + scaleYVal.toFixed(3) + ')';
      el.style.marginTop = phase === 'home' ? homeMT : '0'; // 대기 위치 세로 보정 (기본 0.2cm 아래)
      el.style.marginLeft = phase === 'home' ? '-0.2cm' : '0'; // V1408 C 사용자: 대기 위치만 폰 화면 기준 왼쪽 0.2cm(타격점 그대로)
      el.style.opacity = !sprite && phase === 'home' ? '0.7' : '1'; // 대기 뿅망치만30% 투명, 공격/등장은 불투명.
    }

    function isBusy() { return phase === 'fly' || phase === 'chop' || phase === 'rise'; }

    // 골드해머 라운드 인트로 전용(사용자 지정 "회전 등장") — 지정 좌표(키패드 '✱' 키)에서
    // 작게·0도 포즈(goldhammer-0.png)로 시작해 계속 회전하며(처음엔 천천히 → 대기위치에
    // 가까워질수록 빨라짐) 커지면서 대기 위치까지 날아간다. 회전은 정확히 대기 각도(hDeg)에
    // 맞춰 끝나 도착 순간 기본 스프라이트(대기 포즈)로 교체해 매끄럽게 안착. 자체 rAF 로 구동
    // (인트로 중엔 메인 루프 정지 상태).
    function spinIn(fromX2, fromY2, ms, spins, fromScale, onDone) {
      // phase='spin'(≠'home')으로 둬서 paint() 의 homeMarginTop 세로보정이 비행 내내 끼어들지
      // 않게 한다(고정 cm값이라 전엔 작게 줄여도 항상 위로 밀려 보였음 — 사용자 지적).
      phase = 'spin'; t = 0;
      fired = false;
      const baseSrc = sprite || 'assets/weapons/mallet-yaw10-rest15-v1379.png';
      img.src = introSprite || 'assets/weapons/goldpaw-v1382.webp'; // V1382 C: 기본 골드 망치 입장 스프라이트
      // 그립점(56,72) 기준 확대·축소는 그립이 아닌 부분(머리 등)이 그만큼 옆으로 남아 별표
      // 중심에서 벗어나 보인다(사용자 지적) — 비행 중엔 스프라이트 정중앙(50,50)을 기준점으로
      // 시작해 대기 위치에 도착할 때 정확히 그립(gripX,gripY)이 되도록 같은 진행률로 블렌딩
      // (착지 각도·크기 계산과 동일 기준이라 마지막 순간 튀지 않는다). 그림자 필터도 고정 px라
      // 이 작은 크기에선 어긋나 보여 잠시 끈다.
      const prevFilter = img.style.filter;
      img.style.filter = 'none';
      const startScale = fromScale != null ? fromScale : 0.35;
      const endDeg = hDeg + 360 * (spins || 3);
      const start = performance.now();
      (function step(now) {
        const k = Math.min(1, ((now || performance.now()) - start) / ms);
        const e = ease(k); // k*k — 느리게 시작해 빨라짐(이동·회전·확대 공통)
        gx = lerp(fromX2, homeX, e);
        gy = lerp(fromY2, homeY, e);
        deg = lerp(0, endDeg, e);
        scaleXVal = scaleYVal = lerp(startScale, 1, e);
        anchorX = lerp(50, gripX, e);
        anchorY = lerp(50, gripY, e);
        paint();
        if (k < 1) requestAnimationFrame(step);
        else {
          img.src = baseSrc;
          img.style.filter = prevFilter;
          anchorX = gripX; anchorY = gripY;
          phase = 'home';
          gx = homeX; gy = homeY; deg = hDeg; scaleXVal = 1; scaleYVal = 1;
          fromX = homeX; fromY = homeY; fromDeg = hDeg; aimX = homeX; aimY = homeY;
          paint();
          if (onDone) onDone();
        }
      })(start);
    }

    // 뿅망치 라운드 인트로 전용(사용자 지정 "쭉 늘어났다 팡 등장") — 대기 위치 제자리에서
    // (delayMs 동안은 안 보이게 숨어있다가) 탄성 있게 늘어났다(세로로 길게·가로로 얇게,
    // 고무줄처럼) → 통통 튀며 팡 하고 원래 비율로 안착(back-ease 로 살짝 오버슈트 후 정착).
    // 이동·회전 없음(제자리) — 캐논·골드해머처럼 화면을 가로지르는 무기가 아니라서 인트로
    // 내내 끌지 않고, 라운드 시작(=is-opening) 직전 짧게 "뿅"하고 나타나게(사용자 지정).
    function popIn(delayMs, ms, onDone) {
      scaleXVal = 0.001; scaleYVal = 0.001;
      paint();
      function easeOutBack(x) {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      }
      const stretchMs = ms * 0.55;
      const popMs = ms - stretchMs;
      const start = performance.now() + (delayMs || 0);
      (function step(now) {
        if ((now || performance.now()) < start) { requestAnimationFrame(step); return; }
        const el2 = (now || performance.now()) - start;
        if (el2 < stretchMs) {
          const k = ease(clamp01(el2 / stretchMs)); // 느리게 시작해 빨라짐
          scaleYVal = lerp(0.05, 1.35, k);
          scaleXVal = lerp(0.05, 0.65, k);
          paint();
          requestAnimationFrame(step);
        } else if (el2 < ms) {
          const k = clamp01((el2 - stretchMs) / popMs);
          const eb = easeOutBack(k); // 살짝 오버슈트(1 넘었다 되돌아옴) — "팡" 튕기는 느낌
          scaleYVal = lerp(1.35, 1, eb);
          scaleXVal = lerp(0.65, 1, eb);
          paint();
          requestAnimationFrame(step);
        } else {
          scaleXVal = 1; scaleYVal = 1;
          paint();
          if (onDone) onDone();
        }
      })(); // 인자 없이 호출 — now 가 undefined 로 들어와 performance.now() 폴백(딜레이 체크가 제대로 동작하려면 start 와 같은 값이면 안 됨)
    }

    // 라운드 종료/게임오버 순간 — 메인 루프가 멈춰 update 가 안 돌면 망치가 스윙 도중에 얼어붙는다.
    // 즉시 대기 위치로 스냅 (사용자 리포트: 라운드 종료 박스에 망치가 정지).
    function home() {
      impactCb = null;
      phase = 'home'; t = 0;
      gx = homeX; gy = homeY; deg = hDeg;
      fromX = homeX; fromY = homeY; fromDeg = hDeg;
      aimX = homeX; aimY = homeY;
      fired = false;
      scaleXVal = 1; scaleYVal = 1;
      anchorX = gripX; anchorY = gripY;
      paint();
    }

    // 레벨/화면 전환 시 DOM 에서 완전히 제거 (안 하면 startLevel 마다 망치가 쌓인다).
    function clear() {
      impactCb = null;
      el.remove();
    }

    paint();
    return { strike, update, isBusy, home, clear, spinIn, popIn };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneHammer = api; }
})(typeof window !== 'undefined' ? window : null);
