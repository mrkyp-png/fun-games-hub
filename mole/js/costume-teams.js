(function (root) {
  'use strict';
  // Three team costumes share their effect definitions across inventory, shop, workshop and game.
  var K_OWNED = 'mole.costume.owned';
  var K_EQUIPPED = 'mole.costume.equipped';
  var K_LEVEL = 'mole.costume.level.'; // + id

  // V1405 C 사용자: 5팀 → 3팀(베어스·스타즈·컵스). 레드 윙스·선 자이언츠 삭제(그림 파일은 남겨둠).
  var TEAMS = [
    { id: 'blue_bears', nameKo: '블루 베어스', nameEn: 'Blue Bears', effect: 'HOLD_TIME' },
    { id: 'mount_stars', nameKo: '마운트 스타즈', nameEn: 'Mount Stars', effect: 'SAFE_CHANCE' },
    { id: 'cloud_cups', nameKo: '클라우드 컵스', nameEn: 'Cloud Cups', effect: 'DOUBLE_HIT' }
  ];

  var EFFECT_TYPE = 'HOLD_TIME';
  var BASE_EFFECT_VALUE = 0.1;
  var MAX_UPGRADE_LEVEL = 5;
  var DOUBLE_HIT_UPGRADE_STEP = null; // Unconfirmed: no enhancement bonus until explicitly configured.
  var EFFECTS = {
    HOLD_TIME: { key: 'mole.cos.holdTime', base: BASE_EFFECT_VALUE, step: 0.05, unit: 'seconds' },
    SAFE_CHANCE: { key: 'mole.cos.safeChance', base: 0.1, step: 0.01, unit: 'percent' },
    DOUBLE_HIT: { key: 'mole.cos.doubleHit', base: 0.1, step: DOUBLE_HIT_UPGRADE_STEP, unit: 'percent' }
  };

  function teams() { return TEAMS.slice(); }
  function teamById(id) { return TEAMS.filter(function (t) { return t.id === id; })[0] || null; }

  // Shop acquisition and workshop materials share ItemInventory; demo saves migrate once.
  function ownedIds() {
    var a;
    try { a = JSON.parse(localStorage.getItem(K_OWNED)); } catch (e) { a = null; }
    if (!Array.isArray(a)) a = [];
    return a.filter(function (id) { return !!teamById(id); }); // 삭제된 팀 저장값은 무시
  }
  function owns(id) { return root.MoleGame.ItemInventory.owns('costume', id); }

  // 기본 착용 = 블루베어스(참고 이미지 기준). 한 번도 착용 안 바꿨으면 이 기본값을 쓴다.
  function equippedId() {
    var id = localStorage.getItem(K_EQUIPPED) || TEAMS[0].id;
    if (!teamById(id)) id = TEAMS[0].id; // 삭제된 팀(윙스·자이언츠) 착용 중이었으면 베어스로
    return owns(id) ? id : null;
  }
  function equip(id) {
    if (!owns(id)) return false;
    localStorage.setItem(K_EQUIPPED, id);
    return true;
  }

  // Preserve the existing stored level offset (+0 is stored as 1).
  function upgradeLevel(id) {
    var n = parseInt(localStorage.getItem(K_LEVEL + id), 10);
    return (n >= 1 && n <= MAX_UPGRADE_LEVEL + 1) ? n : 1;
  }
  function enhanceLevel(id) { return upgradeLevel(id) - 1; }
  function setEnhanceLevel(id, n) { localStorage.setItem(K_LEVEL + id, String(Math.max(0, Math.min(MAX_UPGRADE_LEVEL, n)) + 1)); }
  function effectInfo(id, level) {
    var team = teamById(id); if (!team) return null;
    var rule = EFFECTS[team.effect];
    var lv = level == null ? enhanceLevel(id) : Math.max(0, Math.min(MAX_UPGRADE_LEVEL, level));
    return { type: team.effect, key: rule.key, unit: rule.unit, base: rule.base, step: rule.step,
      level: lv, bonus: (rule.step || 0) * lv, value: rule.base + (rule.step || 0) * lv };
  }
  function effectValue(id) { var info = effectInfo(id); return info ? info.value : 0; }
  function effectLabel(id) { var info = effectInfo(id); return info ? root.FGH.I18N.t(info.key) : ''; }
  function formatEffectValue(id, level) {
    var info = effectInfo(id, level); if (!info) return '';
    return info.unit === 'percent' ? Math.round(info.value * 100) + '%' : '+' + info.value.toFixed(2).replace(/0$/, '') + (root.FGH.I18N.lang === 'en' ? 's' : '초');
  }
  function activeEffects() {
    var info = effectInfo(equippedId());
    return { holdTime: info && info.type === 'HOLD_TIME' ? info.value : 0,
      safeChance: info && info.type === 'SAFE_CHANCE' ? info.value : 0,
      doubleHitChance: info && info.type === 'DOUBLE_HIT' ? info.value : 0 };
  }

  // 현재 착용중인 코스튬의 효과값(초) — 없으면 0. 제작소 강화(§21~22)가 레벨을 올리면
  // 여기서 바로 반영된다(저장값만 읽으므로).
  function activeEffectValue() {
    return activeEffects().holdTime;
  }

  var api = {
    TEAMS: TEAMS, EFFECT_TYPE: EFFECT_TYPE, BASE_EFFECT_VALUE: BASE_EFFECT_VALUE, MAX_UPGRADE_LEVEL: MAX_UPGRADE_LEVEL,
    teams: teams, teamById: teamById, owns: owns, equippedId: equippedId, equip: equip,
    upgradeLevel: upgradeLevel, enhanceLevel: enhanceLevel, setEnhanceLevel: setEnhanceLevel, effectValue: effectValue, activeEffectValue: activeEffectValue,
    EFFECTS: EFFECTS, DOUBLE_HIT_UPGRADE_STEP: DOUBLE_HIT_UPGRADE_STEP, effectInfo: effectInfo, effectLabel: effectLabel, formatEffectValue: formatEffectValue, activeEffects: activeEffects
  };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.CostumeTeams = api; }
})(typeof window !== 'undefined' ? window : null);
