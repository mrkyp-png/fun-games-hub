/* 3D 간판 글자: 건물 이름을 캔버스에 그려 Sign_<action> 판 앞면 텍스처로.
   언어 변경 때만 build(), 이전 텍스처는 지운다(렌더 루프에서 만들지 않음). */
(function (root) {
  'use strict';
  const W = 512, H = 160;

  function labelFor(site, lang, t) {
    if (site.action === 'locker' && lang !== 'ko') return 'Workshop'; // 사용자 지정(간판 전용, 기존 번역 'Photos' 유지)
    return t(site.labelKey).replace(/\n/g, ' ');
  }

  function create(gl, opts) {
    const makeCanvas = (opts && opts.makeCanvas) || (() => document.createElement('canvas'));
    let tex = new Map();
    function draw(text) {
      const c = makeCanvas(); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#e8c98f'; g.lineWidth = 10; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 26); g.stroke();
      let size = 96;
      g.font = '800 ' + size + 'px system-ui,sans-serif';
      while (g.measureText(text).width > W - 70 && size > 30) { size -= 4; g.font = '800 ' + size + 'px system-ui,sans-serif'; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#5b3d26'; g.fillText(text, W / 2, H / 2 + 4);
      return c;
    }
    function dispose() { for (const t of tex.values()) gl.deleteTexture(t); tex = new Map(); }
    function build(lang, sites, t) {
      dispose();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // glTF UV 는 v=0 이 위쪽 — 캔버스 그대로
      for (const s of sites) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, draw(labelFor(s, lang, t)));
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex.set(s.action, texture);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return tex;
    }
    return { build, dispose, get: (action) => tex.get(action) };
  }

  const api = { create, labelFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DSigns = api;
})(typeof window !== 'undefined' ? window : globalThis);
