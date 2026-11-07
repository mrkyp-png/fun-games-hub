/* V1653 C 사용자: 광장 글자 = 둥근 글씨체 + 꾸밈 2가지
   - candy(B): 갈색 외곽선 + 흰 안선 + 위 밝고 아래 진한 색(사탕) — 밝은 판(간판·게시판)
   - neon(B 단어마다 색): 어두운 판(게임기 제목 줄·리듬팡)
   글씨체: 한국어 Cafe24 써라운드, 영어·일본어 Mochiy Pop One(OFL) — mole/assets/fonts */
(function (root) {
  'use strict';
  const NEON = ['#ff5fd2', '#ffe14d', '#4fd8ff', '#7dff8a', '#b47dff', '#ff8a4d'];
  const fontOf = (lang, s) => (lang === 'ko' ? s + "px Cafe24Ssurround, 'Mochiy Pop One', Jua, sans-serif" : s + "px 'Mochiy Pop One', Cafe24Ssurround, sans-serif");

  // 폭(maxW)에 맞게 글자 크기 줄임 → 쓴 크기
  function fit(g, txt, lang, size, maxW) { g.font = fontOf(lang, size); const w = g.measureText(txt).width; if (w > maxW) { size = size * maxW / w; g.font = fontOf(lang, size); } return size; }

  // 사탕 글씨: top·bot = 앞면 위·아래 색
  function candy(g, txt, x, y, size, lang, maxW, top, bot) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const s = fit(g, txt, lang, size, maxW);
    g.lineWidth = s * 0.24; g.strokeStyle = '#6b3a1e'; g.strokeText(txt, x, y + s * 0.05); g.strokeText(txt, x, y);
    g.lineWidth = s * 0.1; g.strokeStyle = '#fff'; g.strokeText(txt, x, y);
    const gr = g.createLinearGradient(0, y - s / 2, 0, y + s / 2); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillText(txt, x, y);
    g.restore();
  }

  // 네온(단어마다 색): start = 첫 단어 색 번호
  function neon(g, txt, x, y, size, lang, maxW, start) {
    g.save(); g.textBaseline = 'middle'; g.lineJoin = 'round';
    const s = fit(g, txt, lang, size, maxW), words = txt.split(' '), sp = g.measureText(' ').width;
    const ws = words.map((w) => g.measureText(w).width), total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = x - total / 2; g.textAlign = 'left';
    words.forEach((w, i) => { const col = NEON[((start || 0) + i) % NEON.length];
      g.shadowColor = col; g.shadowBlur = s * 0.4; g.lineWidth = s * 0.09; g.strokeStyle = col; g.strokeText(w, cx, y);
      g.shadowBlur = s * 0.18; g.strokeText(w, cx, y); g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillText(w, cx, y);
      cx += ws[i] + sp; });
    g.restore();
  }

  // 글씨체 미리 불러오기(캔버스는 글씨체가 준비된 뒤 그려야 함) → Promise
  function ready() {
    const d = root.document; if (!d || !d.fonts || !d.fonts.load) return Promise.resolve();
    return Promise.all([d.fonts.load(fontOf('ko', 40), '상점'), d.fonts.load(fontOf('en', 40), 'Shopアマ')]).catch(() => {});
  }

  const api = { NEON, fontOf, fit, candy, neon, ready };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.Home3DText = api;
})(typeof window !== 'undefined' ? window : globalThis);
