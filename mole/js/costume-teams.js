(function (root) {
  'use strict';
  // 코스튬(야구팀) — 모자+상의 세트 단위, 5종. 코스튬 화면(inventory-screen.js 'costume' 탭)과
  // 게임의 두더지 하강 딜레이 효과가 이 모듈을 공유한다. 명세서: 바탕화면 "코스튬 UI 및 에셋/명세서.txt".
  var K_OWNED = 'mole.costume.owned';
  var K_EQUIPPED = 'mole.costume.equipped';
  var K_LEVEL = 'mole.costume.level.'; // + id

  var TEAMS = [
    { id: 'blue_bears', nameKo: '블루 베어스', nameEn: 'Blue Bears' },
    { id: 'red_wings', nameKo: '레드윙스', nameEn: 'Red Wings' },
    { id: 'mount_stars', nameKo: '마운트스타즈', nameEn: 'Mount Stars' },
    { id: 'sun_giants', nameKo: '선자이언츠', nameEn: 'Sun Giants' },
    { id: 'cloud_cups', nameKo: '클라우드컵스', nameEn: 'Cloud Cups' }
  ];

  var EFFECT_TYPE = 'MOLE_DESCENT_DELAY';
  var BASE_EFFECT_VALUE = 0.1;
  var MAX_UPGRADE_LEVEL = 5;

  function teams() { return TEAMS.slice(); }
  function teamById(id) { return TEAMS.filter(function (t) { return t.id === id; })[0] || null; }

  // 지금은 상점/이벤트 획득 경로가 아직 없어(§24) 데모 상태로 5종 전부 보유 처리.
  // 실제 획득 로직이 붙으면 이 기본값만 [] 로 바꾸면 됨 — 구조는 이미 확장 가능.
  function ownedIds() {
    var a;
    try { a = JSON.parse(localStorage.getItem(K_OWNED)); } catch (e) { a = null; }
    if (!a) a = TEAMS.map(function (t) { return t.id; });
    return a;
  }
  function owns(id) { return ownedIds().indexOf(id) > -1; }

  // 기본 착용 = 블루베어스(참고 이미지 기준). 한 번도 착용 안 바꿨으면 이 기본값을 쓴다.
  function equippedId() {
    var id = localStorage.getItem(K_EQUIPPED) || TEAMS[0].id;
    return owns(id) ? id : null;
  }
  function equip(id) {
    if (!owns(id)) return false;
    localStorage.setItem(K_EQUIPPED, id);
    return true;
  }

  function upgradeLevel(id) {
    var n = parseInt(localStorage.getItem(K_LEVEL + id), 10);
    return (n >= 1 && n <= MAX_UPGRADE_LEVEL) ? n : 1;
  }

  // 현재 착용중인 코스튬의 효과값(초) — 없으면 0. 제작소 강화(§21~22)가 레벨을 올리면
  // 여기서 바로 반영된다(저장값만 읽으므로).
  function activeEffectValue() {
    var id = equippedId();
    if (!id) return 0;
    return BASE_EFFECT_VALUE * upgradeLevel(id);
  }

  var api = {
    TEAMS: TEAMS, EFFECT_TYPE: EFFECT_TYPE, BASE_EFFECT_VALUE: BASE_EFFECT_VALUE, MAX_UPGRADE_LEVEL: MAX_UPGRADE_LEVEL,
    teams: teams, teamById: teamById, owns: owns, equippedId: equippedId, equip: equip,
    upgradeLevel: upgradeLevel, activeEffectValue: activeEffectValue
  };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.CostumeTeams = api; }
})(typeof window !== 'undefined' ? window : null);
