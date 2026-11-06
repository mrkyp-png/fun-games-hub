/* 3D 홈 묶음 — 기존 게임(game.js)과 연결. 기본으로 켜짐(?home3d=0 = 구형 홈).
   기능 열기는 기존 홈 버튼과 같은 homeAction(action) 을 그대로 부른다.
   화면은 #game-screen 안 z-index 30(기존 홈 버튼판 위, 기능 화면 아래)에 깔린다. */
(function (root) {
  'use strict';
  const PLAZA_GLB = 'assets/home3d/plaza.glb'; // review/build-home-plaza.py
  const MOLE_GLB = 'assets/checkerboard-v1590/mole-clay-v44.glb'; // v43 + Jump·WalkFwd(review/merge-mole-actions.cjs)
  const SPEED = 2.8;

  function create(opts) {
    const qs = new URLSearchParams(root.location.search);
    if (qs.get('home3d') === '0') return null; // 정식 교체(V1614 C): 기본 = 3D 홈, ?home3d=0 = 구형 홈(비교용)
    const MG = root.MoleGame, L = MG.Home3DLayout;
    const st = MG.Home3DState.create({});
    st.boot(); // 앱 켤 때마다 첫 장면(INTRO = 구멍에서 뛰어올라 구멍 안에 안착, 점프로만 나옴)
    const IN = MG.Home3DIntro, HOLE_Y = -0.3, RISE_T = 0.8; // 구멍 안 높이, 등장 뛰어오르기 시간
    const view = { x: 0, z: 0, heading: 0, yaw: 0, pitch: 0.62 }; // 구멍 가운데, 정면(화면 쪽) — 뒤로 두더지팡 게임장
    let ui = null, rd = null, ready = false, raf = 0, last = 0, time = 0, walking = false, route = null, near = null;
    let rise = 0, hop = null, jumpAt = -1, readyAt = Infinity, badges = [], badgeAt = -9;
    let riding = null, seatY = 0, nearRide = null; // 놀이기구에 탄 동안: 타는 놀이기구 id // rise: 등장 경과 / hop: 구멍 밖 착지 {from,to,t} / jumpAt: 점프 시작 time

    const api = {
      state: () => st.state,
      introDone() { const ok = st.introDone(); if (ok) wake(); return ok; },
      open(action) {
        st.saveView(view);
        if (!st.openFeature(action)) return false;
        stop();
        if (ui) ui.setFeature(true, root.FGH.I18N.lang === 'ko' ? '닫기' : 'Close');
        // 기존 경로가 거절하면(전환 중 연타 등) 광장으로 되돌림
        if (opts.homeAction(action) === false) { st.homeShown(); if (ui) ui.setFeature(false); wake(); return false; }
        return true;
      },
      homeShown() {
        const fromGame = st.state === 'GAMEPLAY';
        const ok = st.homeShown();
        if (ok && fromGame) { // V1621 C 사용자: 게임이 끝나면 처음 시작 구멍으로 나옴
          resetToStart();
        } else if (ok) { const v = st.view(); if (v) Object.assign(view, v); }
        if (ok) { if (ui) ui.setFeature(false); refreshHud(); show(true); wake(); }
        return ok;
      },
      gameStarted() { const ok = st.gameStarted(); if (ok) { stop(); if (ui) ui.setFeature(false); show(false); } return ok; },
      renderAllowed: () => st.state === 'INTRO' || st.state === 'EXPLORE',
      inputEnabled: () => st.inputEnabled(),
      saveView: (v) => st.saveView(v),
      view: () => st.view(),
      debug: () => ({ state: st.state, x: +view.x.toFixed(2), z: +view.z.toFixed(2), heading: +view.heading.toFixed(2), near: near && near.action, rise: +rise.toFixed(2), hop: !!hop, walking, riding, nearRide: nearRide && nearRide.id, clip: pose().clip, raf: !!raf, inside: inside && inside.phase, air: air ? +air.y.toFixed(2) : null, onBoat: !!onBoat }) // 검토용(?h3debug=1)
    };
    if (qs.get('h3debug') === '1') { // 검토용 훅(공개 주소엔 없음)
      root.__home3d = api;
      api.warp = (x, z, yaw) => { if (st.state === 'EXPLORE' && !riding) { view.x = x; view.z = z; if (yaw !== undefined) view.yaw = yaw; } };
    }

    // 두더지팡 게임기: 구멍 = 라운드(깬 구멍 = 라운드 색 빛, 지금 라운드 = 두더지), 화면 = 'OO N라운드' / 'BEST 점수'
    let arcadeKey = '', arcadeState = null, press = null, seqAt = -9, wasNearArcade = false, popAt = -9, arcCam = 0, inside = null, wasFront = false; // inside = 게임기 안 {phase:'suck'|'in', at, from}(V1621 C 사용자: 동전 구멍으로 빨려 들어가 라운드 구멍 두더지로 나옴)
    const COIN = { x: 0.30 * L.ARCADE_K, y: 0.704 * L.ARCADE_K, z: -(9 - 1.03 * L.ARCADE_K) }, SUCK_T = 0.8; // 동전 구멍 = 하늘색 테두리 앞면 오른쪽(review/build-arcade-mole.py coin, 높이 1.06 → 아래 몸통 줄임 0.692)
    function exitArcade() { // 나가기: 게임기 앞에 서고 카메라가 물러남
      if (!inside || inside.phase !== 'in') return; inside = { phase: 'out', at: time }; view.x = COIN.x; view.z = COIN.z; view.yaw = 0; /* 사용자: 오른쪽 동전 구멍에서 화면 가운데로 나오며 커짐, 카메라는 뒤로만 물러남 */ if (ui) ui.setExit(null); if (rd) rd.setSmoke([]); // 사용자: 나올 때도 동전 구멍에서 스윽
      view.heading = 0; route = null; wasNearArcade = false; wasFront = true; // 나온 자리에서 바로 다시 빨려 들지 않게(한 번 떨어졌다 와야 함)
    } // press = {k, at, light, done} 모드 버튼 누르는 중
    function refreshArcade(force) {
      if (!rd || !opts.rounds) return;
      const R0 = opts.rounds(), ko = root.FGH.I18N.lang === 'ko';
      const holes = L.ARCADE_HOLES.map((h) => Object.assign({}, h, { glow: h.n && R0.get(h.n).cleared ? h.n - 1 : -1 }));
      const cur = L.ARCADE_HOLES.find((h) => h.n === R0.chapter);
      const best = R0.get(R0.chapter).best, mode = t('mole.rm.mode.' + R0.light);
      const l1 = ko ? mode + ' ' + R0.chapter + '라운드' : mode + ' Round ' + R0.chapter, l2 = 'BEST ' + Number(best).toLocaleString('en-US');
      const key = holes.map((h) => h.glow).join(',') + '|' + R0.chapter + '|' + l1 + '|' + l2 + '|' + L.ARCADE_BUTTONS.map((b) => +R0.unlocked(b.light)).join('');
      if (!force && key === arcadeKey) return;
      const buttons = L.ARCADE_BUTTONS.map((b) => Object.assign({}, b, { unlocked: R0.unlocked(b.light), active: b.light === R0.light, pressed: 0 }));
      if (arcadeState && arcadeState.mole && cur && arcadeState.mole.n !== cur.n) popAt = time; // 다른 구멍으로 옮김 = 튀어나오기부터
      arcadeKey = key + '|' + buttons.map((b) => +b.unlocked).join('');
      arcadeState = { holes, mole: cur || null, buttons, flash: [] }; rd.setArcade(arcadeState); rd.setScreen(l1, l2);
    }
    /* 날기·배: air = 공중 {y, vy, flapAt} / onBoat = 갑판 위 {u, w}(배 기준 좌표) / boardAt = 배에 오른 시각 / offer = 보상 창 */
    let air = null, onBoat = null, boardAt = -1, offer = null, splashAt = -9;
    const G = 9.5, JUMP_V = 4.4, FLAP_V = 3.6, BOAT_STAY = 300, REWARD_GAP = 3600 * 1000, OFFER_T = 60, REWARD_KEY = 'mole.boatRewardAt';
    const nowS = () => performance.now() / 1000;
    function boatM() { return MG.Home3DRenderer.boatMatrix(nowS()); }
    function deckWorld(u, w) { const B = L.BOAT; return root.StudioRig.point(boatM(), [u / B.S, B.DECK, w / B.S]); }
    function toDeck(x, z) { const B = L.BOAT, p = root.StudioRig.point(root.StudioRig.inverse(boatM()), [x, 0, z]); return { u: p[0] * B.S, w: p[2] * B.S }; }
    function overDeck(x, z) { const d = toDeck(x, z), B = L.BOAT; return Math.abs(d.u) <= B.U && Math.abs(d.w) <= B.W ? d : null; }
    function resetToStart() { /* 처음 시작 구멍(인트로)으로 */
      st.boot(); Object.assign(view, { x: 0, z: 0, heading: 0, yaw: 0, pitch: 0.62 }); rise = 0; hop = null; jumpAt = -1; camK = 0; arcCam = 0; inside = null; wasNearArcade = false; walking = false; route = null;
      air = null; onBoat = null; boardAt = -1; offer = null; if (ui) { ui.setExit(null); ui.hideOffer(); } if (rd) rd.setSmoke([]);
    }
    function splash(x, z) { /* 바다에 빠짐: 하트 -1(0이면 그대로), 첨벙, 해변으로 */
      if (MG.Economy && MG.Economy.getHearts() > 0) MG.Economy.addHearts(-1);
      refreshHud(); splashAt = nowS(); air = null; onBoat = null; boardAt = -1;
      const sp = []; for (let i = 0; i < 10; i++) { const a = i * 0.63; sp.push({ x: x + Math.cos(a) * 0.5, y: 0.2 + (i % 3) * 0.25, z: z + Math.sin(a) * 0.5, r: 0.25, a: 0.7 }); } rd.setSmoke(sp);
      setTimeout(() => { if (rd) rd.setSmoke([]); }, 700);
      view.x = 0; view.z = 20.8; view.heading = Math.PI; route = null;
    }
    function show(on) { if (ui) ui.show(on); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; route = null; if (ui) ui.setEnabled(false); }
    function wake() {
      if (!ui) return;
      ui.setEnabled(st.state === 'INTRO' || st.inputEnabled()); // 구멍 안: 시점 회전·점프만(이동은 move 에서 막음)
      last = 0;
      if (ready && !raf && api.renderAllowed() && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function t(key) { return root.FGH.I18N.t(key); }
    function refreshHud() {
      if (!ui || !opts.hud) return;
      ui.setHud(opts.hud());
    }
    function move(dt) {
      let v = { x: 0, z: 0 };
      const j = ui.input.joy;
      if (j.x || j.y) { route = null; v = { x: Math.cos(view.yaw) * j.x + Math.sin(view.yaw) * j.y, z: -Math.sin(view.yaw) * j.x + Math.cos(view.yaw) * j.y }; }
      else if (route) {
        const goal = route.via.length ? route.via[0] : route, dx = goal.x - view.x, dz = goal.z - view.z, d = Math.hypot(dx, dz);
        if (d < 0.12) { if (route.via.length) route.via.shift(); else route = null; } // 건물 터치 경로는 진입 박스에 닿는 순간 들어감
        else v = { x: dx / d, z: dz / d };
      }
      if (dt <= 0) return; // 흐른 시간 0인 프레임은 걷기 판단을 바꾸지 않음
      const len = Math.hypot(v.x, v.z), s = SPEED * dt / Math.max(1, len);
      if (air) { /* 공중: 막힘 없이 이동(섬 둘레 30 안), 떨어지다 땅·갑판·바다에 닿음 */
        let nx = view.x + v.x * s, nz = view.z + v.z * s; const rr = Math.hypot(nx, nz); if (rr > 30) { nx *= 30 / rr; nz *= 30 / rr; }
        if (v.x || v.z) view.heading = Math.atan2(v.x, v.z); view.x = nx; view.z = nz; walking = false;
        air.vy -= G * dt; air.y += air.vy * dt;
        if (air.vy < 0) {
          const dk = overDeck(view.x, view.z), deckY = dk ? deckWorld(dk.u, dk.w)[1] : -9;
          if (dk && air.y <= deckY && air.y > deckY - 0.6) { air = null; onBoat = dk; boardAt = time; return; } /* 갑판에 착지 */
          const land = L.allowed(view.x, view.z) || Math.hypot(view.x, view.z) <= L.WALK_R;
          if (land && air.y <= 0) { air = null; if (!L.allowed(view.x, view.z)) { const p = L.slide({ x: 0, z: 0 }, view.x, view.z); view.x = p.x; view.z = p.z; } return; } /* 땅에 착지 */
          if (!land && air.y <= -0.3) { splash(view.x, view.z); return; } /* 바다에 빠짐 */
        }
        return;
      }
      if (onBoat) { /* 갑판 위 걷기: 화면 방향 → 배 기준, 난간 안에서만 */
        const B = L.BOAT, a = deckWorld(onBoat.u, onBoat.w), d = toDeck(a[0] + v.x * s, a[2] + v.z * s);
        const nu = Math.max(-B.U, Math.min(B.U, d.u)), nw = Math.max(-B.W, Math.min(B.W, d.w)); walking = Math.hypot(nu - onBoat.u, nw - onBoat.w) > 0.0001;
        if (walking) view.heading = Math.atan2(v.x, v.z); onBoat.u = nu; onBoat.w = nw; return;
      }
      const next = L.slide(view, v.x * s, v.z * s);
      walking = Math.hypot(next.x - view.x, next.z - view.z) > 0.0001;
      if (walking) {
        const hd = Math.atan2(next.x - view.x, next.z - view.z), diff = Math.atan2(Math.sin(hd - view.heading), Math.cos(hd - view.heading));
        view.heading += diff * Math.min(1, dt * 12);
      } else if (route) route = null; // 막혀서 못 가면 멈춤
      view.x = next.x; view.z = next.z;
    }
    // 시작 카메라: 구멍 안에서는 아래에서 올려다봄(큰 두더지팡 게임기 간판까지 보이게), 점프해 나오면 보통 각도로(사용자 지시 2026-11-06)
    const INTRO_PITCH = -0.1, CAM_T = 0.9; let camK = 0;
    function jumping() { return !!air || (jumpAt >= 0 && time - jumpAt < IN.jump.T); }
    function jump() {
      if (st.state === 'EXPLORE' && !riding && !inside) { /* 날기: 첫 누름 = 뛰어오름, 공중에서 누를 때마다 짧은 팔 파닥 → 위로 */
        if (air) { air.vy = Math.max(air.vy, FLAP_V); air.flapAt = time; return; }
        const y0 = onBoat ? deckWorld(onBoat.u, onBoat.w)[1] : 0; onBoat = null; boardAt = -1;
        air = { y: y0, vy: JUMP_V, flapAt: time }; return;
      }
      if (jumping()) return;
      if (st.state === 'INTRO') {
        if (rise < RISE_T) return; // 등장 중엔 무시
        const j = ui.input.joy; // 스틱 방향이 있으면 그쪽으로, 없으면 바라보는 쪽으로
        const hd = j.x || j.y ? Math.atan2(Math.cos(view.yaw) * j.x + Math.sin(view.yaw) * j.y, -Math.sin(view.yaw) * j.x + Math.cos(view.yaw) * j.y) : view.heading;
        const to = IN.hopOut(hd);
        hop = { from: { x: view.x, z: view.z }, to };
        view.heading = Math.atan2(to.x - view.x, to.z - view.z);
      }
      jumpAt = time;
    }
    // 두더지 높이·동작
    function pose() {
      if (st.state === 'INTRO' && rise < RISE_T) { // 구멍 아래(-1.4)에서 뛰어올라 구멍 안(HOLE_Y)에 안착
        const k = rise / RISE_T;
        return { clip: 'Jump', t: k * IN.jump.T, loop: false, y: -1.4 + (HOLE_Y + 1.4) * k + 1.1 * Math.sin(Math.PI * k) };
      }
      if (inside) {
        if (inside.phase === 'in') return { clip: 'Idle', t: time, loop: true, y: COIN.y, s: 0 };
        if (inside.phase === 'out') { // 동전 구멍에서 아주 작게 나와, 앞으로 나오는 동안 천천히 원래 크기로(사용자: 너무 크게 나옴)
          if (time < inside.at) return { clip: 'Idle', t: time, loop: true, y: COIN.y, s: 0 };
          /* 사선 한 줄: 몸 가운데가 동전 구멍(COIN) → 최종 자리(바닥, 몸 가운데 높이 0.95(두더지 키 약 1.9))로, 같은 비율로 커짐 */
          const k = Math.min(1, (time - inside.at) / (SUCK_T * 1.4)), e = k * k * (3 - 2 * k), sc = 0.15 + 0.85 * e, cy = COIN.y + (0.95 - COIN.y) * e;
          return { clip: 'Idle', t: time, loop: true, y: cy - 0.95 * sc, s: sc };
        }
        const k = Math.min(1, (time - inside.at) / SUCK_T), e = Math.pow(k, 2.2), sc = Math.max(0, 1 - e); // 사용자: 두더지가 쏙 빨려 들어감(처음 천천히 → 끝에 빨리, 작아짐)
        return { clip: 'Idle', t: inside.at, loop: true, y: (COIN.y - 0.6 * sc) * e, s: k >= 1 ? 0 : sc }; // 서 있던 자세 그대로(사용자)
      }
      if (air) return time - air.flapAt < 0.3 ? { clip: 'ArmsUp', t: (time - air.flapAt) * 2, loop: false, y: air.y } : { clip: 'Jump', t: 0.3, loop: false, y: air.y }; /* 날기: 파닥 = 팔 들기 */
      if (onBoat) return { clip: walking ? 'WalkFwd' : 'Idle', t: time, loop: true, y: deckWorld(onBoat.u, onBoat.w)[1] }; /* 갑판 */
      if (riding) return { clip: 'ArmsUp', t: time, loop: true, y: seatY }; // 놀이기구에서 신나게
      if (jumping()) {
        const jt = time - jumpAt, base = hop ? HOLE_Y * (1 - jt / IN.jump.T) : 0;
        return { clip: 'Jump', t: jt, loop: false, y: base + IN.jump.height(jt) };
      }
      return { clip: walking ? 'WalkFwd' : 'Idle', t: time, loop: true, y: st.state === 'INTRO' ? HOLE_Y : 0 };
    }
    function frame(stamp) {
      raf = 0;
      if (!ready || !api.renderAllowed() || document.hidden) return;
      const dt = Math.min(0.04, last ? (stamp - last) / 1000 : 0); last = stamp; time += dt;
      if (st.state === 'INTRO') {
        // 첫 로딩 화면(GET NOW → 검은 화면)이 걷히고 가운데부터 열릴 때 등장 시작
        // 첫 로딩 화면(#splash)·검은 원 덮개(power-on-overlay, 열리기 전)가 있을 때만 대기. 준비 후 6초 지나면 무조건 시작(안전장치)
        const sp = document.getElementById('splash'), ov = document.getElementById('power-on-overlay');
        const covered = rise <= 0 && time - readyAt < 6 && ((sp && !sp.hidden) || (ov && !ov.hidden && !ov.classList.contains('is-expand')));
        rise = covered ? 0 : rise + dt; walking = false;
        if (hop) { // 구멍 밖으로 뛰어나오는 중
          const k = Math.min(1, (time - jumpAt) / IN.jump.T);
          view.x = hop.from.x + (hop.to.x - hop.from.x) * k; view.z = hop.from.z + (hop.to.z - hop.from.z) * k;
          if (k >= 1) { hop = null; st.introDone(); wake(); }
        }
      } else if (riding) { const se = rd.seat(riding); if (se) { view.x = se.x; view.z = se.z; view.heading = se.heading; seatY = se.y; } walking = false; }
      else if (inside) {
        walking = false;
        if (inside.phase === 'out') { // 동전 구멍 → 게임기 앞(처음 빨리 → 끝에 천천히)
          const k = Math.max(0, Math.min(1, (time - inside.at) / (SUCK_T * 1.4))), e = k * k * (3 - 2 * k), FX = 0, FZ = -9 + 3.2 + 0.95; /* 위 몸 높이와 같은 e = 사선 한 줄 */
          view.x = COIN.x + (FX - COIN.x) * e; view.z = COIN.z + (FZ - COIN.z) * e;
          if (k >= 1) inside = null;
        }
        if (inside && inside.phase === 'suck') {
          const k = Math.min(1, (time - inside.at) / SUCK_T), f = inside.from, puffs = [], e0 = Math.pow(k, 2.2);
          view.x = f.x + (COIN.x - f.x) * e0; view.z = f.z + (COIN.z - f.z) * e0; view.heading = f.heading; // 그 각도 그대로 스윽(사용자)
          for (let i = 0; i < 8; i++) { // 옅은 연기 꼬리: 두더지 뒤를 따라 동전 구멍으로
            const u = Math.max(0, Math.min(1, e0 - i * 0.06)); if (u <= 0.02 || u >= 1) continue;
            const e = u * u * (3 - 2 * u), sw = Math.sin(i * 2.3) * 0.25 * (1 - e);
            puffs.push({ x: f.x + (COIN.x - f.x) * e + sw, y: 0.9 + Math.sin(i * 1.7) * 0.25 * (1 - e) + (COIN.y - 0.9) * e, z: f.z + (COIN.z - f.z) * e, r: 0.22 * (1 - e) + 0.04, a: 0.35 * Math.sin(Math.PI * u) });
          }
          rd.setSmoke(puffs);
          if (k >= 1) { inside.phase = 'in'; popAt = time; seqAt = time; rd.setSmoke([]); view.x = COIN.x; view.z = COIN.z; } // 다 들어감 → 라운드 구멍에서 튀어나옴 + 차례 빛
        }
      }
      else if (st.inputEnabled()) move(dt);
      if (onBoat && !air) { const a = deckWorld(onBoat.u, onBoat.w); view.x = a[0]; view.z = a[2]; }
      if (onBoat && !air && boardAt >= 0 && !offer && time - boardAt >= BOAT_STAY) { /* 배 5분 → 1시간 1번, 1분 안에 광고 보면 하트 2 → 처음 시작 구멍 */
        let last = 0; try { last = +localStorage.getItem(REWARD_KEY) || 0; } catch (e) { last = 0; }
        if (Date.now() - last >= REWARD_GAP) {
          const ko = root.FGH.I18N.lang === 'ko'; offer = { at: time };
          ui.showOffer(ko ? '배에서 5분을 버텼어요! 1분 안에 광고를 보면 하트 2개를 드려요.' : 'You stayed 5 minutes! Watch an ad within 1 minute for 2 hearts.', ko ? '광고 보기' : 'Watch ad', ko ? '안 받기' : 'No thanks', (yes) => {
            if (!yes || !MG.Ads || !MG.Ads.rewarded) { offer = null; boardAt = -1; return; }
            MG.Ads.rewarded().then((ok) => { offer = null; boardAt = -1; if (!ok) return; MG.Economy.addHearts(2); try { localStorage.setItem(REWARD_KEY, String(Date.now())); } catch (e) { /* 저장 불가 */ } refreshHud(); resetToStart(); wake(); });
          });
        } else boardAt = -1;
      }
      if (offer && time - offer.at > OFFER_T) { ui.hideOffer(); offer = null; boardAt = -1; } /* 1분 지나면 사라짐 = 보상 없음 */
      if (!api.renderAllowed()) return; // move 안에서 기능 화면이 열렸으면 멈춤
      camK = st.state === 'INTRO' && !hop ? 0 : Math.min(1, camK + dt / CAM_T);
      const ck = camK * camK * (3 - 2 * camK);
      const aim = st.state === 'EXPLORE' && inside && inside.phase === 'in' ? 1 : 0; // 연기가 다 들어간 뒤 게임기로(사용자)
      arcCam += (aim - arcCam) * Math.min(1, dt / 0.6 * 3);
      let cv = camK >= 1 ? view : Object.assign({}, view, { pitch: INTRO_PITCH + (view.pitch - INTRO_PITCH) * ck });
      if (inside && inside.phase === 'out') cv = Object.assign({}, cv, { cx: 0, yaw: 0 }); /* 나오는 동안 게임기 좌우로 안 움직임(가운데 고정) */
      if (arcCam > 0.001) { const a = arcCam * arcCam * (3 - 2 * arcCam), dy = Math.atan2(Math.sin(0 - cv.yaw), Math.cos(0 - cv.yaw));
        const arc = Math.sin(Math.PI * a) * Math.min(1, Math.abs(dy) / 0.8); // 옮겨 가는 도중엔 높이 올라 게임기 위로 넘어감(사용자: 화면이 가려지며 지나감 — 카메라가 게임기 몸통을 뚫고 지나가던 것)
        const fx0 = cv.cx ?? cv.x; cv = Object.assign({}, cv, { cx: fx0 + (0 - fx0) * a, cz: cv.z + (-8.4 - cv.z) * a, yaw: cv.yaw + dy * a, pitch: Math.min(1.35, cv.pitch + (0.8 - cv.pitch) * a + 0.55 * arc), dist: 7.5 - 0.3 * a + 3 * arc, fy: 1.35 + 0.9 * a + 1.5 * arc }); } // 게임기 더 아래로, 위 간판까지 보이게(사용자)
      rd.render(cv, pose());
      if (time - badgeAt > 1) { badgeAt = time; badges = claimables(MG); refreshArcade(); ui.setMailDot(badges.includes('mail')); } // 1초마다 확인(뱃지·게임기 진행)
      ui.setBadges(badges.map((a) => { const s = L.SITES.find((x) => x.action === a), q = s && MG.Home3DRenderer.project(rd.vp(), [s.x, s.kind === 'building' ? 3.4 : 1.9, s.z]), z = rd.size(); return q && z && { action: a, x: (q[0] + 1) / 2 * z.cw, y: (1 - q[1]) / 2 * z.ch, on: Math.abs(q[0]) < 1.1 && Math.abs(q[1]) < 1.1 }; }).filter(Boolean));
      near = L.nearest(view.x, view.z);
      const nearArcade = !!(near && near.action === 'lightMode');
      const frontArc = nearArcade && Math.abs(view.x) < 1.4 && view.z > -9 + 2.2; // 게임기 정면(좌우 제외)
      if (frontArc && !wasFront && !inside && st.inputEnabled() && !riding && opts.startGame) { // 정면에서 닿을 때만 동전 구멍으로 빨려 들어감(사용자: 좌우에서는 안 됨)
        inside = { phase: 'suck', at: time, from: { x: view.x, z: view.z, heading: view.heading } }; route = null; ui.input.reset();
        ui.setExit(root.FGH.I18N.lang === 'ko' ? '나가기' : 'Exit');
      }
      wasNearArcade = nearArcade; wasFront = frontArc;
      if (arcadeState) {
        const st0 = time - seqAt, STEP = 0.2;
        arcadeState.flash = st0 >= 0 && st0 < STEP * 9 + 0.35 ? [1, 2, 3, 4, 5, 6, 7, 8, 0].filter((n, i) => st0 >= i * STEP && st0 < i * STEP + 0.35) : [];
        arcadeState.buttons.forEach((b, k) => { const pt = press && press.k === k ? time - press.at : -1; b.pressed = pt >= 0.14 && pt < 0.45 ? 1 : 0; });
        if (press && !press.done && time - press.at >= 0.26) { press.done = true; if (opts.setMode && opts.setMode(press.light)) { refreshArcade(true); seqAt = time; } }
        if (press && time - press.at > 0.65) press = null;
        arcadeState.moleOn = !!(inside && inside.phase === 'in'); // 라운드 구멍 두더지 = 게임기 안에 들어왔을 때만
        if (arcadeState.mole) { // 게임과 같은 순서(clay-round1-local clipFor): Appear 0.4초 → RimSettle 0.22초 → RimIdle
          const age = time - popAt;
          arcadeState.mole.pose = age < 0.4 ? { clip: 'Appear', t: age / 0.4 * 0.8, loop: false } : age < 0.62 ? { clip: 'RimSettle', t: (age - 0.4) / 0.22 * 0.6, loop: false } : { clip: 'RimIdle', t: age - 0.62, loop: true };
        }
      }
      if (riding) near = null;
      if (near && route && route.site === near && st.inputEnabled()) { route = null; if (near.action === 'lightMode' && opts.startGame) return; api.open(near.action); return; } // 게임기는 도착만(시작 버튼으로 진입) // 건물을 터치해 걸어온 경우 = 도착하면 진입
      // 건물에 닿아 있으면 점프 버튼이 그 건물 터치 버튼으로(누르면 그 건물 화면). 스쳐 지나가도 자동 진입 없음
      nearRide = !riding && !near && st.inputEnabled() ? L.nearestRide(view.x, view.z) : null;
      const ko = root.FGH.I18N.lang === 'ko';
      ui.setJumpMode(inside ? (inside.phase === 'in' ? (ko ? '시작' : 'Start') : null) : riding ? (ko ? '내리기' : 'Get off') : jumping() ? null : nearRide ? (ko ? '타기' : 'Ride') : near && st.inputEnabled() && near.action !== 'lightMode' ? (near.action === 'rhythm' ? (ko ? '시작' : 'Start') /* V1621 C 사용자: 리듬팡도 시작 버튼 */ : MG.Home3DSigns.labelFor(near, root.FGH.I18N.lang, t)) : null);
      if (!raf) raf = requestAnimationFrame(frame); // 프레임 안에서 wake() 가 이미 예약했으면 두 번째 반복을 만들지 않음(겹치면 걷기 동작이 멈춤)
    }

    if (opts.host && typeof document !== 'undefined') {
      ui = MG.Home3DUI.create(opts.host, {
        onLook(d) { view.yaw += d.dyaw; view.pitch = Math.max(0.25, Math.min(0.95, view.pitch + d.dpitch)); },
        onTap(px, py, w, h) {
          if (!st.inputEnabled() || !rd.vp() || riding) return;
          const inArc = inside && inside.phase === 'in';
          if (inside && !inArc) return; // 빨려 드는 중
          if (inArc && arcadeState && opts.setMode && !press) {
            const z0 = rd.size(); let bk = -1, bd = 1e9;
            arcadeState.buttons.forEach((b, k) => { const q = MG.Home3DRenderer.project(rd.vp(), [b.x, b.y, b.z]); if (!q) return; const d = Math.hypot((q[0] + 1) / 2 * w - px, (1 - q[1]) / 2 * h - py); if (d < bd) { bd = d; bk = k; } });
            if (bk >= 0 && bd < Math.max(26, w * 0.07)) { // 버튼 누르면 쑥 들어가고 모드 바뀜(안 열린 모드는 눌리기만 하고 그대로)
              const b = arcadeState.buttons[bk]; press = { k: bk, at: time, light: b.unlocked && !b.active ? b.light : null, done: !(b.unlocked && !b.active) };
              return; // 사용자: 두더지 팔이 구멍판까지 안 닿음 → 누르기 동작 없이 버튼만 쑥 들어감
            }
          }
          if (inArc && opts.selectRound) {
            const hp = MG.Home3DRenderer.rayPlane(root.StudioRig.inverse(rd.vp()), px / w * 2 - 1, 1 - py / h * 2, L.ARCADE_HOLES[0].y), hole = hp && L.pickHole(hp.x, hp.z);
            if (hole) { if (hole.n && opts.selectRound(hole.n)) refreshArcade(true); return; } // 파이널(0)·안 열린 구멍 = 무시
            return; // 게임기 안: 바닥 걷기 없음
          }
          const site = MG.Home3DRenderer.pickSite(rd.vp(), L.SITES, px, py, w, h);
          if (site && site === near) { if (site.action !== 'lightMode' || !opts.startGame) api.open(site.action); return; } // 게임기 몸통 터치 = 아무 일 없음(라운드 지도 안 씀) // 닿아 있는 건물을 터치 = 진입
          if (site) { const e = L.entryPoint(site); route = { x: e.x, z: e.z, site, via: L.pathVia(view, e) }; return; }
          const p = MG.Home3DRenderer.rayFloor(root.StudioRig.inverse(rd.vp()), px / w * 2 - 1, 1 - py / h * 2);
          if (p && L.allowed(p.x, p.z)) route = { x: p.x, z: p.z, site: null, via: L.pathVia(view, p) };
        },
        onSettings() { if (st.inputEnabled()) api.open('settings'); },
        onMail() { if (st.inputEnabled()) { ui.input.reset(); ui.showMail(); } }, /* CSS 메일 팝업(V1631 C 사용자) */
        onMailChanged() { refreshHud(); badges = claimables(MG); ui.setMailDot(badges.includes('mail')); },
        onClose() { if (st.state === 'FEATURE') opts.homeAction('home'); },
        onExit() { exitArcade(); },
        onJump() {
          if (riding) { const rdd = L.RIDES.find((x) => x.id === riding), e = L.rideExit(rdd); riding = null; view.x = e.x; view.z = e.z; view.heading = Math.atan2(-e.x, -e.z); jumpAt = time; return; } // 앞으로 뛰어내림
          if (nearRide && st.inputEnabled() && !jumping()) { riding = nearRide.id; route = null; ui.input.reset(); return; } // 뛰어올라 탐
          if (inside) { if (inside.phase === 'in' && st.inputEnabled()) opts.startGame(); return; } // 게임기 안 = 시작 // 사용자: 라운드 지도 없이 바로 시작
          if (near && near.action !== 'lightMode' && st.inputEnabled() && !jumping()) { api.open(near.action); return; } if (st.state === 'INTRO' || st.inputEnabled()) jump(); }
      });
      rd = MG.Home3DRenderer.create(ui.canvas);
      const ko = () => root.FGH.I18N.lang === 'ko';
      ui.setLoading(ko() ? '3D 공간 준비 중…' : 'Preparing 3D plaza…');
      const jumpLabel = () => ui.setJumpLabel(ko() ? '점프' : 'Jump'); jumpLabel();
      refreshHud(); show(true);
      const signsNow = () => rd.buildSigns(root.FGH.I18N.lang, L.SITES, t);
      root.FGH.I18N.onChange(() => { jumpLabel(); if (ready) { signsNow(); refreshArcade(true); if (!raf && api.renderAllowed()) wake(); } });
      document.addEventListener('visibilitychange', wake);
      rd.lost(() => { ready = false; stop(); ui.setLoading(ko() ? '3D 화면을 다시 불러와 주세요.' : 'Please reload the 3D plaza.'); });
      rd.boot(PLAZA_GLB, MOLE_GLB, 'assets/home3d/boat.glb', [ /* V1633 C: 디스코 팡팡(배치만) */
        { url: 'assets/home3d/disco-base.glb', world: root.StudioRig.transform({ translation: [L.DISCO.x, 0, L.DISCO.z], scale: [L.DISCO.baseS, L.DISCO.baseS, L.DISCO.baseS] }) },
        { url: 'assets/home3d/disco-top.glb', world: root.StudioRig.transform({ translation: [L.DISCO.x, L.DISCO.topY, L.DISCO.z], scale: [L.DISCO.topS, L.DISCO.topS, L.DISCO.topS] }) }]).then(() => {
        ready = true; readyAt = time; ui.setLoading(null); signsNow(); refreshArcade(true);
        wake();
      }).catch((err) => { console.error('3D home:', err); ui.setLoading((ko() ? '3D 공간을 불러오지 못했습니다.' : 'Could not load the 3D plaza.') + ' (' + String(err && err.message || err).slice(0, 160) + ')'); });
    }
    return api;
  }
  // 받을 것이 있는 곳(빨간 점): 기존 홈 뱃지와 같은 판단 함수(game.js refreshHomeBadges)
  function claimables(MG) {
    const out = [];
    if (MG.Daily && MG.Daily.claimable && MG.Daily.claimable()) out.push('daily');
    if (MG.Quest && MG.Quest.claimable && MG.Quest.claimable() > 0) out.push('quest');
    if (MG.Mail && MG.Mail.claimable && MG.Mail.claimable()) out.push('mail');
    return out;
  }
  const api = { create, claimables };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
