(function (root) {
  'use strict';

  // 망치 하나. 평소 우측 하단 홀스터 → 버튼 누르면 손잡이(grip)를 목표의 오른쪽 위에 놓고,
  // 머리를 대각선 아래-왼쪽으로 휘둘러 두더지 모자에 **정확히** 꽂는다 (레퍼런스 영상).
  //
  // 핵심: 머리는 grip 에서 고정 길이 R, 고정 방향(자연 A0) 만큼 떨어져 있다. rotate(deg) 하면
  // 머리 방향이 A0+deg 가 된다. 그러니 "머리를 목표에 착지"시키려면:
  //   grip = 목표 − R·(스윙 착지 방향 단위벡터)   ← 이 위치에서
  //   deg  = (착지 방향 각) − A0                   ← 이 각도로 찍으면 머리가 목표에 온다
  // 순수 비주얼 — 게임 상태 모름. update(dt) 를 메인 루프가 매 프레임 호출.

  const FLY_SEC = 0.09;
  const CHOP_SEC = 0.05;
  const RISE_SEC = 0.11;
  const HOME_SEC = 0.22;

  const DEG = Math.PI / 180;
  const GRIP_X = 24, GRIP_Y = 84;   // 스프라이트 안 손잡이 잡는 점 (%)
  // 자연 상태(rotate 0)에서 "머리 타격점 − grip" 오프셋, 보드 폭 단위. CSS .lane-hammer width 13% 기준.
  const V0X = 0.050, V0Y = -0.142;
  const R = Math.hypot(V0X, V0Y);          // 머리 도달 거리 (≈0.15 보드폭)
  const A0 = Math.atan2(V0Y, V0X);         // 자연 머리 방향 (rad)
  const APPROACH = 122 * DEG;              // 착지 방향 (화면각: 90=아래, 180=왼쪽) — 아래-왼쪽
  const DIRX = Math.cos(APPROACH), DIRY = Math.sin(APPROACH);
  const ARC_DEG = 52;                      // 예비(ready) → 타격(hit) 스윙 폭
  const CLAMP = 0.06;
  const HOME_X = 0.83, HOME_Y = 0.84;
  const HOME_DEG = 150;                    // 홀스터도 대충 조준 자세 (fly 회전량 최소화)

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

    let phase = 'home';
    let t = 0;
    let fromX = HOME_X, fromY = HOME_Y, fromDeg = HOME_DEG;
    let aimX = HOME_X, aimY = HOME_Y, gx = HOME_X, gy = HOME_Y, deg = HOME_DEG;
    let readyDeg = HOME_DEG, hitDeg = HOME_DEG;
    let impactCb = null;
    let fired = false;

    function strike(targetXFrac, targetYFrac, onImpact) {
      const tx = (typeof targetXFrac === 'number') ? targetXFrac : 0.5;
      const ty = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      fromX = gx; fromY = gy; fromDeg = deg;
      // grip = 목표 − R·(착지 방향). 화면 밖이면 클램프(그럼 머리가 살짝 못 미치지만 각도는 계속 목표를 향함).
      aimX = clampB(tx - R * DIRX);
      aimY = clampB(ty - R * DIRY);
      hitDeg = (Math.atan2(ty - aimY, tx - aimX) - A0) / DEG;
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
