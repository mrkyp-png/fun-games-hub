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
    /* 메일 아이콘: 설정 버튼 밑(V1631 C 사용자), 받을 메일 있으면 빨간 점 */
    /* V1635 C 사용자: 올라갈 때 오른쪽에 높이 표시 */
    const altBox = el('div', 'h3-alt', wrap), altNum = el('b', '', altBox); el('i', '', altBox).textContent = '▲'; altBox.hidden = true;
    const mailBtn = el('button', 'h3-mail', wrap); mailBtn.type = 'button'; mailBtn.setAttribute('aria-label', 'mail');
    const mimg = el('img', '', mailBtn); mimg.src = 'assets/mailbox/ic-mail.png'; mimg.alt = ''; const mailDot = el('i', 'h3-mail-dot', mailBtn); mailDot.hidden = true;
    mailBtn.addEventListener('click', () => { if (opts.onMail) opts.onMail(); });
    /* CSS 메일 팝업 */
    const mailPop = el('div', 'shop-coin-choice-dialog h3-mailpop', wrap); mailPop.hidden = true;
    const mailBox = el('div', 'shop-coin-choice-card h3-mailbox', mailPop), mailArt = el('img', 'shop-coin-choice-art', mailBox); mailArt.src = 'assets/mailbox/ic-mail.png'; mailArt.alt = '';
    const mailHead = el('b', 'shop-coin-choice-message', mailBox), mailList = el('div', 'h3-maillist', mailBox), mailFoot = el('div', 'shop-coin-choice-actions', mailBox);
    const mailAll = el('button', 'shop-card-btn shop-coin-choice-action ws-action-frame shop-buy-frame', mailFoot), mailClose = el('button', 'shop-card-btn shop-coin-choice-action ws-action-frame shop-buy-frame shop-buy-frame--cancel', mailFoot); mailAll.type = 'button'; mailClose.type = 'button';
    mailAll.dataset.choiceAction = 'confirm'; mailClose.dataset.choiceAction = 'cancel';
    const REWARD_ICON = { coin: ICON.coins, heart: ICON.hearts, ticket: ICON.tickets };
    function mailRender() {
      const MB = root.MoleGame && root.MoleGame.Mailbox, ko = root.FGH && root.FGH.I18N.lang === 'ko', items = MB ? MB.list() : [];
      mailHead.textContent = ko ? '메일함' : 'Mailbox'; mailAll.textContent = ko ? '모두 받기' : 'Claim all'; mailClose.textContent = ko ? '닫기' : 'Close';
      mailList.textContent = '';
      if (!items.length) { const e = el('p', 'h3-mail-empty', mailList); e.textContent = ko ? '받은 메일이 없어요' : 'No mail'; }
      for (const m of items) {
        const row = el('div', 'h3-mailrow' + (m.isClaimed ? ' is-done' : ''), mailList), txt = el('div', 'h3-mailtxt', row);
        const tx = (v) => { const k = String(v || ''); const o = /^mole./.test(k) && root.FGH ? root.FGH.I18N.t(k) : k; return o === k && /^mole./.test(k) ? '' : o; }; /* 메일 제목·내용 = 번역 키(메일함 화면과 같게) */
        el('b', '', txt).textContent = tx(m.title); el('span', '', txt).textContent = tx(m.description);
        const rw = el('div', 'h3-mailrw', row);
        if (REWARD_ICON[m.rewardType]) { const im = el('img', '', rw); im.src = REWARD_ICON[m.rewardType]; im.alt = ''; } else if (m.rewardType === 'gift') el('i', 'h3-mail-gift', rw);
        if (m.rewardType && m.rewardType !== 'none') el('em', '', rw).textContent = '×' + (m.rewardAmount || 1);
        const bt = el('button', 'h3-mail-get', row); bt.type = 'button';
        bt.textContent = m.isClaimed ? (ko ? '받음' : 'Done') : (ko ? '받기' : 'Claim'); bt.disabled = !!m.isClaimed || !m.rewardType || m.rewardType === 'none';
        bt.addEventListener('click', () => { if (MB.claim(m.id)) { mailRender(); if (opts.onMailChanged) opts.onMailChanged(); } });
        if (!m.isRead && MB.markRead) MB.markRead(m.id);
      }
      mailAll.disabled = !items.some((m) => !m.isClaimed && m.rewardType && m.rewardType !== 'none');
    }
    mailAll.addEventListener('click', () => { const MB = root.MoleGame.Mailbox; if (MB && MB.claimAll().length) { mailRender(); if (opts.onMailChanged) opts.onMailChanged(); } });
    mailClose.addEventListener('click', () => { mailPop.hidden = true; if (opts.onMailChanged) opts.onMailChanged(); });
    mailPop.addEventListener('pointerdown', (e) => { if (e.target === mailPop) { mailPop.hidden = true; if (opts.onMailChanged) opts.onMailChanged(); } });
    const dots = {}; // 건물·사물 위 빨간 점(받을 것 있음)
    const stick = el('div', 'h3-stick', wrap), knob = el('span', '', stick);
    // 점프 버튼: 스틱과 같은 크기·같은 줄, 안에 CSS 발바닥(이미지 없이)
    const jumpBtn = el('button', 'h3-jump', wrap); jumpBtn.type = 'button';
    const enterLbl = el('span', 'h3-enter-lbl', jumpBtn); // 건물 가까이: 점프 버튼 → 그 건물 터치 버튼
    const paw = el('span', 'h3-paw', jumpBtn); for (let i = 0; i < 4; i++) el('i', '', paw); el('b', '', paw);
    const loading = el('div', 'h3-loading', wrap); loading.setAttribute('role', 'status');
    // 설정·아이템·메일함은 자체 닫기 없이 아래 다이얼패드로 닫던 화면 — 광장이 그 자리를 덮으므로 대신 닫기
    const close = el('button', 'h3-close', wrap); close.type = 'button'; close.hidden = true;
    // 게임기 안(구멍판 화면)에서 조이스틱 자리 = 나가기(V1621 C 사용자)
    const exitBtn = el('button', 'h3-exit', wrap); exitBtn.type = 'button'; exitBtn.hidden = true;

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
    /* 보상 창(배 5분 → 광고 보고 하트 2) */
    const offer = el('div', 'shop-coin-choice-dialog h3-offer', wrap); offer.hidden = true;
    const offerCard = el('div', 'shop-coin-choice-card', offer), offerArt = el('img', 'shop-coin-choice-art', offerCard); offerArt.src = ICON.hearts; offerArt.alt = '';
    const offerTxt = el('b', 'shop-coin-choice-message', offerCard), offerRow = el('div', 'shop-coin-choice-actions', offerCard);
    const offerYes = el('button', 'shop-card-btn shop-coin-choice-action ws-action-frame shop-buy-frame', offerRow), offerNo = el('button', 'shop-card-btn shop-coin-choice-action ws-action-frame shop-buy-frame shop-buy-frame--cancel', offerRow);
    offerYes.dataset.choiceAction = 'confirm'; offerNo.dataset.choiceAction = 'cancel';
    offerYes.type = 'button'; offerNo.type = 'button'; let offerCb = null;
    offerYes.addEventListener('click', () => { const c = offerCb; offer.hidden = true; offerCb = null; if (c) c(true); });
    offerNo.addEventListener('click', () => { const c = offerCb; offer.hidden = true; offerCb = null; if (c) c(false); });
    exitBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (opts.onExit) opts.onExit(); });
    // 점프: 누르는 순간 바로(스틱과 동시에 누를 수 있게 pointerdown)
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); opts.onJump(); });

    return {
      canvas, input,
      show(on) { wrap.hidden = !on; host.classList.toggle('home3d-on', !!on); if (!on) resetAll(); },
      setFeature(on, label) { close.hidden = !on; close.textContent = label || ''; for (const e of [hud, stick, jumpBtn, mailBtn]) e.hidden = !!on; if (on) for (const k in dots) dots[k].hidden = true; },
      setJumpMode(label) { jumpBtn.classList.toggle('is-enter', !!label); if (enterLbl.textContent !== (label || '')) enterLbl.textContent = label || ''; },
      setEnabled(on) { input.setEnabled(on); drawKnob(); },
      setLoading(text) { loading.hidden = !text; loading.textContent = text || ''; },
      setMailDot(on) { mailDot.hidden = !on; },
      setHeight(m) { altBox.hidden = !(m >= 1); if (m >= 1) altNum.textContent = Math.round(m) + 'm'; }, /* 날기 높이(V1635 C) */
      showMail() { mailRender(); mailPop.hidden = false; },
      mailOpen: () => !mailPop.hidden,
      setJumpLabel(text) { jumpBtn.setAttribute('aria-label', text); },
      showOffer(text, yes, no, cb) { offerTxt.textContent = text; offerYes.textContent = yes; offerNo.textContent = no; offerCb = cb; offer.hidden = false; },
      hideOffer() { offer.hidden = true; offerCb = null; },
      setExit(label) { exitBtn.hidden = !label; exitBtn.textContent = label || ''; stick.hidden = !!label; if (label) resetAll(); },
      setHud(v) { for (const k in vals) vals[k].textContent = v[k]; },
      // 작은 지도: 위 = 앞(-z). 섬·건물/사물 점·두더지 화살표
      setBadges(list) {
        const seen = {};
        for (const b of list) { seen[b.action] = 1; const d = dots[b.action] || (dots[b.action] = el('i', 'h3-dot', wrap)); d.hidden = !b.on; d.style.left = b.x + 'px'; d.style.top = b.y + 'px'; }
        for (const k in dots) if (!seen[k]) dots[k].hidden = true;
      }
    };
  }

  const api = { create, createInput };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
