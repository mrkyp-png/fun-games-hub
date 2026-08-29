(function (root) {
  'use strict';

  const MIN_SPAWN_GAP = 0.2; // 기획서 §6: 두더지 사이 0.2~0.5초 간격
  const MAX_SPAWN_GAP = 0.5;

  function create({ regions, spawnPoints, config, rng }) {
    const completedRegions = new Set();
    const occupiedSpawnPointIds = new Set();
    let nextPopId = 0;
    const active = new Map(); // popId -> { id, type, spawnPointId, regionId, x, y, remaining }

    function randomGap() {
      return rng.next() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP) + MIN_SPAWN_GAP;
    }

    const cooldown = { mole: randomGap(), animal: randomGap(), bomb: randomGap() };

    function maxOf(type) {
      if (type === 'mole') return config.maxConcurrentMoles;
      if (type === 'animal') return config.maxConcurrentAnimals;
      return config.maxConcurrentBombs;
    }

    function activeCountOf(type) {
      let n = 0;
      active.forEach((p) => { if (p.type === type) n++; });
      return n;
    }

    function candidateSpawnPointsFor(type) {
      // 두더지는 아직 완성 안 된 영역에서만, 방해물은 완성 여부와 무관하게 아무 지점에서나 등장.
      if (type === 'mole') {
        return spawnPoints.filter((sp) => !completedRegions.has(sp.regionId) && !occupiedSpawnPointIds.has(sp.id));
      }
      return spawnPoints.filter((sp) => !occupiedSpawnPointIds.has(sp.id));
    }

    function trySpawn(type) {
      if (maxOf(type) <= 0 || activeCountOf(type) >= maxOf(type)) return null;
      const candidates = candidateSpawnPointsFor(type);
      if (candidates.length === 0) return null;
      const sp = candidates[Math.floor(rng.next() * candidates.length)];
      const pop = { id: nextPopId++, type, spawnPointId: sp.id, regionId: sp.regionId, x: sp.x, y: sp.y, remaining: config.popDuration };
      active.set(pop.id, pop);
      occupiedSpawnPointIds.add(sp.id);
      return pop;
    }

    function tick(dt) {
      const spawned = [];
      const expired = [];

      active.forEach((pop) => { pop.remaining -= dt; });
      active.forEach((pop, id) => { if (pop.remaining <= 0) expired.push(id); });
      expired.forEach((id) => {
        const pop = active.get(id);
        occupiedSpawnPointIds.delete(pop.spawnPointId);
        active.delete(id);
      });

      ['mole', 'animal', 'bomb'].forEach((type) => {
        cooldown[type] -= dt;
        if (cooldown[type] <= 0) {
          const pop = trySpawn(type);
          if (pop) spawned.push(pop);
          cooldown[type] = randomGap();
        }
      });

      return { spawned, expired };
    }

    function resolveHit(popId) {
      const pop = active.get(popId);
      if (!pop) return null;
      active.delete(popId);
      occupiedSpawnPointIds.delete(pop.spawnPointId);
      if (pop.type === 'mole') completedRegions.add(pop.regionId);
      return { type: pop.type, regionId: pop.regionId };
    }

    function isComplete() {
      return completedRegions.size === regions.length;
    }

    function completedRegionCount() {
      return completedRegions.size;
    }

    function getActivePops() {
      return Array.from(active.values()).map((p) => Object.assign({}, p));
    }

    function forceCompleteAll() {
      regions.forEach((r) => completedRegions.add(r.id));
    }

    return { tick, resolveHit, isComplete, completedRegionCount, getActivePops, forceCompleteAll };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnScheduler = api; }
})(typeof window !== 'undefined' ? window : null);
