(function (root) {
  'use strict';

  // 망치 하나. 평소 우측 하단 홀스터 → 버튼 누르면 손잡이(grip)를 목표 구멍의 오른쪽 아래에
  // 두고, 머리를 대각선 아래로 휘둘러 두더지 모자를 내리찍는다 (기획서 §5, v1.5 / 레퍼런스 영상).
  // 망치.png: 머리가 위, 초록 grip 이 아래. transform-origin 을 grip 에 둔다.
  // 순수 비주얼 — 게임 상태 모름. update(dt) 를 메인 루프가 매 프레임 호출.

  const FLY_SEC = 0.09;    // 홀스터/이전 위치 → 조준 (예비동작)
  const CHOP_SEC = 0.045;  // 내리찍기 — 빠르게 스냅
  const RISE_SEC = 0.10;
  const HOME_SEC = 0.22;

  const GRIP_X = 24;   // 스프라이트 안 손잡이 잡는 점 (%)
  const GRIP_Y = 84;
  const HOME_X = 0.82, HOME_Y = 0.86;  // 대기 위치 (보드 분수) — 우측 하단, 화면 안
  const HOME_DEG = 26;                 // 대기: 옆으로 뉘어 홀스터
  const READY_DEG = -30;               // 조준: 오른쪽에서 머리 들어올림
  const HIT_DEG = -82;                 // 타격: 머리를 대각선 아래로 휘두름
  const GRIP_OFF_X = 0.11;             // grip 을 목표보다 이만큼 오른쪽 (보드 폭 분수)
  const GRIP_OFF_Y = 0.10;             // grip 을 목표보다 이만큼 아래 (보드 높이 분수)
  const CLAMP = 0.12;                  // grip 이 보드 가장자리 이 안쪽까지만 (화면밖 방지)

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
    el.style.transformOrigin = GRIP_X + '% ' + GRIP_Y + '%';
    layer.appendChild(el);

    let phase = 'home';   // 'home' | 'fly' | 'chop' | 'rise' | 'return'
    let t = 0;
    let fromX = HOME_X, fromY = HOME_Y, fromDeg = HOME_DEG;
    let aimX = HOME_X, aimY = HOME_Y, gx = HOME_X, gy = HOME_Y, deg = HOME_DEG;
    let impactCb = null;
    let fired = false;

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      fromX = gx; fromY = gy; fromDeg = deg;
      aimX = Math.max(CLAMP, Math.min(1 - CLAMP, tx + GRIP_OFF_X));
      aimY = Math.max(CLAMP, Math.min(1 - CLAMP, ty + GRIP_OFF_Y));
      impactCb = onImpact || null;
      fired = false;
      phase = 'fly';
      t = 0;
    }

    function update(dt) {
      if (phase !== 'home') t += dt;

      if (phase === 'fly') {
        const k = ease(clamp01(t / FLY_SEC));
        gx = lerp(fromX, aimX, k);
        gy = lerp(fromY, aimY, k);
        deg = lerp(fromDeg, READY_DEG, k);
        if (t >= FLY_SEC) { phase = 'chop'; t = 0; fromDeg = deg; }
      } else if (phase === 'chop') {
        const k = ease(clamp01(t / CHOP_SEC));
        gx = aimX; gy = aimY;
        deg = lerp(READY_DEG, HIT_DEG, k);
        if (!fired && t >= CHOP_SEC) {
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
        gx = lerp(fromX, HOME_X, k);
        gy = lerp(fromY, HOME_Y, k);
        deg = lerp(fromDeg, HOME_DEG, k);
        if (t >= HOME_SEC) { phase = 'home'; t = 0; }
      }
      paint();
    }

    function paint() {
      el.style.left = (gx * 100).toFixed(2) + '%';
      el.style.top = (gy * 100).toFixed(2) + '%';
      el.style.transform = 'translate(-' + GRIP_X + '%, -' + GRIP_Y + '%) rotate(' + deg.toFixed(1) + 'deg)';
    }

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
