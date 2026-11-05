/* 3D 홈 조작 UI: 재화 줄·톱니바퀴·작은 지도·이동 스틱·들어가기 버튼 + 터치 입력.
   이동 스틱과 시점 회전은 손가락(pointerId)을 따로 추적한다. */
(function (root) {
  'use strict';

  // ---------- 입력 모델(순수, 검사 가능) ----------
  function createInput() {
    let stickId = null, look = null, enabled = true;
    const inp = { joy: { x: 0, y: 0 } };
    function setJoy(dx, dy, r) { const d = Math.max(1, Math.hypot(dx, dy) / r); inp.joy = { x: dx / d / r, y: dy / d / r }; }
    inp.stickDown = (id, dx, dy, r) => { if (!enabled || stickId !== null) return false; stickId = id; setJoy(dx, dy, r); return true; };
    inp.stickMove = (id, dx, dy, r) => { if (id === stickId) setJoy(dx, dy, r); };
    inp.stickUp = (id) => { if (id === stickId) { stickId = null; inp.joy = { x: 0, y: 0 }; } };
    inp.lookDown = (id, x, y) => { if (!enabled || look) return false; look = { id, x, y, sx: x, sy: y, moved: false }; return true; };
    inp.lookMove = (id, x, y) => {
      if (!look || look.id !== id) return { dyaw: 0, dpitch: 0 };
      if (Math.hypot(x - look.sx, y - look.sy) > 8) look.moved = true;
      const out = look.moved ? { dyaw: -(x - look.x) * 0.006, dpitch: (y - look.y) * 0.004 } : { dyaw: 0, dpitch: 0 };
      look.x = x; look.y = y;
      return out;
    };
    inp.lookUp = (id, x, y) => { if (!look || look.id !== id) return null; const tap = !look.moved; look = null; return tap ? { x, y } : null; };
    inp.reset = () => { stickId = null; look = null; inp.joy = { x: 0, y: 0 }; };
    inp.setEnabled = (on) => { enabled = !!on; if (!enabled) inp.reset(); };
    inp.stickActive = () => stickId !== null;
    return inp;
  }

  // ---------- DOM ----------
  const ICON = { coins: 'assets/shop-ui-v1452/coin-option-06-bright20.png', hearts: 'assets/home2/ic-heart.png',
    tickets: 'assets/ui-approved-v1476/ticket-single.webp', gear: 'assets/home2/ic-settings.png' };

  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.append(e); return e; }

  function create(host, opts) {
    const input = createInput();
    const wrap = el('section', 'h3-home', host); wrap.id = 'home3d'; wrap.hidden = true;
    const canvas = el('canvas', 'h3-canvas', wrap);
    const hud = el('div', 'h3-hud', wrap), vals = {};
    for (const k of ['coins', 'hearts', 'tickets']) {
      const pill = el('div', 'h3-pill', hud), img = el('img', '', pill); img.src = ICON[k]; img.alt = '';
      vals[k] = el('b', '', pill);
    }
    const gear = el('button', 'h3-gear', hud); gear.type = 'button'; gear.setAttribute('aria-label', 'settings');
    const gimg = el('img', '', gear); gimg.src = ICON.gear; gimg.alt = '';
    const mini = el('canvas', 'h3-minimap', wrap); mini.width = mini.height = 120;
    const stick = el('div', 'h3-stick', wrap), knob = el('span', '', stick);
    // 점프 버튼: 스틱과 같은 크기·같은 줄, 안에 CSS 발바닥(이미지 없이)
    const jumpBtn = el('button', 'h3-jump', wrap); jumpBtn.type = 'button';
    const enterLbl = el('span', 'h3-enter-lbl', jumpBtn); // 건물 가까이: 점프 버튼 → 그 건물 터치 버튼
    const paw = el('span', 'h3-paw', jumpBtn); for (let i = 0; i < 4; i++) el('i', '', paw); el('b', '', paw);
    const loading = el('div', 'h3-loading', wrap); loading.setAttribute('role', 'status');
    // 설정·아이템·메일함은 자체 닫기 없이 아래 다이얼패드로 닫던 화면 — 광장이 그 자리를 덮으므로 대신 닫기
    const close = el('button', 'h3-close', wrap); close.type = 'button'; close.hidden = true;

    function stickXY(e) { const b = stick.getBoundingClientRect(); return [e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2, b.width * 0.32]; }
    function drawKnob() { const r = stick.getBoundingClientRect().width * 0.32; knob.style.transform = 'translate(' + input.joy.x * r + 'px,' + input.joy.y * r + 'px)'; }
    stick.addEventListener('pointerdown', (e) => { if (input.stickDown(e.pointerId, ...stickXY(e))) { stick.setPointerCapture(e.pointerId); drawKnob(); opts.onStick && opts.onStick(); } });
    stick.addEventListener('pointermove', (e) => { input.stickMove(e.pointerId, ...stickXY(e)); drawKnob(); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(t, (e) => { input.stickUp(e.pointerId); drawKnob(); });

    canvas.addEventListener('pointerdown', (e) => { if (input.lookDown(e.pointerId, e.clientX, e.clientY)) canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { const d = input.lookMove(e.pointerId, e.clientX, e.clientY); if (d.dyaw || d.dpitch) opts.onLook(d); });
    canvas.addEventListener('pointerup', (e) => { const tap = input.lookUp(e.pointerId, e.clientX, e.clientY); if (tap) { const b = canvas.getBoundingClientRect(); opts.onTap(tap.x - b.left, tap.y - b.top, b.width, b.height); } });
    for (const t of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(t, (e) => input.lookUp(e.pointerId, 0, 0));
    function resetAll() { input.reset(); drawKnob(); }
    root.addEventListener('blur', resetAll);
    document.addEventListener('visibilitychange', resetAll);
    gear.addEventListener('click', () => opts.onSettings());
    close.addEventListener('click', () => opts.onClose());
    // 점프: 누르는 순간 바로(스틱과 동시에 누를 수 있게 pointerdown)
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); opts.onJump(); });

    return {
      canvas, input,
      show(on) { wrap.hidden = !on; host.classList.toggle('home3d-on', !!on); if (!on) resetAll(); },
      setFeature(on, label) { close.hidden = !on; close.textContent = label || ''; for (const e of [hud, mini, stick, jumpBtn]) e.hidden = !!on; },
      setJumpMode(label) { jumpBtn.classList.toggle('is-enter', !!label); if (enterLbl.textContent !== (label || '')) enterLbl.textContent = label || ''; },
      setEnabled(on) { input.setEnabled(on); drawKnob(); },
      setLoading(text) { loading.hidden = !text; loading.textContent = text || ''; },
      setJumpLabel(text) { jumpBtn.setAttribute('aria-label', text); },
      setHud(v) { for (const k in vals) vals[k].textContent = v[k]; },
      // 작은 지도: 위 = 앞(-z). 섬·건물/사물 점·두더지 화살표
      drawMinimap(view, layout) {
        const c = mini.getContext('2d'), S = mini.width, k = (S / 2 - 6) / layout.ISLAND_R;
        c.clearRect(0, 0, S, S);
        c.fillStyle = '#e9e3d6'; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); c.fill();
        c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
        for (const s of layout.SITES) {
          c.fillStyle = s.kind === 'building' ? '#6a8fb8' : '#c99a5b';
          c.beginPath(); c.arc(S / 2 + s.x * k, S / 2 + s.z * k, s.kind === 'building' ? 6 : 4, 0, Math.PI * 2); c.fill();
        }
        c.save(); c.translate(S / 2 + view.x * k, S / 2 + view.z * k); c.rotate(-view.heading + Math.PI);
        c.fillStyle = '#8a5a2b'; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(-6, 6); c.closePath(); c.fill();
        c.restore();
      }
    };
  }

  const api = { create, createInput };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
