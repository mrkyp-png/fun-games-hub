(function (root) {
  'use strict';
  var DB_NAME = 'moleFaces';
  var STORE = 'faces';
  var MAX = 20;
  var ACTIVE_KEY = 'mole.activeFaceId';

  function idb() {
    return (typeof indexedDB !== 'undefined') ? indexedDB : (root && root.indexedDB);
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = idb().open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // request 하나를 Promise 로.
  function reqValue(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function count() {
    return openDb().then(function (db) {
      return reqValue(db.transaction(STORE, 'readonly').objectStore(STORE).count());
    });
  }

  function saveFace(blob, name, costume, shape) {
    return count().then(function (n) {
      if (n >= MAX) throw new Error('full');
      var rec = {
        id: 'f' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: name || '', blob: blob, costume: costume || null,
        shape: shape || null, createdAt: Date.now()
      };
      return openDb().then(function (db) {
        return reqValue(db.transaction(STORE, 'readwrite').objectStore(STORE).add(rec));
      }).then(function () { return rec.id; });
    });
  }

  function setCostume(id, costume) {
    return getFace(id).then(function (rec) {
      if (!rec) return;
      rec.costume = costume || null;
      return openDb().then(function (db) {
        return reqValue(db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec));
      });
    });
  }

  function listFaces() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var t = db.transaction(STORE, 'readonly');
        var cur = t.objectStore(STORE).index('createdAt').openCursor(null, 'prev');
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { out.push(c.value); c.continue(); }
        };
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function getFace(id) {
    return openDb().then(function (db) {
      return reqValue(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    }).then(function (v) { return v || null; });
  }

  function renameFace(id, name) {
    return getFace(id).then(function (rec) {
      if (!rec) return;
      rec.name = name || '';
      return openDb().then(function (db) {
        return reqValue(db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec));
      });
    });
  }

  function deleteFace(id) {
    return openDb().then(function (db) {
      return reqValue(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
    }).then(function () {
      if (getActiveId() === id) clearActive();
    });
  }

  function lsGet(k) { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; }
  function getActiveId() { return lsGet(ACTIVE_KEY) || null; }
  function setActive(id) { if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_KEY, id); }
  function clearActive() { if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVE_KEY); }

  var api = {
    MAX: MAX,
    saveFace: saveFace, setCostume: setCostume, listFaces: listFaces, getFace: getFace,
    renameFace: renameFace, deleteFace: deleteFace, count: count,
    getActiveId: getActiveId, setActive: setActive, clearActive: clearActive
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { FaceStore: api };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceStore = api; }
})(typeof window !== 'undefined' ? window : null);
