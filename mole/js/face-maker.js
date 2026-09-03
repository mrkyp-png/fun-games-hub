(function (root) {
  'use strict';
  // 사진 선택 → 원형 크롭 → 미리보기 → 저장. 원본 사진은 메모리에서만 쓰고 저장 안 함.
  var MG = root.MoleGame;
  var OUT = 256;
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

    function stage(name) {
      el.querySelectorAll('[data-fm-stage]').forEach(function (s) {
        s.hidden = (s.getAttribute('data-fm-stage') !== name);
      });
    }
    function open(o) {
      var forced = !!(o && o.forced);
      el.querySelectorAll('[data-fm-cancel]').forEach(function (b) { b.hidden = forced; });
      fileInput.value = '';
      nameInput.value = '';
      lastCropDataUrl = null;
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
        };
        cropImg.src = reader.result;
      };
      reader.readAsDataURL(f);
    });

    function boxSize() { var r = cropBox.getBoundingClientRect(); return { w: r.width, h: r.height }; }
    function minScale() { var b = boxSize(); return Math.max(b.w / natural.w, b.h / natural.h); }
    function resetView() { view.scale = minScale(); view.x = 0; view.y = 0; clampView(); }
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

    function renderCrop() {
      var b = boxSize();
      var srcSize = b.w / view.scale;
      var srcX = (natural.w * view.scale / 2 - view.x - b.w / 2) / view.scale;
      var srcY = (natural.h * view.scale / 2 - view.y - b.h / 2) / view.scale;
      var c = document.createElement('canvas');
      c.width = OUT; c.height = OUT;
      var ctx = c.getContext('2d');
      ctx.drawImage(cropImg, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
      ctx.fill();
      return c.toDataURL('image/png');
    }

    el.querySelector('[data-fm-next]').addEventListener('click', function () {
      lastCropDataUrl = renderCrop();
      var a = MG.MoleSprites.headAnchor('mole1');
      previewBox.innerHTML =
        '<div class="fm-preview-mole"><img class="fm-preview-body" src="' + MOLE_BODY + '" alt="">' +
        '<img class="fm-preview-face" src="' + lastCropDataUrl + '" alt=""></div>';
      var face = previewBox.querySelector('.fm-preview-face');
      face.style.left = (a.cx * 100) + '%';
      face.style.top = (a.cy * 100) + '%';
      face.style.width = (a.r * 2 * 100) + '%';
      stage('preview');
    });
    el.querySelector('[data-fm-redo]').addEventListener('click', function () { stage('crop'); });
    el.querySelector('[data-fm-save]').addEventListener('click', function () {
      dataUrlToBlob(lastCropDataUrl)
        .then(function (blob) { return MG.FaceStore.saveFace(blob, nameInput.value.trim()); })
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
