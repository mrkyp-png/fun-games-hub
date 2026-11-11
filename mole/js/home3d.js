/* 3D 홈 묶음 — 기존 게임(game.js)과 연결. 기본으로 켜짐(?home3d=0 = 구형 홈).
   기능 열기는 기존 홈 버튼과 같은 homeAction(action) 을 그대로 부른다.
   화면은 #game-screen 안 z-index 30(기존 홈 버튼판 위, 기능 화면 아래)에 깔린다. */
(function (root) {
  'use strict';
  const PLAZA_GLB = 'assets/home3d/plaza.glb?v=1688-G'; // review/build-home-plaza.py
  const MOLE_GLB = 'assets/home3d/mole-clay-v47-smile.glb?v=1688-G'; /* V1671 C: + Flap 동작·겨털 위치 */ /* V1670 C 사용자 확정: v44 손 다듬기(손가락 가늘게·손등 90%·손 133%·손가락 바깥으로·가운데 120%·앞 손가락 107%, review/slim-mole-thumb.py) */ // /* V1656 C 사용자: 기존 두더지로 되돌림(신규 Tripo 두더지는 노이즈·배 없음) — 기존 두더지를 다듬기로 */
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
    let doorEntry = null;
    let riding = null, seatY = 0, nearRide = null; // 놀이기구에 탄 동안: 타는 놀이기구 id // rise: 등장 경과 / hop: 구멍 밖 착지 {from,to,t} / jumpAt: 점프 시작 time

    const api = {
      state: () => st.state,
      introDone() { const ok = st.introDone(); if (ok) wake(); return ok; },
      open(action, returnView) {
        if (doorEntry) return false;
        st.saveView(returnView || view);
        if (!st.openFeature(action)) return false;
        stop();
        if (ui) ui.setFeature(true, root.FGH.I18N.lang === 'ko' ? '닫기' : 'Close', action);
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
      debug: () => ({ state: st.state, x: +view.x.toFixed(2), z: +view.z.toFixed(2), heading: +view.heading.toFixed(2), near: near && near.action, rise: +rise.toFixed(2), hop: !!hop, walking, riding, nearRide: nearRide && nearRide.id, clip: pose().clip, raf: !!raf, inside: inside && inside.phase, air: air ? +air.y.toFixed(2) : null, onBoat: !!onBoat, spin: +discoSpin.toFixed(2) }) // 검토용(?h3debug=1)
    };
    if (qs.get('h3debug') === '1') { // 검토용 훅(공개 주소엔 없음)
      root.__home3d = api;
      api.fly = (y) => { air = { y, vy: 0, flapAt: -9 }; camLift = y; }; /* 검사용: 그 높이에 띄움 */
      api.warp = (x, z, yaw) => { if (st.state === 'EXPLORE' && !riding) { view.x = x; view.z = z; if (yaw !== undefined) view.yaw = yaw; } };
    }

    // 두더지팡 게임기: 구멍 = 라운드(깬 구멍 = 라운드 색 빛, 지금 라운드 = 두더지), 화면 = 'OO N라운드' / 'BEST 점수'
    let arcadeKey = '', arcadeState = null, press = null, seqAt = -9, wasNearArcade = false, popAt = -9, arcCam = 0, inside = null, wasFront = false; // inside = 게임기 안 {phase:'suck'|'in', at, from}(V1621 C 사용자: 동전 구멍으로 빨려 들어가 라운드 구멍 두더지로 나옴)
    const COIN = { x: 0.30 * L.ARCADE_K, y: 0.704 * L.ARCADE_K, z: -(9 - 1.03 * L.ARCADE_K) }, SUCK_T = 0.8; // 동전 구멍 = 하늘색 테두리 앞면 오른쪽(review/build-arcade-mole.py coin, 높이 1.06 → 아래 몸통 줄임 0.692)
    function exitArcade() { // 나가기: 게임기 앞에 서고 카메라가 물러남
      if (!inside || inside.phase !== 'in') return; inside = { phase: 'out', at: time }; view.x = COIN.x; view.z = COIN.z; view.yaw = 0; /* 사용자: 오른쪽 동전 구멍에서 화면 가운데로 나오며 커짐, 카메라는 뒤로만 물러남 */ if (ui) ui.setExit(null); if (rd) rd.setSmoke([]); // 사용자: 나올 때도 동전 구멍에서 스윽
      view.heading = 0; route = null; wasNearArcade = false; wasFront = true; // 나온 자리에서 바로 다시 빨려 들지 않게(한 번 떨어졌다 와야 함)
    } // press = {k, at, light, done} 모드 버튼 누르는 중
    /* V1650 C 사용자: 게시판(스코어·일일·퀘스트) — 모델 자리·칸 6개(앞뒤)·내용 새로 그림(바뀔 때만), 스코어 칸은 4초마다 다음 장 */
    function boardWorld() { const s = L.SITES.find((x) => x.id === 'board'), S = L.BOARD.S, y = s.faceYaw;
      return root.StudioRig.transform({ translation: [s.x, 0, s.z], rotation: [0, Math.sin(y / 2), 0, Math.cos(y / 2)], scale: [S, S, S] }); }
    function boardPanels() { const B = L.BOARD, bw = boardWorld(), out = [];
      for (const kind of ['score', 'daily', 'quest']) for (const back of [false, true]) {
        const local = root.StudioRig.transform({ translation: [back ? -B.X[kind] : B.X[kind], B.Y, back ? -B.FACE : B.FACE], rotation: back ? [0, 1, 0, 0] : [0, 0, 0, 1] });
        out.push({ kind, back, world: root.StudioRig.multiply(bw, local), w: B.PANEL_W, h: B.PANEL_H }); }
      return out; }
    let boardKey = '';
    function refreshBoard(force) { if (!rd || !MG.Home3DBoard) return; const k = root.FGH.I18N.lang === 'ko', data = MG.Home3DBoard.panelData(MG, k), n = data.score.pages.length, page = Math.floor(time / 4) % Math.max(1, n);
      const key = JSON.stringify(data) + page + k; if (!force && key === boardKey) return; boardKey = key; rd.drawBoard(data, page, k); }
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
    const deepLast = {}, deepRun = {}; /* 고래·메갈로돈: 마지막으로 다 돈 시각, 도는 중 시작 시각 */
    let discoSpin = 0, discoLiftV = 0, discoT0 = -1, grip = 100, spinLeft = 12, bounceLeft = 3; /* discoT0 = 이번에 탄 시각(20초 도전) */ /* 디스코 팡팡: 더 도는 속도·튀는 속도 */
    let boatV = 0, rowSide = 1, wakeFx = [], wakeAt = 0; /* 배 속도(섬 둘레, 초당 거리)·물결 */
    let air = null, onBoat = null, boardAt = -1, offer = null, splashAt = -9;
    const G = 9.5, JUMP_V = 4.4, FLAP_V = 3.6, BOAT_STAY = 300, REWARD_GAP = 3600 * 1000, OFFER_T = 60, REWARD_KEY = 'mole.boatRewardAt';
    const nowS = () => performance.now() / 1000;
    function boatM() { return MG.Home3DRenderer.boatMatrix(nowS()); }
    function deckWorld(u, w) { const B = L.BOAT; return root.StudioRig.point(boatM(), [u / B.S, B.DECK, w / B.S]); }
    function toDeck(x, z) { const B = L.BOAT, p = root.StudioRig.point(root.StudioRig.inverse(boatM()), [x, 0, z]); return { u: p[0] * B.S, w: p[2] * B.S }; }
    function inDeck(u, w) { const B = L.BOAT; return (u / B.U) ** 2 + (w / B.W) ** 2 <= 1; } /* 갑판 = 타원(V1636 C: 배 그림 밖에 서던 것) */
    function overDeck(x, z) { const d = toDeck(x, z); return inDeck(d.u, d.w) ? d : null; }
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
    function enterDoor(site, committed = false) {
      if (doorEntry || !site.doorDepth || !st.inputEnabled() || air || riding || inside || jumping()) return false;
      const approach = committed ? [] : L.doorApproach(site,view), target = L.doorPoint(site), entry = L.entryPoint(site);
      if (!approach || !target) return false;
      doorEntry = {site,committed,points:approach.concat([target]),index:0,returnView:Object.assign({},view,entry,{heading:Math.atan2(-site.x,-site.z)})};
      route = null; walking = true;
      return true;
    }
    function walkThroughDoor(dt) {
      const entering = doorEntry;
      if (!entering) return false;
      const joy=ui.input.joy;
      if(joy.x || joy.y) {
        const mx=Math.cos(view.yaw)*joy.x+Math.sin(view.yaw)*joy.y,mz=-Math.sin(view.yaw)*joy.x+Math.cos(view.yaw)*joy.y;
        const site=entering.site,d=Math.hypot(site.x,site.z),forward=(mx*site.x+mz*site.z)/(d*Math.hypot(mx,mz));
        if(!entering.committed || forward<.65) { doorEntry=null;walking=false;return false; }
      }
      let distance = SPEED * dt;
      while (entering.index < entering.points.length) {
        const target=entering.points[entering.index],dx=target.x-view.x,dz=target.z-view.z,d=Math.hypot(dx,dz);
        if (d > .001) view.heading=Math.atan2(dx,dz);
        if (d > distance) { view.x+=dx/d*distance; view.z+=dz/d*distance; break; }
        view.x=target.x;view.z=target.z;distance-=d;entering.index++;
      }
      walking = true;
      if(!entering.committed && L.crossedDoor(entering.site,view.x,view.z)) entering.committed=true;
      if (entering.index < entering.points.length) return false;
      doorEntry = null; walking = false;
      if (!api.open(entering.site.action,entering.returnView)) { Object.assign(view,entering.returnView); wake(); }
      return true;
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
        const nx = view.x + v.x * s + (air.vx || 0) * dt, nz = view.z + v.z * s + (air.vz || 0) * dt; /* vx·vz = 팡팡에서 튕겨 나갈 때(V1661 C) */ /* V1635 C 사용자: 지구 끝까지 — 거리 제한 없음 */
        if (v.x || v.z) view.heading = Math.atan2(v.x, v.z); view.x = nx; view.z = nz; walking = false;
        air.vy -= G * dt; air.y += air.vy * dt;
        if (air.vy < 0) {
          const dk = overDeck(view.x, view.z), deckY = dk ? deckWorld(dk.u, dk.w)[1] : -9;
          if (dk && air.y <= deckY && air.y > deckY - 0.6) { air = null; onBoat = { u: 0, w: 0 }; boardAt = time; return; } /* 갑판에 착지 → 가운데에 섬(V1661 C) */
          const rr = Math.hypot(view.x, view.z), land = L.allowed(view.x, view.z) || rr <= L.FENCE_OUT;
          if (land && air.y <= 0) { air = null; if (!L.allowed(view.x, view.z)) { if (rr > L.WALK_R) { const k = (L.WALK_R - 0.1) / rr; view.x *= k; view.z *= k; } if (!L.allowed(view.x, view.z)) { const p = L.slide({ x: 0, z: 0 }, view.x, view.z); view.x = p.x; view.z = p.z; } } return; } /* 땅에 착지(울타리 위면 섬 안쪽으로) */
          if (!land && air.y <= -0.3) { splash(view.x, view.z); return; } /* 바다에 빠짐 */
        }
        return;
      }
      if (onBoat) { walking = false; return; } /* V1661 C 사용자: 배에 타면 두더지는 가만히(갑판 가운데, 걷기 없음, 바다에 안 떨어짐) */
      if (onBoat) { /* (옛) 갑판 위 걷기 */
        const B = L.BOAT, a = deckWorld(onBoat.u, onBoat.w), d = toDeck(a[0] + v.x * s, a[2] + v.z * s);
        let nu = d.u, nw = d.w; if (!inDeck(nu, nw)) { const k = 1 / Math.sqrt((nu / B.U) ** 2 + (nw / B.W) ** 2); nu *= k; nw *= k; } walking = Math.hypot(nu - onBoat.u, nw - onBoat.w) > 0.0001;
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
    const INTRO_PITCH = -0.1, CAM_T = 0.9; let camK = 0, camLift = 0, boardCam = 0, boardAim = 0; /* boardCam = 게시판 앞 카메라(V1653 C) */ /* camLift = 날기 높이 따라 카메라 올림(V1635 C) */
    function jumping() { return !!air || (jumpAt >= 0 && time - jumpAt < IN.jump.T); }
    function jump() {
      if (st.state === 'EXPLORE' && !riding && !inside) { /* 날기: 첫 누름 = 뛰어오름, 공중에서 누를 때마다 짧은 팔 파닥 → 위로 */
        if (air) { air.vy = Math.max(air.vy, FLAP_V); air.flapAt = time; return; }
        const y0 = onBoat ? deckWorld(onBoat.u, onBoat.w)[1] : 0; onBoat = null; boardAt = -1;
        air = { y: y0, vy: JUMP_V, flapAt: -9, jumpAt: time } /* 첫 점프 = 기존 Jump 동작(V1672 C) */; return;
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
      if (air) return time - air.flapAt < 1.2 ? { clip: 'Flap', t: time - air.flapAt, loop: true, y: air.y } : air.jumpAt != null ? { clip: 'Jump', t: Math.min(time - air.jumpAt, 0.6), loop: false, y: air.y } : { clip: 'Jump', t: 0.3, loop: false, y: air.y }; /* V1672 C 사용자: 첫 점프 = 기존, 공중 연타 = Flap */ /* V1671 C 사용자: 날기 = 팔을 옆으로 벌려 파닥(Flap) */
      if (onBoat) return { clip: 'Idle', t: time, loop: true, y: deckWorld(onBoat.u, onBoat.w)[1] }; /* 갑판(가만히) */
      if (riding) return { clip: 'Idle', t: time, loop: true, y: seatY }; /* V1661 C 사용자: 팡팡에서도 가만히(원심력·튀기로 떨어지는 놀이) */
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
      } else if (doorEntry) { if (walkThroughDoor(dt)) return; }
      else if (riding) { const se = rd.seat(riding); if (se) { view.x = se.x; view.z = se.z; view.heading = se.heading; seatY = se.y; } walking = false; }
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
      { /* V1657 C 사용자: 노 젓기 — 섬 둘레 시계 방향, 손 떼면 서서히 멈춤, 속도 따라 배 뒤·옆 물결 */
        const B = L.BOAT, RR = Math.hypot(0, 25.6);
        boatV *= Math.exp(-dt * 0.55); if (boatV < 0.02) boatV = 0; B.kick *= Math.exp(-dt * 2.5);
        B.theta -= boatV / RR * dt; B.x = RR * Math.sin(B.theta); B.z = RR * Math.cos(B.theta); B.yaw = B.theta;
        if (boatV > 0.3 && time - wakeAt > 0.42 - Math.min(0.3, boatV * 0.06)) { wakeAt = time; const bm = boatM(); for (const [u, w, big] of [[2.65, 0, 1], [1.3, 1.45, 0], [1.3, -1.45, 0]]) { /* V1669 C 사용자: 뒤에서 보면 물보라가 너무 떨어짐 → 배 꼬리(2.45) 바로 뒤, 옆도 붙임 */ /* V1663 C 사용자: 뒤 = 예전처럼 크게(배 밖으로 더 뒤), 좌우 = 가운데보다 조금 뒤 */ /* V1663 C 사용자: 물결은 배 밖 옆·뒤만(선체 반폭 1.19·반길이 2.45 바깥, 뒤 = 배 기준 +x) */ const p = root.StudioRig.point(bm, [u / B.S, 0, w / B.S]); wakeFx.push({ x: p[0], z: p[2], at: time, s: Math.min(1, boatV / 3), big }); } }
        wakeFx = wakeFx.filter((q) => time - q.at < 1.8);
        if (rd && (wakeFx.length || boatV)) rd.setSmoke(wakeFx.map((q) => { const k = (time - q.at) / 1.8; return { x: q.x, y: -0.55, z: q.z, r: q.big ? 0.25 + k * 0.9 * (0.6 + q.s) : 0.15 + k * 0.35 * (0.6 + q.s), a: (q.big ? 0.55 : 0.5) * (1 - k) }; /* 물결 작게(사용자: 배 안에 안 보이게) */ }));
        if (ui) ui.setRowing(!!(onBoat && !air));
        { /* V1660 C 사용자: 디스코 팡팡 — 기본으로 천천히 돌고, 회전 버튼 = 더 빨리(서서히 줄어듦), 출렁이며 기울기, 점프 버튼 = 통 튐 */
          const D = L.DISCO; discoSpin *= Math.exp(-dt * 0.5); D.yaw += (0.6 + discoSpin) * dt;
          D.glowSpin = riding === 'disco' ? Math.max(0, (discoSpin - 0.3) / 1.5) : 0; D.glowBounce = Math.max(0, (D.glowBounce || 0) - dt * 1.6); /* V1666 C: 불빛 세기(돌기·튀기) */
          D.tiltDir = time * 1.1; D.tilt = (0.05 + 0.025 * Math.min(1, discoSpin / 3)) * (0.7 + 0.3 * Math.sin(time * 2.3));
          if (riding === 'disco') { const se = rd.seat('disco'); view.x = se.x; view.z = se.z; view.heading = se.heading; seatY = se.y + 0.02; } /* V1665 C 사용자: 튈 때 발이 바닥에 박히지 않게 — 상판을 옮긴 뒤 같은 프레임에 자리 다시 잡음 */
          let landed = false; if (D.lift > 0 || discoLiftV > 0) { discoLiftV -= 9.5 * dt; D.lift = Math.max(0, D.lift + discoLiftV * dt); if (D.lift === 0) { discoLiftV = 0; landed = true; } }
          /* V1661 C 사용자: 떨어뜨리기 놀이 — 아주 빨리 돌면(원심력) 또는 돌면서 튀었다 내려앉으면 두더지가 밖으로 튕겨 나감 */
          if (riding === 'disco' && discoT0 < 0) { discoT0 = time; grip = 100; spinLeft = 12; bounceLeft = 3; } if (riding !== 'disco' && !air) discoT0 = -1; /* V1667 C 사용자: 버티는 힘 100, 20초 동안 회전 12번·점프 3번 */
          const left = riding === 'disco' ? Math.max(0, 20 - (time - discoT0)) : 0;
          if (riding === 'disco') { grip -= Math.max(0, discoSpin - 2) ** 2 * 3 * dt; if (discoSpin < 1) grip = Math.min(100, grip + 15 * dt); if (landed) grip -= discoSpin * 5; } /* 빨리 돌수록 힘 빠짐, 천천히면 다시 참, 돌며 튀었다 내려앉으면 크게 빠짐 */
          if (ui && ui.setTimer) ui.setTimer(riding === 'disco' && left > 0 ? [Math.ceil(left), Math.max(0, Math.round(grip)), spinLeft, bounceLeft] : null);
          /* V1662 C 사용자: 잘 안 떨어지게 — 거의 최고 속도로 돌거나, 빠르게 돌면서 튀었다 내려앉을 때 가끔 */
          if (riding === 'disco' && grip <= 0) { if (left > 0 && MG.Economy) { MG.Economy.addHearts(1); refreshHud(); if (ui.toast) ui.toast(root.FGH.I18N.lang === 'ko' ? '하트 +1!' : 'Heart +1!'); } /* V1667 C: 버티는 힘 0 = 떨어짐(운 없음), 20초 안이면 하트 +1 */
            const se = rd.seat('disco'), ox = se.x - D.x, oz = se.z - D.z, ol = Math.hypot(ox, oz) || 1, sp = 3.2 + discoSpin * 0.6;
            riding = null; view.x = se.x; view.z = se.z; air = { y: se.y, vy: 3.5, vx: ox / ol * sp, vz: oz / ol * sp, flapAt: -9 }; discoSpin *= 0.4; ui.input.reset(); }
          if (ui && ui.setDiscoRide) ui.setDiscoRide(riding === 'disco'); }
        if (ui && ui.setDeep && rd && rd.vp()) { /* V1660 C 사용자: 1000m 고래·2000m 메갈로돈 — 아주 천천히 나타나 섬 둘레를 10분에 한 바퀴(시계 방향) 돌고 사라짐, 둘은 다른 둘레(겹침 없음) */
          const alt = air ? air.y : 0, c = document.querySelector('#home3d .h3-canvas'), cr = c && c.getBoundingClientRect();
          const qi = MG.Home3DRenderer.project(rd.vp(), [0, -0.8, 0]); /* 섬 가운데 화면 자리 — 높이 날면 섬이 점이라 화면 기준 원(사용자: 섬과 겹치지 않게) */
          /* V1680 C 사용자: 높이 따라 크기 — 카메라 높이(약 8.6 + 1.87×높이)에 반비례, 1000m 기준. 고래 168px·둘레 120, 메갈로돈 = 실제 고래의 2배(2000m 에서 168px)·둘레 350 */
          const eye = (h) => 8.6 + 1.87 * h, k1000 = eye(1000) / eye(Math.max(1, camLift));
          for (const [k, need, R1, len] of [['whale', 1000, 120, 168], ['megalodon', 2000, 350, 336]]) { const R0 = R1 * k1000;
            if (deepRun[k] == null && alt >= need && time - (deepLast[k] ?? -1e9) >= 600) deepRun[k] = time;
            const run = deepRun[k], u = run == null ? 2 : (time - run) / 600;
            if (u > 1) { if (run != null) { deepRun[k] = null; deepLast[k] = time; } ui.setDeep(k, null); continue; }
            if (!cr || len * k1000 > 4000) { ui.setDeep(k, null); continue; } /* V1680 C 사용자: 나타난 뒤엔 내려와도 10분 동안 그대로(가까워질수록 커짐), 너무 커지면(낮은 곳) 화면 밖이라 안 그림 */
            if (!qi) { ui.setDeep(k, null); continue; }
            const cx=(qi[0]+1)/2*cr.width,cy=(1-qi[1])/2*cr.height;
            const swim=L.deepSwimPose(k,time-run,{cx,cy,radius:R0,width:cr.width,height:cr.height,length:len*k1000});
            const fade=Math.min(1,(time-run)/12,(600-(time-run))/30);
            ui.setDeep(k, { x:swim.x,y:swim.y,rot:swim.rot,op:.32*fade,w:len*k1000 }); } } }
      if (onBoat && !air) { const a = deckWorld(onBoat.u, onBoat.w), f = deckWorld(onBoat.u - 1, onBoat.w); /* V1663 C 사용자: 배 타면 늘 정면(가는 쪽 = 배 기준 -x) */ view.x = a[0]; view.z = a[2]; view.heading = Math.atan2(f[0] - a[0], f[2] - a[2]); } /* 배와 같이 돌며 뱃머리를 봄 */
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
      { /* V1653 C 사용자: 게시판 앞(정면 4.5 안)에 가면 카메라가 칸 3개 정면으로 붙음 */
        const bs = L.SITES.find((x) => x.id === 'board'), fx = Math.sin(bs.faceYaw), fz = Math.cos(bs.faceYaw), rx = view.x - bs.x, rz = view.z - bs.z;
        const aimB = st.state === 'EXPLORE' && !inside && !air && !onBoat && Math.hypot(rx, rz) < 3.2 && rx * fx + rz * fz > 0.5 ? 1 : 0; /* 사용자: 좀 더 다가갔을 때 커지게(4.5 → 3.2) */
        boardAim = aimB; boardCam += (aimB - boardCam) * Math.min(1, dt * 3);
        if (boardCam > 0.001) { const a = boardCam * boardCam * (3 - 2 * boardCam), dyw = Math.atan2(Math.sin(bs.faceYaw - cv.yaw), Math.cos(bs.faceYaw - cv.yaw)), d0 = cv.dist || 7.5, f0 = cv.fy || 1.35, x0 = cv.cx ?? cv.x, z0 = cv.cz ?? cv.z;
          cv = Object.assign({}, cv, { cx: x0 + (bs.x - x0) * a, cz: z0 + (bs.z - z0) * a, yaw: cv.yaw + dyw * a, pitch: cv.pitch + (0.1 - cv.pitch) * a, dist: d0 + (7.0 - d0) * a, fy: f0 + (L.BOARD.Y * L.BOARD.S - f0) * a }); } }
      camLift += ((air ? air.y : 0) - camLift) * Math.min(1, dt * 4); ui.setHeight(air ? air.y : 0); /* V1635 C 사용자: 높이 오를수록 카메라도 올라가고 멀어져 아래 건물이 작게 보임 */
      if (camLift > 0.05) cv = Object.assign({}, cv, { fy: (cv.fy || 1.35) + camLift, dist: (cv.dist || 7.5) + camLift * 0.9, pitch: Math.min(1.3, cv.pitch + camLift * 0.015), far: 80 + camLift * 4 });
      rd.render(cv, pose());
      if (ui && ui.setBoardHand) { /* 게시판 손: 카메라가 다 붙었을 때 가운데 칸 아래 */
        let hp = null; if (boardAim && boardCam > 0.3 && rd.vp()) { const c = document.querySelector('#home3d .h3-canvas'), B = L.BOARD, pm = boardPanels().find((p) => p.kind === 'daily' && !p.back), q = c && pm && MG.Home3DRenderer.project(rd.vp(), root.StudioRig.point(pm.world, [0, -B.PANEL_H * 0.62, 0]));
          if (q) { const r = c.getBoundingClientRect(); hp = { x: (q[0] + 1) / 2 * r.width, y: (1 - q[1]) / 2 * r.height }; } }
        ui.setBoardHand(hp); }
      if (time - badgeAt > 1) { badgeAt = time; badges = claimables(MG); refreshArcade(); if (ready) refreshBoard(); ui.setMailDot(badges.includes('mail')); } // 1초마다 확인(뱃지·게임기 진행)
      ui.setBadges(badges.map((a) => { const s = L.SITES.find((x) => x.action === a), q = s && MG.Home3DRenderer.project(rd.vp(), [s.x, s.kind === 'building' ? 3.4 : 1.9, s.z]), z = rd.size(); return q && z && { action: a, x: (q[0] + 1) / 2 * z.cw, y: (1 - q[1]) / 2 * z.ch, on: Math.abs(q[0]) < 1.1 && Math.abs(q[1]) < 1.1 }; }).filter(Boolean));
      near = L.nearest(view.x, view.z);
      const nearArcade = !!(near && near.action === 'lightMode');
      const frontArc = nearArcade && Math.abs(view.x) < 1.4 && view.z > -9 + 2.2; // 게임기 정면(좌우 제외)
      if (frontArc && !wasFront && !inside && !air && !onBoat && st.inputEnabled() && !riding && opts.startGame) /* V1679 C: 날거나 배 위면 안 빨려 들어감(공중에 뜬 채 카메라가 하늘을 보던 것) */ { // 정면에서 닿을 때만 동전 구멍으로 빨려 들어감(사용자: 좌우에서는 안 됨)
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
      if (!doorEntry && near && route && route.site === near && st.inputEnabled()) { route = null; if (near.action === 'lightMode' && opts.startGame) return; if (near.doorDepth) enterDoor(near); else { api.open(near.action); return; } }
      if (!doorEntry && near && near.doorDepth && walking && st.inputEnabled() && !air && !jumping() && L.crossedDoor(near,view.x,view.z)) enterDoor(near,true);
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
          if (doorEntry) { doorEntry=null;walking=false; }
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
          { /* V1650 C: 게시판 칸 누르면 그 화면(스코어·일일·퀘스트) */ const vp = rd.vp(), B = L.BOARD;
            for (const p of boardPanels()) { const c = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => MG.Home3DRenderer.project(vp, root.StudioRig.point(p.world, [a * B.PANEL_W / 2, b * B.PANEL_H / 2, 0])));
              if (c.some((q) => !q)) continue; const xs = c.map((q) => (q[0] + 1) / 2 * w), ys = c.map((q) => (1 - q[1]) / 2 * h);
              const facing = (xs[1] - xs[0]) > 0; /* 앞면이 카메라 쪽일 때만 */
              if (facing && px >= Math.min(...xs) && px <= Math.max(...xs) && py >= Math.min(...ys) && py <= Math.max(...ys)) { /* 손이 그 칸으로 가서 누른 뒤 열림 */
                const cx = xs.reduce((a, b) => a + b) / 4, cy = ys.reduce((a, b) => a + b) / 4; if (ui.pressBoardHand) ui.pressBoardHand({ x: cx, y: cy + (Math.max(...ys) - Math.min(...ys)) * 0.15 }, () => api.open(p.kind)); else api.open(p.kind); return; } } }
          const site = MG.Home3DRenderer.pickSite(rd.vp(), L.SITES, px, py, w, h);
          if (site && site === near) { if (site.action !== 'lightMode' || !opts.startGame) api.open(site.action); return; } // 게임기 몸통 터치 = 아무 일 없음(라운드 지도 안 씀) // 닿아 있는 건물을 터치 = 진입
          if (site) { const e = L.entryPoint(site); route = { x: e.x, z: e.z, site, via: L.pathVia(view, e) }; return; }
          const p = MG.Home3DRenderer.rayFloor(root.StudioRig.inverse(rd.vp()), px / w * 2 - 1, 1 - py / h * 2);
          if (p && L.allowed(p.x, p.z)) route = { x: p.x, z: p.z, site: null, via: L.pathVia(view, p) };
        },
        onSettings() { if (!ui.mailOpen()) api.open('settings'); },
        onInventory() { if (!ui.mailOpen()) api.open('inventory'); },
        onMail() { if (!doorEntry && (st.state === 'INTRO' || st.inputEnabled())) { ui.input.reset(); ui.showMail(); } }, /* 대기 화면에서도 기존 CSS 메일 팝업 열기 */
        onMailChanged() { refreshHud(); badges = claimables(MG); ui.setMailDot(badges.includes('mail')); },
        onClose() { if (st.state === 'FEATURE') opts.homeAction('home'); },
        onExit() { exitArcade(); },
        onSpin() { if (riding === 'disco' && spinLeft > 0) { spinLeft--; discoSpin = Math.min(6, discoSpin + 0.6); grip -= 2; } }, /* V1667 C: 20초에 12번까지, 한 번 = 버티는 힘 -2 */ /* V1662 C: 잘 안 떨어지게 0.9 → 0.6 */ /* V1660 C: 팡팡 회전 버튼 = 누를수록 빨리 */
        onBounce() { if (riding === 'disco' && bounceLeft > 0 && L.DISCO.lift <= 0.01) { bounceLeft--; discoLiftV = 4.2; L.DISCO.glowBounce = 1.4; grip -= 6; } }, /* 20초에 3번까지, 한 번 = -6 */ /* 팡팡 점프 버튼 = 통 튀어 오름(땅에 있을 때) */
        onRow() { if (onBoat && !air) { boatV = Math.min(4.2, boatV + 0.7); MG.Home3DLayout.BOAT.kick = (rowSide = -rowSide) * 0.08; } }, /* V1657 C: 노 한 번 = 속도 +0.7(최대 4.2), 좌우로 번갈아 기울기 */
        onJump() {
          if (doorEntry) return;
          if (riding) { const rdd = riding === 'disco' ? L.DISCO : L.RIDES.find((x) => x.id === riding), e = L.rideExit(rdd); riding = null; view.x = e.x; view.z = e.z; view.heading = Math.atan2(-e.x, -e.z); jumpAt = time; return; } // 앞으로 뛰어내림
          if (nearRide && st.inputEnabled() && !jumping()) { riding = nearRide.id; route = null; ui.input.reset(); return; } // 뛰어올라 탐
          if (inside) { if (inside.phase === 'in' && st.inputEnabled()) opts.startGame(); return; } // 게임기 안 = 시작 // 사용자: 라운드 지도 없이 바로 시작
          if (near && near.action !== 'lightMode' && st.inputEnabled() && !jumping()) { if(near.doorDepth) enterDoor(near); else api.open(near.action); return; } if (st.state === 'INTRO' || st.inputEnabled()) jump(); }
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
        { url: 'assets/home3d/disco-base.glb?v=1688-G', /* 내용 바뀐 모델 = 버전 붙여 폰이 새로 받게 */ world: root.StudioRig.transform({ translation: [L.DISCO.x, 0, L.DISCO.z], scale: [L.DISCO.baseS, L.DISCO.baseS, L.DISCO.baseS] }) },
        { url: 'assets/home3d/disco-top.glb?v=1688-G', dyn: 'discoTop', world: root.StudioRig.transform({ translation: [L.DISCO.x, L.DISCO.topY, L.DISCO.z], scale: [L.DISCO.topS, L.DISCO.topS, L.DISCO.topS] }) },
        { url: 'assets/home3d/board.glb?v=1688-G', world: boardWorld() }]).then(() => { /* V1650 C: 게시판 */
        ready = true; readyAt = time; ui.setLoading(null); signsNow(); refreshArcade(true); rd.setBoard(boardPanels()); refreshBoard(true); if (MG.Home3DText) MG.Home3DText.ready().then(() => { signsNow(); refreshArcade(true); refreshBoard(true); wake(); }); /* V1653 C: 둥근 글씨체 준비되면 글자 다시 그림 */
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
