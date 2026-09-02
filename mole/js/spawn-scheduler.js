(function (root) {
  'use strict';

  const MIN_SPAWN_GAP = 0.10; // 등장 간격 (점수 어택: 빈도 1.5배 상승 → 0.15/0.35 ÷ 1.5). 원래 0.2~0.5
  const MAX_SPAWN_GAP = 0.23;

  // 다타(多打) 두더지: 뽕망치로 여러 번 때려야 잡힌다 (사용자 확정).
  // 등장 시 굴림 한 번으로 종류를 정한다: 5% 3히트 / 다음 15% 2히트 / 나머지 80% 1히트.
  const THREE_HIT_CHANCE = 0.05;
  const TWO_HIT_CHANCE = 0.20; // 누적: 0.05~0.20 구간이 2히트
  // 여러 번 때리려면 화면에 더 오래 떠 있어야 후반 레벨에서도 잡을 수 있다.
  const DURATION_MULT = { 1: 1, 2: 1.7, 3: 2.4 };
  const HIT_COOLDOWN = 0.12;  // 같은 두더지 연타 방지 간격 (초)
  const RETREAT_SEC = 0.6;    // 최종 타격/시간초과 후 "땅속으로 천천히 내려가는" 연출이 도는 시간
  // 최종 타격을 등록한 뒤 두더지가 실제로 "내려가기(dying)" 시작할 때까지의 지연 (초).
  // 버튼 누른 즉시가 아니라 망치가 두더지에 닿고 나서 내려가게 한다.
  // 망치 도달 시간 = lane-hammer.js FLY_SEC(0.09) + CHOP_SEC(0.045) ≈ 0.135s.
  // 이 값을 그보다 조금 크게 두면 "망치가 때린다 → (아주 잠깐 뒤) 두더지가 반응해 내려간다" 로 읽힌다.
  // 더 늦게 내려가게 = 값 ↑ (예 0.22),  더 빨리 = 값 ↓ (예 0.12).
  // 내려가는 "속도" 자체는 pop-elements.js 의 DYING_STEP_SEC.
  const SINK_DELAY = 0.17;

  function create({ regions, spawnPoints, config, rng }) {
    const completedRegions = new Set();
    const occupiedSpawnPointIds = new Set();
    let nextPopId = 0;
    const active = new Map(); // popId -> pop. 두더지 pop: { id, type:'mole', spawnPointId, regionId, x, y,
    //   remaining, hitsRequired(1|2|3), hitsTaken, poseIndex, hitCooldown, dying }

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
      // 점수 어택 모드: 두더지는 16칸 아무 데나 랜덤 반복 등장 (잡은 칸도 다시 나온다).
      // 한 칸에 두더지 1마리 제약만 유지 — 방해물은 완성 개념 없이 빈 지점 아무 데나.
      if (type === 'mole') {
        const regionsWithActiveMoles = new Set();
        active.forEach((pop) => {
          if (pop.type === 'mole') regionsWithActiveMoles.add(pop.regionId);
        });
        return spawnPoints.filter((sp) =>
          !occupiedSpawnPointIds.has(sp.id) &&
          !regionsWithActiveMoles.has(sp.regionId)
        );
      }
      return spawnPoints.filter((sp) => !occupiedSpawnPointIds.has(sp.id));
    }

    function rollMoleKind() {
      const r = rng.next();
      return r < THREE_HIT_CHANCE ? 3 : r < TWO_HIT_CHANCE ? 2 : 1;
    }

    function trySpawn(type) {
      if (maxOf(type) <= 0 || activeCountOf(type) >= maxOf(type)) return null;
      const candidates = candidateSpawnPointsFor(type);
      if (candidates.length === 0) return null;
      const sp = candidates[Math.floor(rng.next() * candidates.length)];
      const pop = { id: nextPopId++, type, spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration };
      pop.dying = false;
      pop.hitCooldown = 0;
      if (type === 'mole') {
        pop.hitsRequired = rollMoleKind();
        pop.hitsTaken = 0;
        pop.poseIndex = Math.floor(rng.next() * (config.molePoseCount || 8));
        pop.remaining = config.popDuration * DURATION_MULT[pop.hitsRequired];
      } else {
        pop.poseIndex = Math.floor(rng.next() * (config.obstacleCount || 5)); // 어느 동물인지
      }
      pop.sinkIn = 0; // > 0 이면: 최종 타격을 맞았고 이 시간 뒤에 침몰(dying) 시작
      active.set(pop.id, pop);
      occupiedSpawnPointIds.add(sp.id);
      return pop;
    }

    function tick(dt) {
      const spawned = [];
      const expired = [];

      active.forEach((pop) => {
        pop.remaining -= dt;
        if (pop.hitCooldown > 0) pop.hitCooldown -= dt;
        if (pop.sinkIn > 0) {
          pop.sinkIn -= dt;
          if (pop.sinkIn <= 0) { pop.sinkIn = 0; pop.dying = true; pop.remaining = RETREAT_SEC; }
        }
      });
      active.forEach((pop, id) => {
        if (pop.sinkIn > 0) return; // 타격 등록됨, 침몰 대기 중 — 자연 만료 로직 건너뜀
        if (pop.remaining > 0) return;
        if (!pop.dying) {
          // 시간 초과: (두더지면 영역 완성 안 됨) 땅속으로 물러나는 연출 시간만큼만 더 살려둔다.
          pop.dying = true;
          pop.remaining = RETREAT_SEC;
        } else {
          expired.push(id);
        }
      });
      expired.forEach((id) => {
        const pop = active.get(id);
        occupiedSpawnPointIds.delete(pop.spawnPointId);
        active.delete(id);
      });

      // 난이도별 방해물 토글: config.obstacles === false 면 두더지만 (하수·고수).
      const spawnTypes = (config.obstacles === false) ? ['mole'] : ['mole', 'animal', 'bomb'];
      spawnTypes.forEach((type) => {
        cooldown[type] -= dt;
        if (cooldown[type] <= 0) {
          const pop = trySpawn(type);
          if (pop) spawned.push(pop);
          cooldown[type] = randomGap();
        }
      });

      return { spawned, expired };
    }

    function resolveOne(pop) {
      if (pop.dying || pop.sinkIn > 0) return null; // 이미 처치됨 (침몰 중이거나 침몰 대기 중)

      if (pop.type === 'mole' && pop.hitsRequired > 1) {
        if (pop.hitCooldown > 0) return null; // 연타 무시
        pop.hitsTaken += 1;
        if (pop.hitsTaken < pop.hitsRequired) {
          pop.hitCooldown = HIT_COOLDOWN;
          return { type: 'mole', regionId: pop.regionId, done: false, xFrac: pop.x, yFrac: pop.y, hitsTaken: pop.hitsTaken, hitsRequired: pop.hitsRequired };
        }
      }

      // 최종 타격 — 영역 완성/점수는 지금 확정하되, 실제 "내려가는" 연출은 SINK_DELAY 뒤
      // (망치가 화면에서 두더지에 닿는 순간). tick() 이 sinkIn 을 세다가 dying 으로 넘긴다.
      if (pop.type === 'mole') completedRegions.add(pop.regionId);
      pop.sinkIn = SINK_DELAY;
      return { type: pop.type, regionId: pop.regionId, done: true, xFrac: pop.x, yFrac: pop.y };
    }

    function resolveHit(popId) {
      const pop = active.get(popId);
      return pop ? resolveOne(pop) : null;
    }

    // 구멍(영역) 타격: 그 영역의 활성 pop 을 판정한다 (기획서 v1.5 — 구멍별 버튼).
    // 영역당 스폰 지점 1개라 결과는 0개 또는 1개지만, 호출부 편의를 위해 배열로 돌려준다.
    function resolveRegion(regionId) {
      const out = [];
      active.forEach((pop) => {
        if (pop.regionId !== regionId) return;
        const r = resolveOne(pop);
        if (r) out.push(r);
      });
      return out;
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

    return { tick, resolveHit, resolveRegion, isComplete, completedRegionCount, getActivePops, forceCompleteAll };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnScheduler = api; }
})(typeof window !== 'undefined' ? window : null);
