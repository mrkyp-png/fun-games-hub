(function (root) {
  'use strict';

  // 무기 스킨: 대포. lane-hammer.js 와 같은 인터페이스
  // (create({layer}) → { strike, update, isBusy, home, clear }).
  // 우하단 코너 고정. 발사 = 프레임 스왑(대기→화염→연기→대기) + 반동(살짝/보통/강 랜덤).
  // 타격감은 game.js 의 HitFx 담당 (impactCb 를 발사 직후 호출).

  const REST_X = 0.79, REST_Y = 0.98;     // 캐리지 바닥 앵커 (보드 분수, 우하단)
  const BARREL_DEG = -35;                  // 포신 각도 (0=오른쪽, 반시계 −)
  const RECOIL = [0.016, 0.034, 0.058];    // 살짝 / 보통 / 강
  const KICK_SEC = 0.06;
  const SETTLE_SEC = 0.30;
  const IMPACT_AT = 0.045;

  // 프레임별: 폭(보드 분수) + 앵커 대비 미세 오프셋 (스프라이트마다 캐리지 위치가 달라 보정).
  const FR = {
    'cannon':       { w: 0.34, ox: 0.000, oy: 0.000 },
    'cannon-fire':  { w: 0.60, ox: -0.055, oy: -0.005 },
    'cannon-smoke': { w: 0.58, ox: -0.050, oy: -0.005 }
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(k) { return k * k; }
  function easeOut(k) { return 1 - (1 - k) * (1 - k); }

  function create({ layer }) {
    const el = document.createElement('div');
    el.className = 'lane-cannon';
    el.innerHTML = '<img class="lc-body" alt="">';
    layer.appendChild(el);
    const body = el.querySelector('.lc-body');
    ['cannon', 'cannon-fire', 'cannon-smoke'].forEach((n) => { const i = new Image(); i.src = 'assets/weapons/' + n + '.png'; });

    let cur = 'cannon';
    let phase = 'home', t = 0, total = 0;
    let recoilAmt = 0, impactCb = null, fired = false, firing = false;

    function setFrame(name) {
      cur = name;
      body.src = 'assets/weapons/' + name + '.png';
      body.style.width = (FR[name].w * 100).toFixed(1) + '%';
    }

    let swap1 = null, swap2 = null;
    function strike(_tx, _ty, onImpact) {
      recoilAmt = RECOIL[Math.floor(Math.random() * RECOIL.length)];
      phase = 'kick'; t = 0;
      impactCb = onImpact || null; fired = false; firing = true;
      setFrame('cannon-fire');
      place(recoilAmt);
      // 프레임 전환은 wall-clock (프레임레이트 독립).
      clearTimeout(swap1); clearTimeout(swap2);
      swap1 = setTimeout(() => { if (firing) setFrame('cannon-smoke'); place(curAmt()); }, 110);
      swap2 = setTimeout(() => { if (firing) { setFrame('cannon'); firing = false; place(curAmt()); } }, 270);
    }

    function curAmt() {
      if (phase === 'home') return 0;
      if (phase === 'kick') return recoilAmt * ease(clamp01(t / KICK_SEC));
      return recoilAmt * (1 - easeOut(clamp01(t / SETTLE_SEC)));
    }

    function update(dt) {
      if (phase === 'kick') {
        t += dt;
        if (t >= KICK_SEC) { phase = 'settle'; t = 0; }
      } else if (phase === 'settle') {
        t += dt;
        if (t >= SETTLE_SEC) { phase = 'home'; t = 0; }
      }
      place(curAmt());
      if (firing && !fired) {
        total += dt;
        if (total >= IMPACT_AT) {
          fired = true;
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
        }
      } else if (!firing) {
        total = 0;
      }
    }

    function place(amt) {
      const rad = (BARREL_DEG + 180) * Math.PI / 180;
      const dx = Math.cos(rad) * amt, dy = Math.sin(rad) * amt;
      const f = FR[cur];
      body.style.left = ((REST_X + dx + f.ox) * 100).toFixed(2) + '%';
      body.style.top = ((REST_Y + dy + f.oy) * 100).toFixed(2) + '%';
    }

    function isBusy() { return phase === 'kick'; }

    function home() {
      clearTimeout(swap1); clearTimeout(swap2);
      impactCb = null; fired = false; firing = false;
      phase = 'home'; t = 0; total = 0;
      setFrame('cannon');
      place(0);
    }

    function clear() { clearTimeout(swap1); clearTimeout(swap2); impactCb = null; el.remove(); }

    setFrame('cannon');
    place(0);
    return { strike, update, isBusy, home, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneCannon = api; }
})(typeof window !== 'undefined' ? window : null);
