(function (root) {
  'use strict';

  // 망치 하나. 평소엔 보드 우측 하단에 대기하다가, 버튼을 누르면 그 열 위로 날아가
  // 머리를 아래로 세운 채 두더지 모자를 내리찍고 튕겨 돌아온다 (기획서 §5, v1.4).
  // hammer.png 원본: 머리 왼쪽 / 손잡이 오른쪽. transform-origin 을 머리에 둔다.
  // 순수 비주얼 — 게임 상태 모름. update(dt) 를 메인 루프가 매 프레임 호출.

  const FLY_SEC = 0.09;     // 대기/이전 열 → 목표 열 위로 (예비동작)
  const CHOP_SEC = 0.04;    // 내리찍기 — 빠르게 스냅
  const RISE_SEC = 0.10;    // 찍고 살짝 올라옴
  const HOME_SEC = 0.22;    // 다음 입력 없으면 우측 하단으로 복귀

  const HEAD_X = 16;   // 이미지 안 "머리 타격점" 위치 (%)
  const HEAD_Y = 42;
  const HOME_X = 0.9, HOME_Y = 0.92;   // 대기 위치 (보드 분수) — 우측 하단, 살짝 보이게
  const HOME_DEG = -118;               // 대기: 옆으로 뉘어 홀스터
  const READY_DEG = -70;               // 조준: 머리 아래로 (살짝 대각)
  const HIT_DEG = -88;                 // 찍는 순간 넘김
  const AIM_LIFT = 0.16;               // 조준 시 목표보다 이만큼 위 (보드 높이 분수)
  const CHOP_DROP = 0.15;              // 내리찍기 낙폭 (보드 높이 분수)

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * k; }

  function create({ layer, sprite }) {
    const el = document.createElement('div');
    el.className = 'lane-hammer';
    const img = document.createElement('img');
    img.src = sprite || 'assets/hammer.png';
    img.alt = '';
    el.appendChild(img);
    el.style.transformOrigin = HEAD_X + '% ' + HEAD_Y + '%';
    layer.appendChild(el);

    let phase = 'home';   // 'home' | 'fly' | 'chop' | 'rise' | 'return'
    let t = 0;
    let fromX = HOME_X, fromY = HOME_Y, fromDeg = HOME_DEG;
    let aimX = HOME_X, aimY = HOME_Y - AIM_LIFT;
    let x = HOME_X, y = HOME_Y, deg = HOME_DEG;
    let impactCb = null;
    let fired = false;

    function strike(targetXFrac, targetYFrac, onImpact) {
      fromX = x; fromY = y; fromDeg = deg;
      aimX = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      aimY = ((typeof targetYFrac === 'number') ? targetYFrac : 0.5) - AIM_LIFT;
      impactCb = onImpact || null;
      fired = false;
      phase = 'fly';
      t = 0;
    }

    function update(dt) {
      if (phase !== 'home') t += dt;

      if (phase === 'fly') {
        const k = ease(clamp01(t / FLY_SEC));
        x = lerp(fromX, aimX, k);
        y = lerp(fromY, aimY, k);
        deg = lerp(fromDeg, READY_DEG, k);
        if (t >= FLY_SEC) { phase = 'chop'; t = 0; fromY = y; fromDeg = deg; }
      } else if (phase === 'chop') {
        const k = ease(clamp01(t / CHOP_SEC));
        x = aimX;
        y = lerp(fromY, aimY + CHOP_DROP, k);
        deg = lerp(READY_DEG, HIT_DEG, k);
        if (!fired && t >= CHOP_SEC) {
          fired = true;
          img.classList.remove('lane-hammer-img--hit');
          void img.offsetWidth;
          img.classList.add('lane-hammer-img--hit');
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
          phase = 'rise'; t = 0; fromY = y; fromDeg = deg;
        }
      } else if (phase === 'rise') {
        const k = clamp01(t / RISE_SEC);
        x = aimX;
        y = lerp(fromY, aimY, k);
        deg = lerp(fromDeg, READY_DEG, k);
        if (t >= RISE_SEC) { phase = 'return'; t = 0; fromX = x; fromY = y; fromDeg = deg; }
      } else if (phase === 'return') {
        const k = clamp01(t / HOME_SEC);
        x = lerp(fromX, HOME_X, k);
        y = lerp(fromY, HOME_Y, k);
        deg = lerp(fromDeg, HOME_DEG, k);
        if (t >= HOME_SEC) { phase = 'home'; t = 0; }
      }
      paint();
    }

    function paint() {
      el.style.left = (x * 100).toFixed(2) + '%';
      el.style.top = (y * 100).toFixed(2) + '%';
      el.style.transform = 'translate(-' + HEAD_X + '%, -' + HEAD_Y + '%) rotate(' + deg.toFixed(1) + 'deg)';
    }

    // 스윙이 진행 중(레벨 클리어 판정을 미뤄야 하는 상태)인가.
    function isBusy() { return phase === 'fly' || phase === 'chop' || phase === 'rise'; }

    // 레벨/화면 전환 시 DOM 에서 완전히 제거 (안 하면 startLevel 마다 망치가 쌓인다).
    function clear() {
      impactCb = null;
      el.remove();
    }

    paint();
    return { strike, update, isBusy, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneHammer = api; }
})(typeof window !== 'undefined' ? window : null);
