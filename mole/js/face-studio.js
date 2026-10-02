// 제작소 "사진 합성" — 카메라 촬영 → 코스튬 선택 → 합성 진행 → 얼굴형 선택 → 완성(v751).
// 명세서: 바탕화면 "제작소 UI 및 에셋(얼굴합성)/명세서.txt". SCREEN_08 없음(완성 화면에서 제작소 복귀까지).
// 사진은 기기 안에서만 처리(서버 전송 없음). 원본 촬영 프레임은 합성이 끝나면 버린다(close/완료 시 해제).
// 얼굴형 = 사진관의 확정 캐릭터(얼굴 비운 몸체 assets/photo/characters/<faceType>_<costume>.png)와
//          그 얼굴 영역 마스크(assets/photo/masks, 캐릭터에서 그대로 뽑은 윤곽) — 윤곽을 새로 그리지 않는다.
// 합성: 눈 수평 맞춤 → 볼 폭 기준 크기 → 눈 높이 기준 위치 → 피부색을 캐릭터 톤으로 보정 → 부드러운 경계 → 마스크로 윤곽 확정.
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var FA = 'assets/facestudio/';
  var FACE_ORDER = ['round', 'sturdy', 'sharp'];
  var COSTUME_ORDER = ['blue_bears', 'red_wings', 'mount_stars', 'sun_giants', 'cloud_cups'];

  var imgCache = {};
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return imgCache[src];
  }
  var metaP = null;
  function meta() {
    if (!metaP) metaP = fetch('assets/photo/masks/meta.json').then(function (r) { return r.json(); });
    return metaP;
  }

  function avgColor(ctx, x, y, r) {
    var cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (!fin(x) || !fin(y)) return [220, 180, 150];
    var sx = Math.min(cw - 1, Math.max(0, Math.round(x - r))), sy = Math.min(ch - 1, Math.max(0, Math.round(y - r)));
    var d = ctx.getImageData(sx, sy, Math.max(1, Math.min(r * 2, cw - sx)), Math.max(1, Math.min(r * 2, ch - sy))).data;
    var s = [0, 0, 0], n = 0;
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
    return n ? [s[0] / n, s[1] / n, s[2] / n] : [220, 180, 150];
  }

  // v786(폰 실패 원인: 일부 기준점 좌표가 NaN 으로 와서 getImageData 에서 멈춤) — 좌표가 비었으면 얼굴 윤곽 범위로 대신 계산
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function fixDet(det, W, H) {
    var ov = (det.oval || []).filter(function (p) { return p && fin(p.x) && fin(p.y); });
    var b = det.box;
    if (!b || !fin(b.x) || !fin(b.y) || !fin(b.w) || !fin(b.h) || b.w <= 0 || b.h <= 0) {
      if (ov.length < 3) return null;
      var xs = ov.map(function (p) { return p.x; }), ys = ov.map(function (p) { return p.y; });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
      b = { x: x0, y: y0, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0 };
    }
    function at(p, fx, fy) {
      var q = (p && fin(p.x) && fin(p.y)) ? { x: p.x, y: p.y } : { x: b.x + b.w * fx, y: b.y + b.h * fy };
      q.x = Math.min(W - 1, Math.max(0, q.x)); q.y = Math.min(H - 1, Math.max(0, q.y)); return q;
    }
    if (ov.length < 3) ov = [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { var a = k / 8 * Math.PI * 2; return { x: b.x + b.w / 2 + Math.cos(a) * b.w / 2, y: b.y + b.h / 2 + Math.sin(a) * b.h / 2 }; });
    return { ok: true, count: det.count || 1, oval: ov, box: b,
      eyeL: at(det.eyeL, 0.3, 0.4), eyeR: at(det.eyeR, 0.7, 0.4), cheekL: at(det.cheekL, 0.02, 0.55), cheekR: at(det.cheekR, 0.98, 0.55),
      chin: at(det.chin, 0.5, 1), nose: at(det.nose, 0.5, 0.6), skinL: at(det.skinL, 0.3, 0.62), skinR: at(det.skinR, 0.7, 0.62) };
  }

  // 한 캐릭터(얼굴형×코스튬)에 촬영 얼굴을 합성 → dataURL
  function compose(photo, det, charId) {
    var stage = 'load';
    function tag(e) { var x = new Error('[' + stage + '] ' + ((e && (e.message || e.type)) || e)); x.name = (e && e.name) || 'Error'; return x; }
    return Promise.all([meta().catch(function (e) { stage = 'meta'; throw tag(e); }),
      loadImg('assets/photo/characters/' + charId + '.png').catch(function (e) { stage = 'char'; throw tag(e); }),
      loadImg('assets/photo/masks/' + charId + '.png').catch(function (e) { stage = 'mask'; throw tag(e); })]).then(function (r) {
     try {
      stage = 'meta2';
      var m = r[0][charId], body = r[1], mask = r[2];
      stage = 'body';
      var W = m.w, H = m.h, bx = m.box[0], by = m.box[1], bw = m.box[2], bh = m.box[3];
      var out = document.createElement('canvas'); out.width = W; out.height = H;
      var oc = out.getContext('2d');
      oc.drawImage(body, 0, 0);
      // 캐릭터 얼굴 피부색(마스크 중앙 샘플)
      stage = 'skinC';
      var cS = avgColor(oc, bx + bw / 2, by + bh * 0.6, 8);
      stage = 'skinU';
      // 촬영 얼굴 피부색(양 볼)
      var pc = photo.getContext('2d');
      var a = avgColor(pc, det.skinL.x, det.skinL.y, 6), b = avgColor(pc, det.skinR.x, det.skinR.y, 6);
      var uS = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      var gain = uS.map(function (u, i) { var g = cS[i] / Math.max(1, u); return Math.max(0.6, Math.min(1.7, 1 + (g - 1) * 0.6)); });
      // 1) 얼굴 오려내기(윤곽 폴리곤 + 부드러운 경계) + 피부색 보정
      stage = 'cut';
      var faceW = Math.hypot(det.cheekR.x - det.cheekL.x, det.cheekR.y - det.cheekL.y);
      var cut = document.createElement('canvas'); cut.width = photo.width; cut.height = photo.height;
      var cc = cut.getContext('2d');
      cc.drawImage(photo, 0, 0);
      var ov = MG.FaceDetect.expand(det.oval, 1.0);
      var mk = document.createElement('canvas'); mk.width = photo.width; mk.height = photo.height;
      var mc = mk.getContext('2d');
      mc.filter = 'blur(' + Math.max(2, Math.round(faceW * 0.035)) + 'px)';
      mc.beginPath(); ov.forEach(function (p, i) { if (i) mc.lineTo(p.x, p.y); else mc.moveTo(p.x, p.y); }); mc.closePath(); mc.fillStyle = '#000'; mc.fill();
      cc.globalCompositeOperation = 'destination-in'; cc.drawImage(mk, 0, 0); cc.globalCompositeOperation = 'source-over';
      var bb = det.box, x0 = Math.max(0, Math.floor(bb.x - 10)), y0 = Math.max(0, Math.floor(bb.y - 10));
      x0 = Math.min(x0, cut.width - 1); y0 = Math.min(y0, cut.height - 1);
      var ww = Math.max(1, Math.min(cut.width - x0, Math.ceil(bb.w + 20))), hh = Math.max(1, Math.min(cut.height - y0, Math.ceil(bb.h + 20)));
      var id = cc.getImageData(x0, y0, ww, hh), d = id.data;
      for (var i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * gain[0]); d[i + 1] = Math.min(255, d[i + 1] * gain[1]); d[i + 2] = Math.min(255, d[i + 2] * gain[2]); }
      cc.putImageData(id, x0, y0);
      // 2) 얼굴 레이어: 보정 피부색으로 얼굴형 전체를 채우고(얼굴형 윤곽 유지) 그 위에 얼굴을 맞춰 얹는다
      stage = 'layer';
      var fl = document.createElement('canvas'); fl.width = W; fl.height = H;
      var fc = fl.getContext('2d');
      var fill = cS.map(function (c, i) { return Math.round(c * 0.72 + uS[i] * gain[i] * 0.28); });
      fc.fillStyle = 'rgb(' + fill.join(',') + ')'; fc.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
      var ex = (det.eyeL.x + det.eyeR.x) / 2, ey = (det.eyeL.y + det.eyeR.y) / 2;
      var ang = Math.atan2(det.eyeR.y - det.eyeL.y, det.eyeR.x - det.eyeL.x);
      var s = (bw * 0.9) / faceW;
      fc.save();
      fc.translate(bx + bw / 2, by + bh * 0.44); // 눈 높이 기준점(모자 챙 아래)
      fc.rotate(-ang); fc.scale(s, s); fc.translate(-ex, -ey);
      fc.drawImage(cut, 0, 0);
      fc.restore();
      // 3) 확정 얼굴형 마스크로 윤곽 확정
      fc.globalCompositeOperation = 'destination-in'; fc.drawImage(mask, 0, 0);
      oc.drawImage(fl, 0, 0);
      stage = 'encode';
      var url = out.toDataURL('image/webp', 0.9);
      if (url.indexOf('image/webp') < 0) url = out.toDataURL('image/png');
      return url;
     } catch (e) { throw tag(e); }
    });
  }

  function create(opts) {
    var el = opts.root;
    var $ = function (s) { return el.querySelector(s); };
    var st = { screen: 1, costume: 0, face: null, photo: null, det: null, results: {}, stream: null, loop: null, busy: false };
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function go(n) {
      st.screen = n;
      el.querySelectorAll('[data-fs-screen]').forEach(function (s) { s.hidden = s.dataset.fsScreen.split(' ').indexOf(String(n)) < 0; });
      if (n === 2) startCamera(); else stopCamera();
      if (n === 3) renderCostume();
      if (n === 5) renderFaceSelect(false);
      if (n === 6) renderFaceSelect(true);
    }
    function toast(msg, ms) {
      var t = $('[data-fs-toast]'); t.textContent = msg; t.hidden = false;
      t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on');
      clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 1900);
    }

    // ---- 뒤로가기: 단계별 이전 화면(촬영 데이터는 유지, §58) ----
    el.querySelectorAll('[data-fs-back]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.busy) return;
        var prev = { 1: 0, 2: 1, 3: 2, 5: 3, 6: 5, 7: 6 }[st.screen];
        if (!prev) close(); else go(prev);
      });
    });
    function close() { stopCamera(); timers.forEach(clearTimeout); timers = []; st.photo = null; st.det = null; st.results = {}; st.busy = false; opts.onClose(); }

    // ---- SCREEN_01 안내 ----
    $('[data-fs-agree]').addEventListener('click', function () { go(2); });

    // ---- SCREEN_02 카메라 ----
    var video = $('[data-fs-video]');
    function setCamState(s, msg) {
      var g = $('[data-fs-guide]'); g.classList.toggle('is-ready', s === 'ready');
      $('[data-fs-ready]').hidden = s !== 'ready';
      $('[data-fs-shutter]').disabled = s !== 'ready';
      $('[data-fs-hint]').textContent = msg || T('mole.fs.camHint');
    }
    function startCamera() {
      st.lastDet = null; // v844: 새로 촬영 화면에 들어오면 이전 얼굴 기록 비움
      setCamState('idle');
      $('[data-fs-camerr]').hidden = true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camError(); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false }) /* v783: v771 세로 비율 요청이 일부 폰에서 검은 화면 — 원래 요청으로 복귀(위아래 띠는 기본 꽉 채움 줌으로 해결) */.then(function (s) {
        if (st.screen !== 2) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        // v771: 기본 = 화면 꽉 채움(위아래 검은 띠 없음). 두 손가락으로 오므리면 원본 전체까지 작아짐.
        video.addEventListener('loadedmetadata', function () { setZoom(zoomMax()); }, { once: true });
        st.stream = s; video.srcObject = s; video.play().catch(function () {});
        detectLoop();
      }).catch(camError);
    }
    // 두 손가락 줌(사용자 지정 v757): 기본 = 카메라 원본 전체(가장 작게), 벌리면 화면 꽉 찰 때까지 확대.
    var zoom = 1, pinch = null, camScr = video.parentElement;
    function zoomMax() {
      var vw = video.videoWidth, vh = video.videoHeight, sw = camScr.clientWidth, sh = camScr.clientHeight;
      if (!vw || !vh || !sw || !sh) return 1;
      var k = Math.min(sw / vw, sh / vh);
      return Math.max(sw / (vw * k), sh / (vh * k));
    }
    // v786(사용자 지정): 항상 화면 꽉 채움 고정 — 축소하면 위아래 검은 띠가 얼굴 가이드 안으로 들어왔음. 핀치 줌 비활성.
    // v809(사용자 지정: 꽉 찬 화면에서 얼굴 크기 조절 불가) — 두 손가락 줌 복구. 줄이면 생기는 위아래 빈 곳은
    // 같은 카메라 영상을 흐리게 깔아(검은 띠 없음) 채운다. 기본 = 꽉 채움.
    function setZoom(z) { zoom = Math.max(1, Math.min(zoomMax(), z == null ? zoomMax() : z)); video.style.setProperty('--z', zoom); }
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    camScr.addEventListener('touchstart', function (e) { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoom }; }, { passive: true });
    camScr.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault(); setZoom(pinch.z * dist(e.touches) / pinch.d);
    }, { passive: false });
    camScr.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
    function camError() { $('[data-fs-camerr]').hidden = false; setCamState('error', T('mole.fs.camDenied')); }
    $('[data-fs-retry]').addEventListener('click', startCamera);
    function stopCamera() {
      clearTimeout(st.loop); st.loop = null; clearTimeout(bgTimer); bgTimer = null;
      if (st.stream) { st.stream.getTracks().forEach(function (t) { t.stop(); }); st.stream = null; }
      video.srcObject = null;
    }
    // 얼굴 위치 판정(v771, 사용자 지정): 얼굴 윤곽이 화면의 가이드 타원 안에 다 들어오면 촬영 가능.
    // 가이드 타원(화면 좌표)을 카메라 영상 좌표로 바꿔(object-fit contain × 줌, 좌우 거울) 윤곽 점이 모두 안에 있는지 본다.
    function guideInVideo(scaleToDet) {
      var g = $('[data-fs-guide]').getBoundingClientRect(), r = camScr.getBoundingClientRect();
      var vw = video.videoWidth, vh = video.videoHeight;
      var k = Math.min(r.width / vw, r.height / vh) * zoom; // 화면 px / 영상 px
      var ecx = g.left + g.width * 150 / 300, ecy = g.top + g.height * 195 / 400;
      var rx = g.width * 95 / 300, ry = g.height * 130 / 400;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return { x: (vw / 2 - (ecx - cx) / k) * scaleToDet, y: (vh / 2 + (ecy - cy) / k) * scaleToDet, rx: rx / k * scaleToDet, ry: ry / k * scaleToDet };
    }
    function judge(det, w) {
      if (!det || !det.ok) return 'none';
      var e = guideInVideo(w / video.videoWidth);
      var out = det.oval.some(function (p) { var dx = (p.x - e.x) / e.rx, dy = (p.y - e.y) / e.ry; return dx * dx + dy * dy > 1.2; }); // 윤곽점(이마 위쪽 포함)이 타원선을 조금 넘는 건 허용
      if (out) return (det.box.h > e.ry * 2 || det.box.w > e.rx * 2) ? 'big' : 'off';
      if (det.box.h < e.ry * 2 * 0.5) return 'small';
      var tilt = Math.abs(det.eyeR.y - det.eyeL.y) / Math.max(1, Math.abs(det.eyeR.x - det.eyeL.x));
      if (tilt > 0.3) return 'tilt';
      return 'ok';
    }
    function scaleDet(d, k) {
      function sp(p) { return p ? { x: p.x * k, y: p.y * k } : p; }
      var o = { ok: true, count: d.count, oval: d.oval.map(sp), box: d.box && { x: d.box.x * k, y: d.box.y * k, w: d.box.w * k, h: d.box.h * k } };
      ['eyeL', 'eyeR', 'cheekL', 'cheekR', 'chin', 'nose', 'skinL', 'skinR'].forEach(function (n) { o[n] = sp(d[n]); });
      return o;
    }
    var bgTimer = null;
    function paintBg() {
      clearTimeout(bgTimer);
      if (st.screen !== 2 || !st.stream) return;
      var cv = $('[data-fs-videobg]');
      if (cv && video.videoWidth) { cv.width = 90; cv.height = Math.round(90 * video.videoHeight / video.videoWidth); try { cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height); } catch (e) { /* 무시 */ } }
      bgTimer = setTimeout(paintBg, 120);
    }
    function detectLoop() {
      if (!bgTimer) paintBg();
      if (st.screen !== 2 || !st.stream) return;
      if (!video.videoWidth) { st.loop = setTimeout(detectLoop, 200); return; }
      MG.FaceDetect.detect(video).then(function (det) {
        if (st.screen !== 2) return;
        var j = judge(det, video.videoWidth);
        // v844: 정상 판정된 얼굴은 다음 판정이 흔들려도 지우지 않고 보관(촬영 시 이걸로 바로 진행)
        if (j === 'ok') st.lastDet = { det: det, w: video.videoWidth };
        setCamState(j === 'ok' ? 'ready' : 'idle', j === 'ok' ? T('mole.fs.camHint') : T('mole.fs.cam.' + j));
        st.loop = setTimeout(detectLoop, 300);
      });
    }
    // ⚠️ v879 임시 진단(사용자 폰 촬영 실패 원인 확인용, 원인 고치면 삭제) — 카메라 화면 맨 아래 작은 글자
    var diagEl = null, diagLog = [];
    function diag(msg) {
      try {
        if (!diagEl) { diagEl = document.createElement('div'); diagEl.className = 'fs-diag'; video.parentElement.appendChild(diagEl); }
        diagLog.push(msg); if (diagLog.length > 4) diagLog.shift();
        diagEl.textContent = 'v883 | ' + diagLog.join(' / ');
      } catch (e) { /* 무시 */ }
    }
    window.addEventListener('error', function (e) { if (st.screen === 2) diag('ERR ' + (e.message || e)); });
    window.addEventListener('unhandledrejection', function (e) { if (st.screen === 2) diag('REJ ' + ((e.reason && e.reason.message) || e.reason)); });
    $('[data-fs-shutter]').addEventListener('pointerdown', function () { diag('down dis=' + $('[data-fs-shutter]').disabled); });
    $('[data-fs-shutter]').addEventListener('click', function () {
      diag('click vw=' + video.videoWidth + ' busy=' + st.busy + ' ready=' + (st.lastDet ? 'Y' : 'N'));
      if (!video.videoWidth || st.busy) return;
      st.busy = true;
      // v770: 폰 카메라 원본이 커서(메모리) 합성이 실패하던 것 — 긴 변 960px 로 줄여서 촬영본을 만든다
      var k = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      var c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * k); c.height = Math.round(video.videoHeight * k);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      el.classList.remove('is-snap'); void el.offsetWidth; el.classList.add('is-snap');
      var ready = st.lastDet;
      st.busy = false;
      // v844(사용자: 폰에서 계속 "다시 촬영") — 찍은 사진으로 얼굴을 다시 찾는 단계 완전 삭제(폰에서 이 단계가 실패).
      // 카메라 화면에서 정상 확인된 얼굴 위치를 찍은 사진 크기에 맞춰 그대로 사용. 확인된 얼굴이 한 번도 없을 때만 다시 촬영.
      (function () {
        var det = ready ? scaleDet(ready.det, c.width / ready.w) : null;
        if (!det || !det.ok) { diag('no det'); setCamState('idle', T('mole.fs.cam.none')); toast(T('mole.fs.retake')); return; }
        // v811(사용자 지정: 촬영해도 다음으로 안 넘어감) — 버튼이 켜졌을 때 이미 판정 통과, 촬영본은 얼굴만 있으면 진행
        var fd = fixDet(det, c.width, c.height);
        function proceed(f, how) {
          st.photo = c; st.det = f; st.results = {}; st.face = null;
          diag('go3 ' + how);
          try { go(3); diag('ok scr=' + st.screen); } catch (e) { diag('go3 ERR ' + e.message); throw e; }
        }
        if (fd) { proceed(fd, 'mesh'); return; }
        // v880(진단 결과: 이 폰은 얼굴 인식 좌표가 전부 NaN(숫자 아님)으로 나옴 → 판정이 거짓 'ok', 사진 처리 단계에서 실패).
        // ① 폰 내장 얼굴 인식(FaceDetector)으로 얼굴 상자를 구하고, ② 그것도 없으면 화면의 가이드 타원(사용자가 얼굴을 맞춘 자리)을 얼굴 위치로 사용.
        diag('mesh NaN box=' + (det.box ? [det.box.x, det.box.w].map(function (v) { return Math.round(v); }).join(',') : '-'));
        // v881(사용자: 합성 구도 안 맞음 — 얼굴이 너무 크게 들어가 이마~입만 보임): 상자만 있을 때 기준점을 얼굴 전체가 들어가게 잡음.
        // 볼 끝을 상자보다 바깥(폭 1.3배)으로 → 합성 배율이 작아져 턱·이마까지 들어감, 눈 높이 = 상자 위에서 45%.
        function boxDet(b, eL, eR) {
          var P = function (fx, fy) { return { x: b.x + b.w * fx, y: b.y + b.h * fy }; };
          return { ok: true, count: 1, oval: [], box: b, eyeL: eL || P(0.3, 0.5), eyeR: eR || P(0.7, 0.5), cheekL: P(-0.1, 0.55), cheekR: P(1.1, 0.55), /* v883: 1.3배 너무 작음 / 1.12배 입·턱 잘림(사용자) → 1.2배 + 얼굴을 위로 */
            chin: P(0.5, 1), nose: P(0.5, 0.62), skinL: P(0.3, 0.64), skinR: P(0.7, 0.64) };
        }
        function byGuide() {
          var e = guideInVideo(c.width / video.videoWidth);
          var g = fixDet(boxDet({ x: e.x - e.rx, y: e.y - e.ry, w: e.rx * 2, h: e.ry * 2 }), c.width, c.height);
          if (g) proceed(g, 'guide'); else { diag('guide fail'); setCamState('idle', T('mole.fs.cam.none')); toast(T('mole.fs.retake')); }
        }
        if ('FaceDetector' in root) {
          try {
            new root.FaceDetector({ fastMode: false, maxDetectedFaces: 1 }).detect(c).then(function (faces) {
              var f = faces && faces[0]; if (!f || !f.boundingBox) { byGuide(); return; }
              var bb = f.boundingBox, L = {};
              (f.landmarks || []).forEach(function (lm) { if (lm.locations && lm.locations[0]) L[lm.type + (L[lm.type] ? '2' : '')] = lm.locations[0]; });
              var eyes = [L.eye, L.eye2].filter(Boolean).sort(function (p, q) { return p.x - q.x; });
              var nd = fixDet(boxDet({ x: bb.x, y: bb.y, w: bb.width, h: bb.height }, eyes[0], eyes[1]), c.width, c.height);
              if (nd) proceed(nd, 'native'); else byGuide();
            }).catch(function () { byGuide(); });
            return;
          } catch (e) { /* 내장 인식 없음 → 가이드 */ }
        }
        byGuide();
      })();
    });

    // ---- SCREEN_03 코스튬 선택 ----
    // v782(사용자 지정): 좌우 화살표 = 카드가 한 장씩 옆으로 이동(전체 5팀×3얼굴형 15장을 한 줄로 이어 붙인 목록,
    // 가운데 금색 발판 카드가 현재 선택). 엠블럼을 누르면 그 팀 가운데 카드로 이동.
    var cpos = 1; // 0..14
    function cardSrc(k) { k = (k + 15) % 15; return 'assets/photo/characters/' + FACE_ORDER[k % 3] + '_' + COSTUME_ORDER[Math.floor(k / 3)] + '.png'; }
    function renderCostume() {
      st.costume = Math.floor(((cpos % 15) + 15) % 15 / 3);
      var cid = COSTUME_ORDER[st.costume];
      el.querySelectorAll('[data-fs-emb]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.fsEmb === cid); });
      var cards = el.querySelectorAll('[data-fs-ccard] > img:first-child');
      [-1, 0, 1].forEach(function (d, i) { cards[i].src = cardSrc(cpos + d); });
      $('[data-fs-cname]').textContent = costumeName(cid);
    }
    function costumeName(cid) {
      var c = MG.PhotoStudio.costumes().filter(function (x) { return x.id === cid; })[0];
      return c ? (root.FGH.I18N.lang === 'en' ? c.nameEn : c.nameKo) : cid;
    }
    var sliding = false;
    function slide(dir) {
      if (sliding) return; sliding = true;
      var box = $('.fs-ccards');
      box.classList.remove('is-slide-next', 'is-slide-prev'); void box.offsetWidth;
      box.classList.add(dir > 0 ? 'is-slide-next' : 'is-slide-prev');
      setTimeout(function () {
        cpos = (cpos + dir + 15) % 15; st.results = {}; renderCostume();
        box.classList.remove('is-slide-next', 'is-slide-prev');
        box.classList.add(dir > 0 ? 'is-in-next' : 'is-in-prev');
        setTimeout(function () { box.classList.remove('is-in-next', 'is-in-prev'); sliding = false; }, 180);
      }, 160);
    }
    el.querySelectorAll('[data-fs-emb]').forEach(function (b) {
      b.addEventListener('click', function () { cpos = COSTUME_ORDER.indexOf(b.dataset.fsEmb) * 3 + 1; st.results = {}; renderCostume(); });
    });
    el.querySelectorAll('[data-fs-carrow]').forEach(function (b) {
      b.addEventListener('click', function () { slide(b.dataset.fsCarrow === 'next' ? 1 : -1); });
    });
    $('[data-fs-costume-ok]').addEventListener('click', function () { if (!st.photo) { go(2); return; } runComposite(); });

    // ---- SCREEN_04 합성 진행(실제 합성과 단계 표시 동기화) ----
    function runComposite() {
      go(4);
      st.busy = true;
      var cid = COSTUME_ORDER[st.costume];
      var face = $('[data-fs-ringface]');
      var fc = face.getContext('2d'), b = st.det.box, sz = Math.max(b.w, b.h) * 1.25;
      face.width = face.height = 240;
      fc.drawImage(st.photo, b.x + b.w / 2 - sz / 2, b.y + b.h / 2 - sz / 2, sz, sz, 0, 0, 240, 240);
      var steps = el.querySelectorAll('[data-fs-step]');
      steps.forEach(function (s) { s.className = 'fs-step'; });
      function mark(i, state) { steps[i].className = 'fs-step is-' + state; }
      var t0 = Date.now();
      function after(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms - (Date.now() - t0))); }); }
      mark(0, 'now');
      after(700).then(function () { mark(0, 'done'); mark(1, 'now'); t0 = Date.now(); return compose(st.photo, st.det, 'round_' + cid); })
        .then(function (u) { st.results.round = u; return after(700); })
        .then(function () { mark(1, 'done'); mark(2, 'now'); t0 = Date.now(); return compose(st.photo, st.det, 'sturdy_' + cid); })
        .then(function (u) { st.results.sturdy = u; return after(700); })
        .then(function () { mark(2, 'done'); mark(3, 'now'); t0 = Date.now(); return compose(st.photo, st.det, 'sharp_' + cid); })
        .then(function (u) { st.results.sharp = u; return after(700); })
        .then(function () { mark(3, 'done'); mark(4, 'now'); t0 = Date.now(); return after(600); })
        .then(function () { mark(4, 'done'); st.busy = false; later(function () { go(5); }, 350); })
        .catch(function (e) {
          // v770: 실패 원인을 짧게 함께 표시(폰에서만 나는 오류 확인용)
          var why = (e && (e.message || e.name || e.type)) || 'err'; // v784: 단계+메시지 표시(폰 원인 확인용)
          try { localStorage.setItem('mole.fs.lastErr', String(e && (e.stack || e.message || e))); } catch (x) { /* 무시 */ }
          st.busy = false; toast(T('mole.fs.err') + ' (' + String(why).slice(0, 90) + ')', 6000); go(3);
        });
    }

    // ---- SCREEN_05/06 얼굴형 선택 ----
    function renderFaceSelect(revealed) {
      var cards = el.querySelectorAll('[data-fs-fcard]');
      cards.forEach(function (c) {
        var f = c.dataset.fsFcard;
        c.classList.toggle('is-sel', st.face === f);
        c.classList.toggle('is-revealed', revealed);
        c.querySelector('img.fs-fcard-char').src = revealed && st.results[f] ? st.results[f] : '';
      });
      $('[data-fs-face-ok]').disabled = !st.face;
      $('[data-fs-bubble]').textContent = revealed && st.face ? T('mole.fs.bubbleSel', { name: faceName(st.face) }) : T('mole.fs.bubble');
      $('[data-fs-face-title]').textContent = T(revealed ? 'mole.fs.faceTitle2' : 'mole.fs.faceTitle');
    }
    function faceName(f) { var x = MG.PhotoStudio.faceTypes().filter(function (t) { return t.id === f; })[0]; return root.FGH.I18N.lang === 'en' ? x.nameEn : x.nameKo; }
    el.querySelectorAll('[data-fs-fcard]').forEach(function (c) {
      c.addEventListener('click', function () { if (!st.results[c.dataset.fsFcard]) return; st.face = c.dataset.fsFcard; if (st.screen === 5) go(6); else renderFaceSelect(true); });
    });
    $('[data-fs-face-ok]').addEventListener('click', function () { if (!st.face) return; renderResult(); go(7); });

    // ---- SCREEN_07 완성 ----
    function charId() { return st.face + '_' + COSTUME_ORDER[st.costume]; }
    function renderResult() {
      var u = st.results[st.face];
      $('[data-fs-final]').src = u; $('[data-fs-polaroid]').src = u;
      $('[data-fs-applied]').textContent = T('mole.fs.appliedCount', { n: MG.PhotoStudio.appliedIds().length, max: MG.PhotoStudio.MAX_APPLIED });
    }
    function saveCharacter() {
      var id = charId();
      var ok = MG.PhotoStudio.saveComposite(id, st.results[st.face], { costumeId: COSTUME_ORDER[st.costume], faceType: st.face });
      if (!ok) { toast(T('mole.fs.saveErr')); return false; }
      if (opts.onChange) opts.onChange();
      return true;
    }
    $('[data-fs-use]').addEventListener('click', function () {
      if (!saveCharacter()) return;
      var id = charId();
      if (!MG.PhotoStudio.isApplied(id)) {
        var r = MG.PhotoStudio.toggleApply(id);
        if (!r.ok) { toast(T('mole.fs.maxApplied', { max: MG.PhotoStudio.MAX_APPLIED })); return; }
      }
      renderResult();
      toast(T('mole.fs.applied', { n: MG.PhotoStudio.appliedIds().length, max: MG.PhotoStudio.MAX_APPLIED }));
    });
    $('[data-fs-other]').addEventListener('click', function () { go(6); });
    $('[data-fs-home]').addEventListener('click', function () { if (saveCharacter()) close(); });

    function open() { st.costume = 0; cpos = 1; st.face = null; st.results = {}; st.photo = null; st.det = null; go(1); meta(); }
    return { open: open, close: close };
  }

  var api = { create: create, compose: compose };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceStudio = api; }
})(typeof window !== 'undefined' ? window : null);
