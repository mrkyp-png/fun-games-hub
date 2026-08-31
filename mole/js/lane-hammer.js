(function (root) {
  'use strict';

  // 우측 하단 축에서 대각선으로 스윙하는 망치 하나 (기획서 §5, v1.4).
  // 회전 각도가 어느 열을 때리는지 결정. 이동 시간은 예비동작(wind) 안에 숨긴다.
  // 순수 비주얼 — 게임 상태를 전혀 모른다. update(dt) 를 메인 루프가 매 프레임 호출.

  const WIND_SEC = 0.07;    // 예비: 어깨 뒤로 젖힘 (이동도 이 동안)
  const SWING_SEC = 0.06;   // 타격: 대각선으로 내리침
  const RECOVER_SEC = 0.14; // 복귀 (중단 가능)
  const IDLE_DEG = -18;     // 대기 자세
  const WIND_DEG = -82;     // 예비 자세
  const HIT_DEG = 10;       // 타격 끝 자세

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function create({ layer, gridSize }) {
    const el = document.createElement('div');
    el.className = 'lane-hammer';
    const img = document.createElement('img');
    img.src = 'assets/hammer.png';
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);

    let phase = 'idle';        // 'idle' | 'wind' | 'swing' | 'recover'
    let t = 0;                 // 현재 phase 경과 시간(초)
    let fromCol = gridSize - 1;
    let toCol = gridSize - 1;
    let curCol = gridSize - 1; // 화면상 현재 열 (보간값)
    let targetY = 0.5;         // 목표 정수리 yFrac
    let impactCb = null;
    let fired = false;

    function colXFrac(col) { return (col + 0.5) / gridSize; }

    function strike(col, targetYFrac, onImpact) {
      fromCol = curCol;
      toCol = col;
      targetY = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      impactCb = onImpact || null;
      fired = false;
      phase = 'wind';
      t = 0;
    }

    function update(dt) {
      if (phase === 'idle') { paint(); return; }
      t += dt;

      if (phase === 'wind') {
        curCol = lerp(fromCol, toCol, clamp01(t / WIND_SEC) * 0.35);
        if (t >= WIND_SEC) { phase = 'swing'; t = 0; }
      } else if (phase === 'swing') {
        curCol = lerp(fromCol + (toCol - fromCol) * 0.35, toCol, clamp01(t / SWING_SEC));
        if (!fired && t >= SWING_SEC) {
          fired = true;
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
          phase = 'recover'; t = 0;
        }
      } else if (phase === 'recover') {
        curCol = toCol;
        if (t >= RECOVER_SEC) { phase = 'idle'; t = 0; }
      }
      paint();
    }

    function paint() {
      let deg = IDLE_DEG;
      let lunge = 0;
      if (phase === 'wind') {
        deg = lerp(IDLE_DEG, WIND_DEG, clamp01(t / WIND_SEC));
      } else if (phase === 'swing') {
        const k = clamp01(t / SWING_SEC);
        deg = lerp(WIND_DEG, HIT_DEG, k);
        lunge = Math.sin(k * Math.PI) * 7;
      } else if (phase === 'recover') {
        deg = lerp(HIT_DEG, IDLE_DEG, clamp01(t / RECOVER_SEC));
      }
      el.style.left = (colXFrac(curCol) * 100) + '%';
      el.style.top = ((phase === 'idle' ? 0.5 : targetY) * 100 - lunge) + '%';
      el.style.transform = 'translate(-50%, -100%) rotate(' + deg.toFixed(1) + 'deg)';
    }

    function isBusy() { return phase !== 'idle'; }

    function clear() {
      phase = 'idle'; t = 0; curCol = gridSize - 1; targetY = 0.5; impactCb = null; fired = false;
      paint();
    }

    paint();
    return { strike, update, isBusy, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneHammer = api; }
})(typeof window !== 'undefined' ? window : null);
