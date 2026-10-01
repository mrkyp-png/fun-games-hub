// 리듬팡(RHYTHM PANG) 1차 — 바탕화면 "리듬팡 UI 및 에셋/명세서.txt" 기준.
// 핵심: 음악 박자(targetTime) → 무기가 타겟창 진입 → 버튼 → 두더지 점프 → 두더지·무기 "실제 충돌" → SUCCESS.
// 리듬 판정(입력 시각 vs targetTime)과 물리 충돌(두더지 머리 원 ∩ 무기 원)은 따로 계산하고, 둘 다 만족해야 성공.
// 시간 기준 = Web Audio 시계(ctx.currentTime) — 일시정지는 ctx.suspend() 로 음악·노트가 함께 멈춤.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var A = 'assets/rhythm/';

  // ---- 튜닝 데이터(코드 하드코딩 대신 여기서만 조절) ----
  var CONFIG = {
    song: { src: 'audio/bgm-game-1.mp3', bpm: 83.0, firstBeat: 0.232 }, // BPM·첫 박 = 곡 분석값
    chart: { startBeat: 8, beats: 64 },            // 8박(인트로) 뒤부터 64박
    judge: { perfectMs: 70, greatMs: 130, goodMs: 200 },
    score: { PERFECT: 300, GREAT: 200, GOOD: 100 },
    hpMax: 10,
    jumpFrameMs: 80,                                // 7프레임 × 80ms
    apexFrame: 3,                                   // 0부터 — 최고점 프레임(에셋 실측)
    travelSec: 1.6,                                 // 무기 출발→타겟 시간
    countIn: 3
  };
  // 난이도(명세 §30) — EASY 직선 위주·넓은 판정 / NORMAL POINT1 꺾임·반박 노트 / HARD POINT1+POINT2·빠른 연속·좁은 판정
  var DIFFS = {
    EASY:   { travel: 1.8, judge: { perfectMs: 80, greatMs: 150, goodMs: 220 }, half: 0,    turn1: 0.15, turn2: 0,    rest: 8 },
    NORMAL: { travel: 1.5, judge: { perfectMs: 65, greatMs: 120, goodMs: 180 }, half: 0.25, turn1: 0.35, turn2: 0,    rest: 8 },
    HARD:   { travel: 1.3, judge: { perfectMs: 50, greatMs: 95,  goodMs: 150 }, half: 0.5,  turn1: 0.3,  turn2: 0.35, rest: 16 }
  };
  var LAUNCH = 0.75; // 수평선에서 최상단까지 던져 올라오는 시간(초)
  var CHARS = ['cap', 'pink', 'braid', 'punk'];
  var WEAPONS = ['snow', 'boomerang', 'disc', 'heart'];

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var stage = $('[data-rp-stage]'), wlayer = $('[data-rp-weapons]');
    var meta = null, buffer = null, ctx = null, src = null;
    var st = null, raf = 0;
    var imgs = {}, diff = 'EASY';
    // 효과음(기존 게임 사운드 재사용) — 성공 = 타격음, 실패 = 두더지 아야
    var SFX = { hit: ['audio/hit1.mp3', 'audio/hit2.mp3', 'audio/hit3.mp3', 'audio/hit4.mp3'], jump: ['audio/mole-emerge.mp3'] }; // v814(사용자 지정): 실패 목소리(아야 등) 삭제, 두더지 점프 = 두더지팡 등장 소리
    var sfxBuf = {};
    function loadSfx() {
      var all = SFX.hit.concat(SFX.jump);
      return Promise.all(all.map(function (u) {
        if (sfxBuf[u]) return null;
        return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (res) { ctx.decodeAudioData(ab, function (b) { sfxBuf[u] = b; res(); }, function () { res(); }); }); }).catch(function () {});
      }));
    }
    function sfx(kind) {
      var list = SFX[kind], b = sfxBuf[list[Math.floor(Math.random() * list.length)]]; if (!b || !ctx) return;
      var s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = kind === 'hit' ? 0.7 : 0.6;
      s.buffer = b; s.connect(g); g.connect(ctx.destination); s.start();
    }

    function preload() {
      var list = [];
      CHARS.forEach(function (c) { list.push(A + 'jump-' + c + '-strip.png'); });
      WEAPONS.forEach(function (w) { list.push(A + 'w-' + w + '.png'); }); list.push(A + 'w-disc-face.png');
      return Promise.all(list.map(function (u) { var im = new Image(); im.src = u; imgs[u] = im; return im.decode ? im.decode().catch(function () {}) : null; }));
    }
    function loadMeta() { return meta ? Promise.resolve(meta) : fetch(A + 'jump-meta.json').then(function (r) { return r.json(); }).then(function (m) { meta = m; return m; }); }
    function loadSong() {
      if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)();
      if (buffer) return Promise.resolve(buffer);
      return fetch(CONFIG.song.src).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
        return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); });
      }).then(function (b) { buffer = b; return b; });
    }

    // ---- 레이아웃(px) ----
    var L = {};
    function layout() {
      var W = stage.clientWidth, H = stage.clientHeight;
      L.W = W; L.H = H; L.laneW = W / 4;
      L.laneX = [0, 1, 2, 3].map(function (i) { return L.laneW * (i + 0.5); });
      L.moleW = L.laneW * 0.92;
      L.moleBottom = H * 0.80;                    // 두더지 발바닥(구멍 중심) y
      L.p1 = H * 0.24; L.p2 = H * 0.40;
      L.horizonY = H * 0.37; // 해변 배경 바다 수평선 근처
      // 타겟창 = 두더지 최고점 머리 위치(가장 높이 오르는 캐릭터 기준 평균)
      // v812: 타겟창 높이 고정(무대의 71% — 사용자가 확인한 기존 위치). 최고점 머리가 여기 닿도록 기준 바닥을 역산.
      L.lift = undefined; L.moleBottom = 0;
      var heads = CHARS.map(function (c, i) { return headAt(i, CONFIG.apexFrame); });
      var K = -heads.reduce(function (s, h) { return s + h.y; }, 0) / 4;
      L.targetY = H * 0.71;
      L.moleBottom = L.targetY + K;
      L.targetR = L.laneW * 0.36;
      L.weaponR = L.laneW * 0.22;
      L.speed = 0; // 노트별 경로 길이/시간으로 계산
      // v812(사용자 지정): 두더지는 시간(HP) 바 바로 위로 내림, 타겟창은 그대로 →
      // 내려간 만큼 점프를 더 높이 띄워(lift) 최고점 머리가 여전히 타겟창에 닿게.
      var oldBottom = L.moleBottom;
      L.sink = L.laneW * 0.1; // v814: 두더지를 구멍 속으로 조금 내림(떠 보이지 않게)
      L.moleBottom = H - L.laneW * 0.3 - 4 + L.sink; // 구멍(테두리) 아래끝이 시간 바 바로 위에 오게 — 버튼과 안 겹침
      L.lift = L.moleBottom - oldBottom;
    }
    // 프레임별 추가 상승량 = (그 프레임이 대기 자세보다 오른 정도 ÷ 최고점이 오른 정도) × lift
    function liftAt(i, f) {
      if (!L.lift) return 0;
      var bb = meta[CHARS[i]].bb, rise = bb[0][1] - bb[f][1], top = bb[0][1] - bb[CONFIG.apexFrame][1];
      return top > 0 ? Math.max(0, rise / top) * L.lift : 0;
    }
    // 두더지 i 의 프레임 f 머리 원(화면 px)
    function headAt(i, f) {
      var m = meta[CHARS[i]], s = L.moleW / m.w, bb = m.bb[f];
      var bw = (bb[2] - bb[0]) * s;
      var top = L.moleBottom - (m.h - bb[1]) * s - (L.lift !== undefined ? liftAt(i, f) : 0);  // 캔버스 아래 = 구멍
      return { x: L.laneX[i], y: top + bw * 0.36, r: bw * 0.36 };
    }

    // ---- 채보(EASY): 박마다 1노트, 가끔 POINT1 꺾임 ----
    function buildChart() {
      var D = DIFFS[diff], spb = 60 / CONFIG.song.bpm, notes = [], seed = 7 + diff.length, prev = -1, same = 0, id = 0, lastAt = {};
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      for (var k = 0; k < CONFIG.chart.beats; k++) {
        if (k % D.rest === D.rest - 1) continue;           // 마디 끝 쉼
        var subs = (k % 2 === 1 && rnd() < D.half) ? [0, 0.5] : [0]; // 반박(1.5박 등) 노트
        subs.forEach(function (sub) {
          var beat = CONFIG.chart.startBeat + k + sub;
          var lane = Math.floor(rnd() * 4);
          if (lane === prev) { same++; if (same >= 2) { lane = (lane + 1 + Math.floor(rnd() * 3)) % 4; same = 0; } } else same = 0;
          // 같은 레인은 두더지 점프(7프레임)가 끝날 시간 이상 간격 — 못 치는 노트 방지(v811)
          var tt = CONFIG.song.firstBeat + beat * spb, gap = 7 * CONFIG.jumpFrameMs / 1000 + 0.1;
          for (var tries = 0; tries < 4 && tt - (lastAt[lane] || -9) < gap; tries++) lane = (lane + 1) % 4;
          lastAt[lane] = tt;
          prev = lane;
          var t2 = rnd() < D.turn2, t1 = t2 || rnd() < D.turn1;
          var mid = t2 ? (lane + 1 + Math.floor(rnd() * 3)) % 4 : lane;
          var start = t1 ? (mid + 1 + Math.floor(rnd() * 3)) % 4 : lane;
          if (t1 && !t2 && start === lane) start = (lane + 1) % 4;
          notes.push({ id: id++, beatIndex: beat, targetTime: CONFIG.song.firstBeat + beat * spb, startLane: start, targetLane: lane,
            midLane: mid, routePoint1: t1 ? 1 : 0, routePoint2: t2 ? 1 : 0, weaponType: WEAPONS[lane], difficulty: diff });
        });
      }
      return notes;
    }
    // 경로(직선→꺾임→직선): 꼭짓점 목록
    function routeOf(n) {
      var xs = L.laneX[n.startLane], xt = L.laneX[n.targetLane], y0 = L.weaponR * 1.3; // v812: 던져진 무기가 올라온 최상단
      if (!n.routePoint1) return [[xs, y0], [xt, L.targetY]];
      if (!n.routePoint2) return [[xs, y0], [xs, L.p1], [xt, L.p2], [xt, L.targetY]];
      var xm = L.laneX[n.midLane];
      return [[xs, y0], [xs, L.p1 * 0.62], [xm, L.p1 * 1.15], [xm, L.p2 * 0.95], [xt, L.p2 * 1.32], [xt, L.targetY]];
    }
    // 무기 화면 상태(위치·크기·회전·투명도). 부메랑·원반은 던져 올라올 땐 빠르게, 내려올 땐 천천히 회전(사용자 지정 v816)
    function flyAt(n, t) {
      var spin = n.weaponType === 'boomerang' || n.weaponType === 'disc', big = spin ? 1.2 : 1; // 부메랑·원반 1.2배(사용자 지정 v822: 화살·눈덩이보다 작아 보임)
      if (t < n.spawnTime - LAUNCH) return { x: 0, y: -999, sc: 1, rot: 0, op: 0 };
      if (t < n.spawnTime) {
        var u = 1 - (n.spawnTime - t) / LAUNCH, x0 = n.pts[0][0], hx = x0 + (L.W / 2 - x0) * 0.55, hy = L.horizonY;
        return { x: hx + (x0 - hx) * u, y: hy + (n.pts[0][1] - hy) * (1 - (1 - u) * (1 - u)), sc: (0.22 + 0.78 * u) * big,
          rot: spin ? -(n.spawnTime - t) * 1080 : n.weaponType === 'heart' ? 180 : 0, op: Math.min(1, u * 3) }; // 화살: 올라갈 땐 뒤집혀(촉 위), 꼭대기에서 회전 없이 바로 촉 아래 그림으로(v821)
      }
      var p = posAt(n, t);
      return { x: p.x, y: p.y, sc: big, rot: spin ? (t - n.spawnTime) * 240 : 0, op: 1 };
    }
    function sizeWind(n) { n.wind.style.width = (L.weaponR * 2.6) + 'px'; n.wind.style.height = (L.weaponR * 4.4) + 'px'; n.wind.style.opacity = '0'; }
    function xf(q) { return 'translate(' + (q.x - L.weaponR * 1.2) + 'px,' + (q.y - L.weaponR * 1.2) + 'px) scale(' + q.sc.toFixed(3) + ') rotate(' + q.rot.toFixed(1) + 'deg)'; }
    function pathLen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
    function posAt(n, t) { // t = 음악 시각
      var v = n.len / DIFFS[diff].travel, d = (t - n.spawnTime) * v;
      if (d >= n.len) return { x: n.pts[n.pts.length - 1][0], y: L.targetY + (d - n.len) }; // 타겟 지나면 계속 아래로 직선
      for (var i = 1; i < n.pts.length; i++) {
        var a = n.pts[i - 1], b = n.pts[i], sl = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= sl) { var r = d / sl; return { x: a[0] + (b[0] - a[0]) * r, y: a[1] + (b[1] - a[1]) * r }; }
        d -= sl;
      }
    }

    // ---- 화면 요소 ----
    function buildStage() {
      var lanesEl = $('[data-rp-lanes]'); lanesEl.innerHTML = ''; moleEls = null;
      for (var i = 0; i < 4; i++) {
        var ln = document.createElement('div'); ln.className = 'rp-lane'; ln.style.left = (i * 25) + '%';
        ln.innerHTML = '<img class="rp-target" src="' + A + 'target-' + (i + 1) + '.png" alt="">' +
          '<img class="rp-hole" src="' + A + 'hole-' + (i + 1) + '.png" alt="">' +
          '<span class="rp-mole" style="background-image:url(' + A + 'jump-' + CHARS[i] + '-strip.png)"></span>' +
          '<span class="rp-judge"></span>';
        lanesEl.appendChild(ln);
      }
      // v831: MISS 맞은 두더지 머리 위 빙글 별(레인 컨테이너 = 무대 좌표)
      for (var di = 0; di < 4; di++) { var dz = document.createElement('span'); dz.className = 'rp-dizzy'; dz.innerHTML = '<i>★</i><i>★</i><i>★</i>'; lanesEl.appendChild(dz); }
      dizzyEls = lanesEl.querySelectorAll('.rp-dizzy'); tgtEls = lanesEl.querySelectorAll('.rp-target');
      var bt = $('[data-rp-btns]'); bt.innerHTML = ''; btnEls = null;
      for (var j = 0; j < 4; j++) {
        (function (j) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'rp-btn';
          b.innerHTML = '<img src="' + A + 'btn-' + (j + 1) + '.png" alt="">';
          b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(j); b.classList.add('is-down'); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
          bt.appendChild(b);
        })(j);
      }
    }
    function placeStatic() {
      var lanes = el.querySelectorAll('.rp-lane');
      lanes.forEach(function (ln, i) {
        var t = ln.querySelector('.rp-target'); t.style.width = (L.targetR * 2.6) + 'px'; t.style.top = (L.targetY - L.targetR * 1.3) + 'px';
        var h = ln.querySelector('.rp-hole'); h.style.width = (L.laneW * 0.98) + 'px'; h.style.top = (L.moleBottom - L.sink - L.laneW * 0.32) + 'px';
        var m = ln.querySelector('.rp-mole'); var md = meta[CHARS[i]];
        m.style.width = L.moleW + 'px'; m.style.height = (md.h * (L.moleW / md.w)) + 'px'; m.style.aspectRatio = 'auto'; m.style.top = (L.moleBottom - md.h * (L.moleW / md.w)) + 'px';
        ln.querySelector('.rp-judge').style.top = (L.targetY - L.targetR * 2.2) + 'px';
        var h0 = headAt(i, 0), dz = dizzyEls[i]; dz.style.left = h0.x + 'px'; dz.style.top = (h0.y - h0.r * 1.1) + 'px'; dz.style.width = (h0.r * 2.4) + 'px';
      });
    }
    // v824: 폰을 껐다 켜면(전체화면 복귀 등) 화면 높이가 바뀌는데 배치를 다시 안 해서 두더지·타겟이 올라가 있던 것 — 크기 바뀌면 다시 계산
    root.addEventListener('resize', function () {
      if (!st || !meta || el.hidden) return;
      layout(); placeStatic();
      st.notes.forEach(function (n) {
        n.pts = routeOf(n); n.len = pathLen(n.pts);
        if (n.el) n.el.style.width = (L.weaponR * 2.4) + 'px';
        if (n.trail) n.trail.forEach(function (g) { g.style.width = (L.weaponR * 2.4) + 'px'; });
        if (n.wind) sizeWind(n);
      });
    });
    // v813(깜빡임 제거): 7프레임을 미리 겹쳐 두고 보이는 것만 바꿈 — img src 교체 순간 빈 프레임이 생기던 것
    var moleFrame = [-1, -1, -1, -1], moleEls = null, btnEls = null, dizzyEls = null, tgtEls = null, lastPulse = -1;
    function setMoleFrame(i, f) {
      if (moleFrame[i] === f) return;
      var m = (moleEls || (moleEls = el.querySelectorAll('.rp-mole')))[i];
      m.style.backgroundPosition = (f / 6 * 100) + '% 0'; moleFrame[i] = f;
    }
    function showJudge(i, txt, cls) {
      var j = el.querySelectorAll('.rp-judge')[i]; j.textContent = txt; j.className = 'rp-judge is-' + cls;
      void j.offsetWidth; j.classList.add('is-on');
    }
    function hud() {
      $('[data-rp-score]').textContent = st.score.toLocaleString('en-US');
      $('[data-rp-combo]').textContent = st.combo > 1 ? st.combo + ' COMBO' : '';
      $('[data-rp-hp]').style.width = (st.hp / CONFIG.hpMax * 100) + '%';
      $('[data-rp-hpbar]').classList.toggle('is-low', st.hp <= 3);
    }

    // ---- 진행 ----
    function now() { return ctx.currentTime - st.t0; } // 음악 시각(초)
    function start() {
      Promise.all([loadMeta(), loadSong(), preload()]).then(loadSfx).then(function () {
        if (ctx.state === 'suspended') ctx.resume();
        buildStage(); layout(); placeStatic(); // 버튼을 먼저 만들어야 무대 높이가 정확(v812)
        var notes = buildChart();
        // v813: 무기 그림을 시작 전에 전부 만들어 둠(숨김) — 플레이 중 생성/삭제로 인한 깜빡임 제거
        wlayer.innerHTML = '';
        notes.forEach(function (n) { n.el = document.createElement('img'); n.el.className = 'rp-weapon'; n.el.src = A + 'w-' + n.weaponType + '.png';
          // 원반 = 테두리 그림은 그대로, 가운데 발바닥 면만 회전(사용자 지정 v817)
          if (n.weaponType === 'disc') {
            var img = n.el; img.className = ''; n.el = document.createElement('span'); n.el.className = 'rp-weapon rp-disc'; n.el.appendChild(img);
            n.face = document.createElement('img'); n.face.src = A + 'w-disc-face.png'; n.face.decoding = 'sync';
            var fw = document.createElement('span'); fw.className = 'rp-disc-face'; fw.appendChild(n.face); n.el.appendChild(fw);
          }
          n.el.style.width = (L.weaponR * 2.4) + 'px'; n.el.style.opacity = '0'; n.el.decoding = 'sync';
          // 눈덩이·하트 화살 = 날아오는 잔상 2겹(사용자 지정 v816)
          { // 4종 모두 잔상 — 원반·부메랑도(사용자 지정 v830)
            n.trail = [0.32, 0.15].map(function (op) { var g = n.el.cloneNode(true); g.className = n.el.className + ' rp-trail'; g.dataset.op = op; wlayer.appendChild(g); return g; });
          }
          // 부메랑·원반 = 내려올 때 뒤로 바람 줄기(사용자 지정 v830)
          if (n.weaponType === 'boomerang' || n.weaponType === 'disc') { n.wind = document.createElement('span'); n.wind.className = 'rp-wind'; sizeWind(n); wlayer.appendChild(n.wind); }
          wlayer.appendChild(n.el); });
        notes.forEach(function (n) { n.pts = routeOf(n); n.len = pathLen(n.pts); n.spawnTime = n.targetTime - DIFFS[diff].travel; n.state = 'wait'; });
        st = { notes: notes, score: 0, combo: 0, maxCombo: 0, hp: CONFIG.hpMax, cnt: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
          moles: [0, 1, 2, 3].map(function () { return { jumpAt: -9, hurtAt: -9 }; }), over: false, paused: false };
        moleFrame = [-1, -1, -1, -1]; for (var i = 0; i < 4; i++) setMoleFrame(i, 0);
        // 카운트인: 3·2·1·START 가 끝나는 순간 음악 0초
        var startAt = ctx.currentTime + CONFIG.countIn + 0.15;
        st.t0 = startAt;
        src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start(startAt);
        hud(); // (무기 풀은 위에서 생성 — 여기서 비우지 않음)
        el.querySelector('[data-rp-result]').hidden = true;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      });
    }

    // 버튼 → 점프. 리듬 판정은 "두더지가 최고점에 닿는 시각" 기준(입력 시각 + 최고점까지 시간).
    function press(lane) {
      if (!st || st.over || st.paused || now() < 0) return;
      var t = now(), m = st.moles[lane];
      if (t - m.jumpAt < 7 * CONFIG.jumpFrameMs / 1000) return; // 점프 중 재입력 무시
      m.jumpAt = t; sfx('jump');
      var apexT = t + (CONFIG.apexFrame + 0.5) * CONFIG.jumpFrameMs / 1000;
      // 이 레인에서 판정 대상 노트(아직 처리 안 된 가장 가까운 것)
      var best = null;
      st.notes.forEach(function (n) {
        if (n.state !== 'live' || n.targetLane !== lane) return;
        var d = Math.abs(apexT - n.targetTime);
        if (!best || d < best.d) best = { n: n, d: d };
      });
      var J = DIFFS[diff].judge;
      if (!best || best.d * 1000 > J.goodMs) {
        // 잘못된 레인/근처에 노트 없음 → MISS(명세 §22)
        if (!best) { miss(lane, null); return; }
        best.n.press = { grade: null }; // 리듬 범위 밖 — 충돌해도 성공 아님
        return;
      }
      var ms = best.d * 1000;
      best.n.press = { grade: ms <= J.perfectMs ? 'PERFECT' : ms <= J.greatMs ? 'GREAT' : 'GOOD', lane: lane };
    }
    function hit(n, lane) {
      n.state = 'hit'; n.hitAt = now(); if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0';
      var g = n.press.grade; st.cnt[g]++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.score += Math.round(CONFIG.score[g] * (1 + Math.min(st.combo, 100) / 200));
      n.vx = (Math.random() < 0.5 ? -1 : 1) * (L.laneW * (1.5 + Math.random())); n.vy = -L.H * 1.1; n.bx = n.cx; n.by = n.cy;
      showJudge(lane, g, g.toLowerCase()); pang(lane, n.cx, n.cy); hud(); sfx('hit');
      burst(n.cx, n.cy, g === 'PERFECT' ? 10 : g === 'GREAT' ? 7 : 5); if (g === 'PERFECT') replay(stage, 'rp-shake'); comboFx();
      try { MG.HitFx && MG.HitFx.uiTap && MG.HitFx.uiTap(1); } catch (e) { /* 무시 */ }
    }
    function miss(lane, n) {
      if (n) { n.state = 'miss'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; }
      st.cnt.MISS++; st.combo = 0; st.hp = Math.max(0, st.hp - 1);
      st.moles[lane].hurtAt = now();
      showJudge(lane, 'MISS', 'miss'); hud(); replay(hippo, 'is-no');
      if (st.hp <= 0) gameOver(false);
    }
    // ---- v831 연출 ----
    var hippo = el.querySelector('.rp-hippo');
    function replay(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
    function burst(x, y, k) { // 명중 자리에서 반짝이 조각이 사방으로
      for (var i = 0; i < k; i++) {
        var a = (i / k) * Math.PI * 2 + Math.random() * 0.5, d = L.laneW * (0.45 + Math.random() * 0.35), sp = document.createElement('span');
        sp.className = 'rp-spark'; sp.textContent = i % 3 ? '✦' : '★'; sp.style.left = x + 'px'; sp.style.top = y + 'px';
        sp.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px'); sp.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
        sp.style.color = ['#fff36b', '#ffffff', '#ffb3e6', '#8ff0ff'][i % 4]; wlayer.appendChild(sp);
        (function (sp) { setTimeout(function () { sp.remove(); }, 560); })(sp);
      }
    }
    function comboFx() {
      var c = $('[data-rp-combo]'); replay(c, 'is-bump');
      if (st.combo === 10 || st.combo === 30 || (st.combo >= 50 && st.combo % 50 === 0)) {
        var mt = document.createElement('span'); mt.className = 'rp-milestone'; mt.textContent = st.combo + ' COMBO!'; stage.appendChild(mt);
        setTimeout(function () { mt.remove(); }, 1300); replay(hippo, 'is-cheer');
      } else if (st.combo % 10 === 0) replay(hippo, 'is-cheer');
    }
    function pang(lane, x, y) {
      var p = document.createElement('span'); p.className = 'rp-pang'; p.textContent = 'PANG!';
      p.style.left = x + 'px'; p.style.top = y + 'px'; wlayer.appendChild(p);
      setTimeout(function () { p.remove(); }, 600);
    }

    function loop() {
      raf = requestAnimationFrame(loop);
      if (!st || st.paused) return;
      if (st.ended) { cancelAnimationFrame(raf); return; } // v816: 종료 후 결과창 뒤에서 계속 판정·연출이 돌며 깜빡이던 것 정지
      var t = now();
      // 카운트인 표시
      var ci = $('[data-rp-count]');
      if (t < 0) { var c = Math.ceil(-t); ci.textContent = c > CONFIG.countIn ? '' : String(c); ci.hidden = false; }
      else if (t < 0.6) { ci.textContent = 'START'; ci.hidden = false; } else ci.hidden = true;
      // 두더지 프레임 + 머리 원
      var heads = [];
      for (var i = 0; i < 4; i++) {
        var m = st.moles[i], dt = (t - m.jumpAt) * 1000, f = 0;
        if (dt >= 0 && dt < 7 * CONFIG.jumpFrameMs) f = Math.min(6, Math.floor(dt / CONFIG.jumpFrameMs));
        setMoleFrame(i, f);
        moleFrame = moleFrame || [-1, -1, -1, -1];
        moleEls[i].style.translate = '0 ' + (-liftAt(i, f)) + 'px';
        var me = moleEls[i];
        me.classList.toggle('is-hurt', t - m.hurtAt < 0.45);
        dizzyEls[i].classList.toggle('is-on', t - m.hurtAt < 1.0);
        heads.push({ h: headAt(i, f), jumping: f > 0 && f < 6 });
      }
      // v831: 박자마다 타겟 원이 톡 커졌다 줄어듦(곡 BPM 기준)
      if (t > 0) { var bp = (t - CONFIG.song.firstBeat) * CONFIG.song.bpm / 60, ph = bp - Math.floor(bp), sc = (1 + 0.1 * Math.max(0, 1 - ph * 4)).toFixed(3);
        if (sc !== lastPulse) { lastPulse = sc; for (var ti = 0; ti < 4; ti++) tgtEls[ti].style.scale = sc; } }
      // 무기
      st.notes.forEach(function (n) {
        // v812(사용자 지정): 바다 수평선 부근에서 정면으로 던져져(작게) 포물선으로 화면 최상단까지 올라온 뒤(크게) 두더지 쪽으로 떨어짐
        if (n.state === 'wait' && t >= n.spawnTime - LAUNCH) {
          n.state = 'live';
          if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0';
        }
        if (n.state === 'live') {
          var cur = flyAt(n, t);
          if (n.face) { n.face.style.transform = 'rotate(' + cur.rot.toFixed(1) + 'deg)'; cur = Object.assign({}, cur, { rot: 0 }); }
          n.el.style.transform = xf(cur); n.el.style.opacity = String(cur.op);
          if (n.trail) n.trail.forEach(function (g, gi) {
            var q = flyAt(n, t - 0.035 * (gi + 1)); if (n.face) q.rot = 0; // 원반 잔상은 테두리 고정
            if (q.op <= 0) { g.style.opacity = '0'; return; }
            g.style.transform = xf(q); g.style.opacity = String(q.op * +g.dataset.op);
          });
          if (n.wind) {
            if (t < n.spawnTime) n.wind.style.opacity = '0';
            else { var pv = flyAt(n, t - 0.03), ang = Math.atan2(-(cur.x - pv.x), cur.y - pv.y) * 180 / Math.PI;
              n.wind.style.transform = 'translate(' + (cur.x - L.weaponR * 1.3) + 'px,' + (cur.y - L.weaponR * 4.4) + 'px) rotate(' + ang.toFixed(1) + 'deg)';
              n.wind.style.opacity = (0.85 + 0.15 * Math.sin(t * 38)).toFixed(2); }
          }
          if (t < n.spawnTime) { n.cx = cur.x; n.cy = -9999; return; } // 던져 올라오는 구간(판정 없음)
          var p = cur; n.cx = p.x; n.cy = p.y;
          // 물리 충돌: 그 레인 두더지가 점프 중이고 머리 원과 무기 원이 겹침
          var hd = heads[n.targetLane];
          if (Math.abs(p.x - L.laneX[n.targetLane]) < 1 && hd.jumping && Math.hypot(p.x - hd.h.x, p.y - hd.h.y) < hd.h.r + L.weaponR) {
            if (n.press && n.press.grade && n.press.lane === n.targetLane) hit(n, n.targetLane);
            else { n.hurtBy = true; miss(n.targetLane, n); }
          }
          // 아무도 못 맞힘 → 무기가 가만히 있는 두더지 머리에 맞음 = MISS
          else if (t > n.targetTime + DIFFS[diff].judge.goodMs / 1000 && p.y >= heads[n.targetLane].h.y - heads[n.targetLane].h.r) miss(n.targetLane, n);
        }
        if (n.state === 'hit') { // 튕김
          var k = t - n.hitAt; n.cx = n.bx + n.vx * k; n.cy = n.by + n.vy * k + L.H * 2.2 * k * k;
          n.el.style.transform = 'translate(' + (n.cx - L.weaponR * 1.2) + 'px,' + (n.cy - L.weaponR * 1.2) + 'px) scale(' + (n.weaponType === 'boomerang' || n.weaponType === 'disc' ? 1.2 : 1) + ') rotate(' + (t * 900) + 'deg)';
          n.el.style.opacity = String(Math.max(0, 1 - k * 1.6));
          if (k > 0.7) { n.el.style.opacity = '0'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; n.state = 'done'; }
        }
        if (n.state === 'miss') { // 두더지에 맞고 튕겨 떨어짐
          if (!n.missAt) n.missAt = t;
          var q = t - n.missAt; n.el.style.opacity = String(Math.max(0, 1 - q * 2.5));
          n.el.style.transform += ' translateY(' + (q * 120) + 'px)';
          if (q > 0.4) { n.el.style.opacity = '0'; if (n.trail) n.trail.forEach(function (g) { g.style.opacity = '0'; }); if (n.wind) n.wind.style.opacity = '0'; n.state = 'done'; }
        }
      });
      // v814(사용자 지정): 무기가 타겟에 다가오면(도착 0.5초 전~도착 0.15초 후) 그 레인 버튼에 불빛
      var cue = [0, 0, 0, 0];
      st.notes.forEach(function (n) { if (n.state === 'live' && n.targetTime - t < 0.5 && n.targetTime - t > -0.15) cue[n.targetLane] = 1; });
      var btns = btnEls || (btnEls = el.querySelectorAll('.rp-btn'));
      for (var bi = 0; bi < 4; bi++) if (btns[bi]) btns[bi].classList.toggle('is-cue', !!cue[bi]);
      // 종료: 모든 노트 처리 후
      if (!st.over && st.notes.every(function (n) { return n.state === 'done'; })) { st.over = true; setTimeout(function () { gameOver(true); }, 900); }
    }

    function gameOver(clear) {
      if (st.ended) return; st.ended = true; st.over = true; el.querySelectorAll('.rp-btn').forEach(function (b) { b.classList.remove('is-cue'); }); // 결과창 뒤 버튼 반짝임 정지
      try { src.stop(ctx.currentTime + (clear ? 0.8 : 0.05)); } catch (e) { /* 무시 */ }
      var r = $('[data-rp-result]');
      var bk = 'mole.rp.best.' + diff, old = parseInt(localStorage.getItem(bk), 10) || 0, isNew = st.score > old;
      if (isNew) localStorage.setItem(bk, String(st.score));
      $('[data-rp-res-best]').innerHTML = '<small>' + diff + ' BEST</small><b>' + Math.max(old, st.score).toLocaleString('en-US') + '</b>';
      var stamp = $('[data-rx-new]'); stamp.classList.remove('is-on');
      r.classList.toggle('is-fail', !clear);
      var sEl = $('[data-rp-res-score]'), fin = st.score; sEl.textContent = '0';
      $('[data-rp-res-combo]').textContent = st.maxCombo;
      ['PERFECT', 'GREAT', 'GOOD', 'MISS'].forEach(function (g) { $('[data-rp-res-' + g.toLowerCase() + ']').textContent = st.cnt[g]; });
      setTimeout(function () {
        r.hidden = false;
        var t0 = performance.now(); // v831: 점수 0 → 최종 카운트업(0.9초) 뒤 신기록이면 NEW! 도장
        (function up(now) { var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); sEl.textContent = Math.round(fin * e).toLocaleString('en-US');
          if (k < 1) requestAnimationFrame(up); else if (isNew && fin > 0) stamp.classList.add('is-on'); })(t0);
      }, clear ? 700 : 300);
    }

    function pause(on) {
      if (!st || st.ended) return;
      var pt = (root.FGH && root.FGH.I18N && root.FGH.I18N.lang === 'en') ? 'PAUSE' : '일시정지'; // v826: 한글은 일시정지
      el.querySelectorAll('[data-rx-pause-t] textPath').forEach(function (t) { t.textContent = pt; });
      st.paused = on; $('[data-rp-pause]').hidden = !on;
      if (on) ctx.suspend(); else ctx.resume();
    }
    // 창 버튼 누름 효과(v820) — 폰에서 :active 가 잘 안 먹어 직접 클래스 토글
    el.querySelectorAll('.rx-btn').forEach(function (b) {
      b.addEventListener('pointerdown', function () { b.classList.add('is-press'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-press'); }); });
    });
    $('[data-rp-pausebtn]').addEventListener('click', function () { pause(true); });
    $('[data-rp-resume]').addEventListener('click', function () { pause(false); });
    $('[data-rp-quit]').addEventListener('click', function () { if (MG.Economy) MG.Economy.spendHeart(); close(); }); // 그만하기 = 하트 1개 차감(사용자 지정 v820)
    $('[data-rp-retry]').addEventListener('click', function () { start(); });
    $('[data-rp-home]').addEventListener('click', function () { close(); });
    $('[data-rp-other]').addEventListener('click', function () { cancelAnimationFrame(raf); try { src && src.stop(); } catch (e) { /* 무시 */ } st = null; showSelect(); });

    function close() {
      cancelAnimationFrame(raf);
      try { src && src.stop(); } catch (e) { /* 무시 */ }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      st = null; $('[data-rp-pause]').hidden = true;
      opts.onClose();
    }
    function showSelect() {
      $('[data-rp-result]').hidden = true; $('[data-rp-pause]').hidden = true;
      el.querySelectorAll('[data-rp-diff]').forEach(function (b) {
        var d = b.getAttribute('data-rp-diff'), best = parseInt(localStorage.getItem('mole.rp.best.' + d), 10) || 0;
        b.querySelector('small').textContent = best.toLocaleString('en-US');
      });
      $('[data-rp-select]').hidden = false;
    }
    el.querySelectorAll('[data-rp-diff]').forEach(function (b) {
      b.addEventListener('click', function () {
        diff = b.getAttribute('data-rp-diff'); $('[data-rp-select]').hidden = true;
        if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume(); // 사용자 탭 안에서 소리 허용
        start();
      });
    });
    $('[data-rp-sel-close]').addEventListener('click', function () { close(); });
    function open() { el.hidden = false; $('[data-rp-pause]').hidden = true; $('[data-rp-result]').hidden = true; wlayer.innerHTML = ''; showSelect(); }
    return { open: open, close: close, CONFIG: CONFIG, setDiff: function (d) { diff = d; }, start: function () { start(); }, press: function (l) { press(l); }, dbg: function () { return st ? { t: now(), notes: st.notes, score: st.score, combo: st.combo, hp: st.hp, cnt: st.cnt } : null; } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Rhythm = api; }
})(typeof window !== 'undefined' ? window : null);
