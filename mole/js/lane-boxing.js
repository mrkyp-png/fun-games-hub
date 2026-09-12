(function (root) {
  'use strict';

  // 알리 펀치 — 좌/우 권투 글러브 2개. lane-hammer.js 와 인터페이스 동일
  // (strike/update/home/clear/isBusy) 이지만, 망치처럼 아무 데나 날아가는 게 아니라
  // 각 글러브가 자기 자리(왼쪽 하단·오른쪽 하단, 삭제된 구멍 12·15 자리)에 고정돼 있고
  // 자기 담당 구역(ZONES)만 손을 뻗어 때린다 (기획서 §1·§2).
  //
  // 펀치 스타일 5종(§3·§4): 잽/스트레이트 = 때리고 대기위치 복귀. 어퍼컷/라이트훅/레프트훅 =
  // 때리고 사라졌다가 짧게 쉬고 다시 나타남(코너가 계속 비어있지 않도록).
  // 이미지는 3장만(§5): 잽·라이트훅·레프트훅·대기 = alipunch-jab.png(공용), 스트레이트 전용,
  // 어퍼컷 전용.

  const HOME_L = { x: 0.125, y: 0.88 };
  const HOME_R = { x: 0.875, y: 0.88 };
  const REACH_SEC = 0.10;
  const RETURN_SEC = 0.14;
  const GONE_FADE_SEC = 0.12;
  const GONE_HOLD_SEC = 0.16;
  const BACK_FADE_SEC = 0.16;

  const SPRITE = {
    idle: 'assets/weapons/alipunch-jab.png',
    jab: 'assets/weapons/alipunch-jab.png',
    hookL: 'assets/weapons/alipunch-jab.png',
    hookR: 'assets/weapons/alipunch-jab.png',
    straight: 'assets/weapons/alipunch-straight.png',
    upper: 'assets/weapons/alipunch-upper.png'
  };
  // 때린 뒤 대기위치로 복귀(true) vs 사라졌다 다시 나타남(false). 전부 복귀로 변경(사용자 지시).
  const RETURNS = { jab: true, straight: true, upper: true, hookL: true, hookR: true };

  // 이미지 회전각(사용자 지시, 도) — 원본 이미지 기준. 대기(idle) = 항상 좌45도(시계)·우-45도(반시계,거울).
  // 직선 움직임(스트레이트)과 세로(어퍼컷)는 원본 이미지 각도(0도) 그대로 사용 — 대기 각도 아님.
  // 잽은 좌측만 지정됨(시계 90도) → 우측은 대칭 가정(반시계 90도, 사용자 확인 전).
  // 훅(대각선)은 아직 지시 없음 — 대기 각도로 잠정.
  const ROT_BY_SIDE = {
    L: { idle: 45, jab: 90, straight: 0, upper: 0, hookL: 45 },
    R: { idle: -45, jab: -90, straight: 0, upper: 0, hookR: -45 }
  };
  function imgTransform(side, deg) {
    return side === 'R' ? ('rotate(' + deg + 'deg) scaleX(-1)') : ('rotate(' + deg + 'deg)');
  }
  // 구멍별 이미지·각도 오버라이드(사용자 지시) — sprite/deg 중 있는 값만 스타일 기본값 대신 쓴다.
  // 다이얼 숫자 5번(id5): 쨉 이미지로, 35도(대기각 45도에서 반시계 10도 = 45-10).
  // 최근기록(id11): 대기각(-45)에서 시계방향 45도 = 0도, 직선으로 타격 후 복귀.
  // 다이얼 숫자 7번(id8): "최근기록"과 동일 동작 → 0도 그대로 공유(방향 대칭 상관없는 값이라 좌우 동일).
  // 다이얼 숫자 8번(id9): 대기위치 이미지 그대로(45도) 타격 후 복귀.
  // 다이얼 숫자 9번(id10): 대기위치 이미지 그대로(-45도) 타격 후 복귀.
  // 다이얼 숫자 6번(id6): 스트레이트 이미지, 대기각(-45)에서 시계 10도 = -35도, 직선 타격 후 복귀.
  const REGION_OVERRIDE = {
    5: { sprite: 'jab', deg: 35 },
    6: { deg: -35 },
    8: { deg: 0 },
    9: { deg: 45 },
    10: { deg: -45 },
    11: { deg: 0 }
  };

  // 구역 배치 — 사용자가 다이얼 번호로 직접 확정(2026-09-12): 7·8·9·최근기록·0·#=잽,
  // 4·5·6·키패드=스트레이트, 1·연락처=어퍼컷, 2=레프트훅(왼쪽), 3=라이트훅(오른쪽).
  const ZONES = {
    8: 'jab', 9: 'jab', 13: 'jab',
    4: 'straight', 5: 'straight',
    0: 'upper',
    1: 'hookL',
    10: 'jab', 11: 'jab', 14: 'jab',
    6: 'straight', 7: 'straight',
    3: 'upper',
    2: 'hookR'
  };
  const GLOVE_OF = { 8: 'L', 9: 'L', 13: 'L', 4: 'L', 5: 'L', 0: 'L', 1: 'L',
    10: 'R', 11: 'R', 14: 'R', 6: 'R', 7: 'R', 3: 'R', 2: 'R' };

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * (2 - k); } // ease-out

  function makeGlove(layer, home, cssClass, side) {
    const el = document.createElement('div');
    el.className = 'lane-boxing-glove ' + cssClass;
    const img = document.createElement('img');
    img.src = SPRITE.idle;
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);
    const rotTable = ROT_BY_SIDE[side];

    function setPose(s, regionId) {
      const override = regionId != null ? REGION_OVERRIDE[regionId] : null;
      const src = SPRITE[override ? override.sprite : s] || SPRITE.idle;
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      const deg = override ? override.deg : (rotTable[s] != null ? rotTable[s] : rotTable.idle);
      img.style.transform = imgTransform(side, deg);
    }

    let phase = 'idle'; // idle | reach | return | goneFade | goneHold | backFade
    let t = 0;
    let gx = home.x, gy = home.y, scale = 1, opacity = 1;
    let fromX = home.x, fromY = home.y, toX = home.x, toY = home.y;
    let style = 'jab';
    let impactCb = null, fired = false;
    let arcSign = 0; // 훅 진행 방향(좌우 곡선) — 0 이면 직선

    function paint() {
      el.style.left = (gx * 100).toFixed(2) + '%';
      el.style.top = (gy * 100).toFixed(2) + '%';
      el.style.opacity = opacity.toFixed(2);
      el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(3) + ')';
    }

    function strike(targetX, targetY, st, onImpact, regionId) {
      style = st;
      setPose(st, regionId);
      arcSign = (st === 'hookL') ? -1 : (st === 'hookR') ? 1 : 0;
      fromX = home.x; fromY = home.y;
      toX = targetX; toY = targetY;
      impactCb = onImpact || null;
      fired = false;
      phase = 'reach';
      t = 0;
      // 보이스는 여기서 안 튼다 — 정타(두더지 실제 명중)일 때만, game.js onHammerImpact 가 재생.
    }

    function update(dt) {
      if (phase === 'idle') return;
      t += dt;
      if (phase === 'reach') {
        const k = ease(clamp01(t / REACH_SEC));
        gx = lerp(fromX, toX, k) + (arcSign ? arcSign * Math.sin(k * Math.PI) * 0.3 : 0); // 훅 곡선 최대로(사용자 지시)
        gy = lerp(fromY, toY, k);
        scale = lerp(1, 1.08, k);
        opacity = 1;
        if (t >= REACH_SEC) {
          if (!fired) { fired = true; if (impactCb) { const cb = impactCb; impactCb = null; cb(); } }
          if (RETURNS[style]) { phase = 'return'; t = 0; fromX = gx; fromY = gy; }
          else { phase = 'goneFade'; t = 0; }
        }
      } else if (phase === 'return') {
        const k = clamp01(t / RETURN_SEC);
        gx = lerp(fromX, home.x, k);
        gy = lerp(fromY, home.y, k);
        scale = lerp(1.08, 1, k);
        if (t >= RETURN_SEC) { phase = 'idle'; t = 0; gx = home.x; gy = home.y; scale = 1; setPose('idle'); }
      } else if (phase === 'goneFade') {
        const k = clamp01(t / GONE_FADE_SEC);
        opacity = 1 - k;
        scale = lerp(1.08, 0.7, k);
        if (t >= GONE_FADE_SEC) { phase = 'goneHold'; t = 0; opacity = 0; gx = home.x; gy = home.y; scale = 1; }
      } else if (phase === 'goneHold') {
        if (t >= GONE_HOLD_SEC) { phase = 'backFade'; t = 0; setPose('idle'); }
      } else if (phase === 'backFade') {
        const k = clamp01(t / BACK_FADE_SEC);
        opacity = k;
        if (t >= BACK_FADE_SEC) { phase = 'idle'; t = 0; opacity = 1; }
      }
      paint();
    }

    function isBusy() { return phase !== 'idle'; }

    function home_() {
      phase = 'idle'; t = 0; impactCb = null; fired = false;
      gx = home.x; gy = home.y; scale = 1; opacity = 1;
      setPose('idle');
      paint();
    }

    function clear() { el.remove(); }

    setPose('idle'); // 최초 생성 시 회전/거울상 적용 (안 하면 img.style.transform 이 계속 비어있음)
    paint();
    return { strike, update, isBusy, home: home_, clear };
  }

  function create({ layer }) {
    const left = makeGlove(layer, HOME_L, 'lane-boxing-glove--l', 'L');
    const right = makeGlove(layer, HOME_R, 'lane-boxing-glove--r', 'R');

    // strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId) — regionId 로 구역 판정.
    // (lane-hammer.js 와 인터페이스 맞추려고 frameKey 자리를 유지, 여기선 안 씀.)
    function strike(targetX, targetY, onImpact, frameKey, regionId) {
      const style = ZONES[regionId];
      const side = GLOVE_OF[regionId];
      if (!style || !side) { if (onImpact) onImpact(); return; } // 구역 밖(방어적) — 그냥 판정만
      const g = side === 'L' ? left : right;
      g.strike(targetX, targetY, style, onImpact, regionId);
    }

    function update(dt) { left.update(dt); right.update(dt); }
    function isBusy() { return left.isBusy() || right.isBusy(); }
    function home() { left.home(); right.home(); }
    function clear() { left.clear(); right.clear(); }

    return { strike, update, isBusy, home, clear };
  }

  const api = { create, ZONES: ZONES, EXCLUDED_HOLES: [12, 15] };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneBoxing = api; }
})(typeof window !== 'undefined' ? window : null);
