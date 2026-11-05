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
        const ok = st.homeShown();
        if (ok) { const v = st.view(); if (v) Object.assign(view, v); if (ui) ui.setFeature(false); refreshHud(); show(true); wake(); }
        return ok;
      },
      gameStarted() { const ok = st.gameStarted(); if (ok) { stop(); if (ui) ui.setFeature(false); show(false); } return ok; },
      renderAllowed: () => st.state === 'INTRO' || st.state === 'EXPLORE',
      inputEnabled: () => st.inputEnabled(),
      saveView: (v) => st.saveView(v),
      view: () => st.view(),
      debug: () => ({ state: st.state, x: +view.x.toFixed(2), z: +view.z.toFixed(2), heading: +view.heading.toFixed(2), near: near && near.action, rise: +rise.toFixed(2), hop: !!hop, walking, riding, nearRide: nearRide && nearRide.id, clip: pose().clip, raf: !!raf }) // 검토용(?h3debug=1)
    };
    if (qs.get('h3debug') === '1') { // 검토용 훅(공개 주소엔 없음)
      root.__home3d = api;
      api.warp = (x, z, yaw) => { if (st.state === 'EXPLORE' && !riding) { view.x = x; view.z = z; if (yaw !== undefined) view.yaw = yaw; } };
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
      const len = Math.hypot(v.x, v.z), s = SPEED * dt / Math.max(1, len), next = L.slide(view, v.x * s, v.z * s);
      walking = Math.hypot(next.x - view.x, next.z - view.z) > 0.0001;
      if (walking) {
        const hd = Math.atan2(next.x - view.x, next.z - view.z), diff = Math.atan2(Math.sin(hd - view.heading), Math.cos(hd - view.heading));
        view.heading += diff * Math.min(1, dt * 12);
      } else if (route) route = null; // 막혀서 못 가면 멈춤
      view.x = next.x; view.z = next.z;
    }
    // 시작 카메라: 구멍 안에서는 아래에서 올려다봄(큰 두더지팡 게임기 간판까지 보이게), 점프해 나오면 보통 각도로(사용자 지시 2026-11-06)
    const INTRO_PITCH = -0.1, CAM_T = 0.9; let camK = 0;
    function jumping() { return jumpAt >= 0 && time - jumpAt < IN.jump.T; }
    function jump() {
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
      else if (st.inputEnabled()) move(dt);
      if (!api.renderAllowed()) return; // move 안에서 기능 화면이 열렸으면 멈춤
      camK = st.state === 'INTRO' && !hop ? 0 : Math.min(1, camK + dt / CAM_T);
      const ck = camK * camK * (3 - 2 * camK);
      rd.render(camK >= 1 ? view : Object.assign({}, view, { pitch: INTRO_PITCH + (view.pitch - INTRO_PITCH) * ck }), pose());
      if (time - badgeAt > 1) { badgeAt = time; badges = claimables(MG); } // 1초마다 확인
      ui.setBadges(badges.map((a) => { const s = L.SITES.find((x) => x.action === a), q = s && MG.Home3DRenderer.project(rd.vp(), [s.x, s.kind === 'building' ? 3.4 : 1.9, s.z]), z = rd.size(); return q && z && { action: a, x: (q[0] + 1) / 2 * z.cw, y: (1 - q[1]) / 2 * z.ch, on: Math.abs(q[0]) < 1.1 && Math.abs(q[1]) < 1.1 }; }).filter(Boolean));
      near = L.nearest(view.x, view.z);
      if (riding) near = null;
      if (near && route && route.site === near && st.inputEnabled()) { route = null; api.open(near.action); return; } // 건물을 터치해 걸어온 경우 = 도착하면 진입
      // 건물에 닿아 있으면 점프 버튼이 그 건물 터치 버튼으로(누르면 그 건물 화면). 스쳐 지나가도 자동 진입 없음
      nearRide = !riding && !near && st.inputEnabled() ? L.nearestRide(view.x, view.z) : null;
      const ko = root.FGH.I18N.lang === 'ko';
      ui.setJumpMode(riding ? (ko ? '내리기' : 'Get off') : jumping() ? null : nearRide ? (ko ? '타기' : 'Ride') : near && st.inputEnabled() ? MG.Home3DSigns.labelFor(near, root.FGH.I18N.lang, t) : null);
      if (!raf) raf = requestAnimationFrame(frame); // 프레임 안에서 wake() 가 이미 예약했으면 두 번째 반복을 만들지 않음(겹치면 걷기 동작이 멈춤)
    }

    if (opts.host && typeof document !== 'undefined') {
      ui = MG.Home3DUI.create(opts.host, {
        onLook(d) { view.yaw += d.dyaw; view.pitch = Math.max(0.25, Math.min(0.95, view.pitch + d.dpitch)); },
        onTap(px, py, w, h) {
          if (!st.inputEnabled() || !rd.vp() || riding) return;
          const site = MG.Home3DRenderer.pickSite(rd.vp(), L.SITES, px, py, w, h);
          if (site && site === near) { api.open(site.action); return; } // 닿아 있는 건물을 터치 = 진입
          if (site) { const e = L.entryPoint(site); route = { x: e.x, z: e.z, site, via: L.pathVia(view, e) }; return; }
          const p = MG.Home3DRenderer.rayFloor(root.StudioRig.inverse(rd.vp()), px / w * 2 - 1, 1 - py / h * 2);
          if (p && L.allowed(p.x, p.z)) route = { x: p.x, z: p.z, site: null, via: L.pathVia(view, p) };
        },
        onSettings() { if (st.inputEnabled()) api.open('settings'); },
        onClose() { if (st.state === 'FEATURE') opts.homeAction('home'); },
        onJump() {
          if (riding) { const rdd = L.RIDES.find((x) => x.id === riding), e = L.rideExit(rdd); riding = null; view.x = e.x; view.z = e.z; view.heading = Math.atan2(-e.x, -e.z); jumpAt = time; return; } // 앞으로 뛰어내림
          if (nearRide && st.inputEnabled() && !jumping()) { riding = nearRide.id; route = null; ui.input.reset(); return; } // 뛰어올라 탐
          if (near && st.inputEnabled() && !jumping()) { api.open(near.action); return; } if (st.state === 'INTRO' || st.inputEnabled()) jump(); }
      });
      rd = MG.Home3DRenderer.create(ui.canvas);
      const ko = () => root.FGH.I18N.lang === 'ko';
      ui.setLoading(ko() ? '3D 공간 준비 중…' : 'Preparing 3D plaza…');
      const jumpLabel = () => ui.setJumpLabel(ko() ? '점프' : 'Jump'); jumpLabel();
      refreshHud(); show(true);
      const signsNow = () => rd.buildSigns(root.FGH.I18N.lang, L.SITES, t);
      root.FGH.I18N.onChange(() => { jumpLabel(); if (ready) { signsNow(); if (!raf && api.renderAllowed()) wake(); } });
      document.addEventListener('visibilitychange', wake);
      rd.lost(() => { ready = false; stop(); ui.setLoading(ko() ? '3D 화면을 다시 불러와 주세요.' : 'Please reload the 3D plaza.'); });
      rd.boot(PLAZA_GLB, MOLE_GLB).then(() => {
        ready = true; readyAt = time; ui.setLoading(null); signsNow();
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
