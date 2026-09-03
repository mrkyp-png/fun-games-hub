(function (root) {
  'use strict';
  // 사진에서 얼굴 위치·윤곽을 찾는다. MediaPipe FaceMesh(vendor/face_mesh, 약 10MB) 를
  // 처음 쓸 때 한 번만 로드. 사람두더지 메이커에서만 호출 (게임/합성에서는 안 씀).
  //
  // detect(imgOrCanvas) -> Promise<{ ok, oval, box }>
  //   oval : 얼굴 윤곽 폴리곤 [{x,y}...] — 소스 이미지 픽셀 좌표 (못 찾으면 [])
  //   box  : {x,y,w,h} 윤곽 바운딩 박스
  //   ok   : 얼굴을 찾았는지
  var MG = root.MoleGame;

  // FACEMESH_FACE_OVAL — 이마 중앙(10)에서 시계방향으로 한 바퀴 도는 36개 경계점.
  var OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109
  ];

  var VENDOR = 'vendor/face_mesh/';
  var meshP = null;      // FaceMesh 인스턴스 (Promise)
  var pending = null;    // 현재 send() 의 resolve

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }

  function getMesh() {
    if (meshP) return meshP;
    meshP = (typeof FaceMesh !== 'undefined' ? Promise.resolve() : loadScript(VENDOR + 'face_mesh.js'))
      .then(function () {
        var m = new FaceMesh({ locateFile: function (f) { return VENDOR + f; } });
        m.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.4 });
        m.onResults(function (r) {
          var f = pending; pending = null;
          if (!f) return;
          var lm = r.multiFaceLandmarks && r.multiFaceLandmarks[0];
          f(lm || null);
        });
        return m;
      });
    return meshP;
  }

  function detect(src) {
    var w = src.naturalWidth || src.videoWidth || src.width;
    var h = src.naturalHeight || src.videoHeight || src.height;
    return getMesh().then(function (mesh) {
      return new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true; pending = null;
          resolve({ ok: false, oval: [], box: null });
        }, 8000);
        pending = function (lm) {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (!lm) { resolve({ ok: false, oval: [], box: null }); return; }
          var pts = OVAL.map(function (i) { return { x: lm[i].x * w, y: lm[i].y * h }; });
          var xs = pts.map(function (p) { return p.x; });
          var ys = pts.map(function (p) { return p.y; });
          var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
          var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
          resolve({ ok: true, oval: pts, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
        };
        mesh.send({ image: src }).catch(function () {
          if (settled) return;
          settled = true; clearTimeout(timer); pending = null;
          resolve({ ok: false, oval: [], box: null });
        });
      });
    }).catch(function () {
      return { ok: false, oval: [], box: null };
    });
  }

  // 폴리곤을 살짝 바깥으로 부풀린다 (윤곽 안쪽으로 잘리는 것 방지, 페더 여유).
  function expand(oval, factor) {
    if (!oval.length) return oval;
    var cx = 0, cy = 0;
    oval.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= oval.length; cy /= oval.length;
    return oval.map(function (p) {
      return { x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor };
    });
  }

  var api = { detect: detect, expand: expand, OVAL: OVAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = { FaceDetect: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceDetect = api; }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
