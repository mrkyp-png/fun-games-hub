(function (root) {
  'use strict';

  const MIN_SPAWN_GAP = 0.10; // 등장 간격 (점수 어택: 빈도 1.5배 상승 → 0.15/0.35 ÷ 1.5). 원래 0.2~0.5
  const MAX_SPAWN_GAP = 0.23;
  // 두더지 전용 등장 간격 — 난이도 상향(전체 레벨, 사용자 요청): 동물/폭탄은 그대로 두고
  // 두더지만 더 자주 나오게. MIN/MAX_SPAWN_GAP 대비 약 35% 더 촘촘함.
  const MOLE_MIN_SPAWN_GAP = 0.07;
  const MOLE_MAX_SPAWN_GAP = 0.15;

  // 다타(多打) 두더지: 뽕망치로 여러 번 때려야 잡힌다 (사용자 확정).
  // 등장 시 굴림 한 번으로 종류를 정한다: 5% 3히트 / 다음 15% 2히트 / 나머지 80% 1히트.
  const THREE_HIT_CHANCE = 0.05;
  const TWO_HIT_CHANCE = 0.20; // 누적: 0.05~0.20 구간이 2히트
  // 4타 두더지 (전신→빠끔1→빠끔2→모자): config.fourHit(챕터 5) 일 때만, 상위 3% 를 4타로.
  const FOUR_HIT_CHANCE = 0.03;
  // 대포 연사 스킬: 2·3타 두더지를 "전신 상태에서" 대포로 처음 맞히는 순간 10% 확률로 발동
  //   → 남은 타격이 자동 연사돼 1마리 즉시 클리어. 판정은 스폰이 아니라 "타격 시".
  const BURST_CHANCE = 0.10;
  // 여러 번 때리려면 화면에 더 오래 떠 있어야 후반 레벨에서도 잡을 수 있다.
  const DURATION_MULT = { 1: 1, 2: 1.7, 3: 2.4, 4: 3.1 };
  const HIT_COOLDOWN = 0.12;  // 같은 두더지 연타 방지 간격 (초)
  const RETREAT_SEC = 0.6;    // 최종 타격/시간초과 후 "땅속으로 천천히 내려가는" 연출이 도는 시간
  const JUGGLE_VISIBLE_FRAC = 0.5; // 저글 보너스는 침몰 초반(두더지가 아직 눈에 보일 때)만 — 이후엔 명백한 헛방
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
    function randomMoleGap() {
      return rng.next() * (MOLE_MAX_SPAWN_GAP - MOLE_MIN_SPAWN_GAP) + MOLE_MIN_SPAWN_GAP;
    }

    const cooldown = { mole: randomMoleGap(), animal: randomGap(), bomb: randomGap(), item: 3 };

    function maxOf(type) {
      if (type === 'mole') return config.maxConcurrentMoles;
      if (type === 'animal') return config.maxConcurrentAnimals;
      if (type === 'item') return config.maxConcurrentItems || 0;
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
      if (config.fourHit) {
        // 챕터 5: 4타를 상위에 "추가"(3타 대역은 그만큼 아래로) → 다타 두더지 총량이 늘어 더 어렵다.
        if (r < FOUR_HIT_CHANCE) return 4;
        if (r < FOUR_HIT_CHANCE + THREE_HIT_CHANCE) return 3;
        if (r < FOUR_HIT_CHANCE + TWO_HIT_CHANCE) return 2;
        return 1;
      }
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
      pop.killed = false; // 실제로 타격당해 처치됐는가 (시간초과로 내려간 것과 구분 — 저글 오발 방지)
      pop.juggled = false; // 저글 보너스 1회용
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
      if (config.shieldItems) spawnTypes.push('item');
      spawnTypes.forEach((type) => {
        cooldown[type] -= dt;
        if (cooldown[type] <= 0) {
          const pop = trySpawn(type);
          if (pop) spawned.push(pop);
          // 실드 아이템은 드물게 (2.5~6초 간격), 두더지는 전용(더 촘촘한) 간격, 나머지는 기본 간격.
          cooldown[type] = (type === 'item') ? (2.5 + rng.next() * 3.5) : (type === 'mole') ? randomMoleGap() : randomGap();
        }
      });

      return { spawned, expired };
    }

    function resolveOne(pop, opts) {
      var isBurstShot = !!(opts && opts.burst); // 연사 자동샷 — 쿨다운·무패널티게이트 통과

      // 연사(burst) 진행 중: 자동샷만 실제 처리하고, 유저가 그 구멍을 더 때리는 건
      // 두더지가 사라질 때까지 무패널티로 무시 (헛방 아님, 콤보 리셋 X). (사용자 지정)
      if (pop.burstActive && !isBurstShot) {
        return { type: 'mole', regionId: pop.regionId, ignored: true, xFrac: pop.x, yFrac: pop.y };
      }

      // 저글 보너스(스펙 2026-09-04 §4): 1방 두더지를 잡은 뒤 내려가는 창에 한 번 더 맞히면
      // 콤보 +1 보너스. 두더지당 1회. 못 맞혀도 페널티 없음. 2·3방 다타는 제외.
      // 단 두더지가 "시각적으로 보일 때"만 — 다 사라진 뒤 때리면 명백한 헛방(콤보 리셋). (사용자 지정)
      var moleVisible = pop.sinkIn > 0 || (pop.dying && pop.remaining > RETREAT_SEC * JUGGLE_VISIBLE_FRAC);
      if (pop.killed && moleVisible && pop.type === 'mole' && pop.hitsRequired === 1 && !pop.juggled) {
        pop.juggled = true;
        return { type: 'mole', regionId: pop.regionId, juggle: true, xFrac: pop.x, yFrac: pop.y };
      }
      if (pop.dying || pop.sinkIn > 0) return null; // 이미 처치됐거나(침몰) 시간초과로 내려가는 중 — 헛방

      if (pop.type === 'mole' && pop.hitsRequired > 1) {
        // 연타 쿨다운 중 = 유효한 두더지가 떠 있는데 무시하는 것 → 헛방 아님(콤보 리셋 X).
        if (pop.hitCooldown > 0 && !isBurstShot) return { type: 'mole', regionId: pop.regionId, ignored: true, xFrac: pop.x, yFrac: pop.y };
        pop.hitsTaken += 1;
        // 전신(첫 타) + 대포 → 10% 로 연사 발동. 판정은 이 타격 순간.
        if (pop.hitsTaken === 1 && (pop._forceBurst || (config.cannonBurst && rng.next() < BURST_CHANCE))) pop.burstActive = true;
        if (pop.hitsTaken < pop.hitsRequired) {
          pop.hitCooldown = HIT_COOLDOWN;
          return { type: 'mole', regionId: pop.regionId, done: false, xFrac: pop.x, yFrac: pop.y, hitsTaken: pop.hitsTaken, hitsRequired: pop.hitsRequired, burst: !!pop.burstActive };
        }
      }

      // 최종 타격 — 영역 완성/점수는 지금 확정하되, 실제 "내려가는" 연출은 SINK_DELAY 뒤
      // (망치가 화면에서 두더지에 닿는 순간). tick() 이 sinkIn 을 세다가 dying 으로 넘긴다.
      if (pop.type === 'mole') { completedRegions.add(pop.regionId); pop.killed = true; }
      pop.sinkIn = SINK_DELAY;
      return { type: pop.type, regionId: pop.regionId, done: true, xFrac: pop.x, yFrac: pop.y };
    }

    function resolveHit(popId, opts) {
      const pop = active.get(popId);
      return pop ? resolveOne(pop, opts) : null;
    }

    // 구멍(영역) 타격: 그 영역의 활성 pop 을 판정한다 (기획서 v1.5 — 구멍별 버튼).
    // 영역당 스폰 지점 1개라 결과는 0개 또는 1개지만, 호출부 편의를 위해 배열로 돌려준다.
    function resolveRegion(regionId, opts) {
      const out = [];
      active.forEach((pop) => {
        if (pop.regionId !== regionId) return;
        const r = resolveOne(pop, opts);
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

    // 디버그: 그 구멍의 안 맞은 다타 두더지를 연사 대상으로 강제 (연출 확인용).
    function debugForceBurst(regionId) {
      var hit = null;
      active.forEach((pop) => {
        if (pop.regionId === regionId && pop.type === 'mole' && pop.hitsRequired > 1 &&
            pop.hitsTaken === 0 && !pop.dying) { pop.burst = 1; hit = pop; }
      });
      if (hit) hit._forceBurst = true;
      return !!hit;
    }

    return { tick, resolveHit, resolveRegion, isComplete, completedRegionCount, getActivePops, forceCompleteAll, debugForceBurst };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnScheduler = api; }
})(typeof window !== 'undefined' ? window : null);
