(function (root) {
  'use strict';
  // 사람두더지 꾸미기.
  //  - 상점에서 "세트"(몸+모자+안경 테마 묶음)를 코인으로 산다 (세트 = 구매 단위).
  //  - 꾸미기 화면에선 산 세트들의 아이템을 부위별로 자유롭게 섞는다 (모자/얼굴/몸/안경 4줄).
  //  - 선택 조합은 face 레코드에 { body, hat, glasses } id 로만 저장. 최종 8포즈 이미지는
  //    mole-composite 가 그때그때 합성한다.
  var K_SETS = 'mole.ownedSets';

  // 아트는 사용자가 나중에 준다 — 지금 id 만. thumb 는 임시 도형(costume-art.js).
  var SETS = [
    { id: 'starter', price: 0, name: '기본', body: 'default', hat: 'helmet', glasses: 'none' },
    { id: 'construction', price: 900, name: '공사장', body: 'work', hat: 'hardhat', glasses: 'goggle' },
    { id: 'street', price: 1000, name: '스트릿', body: 'hoodie', hat: 'cap', glasses: 'sun' },
    { id: 'party', price: 1300, name: '파티', body: 'tux', hat: 'party', glasses: 'round' },
    { id: 'royal', price: 2500, name: '로얄', body: 'robe', hat: 'crown', glasses: 'monocle' }
  ];

  var CATS = ['hat', 'body', 'glasses']; // 얼굴은 사진이라 카탈로그 밖
  var DEFAULT = { body: 'default', hat: 'helmet', glasses: 'none' };

  function sets() { return SETS.slice(); }
  function setById(id) { return SETS.filter(function (s) { return s.id === id; })[0] || null; }

  function ownedSetIds() {
    var a;
    try { a = JSON.parse(localStorage.getItem(K_SETS)) || []; } catch (e) { a = []; }
    if (a.indexOf('starter') === -1) a = ['starter'].concat(a);
    return a;
  }
  function ownsSet(id) { return ownedSetIds().indexOf(id) > -1; }
  function buySet(id) {
    var s = setById(id);
    if (!s || ownsSet(id)) return true;
    if (!root.MoleGame.Economy.spendCoins(s.price)) return false;
    var a = ownedSetIds();
    a.push(id);
    localStorage.setItem(K_SETS, JSON.stringify(a));
    return true;
  }

  // 부위별 전체 아이템 목록 = 모든 세트의 그 부위 아이템 (중복 제거) + 보유 여부 + 어느 세트인지.
  function items(cat) {
    var seen = {};
    var out = [];
    SETS.forEach(function (s) {
      var id = s[cat];
      if (!id || seen[id]) return;
      seen[id] = 1;
      out.push({ id: id, setId: s.id, setName: s.name, owned: ownsSet(s.id), price: s.price });
    });
    // 'none' 은 항상 맨 앞·항상 보유
    var noneIx = out.findIndex(function (i) { return i.id === 'none'; });
    if (noneIx > 0) out.unshift(out.splice(noneIx, 1)[0]);
    return out;
  }
  function owns(cat, id) {
    return items(cat).some(function (i) { return i.id === id && i.owned; });
  }
  function setContaining(cat, id) {
    var it = items(cat).filter(function (i) { return i.id === id; })[0];
    return it ? it.setId : null;
  }

  function normalize(c) {
    c = c || {};
    var out = {};
    CATS.forEach(function (cat) {
      out[cat] = owns(cat, c[cat]) ? c[cat] : DEFAULT[cat];
    });
    return out;
  }

  var api = {
    SETS: SETS, CATS: CATS, DEFAULT: DEFAULT,
    sets: sets, setById: setById, ownedSetIds: ownedSetIds, ownsSet: ownsSet, buySet: buySet,
    items: items, owns: owns, setContaining: setContaining, normalize: normalize
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Costume: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Costume = api; }
})(typeof window !== 'undefined' ? window : null);
