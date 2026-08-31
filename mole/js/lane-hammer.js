(function (root) {
  'use strict';

  // 망치 하나. 평소 우측 하단 홀스터 → 버튼 누르면 손잡이(grip)를 목표 근처(오른쪽 아래)에 놓고,
  // 머리를 대각선으로 휘둘러 두더지 모자 정수리에 정확히 꽂는다 (기획서 §5, v1.5 / 레퍼런스 영상).
  // 망치.png: 머리 위 / 초록 grip 아래. transform-origin 을 grip 에 둔다.
  // 타격 각도는 "grip→목표" 방향에 머리를 맞춰 동적으로 계산 → 맨 오른쪽 열도 위치가 맞는다.
  // 순수 비주얼 — 게임 상태 모름. update(dt) 를 메인 루프가 매 프레임 호출.

  const FLY_SEC = 0.09;
  const CHOP_SEC = 0.05;
  const RISE_SEC = 0.10;
  const HOME_SEC = 0.22;

  const GRIP_X = 24;   // 스프라이트 안 손잡이 잡는 점 (%)
  const GRIP_Y = 84;
  // 자연 상태(rotate 0)에서 "머리 타격점 − grip" 오프셋, 보드 폭 단위. CSS .lane-hammer width 13% 기준.
  // (스프라이트에서 머리중심 ~(62%,22%), grip ~(24%,84%), 세로/가로비 546/309)
  const V0X = 0.050;
  const V0Y = -0.142;
  const A0 = Math.atan2(V0Y, V0X);          // 자연 머리 방향 (rad)
  const ARC_DEG = 46;                       // 예비(ready) → 타격(hit) 스윙 폭
  const IDEAL_OFF_X = 0.10;                 // grip 을 목표보다 이만큼 오른쪽 (여유 있을 때)
  const IDEAL_OFF_Y = 0.06;                 // grip 을 목표보다 이만큼 아래
  const CLAMP = 0.1;                        // grip 이 보드 가장자리 이 안쪽까지만
  const HOME_X = 0.82, HOME_Y = 0.86;
  const HOME_DEG = 26;

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clampB(v) { return Math.max(CLAMP, Math.min(1 - CLAMP, v)); }
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
    let readyDeg = -30, hitDeg = -76;
    let impactCb = null;
    let fired = false;

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      fromX = gx; fromY = gy; fromDeg = deg;
      aimX = clampB(tx + IDEAL_OFF_X);
      aimY = clampB(ty + IDEAL_OFF_Y);
      // 타격 각도: grip→목표 방향에 머리를 맞춘다.
      hitDeg = (Math.atan2(ty - aimY, tx - aimX) - A0) * 180 / Math.PI;
      readyDeg = hitDeg - ARC_DEG;
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
        deg = lerp(fromDeg, readyDeg, k);
        if (t >= FLY_SEC) { phase = 'chop'; t = 0; fromDeg = deg; }
      } else if (phase === 'chop') {
        const k = ease(clamp01(t / CHOP_SEC));
        gx = aimX; gy = aimY;
        deg = lerp(readyDeg, hitDeg, k);
        if (!fired && t >= CHOP_SEC) {
          fired = true;
          img.classList.remove('lane-hammer-img--hit');
          void img.offsetWidth;
          img.classList.add('lane-hammer-img--hit');
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
          phase = 'rise'; t = 0; fromDeg = deg;
        }
      } else if (phase === 'rise') {
        deg = lerp(fromDeg, readyDeg, clamp01(t / RISE_SEC));
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
