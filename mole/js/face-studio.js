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
    var sx = Math.min(cw - 1, Math.max(0, Math.round(x - r))), sy = Math.min(ch - 1, Math.max(0, Math.round(y - r)));
    var d = ctx.getImageData(sx, sy, Math.max(1, Math.min(r * 2, cw - sx)), Math.max(1, Math.min(r * 2, ch - sy))).data;
    var s = [0, 0, 0], n = 0;
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
    return n ? [s[0] / n, s[1] / n, s[2] / n] : [220, 180, 150];
  }

  // 한 캐릭터(얼굴형×코스튬)에 촬영 얼굴을 합성 → dataURL
  function compose(photo, det, charId) {
    return Promise.all([meta(), loadImg('assets/photo/characters/' + charId + '.png'), loadImg('assets/photo/masks/' + charId + '.png')]).then(function (r) {
      var m = r[0][charId], body = r[1], mask = r[2];
      var W = m.w, H = m.h, bx = m.box[0], by = m.box[1], bw = m.box[2], bh = m.box[3];
      var out = document.createElement('canvas'); out.width = W; out.height = H;
      var oc = out.getContext('2d');
      oc.drawImage(body, 0, 0);
      // 캐릭터 얼굴 피부색(마스크 중앙 샘플)
      var cS = avgColor(oc, bx + bw / 2, by + bh * 0.6, 8);
      // 촬영 얼굴 피부색(양 볼)
      var pc = photo.getContext('2d');
      var a = avgColor(pc, det.skinL.x, det.skinL.y, 6), b = avgColor(pc, det.skinR.x, det.skinR.y, 6);
      var uS = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      var gain = uS.map(function (u, i) { var g = cS[i] / Math.max(1, u); return Math.max(0.6, Math.min(1.7, 1 + (g - 1) * 0.6)); });
      // 1) 얼굴 오려내기(윤곽 폴리곤 + 부드러운 경계) + 피부색 보정
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
      var url = out.toDataURL('image/webp', 0.9);
      if (url.indexOf('image/webp') < 0) url = out.toDataURL('image/png');
      return url;
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
    function toast(msg) {
      var t = $('[data-fs-toast]'); t.textContent = msg; t.hidden = false;
      t.classList.remove('is-on'); void t.offsetWidth; t.classList.add('is-on');
      clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 1900);
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
      setCamState('idle');
      $('[data-fs-camerr]').hidden = true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camError(); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false }).then(function (s) {
        if (st.screen !== 2) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        setZoom(1);
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
    function setZoom(z) { zoom = Math.max(1, Math.min(zoomMax(), z)); video.style.setProperty('--z', zoom); }
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
      clearTimeout(st.loop); st.loop = null;
      if (st.stream) { st.stream.getTracks().forEach(function (t) { t.stop(); }); st.stream = null; }
      video.srcObject = null;
    }
    // 얼굴 위치 판정(§6): 1명, 화면 가운데, 적당한 크기, 기울기 작음
    function judge(det, w, h) {
      if (!det || !det.ok) return 'none';
      if (det.count > 1) return 'many';
      var cx = det.box.x + det.box.w / 2, cy = det.box.y + det.box.h / 2, m = Math.min(w, h);
      if (det.box.w < m * 0.28) return 'small';
      if (det.box.w > m * 0.85) return 'big';
      if (Math.abs(cx - w / 2) > w * 0.14 || Math.abs(cy - h * 0.48) > h * 0.16) return 'off';
      var tilt = Math.abs(det.eyeR.y - det.eyeL.y) / Math.max(1, Math.abs(det.eyeR.x - det.eyeL.x));
      if (tilt > 0.2) return 'tilt';
      return 'ok';
    }
    function detectLoop() {
      if (st.screen !== 2 || !st.stream) return;
      if (!video.videoWidth) { st.loop = setTimeout(detectLoop, 200); return; }
      MG.FaceDetect.detect(video).then(function (det) {
        if (st.screen !== 2) return;
        var j = judge(det, video.videoWidth, video.videoHeight);
        setCamState(j === 'ok' ? 'ready' : 'idle', j === 'ok' ? T('mole.fs.camHint') : T('mole.fs.cam.' + j));
        st.loop = setTimeout(detectLoop, 300);
      });
    }
    $('[data-fs-shutter]').addEventListener('click', function () {
      if (!video.videoWidth || st.busy) return;
      st.busy = true;
      // v770: 폰 카메라 원본이 커서(메모리) 합성이 실패하던 것 — 긴 변 960px 로 줄여서 촬영본을 만든다
      var k = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      var c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * k); c.height = Math.round(video.videoHeight * k);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      el.classList.remove('is-snap'); void el.offsetWidth; el.classList.add('is-snap');
      MG.FaceDetect.detect(c).then(function (det) {
        st.busy = false;
        if (!det || !det.ok) { setCamState('idle', T('mole.fs.cam.none')); toast(T('mole.fs.retake')); return; }
        var j = judge(det, c.width, c.height);
        if (j !== 'ok') { setCamState('idle', T('mole.fs.cam.' + j)); toast(T('mole.fs.retake')); return; }
        st.photo = c; st.det = det; st.results = {}; st.face = null;
        go(3);
      });
    });

    // ---- SCREEN_03 코스튬 선택 ----
    function renderCostume() {
      var cid = COSTUME_ORDER[st.costume];
      el.querySelectorAll('[data-fs-emb]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.fsEmb === cid); });
      var cards = el.querySelectorAll('[data-fs-ccard] > img:first-child');
      FACE_ORDER.forEach(function (f, i) { cards[i].src = 'assets/photo/characters/' + f + '_' + cid + '.png'; });
      $('[data-fs-cname]').textContent = costumeName(cid);
    }
    function costumeName(cid) {
      var c = MG.PhotoStudio.costumes().filter(function (x) { return x.id === cid; })[0];
      return c ? (root.FGH.I18N.lang === 'en' ? c.nameEn : c.nameKo) : cid;
    }
    el.querySelectorAll('[data-fs-emb]').forEach(function (b) {
      b.addEventListener('click', function () { st.costume = COSTUME_ORDER.indexOf(b.dataset.fsEmb); st.results = {}; renderCostume(); });
    });
    el.querySelectorAll('[data-fs-carrow]').forEach(function (b) {
      b.addEventListener('click', function () { st.costume = (st.costume + (b.dataset.fsCarrow === 'next' ? 1 : 4)) % 5; st.results = {}; renderCostume(); });
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
          var why = (e && (e.name || e.type || e.message)) || 'err';
          try { localStorage.setItem('mole.fs.lastErr', String(e && (e.stack || e.message || e))); } catch (x) { /* 무시 */ }
          st.busy = false; toast(T('mole.fs.err') + ' (' + String(why).slice(0, 40) + ')'); go(3);
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

    function open() { st.costume = 0; st.face = null; st.results = {}; st.photo = null; st.det = null; go(1); meta(); }
    return { open: open, close: close };
  }

  var api = { create: create, compose: compose };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceStudio = api; }
})(typeof window !== 'undefined' ? window : null);
