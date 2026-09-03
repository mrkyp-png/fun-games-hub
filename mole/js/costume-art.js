(function (root) {
  'use strict';
  // 꾸미기 칩(선택 목록) 썸네일 — 임시 인라인 SVG. 실제 아트 오면 교체.
  function svg(inner) {
    return '<svg viewBox="0 0 40 40" class="cs-thumb" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  var HAT = {
    none: '<line x1="10" y1="20" x2="30" y2="20" stroke="#888" stroke-width="2"/>',
    helmet: '<path d="M8 24a12 9 0 0 1 24 0z" fill="#d23c2e"/><rect x="6" y="23" width="28" height="3" fill="#b53125"/>',
    hardhat: '<path d="M8 24a12 9 0 0 1 24 0z" fill="#f2a900"/><rect x="6" y="23" width="28" height="3" fill="#d68f00"/>',
    cap: '<path d="M9 24a11 8 0 0 1 22 0z" fill="#2b6cb0"/><ellipse cx="27" cy="25" rx="9" ry="2.5" fill="#2b6cb0"/>',
    party: '<path d="M20 8 L12 30 L28 30 Z" fill="#e14bd0"/><circle cx="20" cy="8" r="2.5" fill="#ffd93b"/>',
    crown: '<path d="M8 28 L8 15 L14 21 L20 12 L26 21 L32 15 L32 28 Z" fill="#f2c14e"/>'
  };
  var GLASS = {
    none: '<line x1="11" y1="20" x2="29" y2="20" stroke="#6d6d76" stroke-width="2.5" stroke-linecap="round"/>',
    round: '<circle cx="14" cy="20" r="6" fill="none" stroke="#cfcfd4" stroke-width="2.5"/><circle cx="26" cy="20" r="6" fill="none" stroke="#cfcfd4" stroke-width="2.5"/><line x1="20" y1="20" x2="20" y2="20" stroke="#cfcfd4" stroke-width="2.5"/>',
    sun: '<ellipse cx="14" cy="20" rx="7" ry="5.5" fill="#2b2b33" stroke="#8a8a92" stroke-width="1.5"/><ellipse cx="26" cy="20" rx="7" ry="5.5" fill="#2b2b33" stroke="#8a8a92" stroke-width="1.5"/>',
    goggle: '<ellipse cx="14" cy="20" rx="7.5" ry="6" fill="#9ccfe0" stroke="#c79a4e" stroke-width="2"/><ellipse cx="26" cy="20" rx="7.5" ry="6" fill="#9ccfe0" stroke="#c79a4e" stroke-width="2"/>',
    monocle: '<circle cx="24" cy="20" r="7" fill="none" stroke="#f2c14e" stroke-width="2.5"/>'
  };
  var BODY = {
    default: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#9a6c4c"/>',
    gray: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#9a9aa4"/>',
    tux: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#9a6c4c"/><path d="M20 12 L14 38 L26 38 Z" fill="#1c1c26"/>',
    hoodie: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#5a78c8"/>',
    work: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#c79a4e"/>',
    robe: '<ellipse cx="20" cy="24" rx="12" ry="14" fill="#7b3f8f"/>'
  };
  var MAP = { hat: HAT, body: BODY, glasses: GLASS };

  function chip(cat, id) {
    var inner = (MAP[cat] && MAP[cat][id]) || '<circle cx="20" cy="20" r="6" fill="#555"/>';
    return svg(inner);
  }

  var api = { chip: chip };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.CostumeArt = api; }
})(typeof window !== 'undefined' ? window : null);
