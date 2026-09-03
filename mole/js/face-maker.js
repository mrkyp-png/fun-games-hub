(function (root) {
  'use strict';
  // 사진 선택 → 원형 크롭 → 미리보기 → 저장. 원본 사진은 메모리에서만 쓰고 저장 안 함.
  var MG = root.MoleGame;
  var OUT = 320;
  var MOLE_BODY = 'assets/moles/mole1.png';

  function create(opts) {
    var el = opts.root;
    var onDone = opts.onDone || function () {};
    var onCancel = opts.onCancel || function () {};

    var fileInput = el.querySelector('[data-fm-file]');
    var cropImg = el.querySelector('[data-fm-img]');
    var cropBox = el.querySelector('[data-fm-crop]');
    var previewBox = el.querySelector('[data-fm-preview]');
    var nameInput = el.querySelector('[data-fm-name]');

    var view = { scale: 1, x: 0, y: 0 };
    var natural = { w: 0, h: 0 };
    var pointers = new Map();
    var pinchStart = null;
    var lastCropDataUrl = null;
    var detected = null;   // FaceDetect 결과 {oval(자연 px), box} — 못 찾으면 null (원형 폴백)
    var session = {};  // 이번 open() 옵션 (profile 모드 / done 오버라이드)

    function stage(name) {
      el.querySelectorAll('[data-fm-stage]').forEach(function (s) {
        s.hidden = (s.getAttribute('data-fm-stage') !== name);
      });
    }
    function open(o) {
      session = o || {};
      var forced = !!session.forced;
      el.querySelectorAll('[data-fm-cancel]').forEach(function (b) { b.hidden = forced; });
      // 프로필 모드: 이름칸 숨김, 제목 문구 바꿈
      var isProfile = !!session.profile;
      if (nameInput) nameInput.hidden = isProfile;
      var titleEl = el.querySelector('.bs-title');
      if (titleEl) titleEl.textContent = root.FGH.I18N.t(isProfile ? 'mole.fm.titleProfile' : 'mole.fm.title');
      fileInput.value = '';
      nameInput.value = '';
      lastCropDataUrl = null;
      detected = null;
      stage('pick');
    }

    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        cropImg.onload = function () {
          natural.w = cropImg.naturalWidth;
          natural.h = cropImg.naturalHeight;
          stage('crop');
          resetView();
          applyView();
          autoFitFace();  // 얼굴 인식되면 그 윤곽에 맞춰 크롭을 자동 배치 (안 되면 수동 그대로)
        };
        cropImg.src = reader.result;
      };
      reader.readAsDataURL(f);
    });

    // MediaPipe FaceMesh 로 얼굴 윤곽을 찾아 크롭을 그 위에 자동 정렬 + 윤곽대로 잘라내기 준비.
    // 못 찾으면 detected=null → renderCrop 이 기존 원형 크롭으로 폴백.
    function autoFitFace() {
      if (!MG.FaceDetect) { detected = null; return; }
      var hint = el.querySelector('.fm-hint');
      var idle = root.FGH.I18N.t('mole.fm.cropHint');
      if (hint) hint.textContent = root.FGH.I18N.t('mole.fm.detecting');
      MG.FaceDetect.detect(cropImg).then(function (res) {
        if (hint) hint.textContent = res.ok ? root.FGH.I18N.t('mole.fm.detected') : idle;
        if (!res.ok) { detected = null; return; }
        detected = res;
        // 얼굴 박스가 크롭 사각형의 ~86% 를 채우도록 스케일 + 중앙 정렬.
        var bx = res.box, b = boxSize();
        var fcx = bx.x + bx.w / 2, fcy = bx.y + bx.h / 2;
        var span = Math.max(bx.w, bx.h);
        view.scale = (b.w * 0.86) / span;
        view.x = (natural.w / 2 - fcx) * view.scale;
        view.y = (natural.h / 2 - fcy) * view.scale;
        clampView();
        applyView();
      });
    }

    function boxSize() { var r = cropBox.getBoundingClientRect(); return { w: r.width, h: r.height }; }
    function minScale() { var b = boxSize(); return Math.max(b.w / natural.w, b.h / natural.h); }
    function resetView() { view.scale = minScale() * 1.08; view.x = 0; view.y = 0; clampView(); }
    function clampView() {
      var b = boxSize();
      if (view.scale < minScale()) view.scale = minScale();
      var maxX = Math.max(0, (natural.w * view.scale - b.w) / 2);
      var maxY = Math.max(0, (natural.h * view.scale - b.h) / 2);
      view.x = Math.max(-maxX, Math.min(maxX, view.x));
      view.y = Math.max(-maxY, Math.min(maxY, view.y));
    }
    function applyView() {
      cropImg.style.transform =
        'translate(-50%,-50%) translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    cropBox.addEventListener('pointerdown', function (e) {
      cropBox.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        pinchStart = { dist: dist(p[0], p[1]), scale: view.scale };
      }
    });
    cropBox.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { view.x += (e.clientX - prev.x); view.y += (e.clientY - prev.y); }
      else if (pointers.size === 2 && pinchStart) {
        var p = Array.from(pointers.values());
        view.scale = pinchStart.scale * (dist(p[0], p[1]) / pinchStart.dist);
      }
      clampView(); applyView();
    });
    function endPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null; }
    cropBox.addEventListener('pointerup', endPointer);
    cropBox.addEventListener('pointercancel', endPointer);
    cropBox.addEventListener('wheel', function (e) {
      e.preventDefault();
      view.scale *= (e.deltaY < 0 ? 1.08 : 0.93);
      clampView(); applyView();
    }, { passive: false });

    var lastShape = null;  // 저장/합성에 넘길 윤곽 {oval:[정규화 0~1], box} — 원형 폴백이면 null

    function renderCrop() {
      var b = boxSize();
      var srcSize = b.w / view.scale;
      var srcX = (natural.w * view.scale / 2 - view.x - b.w / 2) / view.scale;
      var srcY = (natural.h * view.scale / 2 - view.y - b.h / 2) / view.scale;
      var c = document.createElement('canvas');
      c.width = OUT; c.height = OUT;
      var ctx = c.getContext('2d');
      ctx.drawImage(cropImg, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);

      var toOut = function (p) {
        return { x: (p.x - srcX) / srcSize * OUT, y: (p.y - srcY) / srcSize * OUT };
      };
      lastShape = null;
      if (detected && detected.oval.length) {
        // 윤곽을 살짝 부풀린 폴리곤 → 페더(블러) 마스크로 잘라냄.
        var poly = MG.FaceDetect.expand(detected.oval, 1.06).map(toOut);
        var mask = document.createElement('canvas');
        mask.width = OUT; mask.height = OUT;
        var mx = mask.getContext('2d');
        mx.filter = 'blur(' + Math.round(OUT * 0.03) + 'px)';
        mx.fillStyle = '#fff';
        mx.beginPath();
        poly.forEach(function (p, i) { i ? mx.lineTo(p.x, p.y) : mx.moveTo(p.x, p.y); });
        mx.closePath(); mx.fill();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0);
        var nxs = poly.map(function (p) { return p.x / OUT; });
        var nys = poly.map(function (p) { return p.y / OUT; });
        lastShape = {
          oval: poly.map(function (p) { return { x: p.x / OUT, y: p.y / OUT }; }),
          box: {
            x: Math.min.apply(null, nxs), y: Math.min.apply(null, nys),
            w: Math.max.apply(null, nxs) - Math.min.apply(null, nxs),
            h: Math.max.apply(null, nys) - Math.min.apply(null, nys)
          }
        };
      } else {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      return c.toDataURL('image/png');
    }

    el.querySelector('[data-fm-next]').addEventListener('click', function () {
      lastCropDataUrl = renderCrop();
      if (session.profile) {
        // 프로필 사진 모드: 두더지 몸 합성 없이 원형 얼굴만 미리보기
        previewBox.innerHTML = '<div class="fm-preview-face-only"><img src="' + lastCropDataUrl + '" alt=""></div>';
        stage('preview');
      } else {
        // 게임과 동일하게 "얼굴+몸체 합성 완료" 이미지를 미리보기 (원본 사진 노출 없음)
        previewBox.innerHTML = '<div class="fm-preview-mole"><img src="' + MOLE_BODY + '" alt=""></div>';
        stage('preview');
        MG.MoleComposite.buildOne(lastCropDataUrl, null, 'mole1', lastShape).then(function (url) {
          var img = previewBox.querySelector('img');
          if (img) img.src = url;
        });
      }
    });
    el.querySelector('[data-fm-redo]').addEventListener('click', function () { stage('crop'); });
    el.querySelector('[data-fm-save]').addEventListener('click', function () {
      if (session.profile) {
        (session.onDone || onDone)(lastCropDataUrl);
        return;
      }
      dataUrlToBlob(lastCropDataUrl)
        .then(function (blob) { return MG.FaceStore.saveFace(blob, nameInput.value.trim(), null, lastShape); })
        .then(function (id) { MG.FaceStore.setActive(id); onDone(id); })
        .catch(function (err) {
          alert(root.FGH.I18N.t(err && err.message === 'full' ? 'mole.fm.full' : 'mole.fm.priv'));
        });
    });
    el.querySelectorAll('[data-fm-cancel]').forEach(function (b) {
      b.addEventListener('click', function () { onCancel(); });
    });
    function dataUrlToBlob(url) { return fetch(url).then(function (r) { return r.blob(); }); }

    return { open: open };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceMaker = api; }
})(typeof window !== 'undefined' ? window : null);
