(function (root) {
  'use strict';
  // Shared acquisition ledger. Existing storage keys remain readable by older screens.
  var WEAPONS = ['cannon', 'goldhammer', 'alipunch'];
  var COSTUMES = ['blue_bears', 'mount_stars', 'cloud_cups'];
  var SKILLS = ['shield', 'targeting', 'ai'];
  var VERSION = 'mole.items.connected.v1', JOURNAL = 'mole.items.pending.v1';
  var CATALOG = {
    'weapon.cannon': { price: 100000, kind: 'weapon', grants: { cannon: 1 } },
    'weapon.goldhammer': { price: 500000, kind: 'weapon', grants: { goldhammer: 1 } },
    'weapon.alipunch': { price: 1000000, kind: 'weapon', grants: { alipunch: 1 } },
    'costume.blue_bears': { price: 100000, kind: 'costume', grants: { blue_bears: 1 } },
    'costume.mount_stars': { price: 100000, kind: 'costume', grants: { mount_stars: 1 } },
    'costume.cloud_cups': { price: 100000, kind: 'costume', grants: { cloud_cups: 1 } },
    'costume.set': { price: 250000, kind: 'costume', grants: { blue_bears: 1, mount_stars: 1, cloud_cups: 1 } },
    'skill.shield': { price: 10000, kind: 'skill', grants: { shield: 10 } },
    'skill.targeting': { price: 50000, kind: 'skill', grants: { targeting: 30 } },
    'skill.ai': { price: 100000, kind: 'skill', grants: { ai: 10 } },
    'skill.set': { price: 150000, kind: 'skill', grants: { shield: 15, targeting: 35, ai: 12 } }
  };
  function store() { return root.localStorage; }
  function read(key) { return store().getItem(key); }
  function json(key, fallback) { try { var v = JSON.parse(read(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function count(value) { var n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function ids(kind) { return kind === 'weapon' ? WEAPONS : kind === 'costume' ? COSTUMES : []; }
  function ownedKey(kind) { return 'mole.' + kind + '.owned'; }
  function materialKey(kind, id) { return 'mole.ws.mat.' + kind + '.' + id; }
  function ownedIds(kind) { var a = json(ownedKey(kind), []); return Array.isArray(a) ? a.filter(function (id) { return ids(kind).indexOf(id) !== -1; }) : []; }
  function owns(kind, id) { return kind === 'weapon' && id === 'hammer' || ownedIds(kind).indexOf(id) !== -1; }
  function materials(kind, id) { return ids(kind).indexOf(id) === -1 ? 0 : count(read(materialKey(kind, id))); }
  function skillInventory() { var v = json('mole.skill.inventory', {}), out = {}; SKILLS.forEach(function (id) { out[id] = count(v && v[id]); }); return out; }

  // A durable journal completes an interrupted write on startup. Write errors roll back.
  function commit(changes) {
    var before = {}, keys = Object.keys(changes), started = false;
    try {
      keys.forEach(function (key) { before[key] = read(key); });
      store().setItem(JOURNAL, JSON.stringify({ changes: changes })); started = true;
      keys.forEach(function (key) { store().setItem(key, changes[key]); });
      store().removeItem(JOURNAL);
      return true;
    } catch (e) {
      if (started) {
        try {
          keys.forEach(function (key) { if (before[key] == null) store().removeItem(key); else store().setItem(key, before[key]); });
          store().removeItem(JOURNAL);
        } catch (rollbackError) { /* Leave the journal for startup recovery. */ }
      }
      return false;
    }
  }
  var ready = false;
  function initialize() {
    try {
      var pending = json(JOURNAL, null);
      if (pending && pending.changes) {
        Object.keys(pending.changes).forEach(function (key) { store().setItem(key, pending.changes[key]); });
        store().removeItem(JOURNAL);
      }
      if (read(VERSION)) { ready = true; return; }
      // Freeze the old demo defaults once for existing test profiles, never erase saves.
      var legacy = !!(read('mole.devGrant2') || read('mole.devMatGrant1') || read('mole.devResetLv3'));
      var changes = {}, backup = {};
      ['weapon', 'costume'].forEach(function (kind) {
        var key = ownedKey(kind), owned = ownedIds(kind); backup[key] = read(key);
        if (read(key) == null && legacy) owned = kind === 'weapon' ? WEAPONS.slice() : COSTUMES.slice(0, 2);
        ids(kind).forEach(function (id) {
          var level = Number(read('mole.' + kind + '.level.' + id));
          var equipped = read('mole.' + (kind === 'weapon' ? 'weapon' : 'costume.equipped')) === id;
          if ((level > (kind === 'costume' ? 1 : 0) || equipped) && owned.indexOf(id) === -1) owned.push(id);
          var mat = materialKey(kind, id); backup[mat] = read(mat);
          if (read(mat) == null) changes[mat] = legacy ? '50' : '0';
        });
        changes[key] = JSON.stringify(owned);
      });
      var inv = json('mole.skill.inventory', {}), next = {};
      SKILLS.forEach(function (id) { next[id] = inv && Object.prototype.hasOwnProperty.call(inv, id) ? count(inv[id]) : legacy ? 1000 : 0; });
      backup['mole.skill.inventory'] = read('mole.skill.inventory');
      changes['mole.skill.inventory'] = JSON.stringify(next);
      changes['mole.items.before-connect.v1'] = JSON.stringify(backup);
      changes[VERSION] = '1';
      ready = commit(changes);
    } catch (e) { ready = false; }
  }
  function addGrants(changes, kind, grants) {
    if (kind === 'skill') {
      var inv = skillInventory();
      Object.keys(grants).forEach(function (id) { inv[id] += grants[id]; });
      changes['mole.skill.inventory'] = JSON.stringify(inv); return;
    }
    var owned = ownedIds(kind);
    Object.keys(grants).forEach(function (id) {
      var n = grants[id];
      if (owned.indexOf(id) === -1) { owned.push(id); n--; }
      changes[materialKey(kind, id)] = String(materials(kind, id) + n);
    });
    changes[ownedKey(kind)] = JSON.stringify(owned);
  }
  function grant(kind, id, n) {
    if (!ready || (kind === 'skill' ? SKILLS : ids(kind)).indexOf(id) === -1 || !Number.isSafeInteger(n) || n < 1) return false;
    var changes = {}, grants = {}; grants[id] = n; addGrants(changes, kind, grants);
    return commit(changes);
  }
  function purchase(sku) {
    var offer = CATALOG[sku];
    if (!ready) return { ok: false, reason: 'storage' };
    if (!offer) return { ok: false, reason: 'pending' };
    var coins = count(read('mole.coins'));
    if (coins < offer.price) return { ok: false, reason: 'coins' };
    var changes = { 'mole.coins': String(coins - offer.price) };
    // A newly purchased costume must wait for the user's explicit equip action.
    // Clear a matching legacy equipped value so it cannot appear equipped on acquisition.
    if (offer.kind === 'costume') {
      var equippedCostume = read('mole.costume.equipped');
      if (equippedCostume && Object.keys(offer.grants).some(function (id) {
        return id === equippedCostume && !owns('costume', id);
      })) changes['mole.costume.equipped'] = '';
    }
    addGrants(changes, offer.kind, offer.grants);
    return { ok: commit(changes), reason: 'storage' };
  }
  function equippedWeapon() { var id = read('mole.weapon'); return owns('weapon', id) ? id : 'hammer'; }
  function equipWeapon(id, locked) {
    if (!ready || locked || !owns('weapon', id)) return false;
    return commit({ 'mole.weapon': id });
  }
  var RATE = [50, 45, 40, 35, 30], COST = 10000;
  function enhance(kind, id) {
    if (!ready) return { ok: false, reason: 'storage' };
    if (ids(kind).indexOf(id) === -1 || !owns(kind, id)) return { ok: false, reason: 'owned' };
    var levelKey = 'mole.' + kind + '.level.' + id;
    var level = Math.max(0, count(read(levelKey)) - (kind === 'costume' ? 1 : 0));
    if (level >= 5) return { ok: false, reason: 'max' };
    var mats = materials(kind, id), coins = count(read('mole.coins'));
    if (!mats || coins < COST) return { ok: false, reason: !mats ? 'materials' : 'coins' };
    var success = Math.random() * 100 < RATE[level];
    var rescue = !success && Math.random() < 0.1;
    success = success || rescue;
    var changes = { 'mole.coins': String(coins - COST) };
    changes[materialKey(kind, id)] = String(mats - 1);
    changes[levelKey] = String(level + (success ? 1 : 0) + (kind === 'costume' ? 1 : 0));
    return { ok: commit(changes), reason: 'storage', level: level, success: success, rescue: rescue };
  }
  initialize();
  root.MoleGame = root.MoleGame || {};
  root.MoleGame.ItemInventory = { owns: owns, materials: materials, grant: grant, purchase: purchase,
    equippedWeapon: equippedWeapon, equipWeapon: equipWeapon, enhance: enhance, COST: COST, RATE: RATE,
    offer: function (sku) { var o = CATALOG[sku]; return o ? JSON.parse(JSON.stringify(o)) : null; } };
})(window);
