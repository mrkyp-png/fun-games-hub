(function (root) {
  'use strict';
  // 스킬 시스템 — 액티브 5종 + 패시브 2종, 무기별 독립 Loadout + 공용 Inventory.
  // costume-teams.js 와 같은 패턴(모듈이 localStorage 를 직접 소유, 화면/게임은 이 API만 사용).
  // 명세서: 바탕화면 "스킬 UI 및 에셋/명세서.txt".
  var K_INVENTORY = 'mole.skill.inventory';
  var K_LOADOUTS = 'mole.skill.loadouts';

  var SKILLS = [
    { id: 'freeze', type: 'ACTIVE', nameKo: '빙결', nameEn: 'Freeze', icon: 'assets/skills/freeze.png' },
    { id: 'goldDouble', type: 'ACTIVE', nameKo: '골드 2배', nameEn: 'Gold x2', icon: 'assets/skills/gold_double.png' },
    { id: 'targeting', type: 'ACTIVE', nameKo: '타겟팅', nameEn: 'Targeting', icon: 'assets/skills/targeting.png' },
    { id: 'carpetBombing', type: 'ACTIVE', nameKo: '융단폭격', nameEn: 'Carpet Bombing', icon: 'assets/skills/carpet_bombing.png' },
    { id: 'ai', type: 'ACTIVE', nameKo: 'AI', nameEn: 'AI', icon: 'assets/skills/ai.png' },
    { id: 'shield', type: 'PASSIVE', nameKo: '실드', nameEn: 'Shield', icon: 'assets/skills/shield.png' },
    { id: 'feverTime', type: 'PASSIVE', nameKo: '피버타임 증가', nameEn: 'Fever Time Up', icon: 'assets/skills/fever_time.png' }
  ];

  // 무기별 슬롯 — hammer(뿅망치)는 명세서에 없음(스킬 미지원 무기, laneSkillZone=false).
  var WEAPON_SLOTS = {
    goldhammer: { active: 2, passive: 2 },
    cannon: { active: 2, passive: 2 },
    alipunch: { active: 4, passive: 2 }
  };

  // 데모 기본 수량 — 아직 상점/보물상자 지급 경로가 없어(§46~49) 사용자 지정으로 테스트용
  // 1000개씩 시드(2026-09-26, "테스트용으로 할려면 필요합니다. 패시브 스킬도").
  // 실제 지급 경로가 생기면 이 기본값만 {}(전부 0)로 바꾸면 됨 — 구조는 이미 확장 가능.
  var DEFAULT_INVENTORY = {
    freeze: 1000, goldDouble: 1000, targeting: 1000, carpetBombing: 1000, ai: 1000,
    shield: 1000, feverTime: 1000
  };

  function skillById(id) {
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }
  function activeSkills() { return SKILLS.filter(function (s) { return s.type === 'ACTIVE'; }); }
  function passiveSkills() { return SKILLS.filter(function (s) { return s.type === 'PASSIVE'; }); }
  function slotsFor(weaponId) { return WEAPON_SLOTS[weaponId] || { active: 0, passive: 0 }; }

  // ---- Inventory ----
  function loadInventory() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(K_INVENTORY)); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') raw = {};
    var out = {};
    SKILLS.forEach(function (s) {
      var n = raw[s.id];
      out[s.id] = (Number.isFinite(n) && n >= 0) ? Math.floor(n) : (raw.hasOwnProperty(s.id) ? 0 : DEFAULT_INVENTORY[s.id] || 0);
    });
    return out;
  }
  function saveInventory(inv) {
    try { localStorage.setItem(K_INVENTORY, JSON.stringify(inv)); } catch (e) { /* 저장 실패 무시 */ }
  }
  function getQuantity(id) { return loadInventory()[id] || 0; }
  // 모든 지급 경로(상점 구매/보물상자/일일 보상/퀘스트)가 공통으로 쓰는 단일 증가 함수(§46).
  function addQuantity(id, n) {
    if (!skillById(id) || !(n > 0)) return getQuantity(id);
    var inv = loadInventory();
    inv[id] = Math.max(0, (inv[id] || 0) + Math.floor(n));
    saveInventory(inv);
    return inv[id];
  }
  // 액티브 사용/패시브 적용 시 -1. 수량 0이면 실패(음수 방지, §81). 0이 되면 현재 Loadout에서 자동 해제.
  function consumeOne(id) {
    var inv = loadInventory();
    var cur = inv[id] || 0;
    if (cur <= 0) return false;
    inv[id] = cur - 1;
    saveInventory(inv);
    if (inv[id] === 0) unequipEverywhere(id);
    return true;
  }

  // ---- Loadouts (무기별 독립) ----
  function defaultLoadouts() {
    var out = {};
    Object.keys(WEAPON_SLOTS).forEach(function (w) { out[w] = { activeSkills: [], passiveSkills: [] }; });
    return out;
  }
  function loadLoadouts() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(K_LOADOUTS)); } catch (e) { raw = null; }
    var out = defaultLoadouts();
    if (raw && typeof raw === 'object') {
      Object.keys(out).forEach(function (w) {
        var slots = slotsFor(w);
        var src = raw[w] || {};
        out[w].activeSkills = sanitizeList(src.activeSkills, 'ACTIVE', slots.active);
        out[w].passiveSkills = sanitizeList(src.passiveSkills, 'PASSIVE', slots.passive);
      });
    }
    return out;
  }
  // 저장된 값 중 유효하지 않은 스킬 id·타입 불일치·중복·슬롯초과는 안전하게 걸러낸다(§80 예외 처리).
  function sanitizeList(arr, type, maxSlots) {
    if (!Array.isArray(arr)) return [];
    var seen = {};
    var out = [];
    arr.forEach(function (id) {
      var s = skillById(id);
      if (!s || s.type !== type || seen[id] || out.length >= maxSlots) return;
      seen[id] = true;
      out.push(id);
    });
    return out;
  }
  function saveLoadouts(all) {
    try { localStorage.setItem(K_LOADOUTS, JSON.stringify(all)); } catch (e) { /* 저장 실패 무시 */ }
  }
  function loadoutFor(weaponId) {
    var all = loadLoadouts();
    return all[weaponId] || { activeSkills: [], passiveSkills: [] };
  }

  function listFieldFor(type) { return type === 'ACTIVE' ? 'activeSkills' : 'passiveSkills'; }
  function maxFieldFor(type) { return type === 'ACTIVE' ? 'active' : 'passive'; }

  // 장착/해제 토글. locked(게임 중)면 거부. 중복·슬롯초과·수량0이면 장착 거부(§43).
  function toggleEquip(weaponId, skillId, locked) {
    if (locked) return { ok: false, reason: 'locked' };
    var skill = skillById(skillId);
    if (!skill) return { ok: false, reason: 'invalid-skill' };
    var slots = slotsFor(weaponId);
    if (!slots.active && !slots.passive) return { ok: false, reason: 'invalid-weapon' };
    var all = loadLoadouts();
    var lo = all[weaponId];
    var field = listFieldFor(skill.type);
    var idx = lo[field].indexOf(skillId);
    if (idx > -1) {
      lo[field].splice(idx, 1);
      saveLoadouts(all);
      return { ok: true, equipped: false };
    }
    if (getQuantity(skillId) <= 0) return { ok: false, reason: 'no-quantity' };
    if (lo[field].length >= slots[maxFieldFor(skill.type)]) return { ok: false, reason: 'slots-full' };
    lo[field].push(skillId);
    saveLoadouts(all);
    return { ok: true, equipped: true };
  }
  // 수량이 0이 된 스킬은 모든 무기의 Loadout에서 자동 해제(§33, §62).
  function unequipEverywhere(skillId) {
    var all = loadLoadouts();
    var changed = false;
    Object.keys(all).forEach(function (w) {
      ['activeSkills', 'passiveSkills'].forEach(function (field) {
        var idx = all[w][field].indexOf(skillId);
        if (idx > -1) { all[w][field].splice(idx, 1); changed = true; }
      });
    });
    if (changed) saveLoadouts(all);
  }
  // 복원 — 현재 무기 하나만 빈 Loadout으로. Inventory 환불 아님(§50~51).
  // type('ACTIVE'|'PASSIVE') 지정 시 그쪽 슬롯만 복원(사용자 지정: 액티브/패시브 박스마다
  // 개별 복원 버튼), 생략 시 무기 전체(액티브+패시브 둘 다) 복원.
  function restore(weaponId, type) {
    var all = loadLoadouts();
    if (!all[weaponId]) return;
    if (type === 'ACTIVE') all[weaponId].activeSkills = [];
    else if (type === 'PASSIVE') all[weaponId].passiveSkills = [];
    else all[weaponId] = { activeSkills: [], passiveSkills: [] };
    saveLoadouts(all);
  }

  // 게임 시작 시 스냅샷 — 이후 PLAYING 중에는 이 값을 그대로 쓴다(§64). 패시브는 여기서 바로
  // 소비(-1)까지 확정한다(§30, §61). 수량 부족한 패시브는 적용/소비하지 않고 목록에서 제외(§62).
  function snapshotForGameStart(weaponId) {
    var lo = loadoutFor(weaponId);
    var active = lo.activeSkills.slice();
    var passiveApplied = [];
    lo.passiveSkills.forEach(function (id) {
      if (consumeOne(id)) passiveApplied.push(id);
      else unequipEverywhere(id); // 장착 중인데 수량이 이미 0 — 적용 못 하니 Loadout에서도 해제(§62)
    });
    return { weaponId: weaponId, activeSkills: active, passiveApplied: passiveApplied };
  }

  var api = {
    SKILLS: SKILLS, WEAPON_SLOTS: WEAPON_SLOTS,
    skillById: skillById, activeSkills: activeSkills, passiveSkills: passiveSkills, slotsFor: slotsFor,
    getQuantity: getQuantity, addQuantity: addQuantity, consumeOne: consumeOne,
    loadoutFor: loadoutFor, toggleEquip: toggleEquip, restore: restore,
    snapshotForGameStart: snapshotForGameStart
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Skills: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Skills = api; }
})(typeof window !== 'undefined' ? window : null);
