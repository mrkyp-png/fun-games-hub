(function (root) {
  'use strict';
  // 원형 크롭한 얼굴 + 두더지 포즈 스프라이트를 캔버스에서 하나로 합성한다.
  // 결과 = 포즈별 완성 두더지 PNG(objectURL) 맵. 게임은 이 이미지만 그린다 (레이어 X, 원본 사진 X).
  var MG = root.MoleGame;
  var POSES = ['mole1', 'mole2', 'mole3', 'mole4', 'mole5', 'mole6', 'mole7', 'mole8', 'peek1', 'peek2', 'helmet'];
  var CW = 470, CH = 548; // 스프라이트 캔버스 (mole-sprites 와 동일 비율)

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('img load: ' + src)); };
      im.src = src;
    });
  }

  function drawPose(faceImg, spriteImg, pose) {
    var a = MG.MoleSprites.headAnchor(pose);
    var c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    var ctx = c.getContext('2d');
    ctx.drawImage(spriteImg, 0, 0, CW, CH);              // 1) 두더지 몸체
    var cx = a.cx * CW, cy = a.cy * CH, r = a.r * CW;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();                                          // 2) 얼굴 영역 원형 클립
    ctx.drawImage(faceImg, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return new Promise(function (res) {
      c.toBlob(function (blob) { res(URL.createObjectURL(blob)); }, 'image/png');
    });
  }

  // faceSrc: 원형 크롭 얼굴 PNG(dataURL/objectURL) → { mole1: url, ..., helmet: url }
  function build(faceSrc) {
    return loadImg(faceSrc).then(function (faceImg) {
      return Promise.all(POSES.map(function (pose) {
        return loadImg(MG.MoleSprites.spriteUrl(pose))
          .then(function (spriteImg) { return drawPose(faceImg, spriteImg, pose); })
          .then(function (url) { return [pose, url]; });
      })).then(function (pairs) {
        var map = {};
        pairs.forEach(function (p) { map[p[0]] = p[1]; });
        return map;
      });
    });
  }

  // 미리보기용 — 한 포즈만
  function buildOne(faceSrc, pose) {
    return Promise.all([loadImg(faceSrc), loadImg(MG.MoleSprites.spriteUrl(pose))])
      .then(function (r) { return drawPose(r[0], r[1], pose); });
  }

  function revoke(map) {
    if (!map) return;
    Object.keys(map).forEach(function (k) { URL.revokeObjectURL(map[k]); });
  }

  var api = { build: build, buildOne: buildOne, revoke: revoke, POSES: POSES };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.MoleComposite = api; }
})(typeof window !== 'undefined' ? window : null);
