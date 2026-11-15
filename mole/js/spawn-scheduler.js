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
  // 동물 다타(챕터8 전용, config.animalMultiHit — 사용자 지정): 두더지와 같은 굴림 구조,
  // 다만 애셋이 2단계뿐이라 4타는 없음. 10% 3히트 / 다음 25% 2히트 / 나머지 1히트.
  const ANIMAL_THREE_HIT_CHANCE = 0.10;
  const ANIMAL_TWO_HIT_CHANCE = 0.35;
  // 여러 번 때리려면 화면에 더 오래 떠 있어야 후반 레벨에서도 잡을 수 있다.
  const DURATION_MULT = { 1: 1, 2: 1.7, 3: 2.4, 4: 3.1 };
  const STAY_MULT = { thief: 0.75, phone: 1.4 }; // V1710 C 사용자: 나쁜 두더지 성격 — 도둑은 빨리 도망, 휴대폰은 폰에 빠져 오래 머묾
  const GOLDEN_CHANCE = 0.03; // V1710 C 사용자: 황금 두더지 확률
  const GOOD_CHANCE = 0.1;    // V1712 C 사용자: 일반 두더지(때리면 안 됨) 확률 — 1방짜리 두더지 중
  const BEHAVIORS = ['drink', 'smoke', 'phone', 'thief'];
  const RELAY_GAP = 0.3;      // V1710 C 사용자: 릴레이 묶음 사이 간격(초)
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
    let relayWait = 0.6; // V1710 C: 릴레이 첫 묶음 대기
    let relayCurrent = 0; // V1713 C: 지금 묶음 번호
    const active = new Map(); // popId -> pop. 두더지 pop: { id, type:'mole', spawnPointId, regionId, x, y,
    //   remaining, hitsRequired(1|2|3), hitsTaken, poseIndex, hitCooldown, dying }

    function randomGap() {
      return rng.next() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP) + MIN_SPAWN_GAP;
    }
    function randomMoleGap() {
      return rng.next() * (MOLE_MAX_SPAWN_GAP - MOLE_MIN_SPAWN_GAP) + MOLE_MIN_SPAWN_GAP;
    }
    // 방해물(동물·폭탄) 등장 간격 — config.obstacleRatioBoost(기본 1, 챕터10 = 1.1)만큼
    // 간격을 좁혀 그만큼 자주 등장하게 한다(§10 "방해비율 10% 상향").
    function randomObstacleGap() {
      return randomGap() / (config.obstacleRatioBoost || 1);
    }

    const cooldown = { mole: randomMoleGap(), animal: randomObstacleGap(), bomb: randomObstacleGap(), item: 3 };

    function maxOf(type) {
      if (type === 'mole') return config.maxConcurrentMoles;
      if (type === 'animal') return config.maxConcurrentAnimals;
      if (type === 'item') return config.maxConcurrentItems || 0;
      return config.maxConcurrentBombs;
    }

    // V1713 C 사용자: 지금 라운드의 타격 대상인가(성격 효과·황금은 대상에게만). 6라운드 = 색깔 두더지, 8라운드 = 둘 다
    function isTarget(p) { if (p.good || p.bombKind) return false; if (p.type === 'mole') return !config.reverseTarget; if (p.type === 'animal') return !!(config.reverseTarget || config.dualTarget); return false; }
    function activeCountOf(type) {
      let n = 0;
      active.forEach((p) => { if (p.type === type && !p.good) n++; }); // V1712 C 사용자: 일반 두더지는 한도에서 뺌(칠 수 있는 두더지 수 유지)
      return n;
    }

    // 골드 묠니르 지진이 처리 중인 구역은 그동안 새 두더지가 안 뜨게(사용자 지정) — 지역별
    // 잠금 개수(겹치는 지진이 있을 수 있어 카운트로, 0 이 되면 완전히 풀림).
    const lockedMoleRegionCounts = new Map(); // regionId -> count
    function lockMoleRegions(ids) {
      (ids || []).forEach((id) => lockedMoleRegionCounts.set(id, (lockedMoleRegionCounts.get(id) || 0) + 1));
    }
    function unlockMoleRegions(ids) {
      (ids || []).forEach((id) => {
        const c = (lockedMoleRegionCounts.get(id) || 0) - 1;
        if (c <= 0) lockedMoleRegionCounts.delete(id); else lockedMoleRegionCounts.set(id, c);
      });
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
          !regionsWithActiveMoles.has(sp.regionId) &&
          !lockedMoleRegionCounts.has(sp.regionId)
        );
      }
      return spawnPoints.filter((sp) => !occupiedSpawnPointIds.has(sp.id));
    }

    function rollMoleKind() {
      // 챕터1(§5 "등장 추가 요소: 없음"): 다타(빼꼼) 두더지 없음 — 전부 1방.
      if (config.multiHit === false) return 1;
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

    // 동물 다타(챕터8 — 동물이 타겟으로 뒤집히는 챕터라 두더지처럼 다타 도입, 사용자 지정).
    function rollAnimalKind() {
      if (!config.animalMultiHit) return 1;
      const r = rng.next();
      return r < ANIMAL_THREE_HIT_CHANCE ? 3 : r < ANIMAL_TWO_HIT_CHANCE ? 2 : 1;
    }

    function trySpawn(type, relay) {
      if (maxOf(type) <= 0 || (!relay && activeCountOf(type) >= maxOf(type))) return null; // V1710 C: 릴레이 묶음은 한도 대신 빈 구멍만 봄
      const candidates = candidateSpawnPointsFor(type);
      if (candidates.length === 0) return null;
      const sp = candidates[Math.floor(rng.next() * candidates.length)];
      const pop = { id: nextPopId++, type, spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration };
      pop.dying = false;
      pop.hitCooldown = 0;
      if (type === 'mole') {
        // 폭탄 든 두더지(전체 챕터 기획서 후속, 2026-09-14 확정) — 다타 굴림과 별개의 독립 굴림.
        // 강력폭탄이 먼저 당첨 판정(겹치면 강력 우선). 둘 다 config.bombChance/strongBombChance
        // 가 0(미설정 챕터)이면 절대 안 뜬다. 폭탄 든 두더지는 1방·전신(모자 8=보석/폭탄 든 포즈)
        // 고정 — 다타로 빠끔/모자로 안 바뀌어야 폭탄이 계속 보이므로.
        const bombRoll = rng.next();
        // V1430 C 사용자: 6라운드(reverseTarget)는 두더지가 폭탄을 안 듦(동물이 듦, 아래).
        const strongChance = config.reverseTarget ? 0 : (config.strongBombChance || 0);
        const bombChance = config.reverseTarget ? 0 : (config.bombChance || 0);
        pop.bombKind = bombRoll < strongChance ? 'strong' : bombRoll < strongChance + bombChance ? 'normal' : null;
        if (pop.bombKind) {
          pop.hitsRequired = 1;
          pop.poseIndex = 7; // mole8.png — 폭탄(원래 보석) 든 포즈
        } else {
          pop.hitsRequired = rollMoleKind();
          pop.poseIndex = Math.floor(rng.next() * (config.molePoseCount || 8));
          // V1703 C: 5마리 중 1마리는 '일반 두더지'(때리면 안 됨). 나머지 4는 나쁜 두더지(술·담배·휴대폰·도둑)=타겟.
          // 기존 rng 순서를 바꾸지 않도록 별도 난수(Math.random) 사용. 다타 두더지는 항상 나쁜 두더지(일반은 1방짜리만).
          const roll = Math.random();
          const goodChance = config.goodChance != null ? config.goodChance : GOOD_CHANCE; // V1716 C: 프로는 더 자주(15%)
          pop.good = pop.hitsRequired === 1 && roll < goodChance; // V1712 C 사용자: 일반 두더지 확률 낮춤(20% → 10%)
          if (!pop.good) pop.behavior = ['drink', 'smoke', 'phone', 'thief'][Math.min(3, Math.floor(Math.max(0, roll - goodChance) / ((1 - goodChance) / 4)))];
          // V1710 C 사용자: 황금 두더지 — 아주 가끔(3%, 1방짜리 나쁜 두더지 자리), 짧게 머묾·점수 5배·코인
          if (!pop.good && isTarget(pop) && pop.hitsRequired === 1 && Math.random() < GOLDEN_CHANCE) { pop.golden = true; pop.behavior = null; } // 황금은 타격 대상일 때만
        }
        pop.hitsTaken = 0;
        // 알리 펀치 [방어]: 내려가기(자연 만료) 전 0.1초 더 여유(기획서 §7, config.moleUpBonus).
        // 코스튬 효과(두더지 하강 딜레이, config.costumeUpBonus)는 무기 효과와 별개로 가산된다.
        pop.remaining = config.popDuration * DURATION_MULT[pop.hitsRequired] * (pop.golden ? 0.7 : (isTarget(pop) && STAY_MULT[pop.behavior] || 1)) + (config.moleUpBonus || 0) + (config.costumeUpBonus || 0); /* V1710 C: 성격별 머무는 시간(도둑 짧게·휴대폰 길게) */
        pop.life = pop.remaining;
      } else {
        pop.poseIndex = Math.floor(rng.next() * (config.obstacleCount || 5)); // 어느 동물인지
        if (type === 'animal') {
          // V1430 C 사용자: 6라운드는 폭탄을 동물이 듦 — 확률·강력/일반·1방은 폭탄 두더지와 같음.
          if (config.reverseTarget) {
            const bombRoll = rng.next();
            const strongChance = config.strongBombChance || 0;
            const bombChance = config.bombChance || 0;
            pop.bombKind = bombRoll < strongChance ? 'strong' : bombRoll < strongChance + bombChance ? 'normal' : null;
          }
          pop.hitsRequired = pop.bombKind ? 1 : rollAnimalKind();
          pop.hitsTaken = 0;
          // 다타 동물도 두더지처럼 더 오래 떠 있어야 여러 번 때릴 시간이 생긴다.
          if (!pop.bombKind) pop.behavior = BEHAVIORS[Math.floor(Math.random() * 4)]; // V1713 C 사용자: 색깔 두더지도 소품(성격) — 효과는 타격 대상일 때만
          pop.remaining = config.popDuration * (DURATION_MULT[pop.hitsRequired] || 1) * (isTarget(pop) && STAY_MULT[pop.behavior] || 1); pop.life = pop.remaining;
        }
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
      // V1710 C 사용자: 술 두더지 — 머무는 시간 절반쯤 지나도 안 맞았으면 비틀거리며 옆(빈) 구멍으로 옮겨 감(1번)
      Array.from(active.values()).forEach((pop) => {
        if (pop.behavior !== 'drink' || !isTarget(pop) || pop.wobbled || pop.dying || pop.sinkIn > 0 || pop.hitsTaken > 0 || !(pop.remaining < pop.life * 0.5) || pop.remaining < 0.6) return;
        pop.wobbled = true;
        if (activeCountOf(pop.type) >= maxOf(pop.type)) return; // 동시 마릿수 한도를 넘지 않게(자리 없으면 그냥 제자리)
        const free = candidateSpawnPointsFor(pop.type).filter((sp) => sp.id !== pop.spawnPointId);
        if (!free.length) return;
        const sp = free.reduce((a, b) => (Math.hypot(b.x - pop.x, b.y - pop.y) < Math.hypot(a.x - pop.x, a.y - pop.y) ? b : a)); // 가까운 구멍
        const moved = Object.assign({}, pop, { id: nextPopId++, spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, wobbled: true, remaining: pop.remaining + 0.3 });
        pop.dying = true; pop.relocated = true; pop.remaining = RETREAT_SEC; // 옛 자리는 내려감(시간초과 아님 → 콤보 유지)
        active.set(moved.id, moved); occupiedSpawnPointIds.add(sp.id); spawned.push(moved);
      });
      active.forEach((pop, id) => {
        if (pop.sinkIn > 0) return; // 타격 등록됨, 침몰 대기 중 — 자연 만료 로직 건너뜀
        if (pop.remaining > 0) return;
        if (!pop.dying) {
          // 시간 초과: (두더지면 영역 완성 안 됨) 땅속으로 물러나는 연출 시간만큼만 더 살려둔다.
          pop.dying = true;
          pop.timedOut = true; // 처치 못 하고 시간초과로 내려감 (콤보 리셋 판정용 — game.js)
          pop.remaining = RETREAT_SEC;
        } else {
          expired.push({ id, type: pop.type, timedOut: !!pop.timedOut, bomb: !!pop.bombKind, good: !!pop.good, behavior: pop.behavior || null, regionId: pop.regionId, relocated: !!pop.relocated });
        }
      });
      expired.forEach((e) => {
        const pop = active.get(e.id);
        occupiedSpawnPointIds.delete(pop.spawnPointId);
        active.delete(e.id);
      });

      // 난이도별 방해물 토글: config.obstacles === false 면 두더지만 (하수·고수).
      const spawnTypes = (config.obstacles === false) ? ['mole'] : ['mole', 'animal', 'bomb'];
      if (config.shieldItems) spawnTypes.push('item');
      // V1710 C 사용자: 릴레이(아마추어 6라운드) — 두더지 3마리씩 한 묶음. 묶음의 나쁜 두더지가 다 없어지면
      // (잡거나 놓쳐서) 0.3초 뒤 다음 3마리. 일반 두더지는 묶음당 최대 1마리, 남아 있어도 기다리지 않음.
      if (config.relay) {
        // V1713 C 사용자: 지금 묶음에서 1마리라도 잡으면(또는 다 놓치면) 다음 3마리. 남은 두더지는 제 시간까지 남음
        const cur = Array.from(active.values()).filter((p) => p.type === 'mole' && p.relayWave === relayCurrent);
        const caught = cur.some((p) => !p.good && (p.killed || p.sinkIn > 0));
        const live = cur.some((p) => !p.good && !p.bombKind && !p.dying && !(p.sinkIn > 0));
        if (!caught && live) relayWait = RELAY_GAP;
        else if ((relayWait -= dt) <= 0) {
          let goods = 0; relayCurrent += 1;
          for (let i = 0; i < 3; i++) {
            const p = trySpawn('mole', true); if (!p) break;
            if (p.bombKind) { p.bombKind = null; if (!p.behavior) p.behavior = ['drink', 'smoke', 'phone', 'thief'][Math.floor(Math.random() * 4)]; } // 릴레이는 폭탄 없음(만약을 위해)
            if (p.good && goods++ >= 1) { p.good = false; p.behavior = ['drink', 'smoke', 'phone', 'thief'][Math.floor(Math.random() * 4)]; }
            p.relayWave = relayCurrent;
            spawned.push(p);
          }
          relayWait = RELAY_GAP;
        }
      }
      spawnTypes.forEach((type) => {
        if (type === 'mole' && config.relay) return; // 릴레이는 위에서 묶음으로만
        cooldown[type] -= dt;
        if (cooldown[type] <= 0) {
          const pop = trySpawn(type);
          if (pop) spawned.push(pop);
          // 실드 아이템은 드물게 (2.5~6초 간격), 두더지는 전용(더 촘촘한) 간격, 방해물은 obstacleRatioBoost 반영.
          cooldown[type] = (type === 'item') ? (2.5 + rng.next() * 3.5) : (type === 'mole') ? randomMoleGap() : randomObstacleGap();
        }
      });

      return { spawned, expired };
    }

    function resolveOne(pop, opts) {
      if (opts && opts.doubleHit) {
        var inRepeatWindow = pop.sinkIn > 0 || (pop.dying && pop.remaining > RETREAT_SEC * JUGGLE_VISIBLE_FRAC);
        if (pop.type !== 'mole' || pop.good || pop.bombKind || pop.hitsRequired !== 1 || !pop.killed || !inRepeatWindow || pop.doubleHitUsed) return null;
        pop.doubleHitUsed = true;
        return { type: 'mole', regionId: pop.regionId, popId: pop.id, juggle: true, doubleHit: true, source: 'costume-double-hit', xFrac: pop.x, yFrac: pop.y };
      }
      var isBurstShot = !!(opts && opts.burst);            // 대포 연사 자동샷
      var isAuto = isBurstShot || !!(opts && opts.quake);  // 자동타격(연사/지진) — 쿨다운·무패널티게이트 통과
      if (opts && opts.quake) pop.quakeAt = performance.now();

      // 연사(burst) 진행 중: 자동샷만 실제 처리하고, 유저가 그 구멍을 더 때리는 건
      // 두더지가 사라질 때까지 무패널티로 무시 (헛방 아님, 콤보 리셋 X). (사용자 지정)
      if (pop.burstActive && !isAuto) {
        return { type: 'mole', regionId: pop.regionId, ignored: true, xFrac: pop.x, yFrac: pop.y };
      }

      // v975(사용자 지정): 골드해머 지진이 처리한 칸은 유저가 눌러도 무시 —
      // 분신 망치가 날아가는 중이라 두더지·초록 버튼이 아직 보여서 누르면 헛방으로 콤보가 끊기던 것.
      // v991: 0.64초 → 두더지가 완전히 사라질 때까지(분신 비행+내려가는 0.6초 동안에도 보여서 여전히 끊겼음)
      if (!isAuto && pop.quakeAt) {
        return { type: 'mole', regionId: pop.regionId, ignored: true, xFrac: pop.x, yFrac: pop.y };
      }
      // 저글 보너스(스펙 2026-09-04 §4): 1방 두더지를 잡은 뒤 내려가는 창에 한 번 더 맞히면
      // 콤보 +1 보너스. 두더지당 1회. 못 맞혀도 페널티 없음. 2·3방 다타는 제외.
      // 단 두더지가 "시각적으로 보일 때"만 — 다 사라진 뒤 때리면 명백한 헛방(콤보 리셋). (사용자 지정)
      var moleVisible = pop.sinkIn > 0 || (pop.dying && pop.remaining > RETREAT_SEC * JUGGLE_VISIBLE_FRAC);
      if (pop.killed && moleVisible && pop.type === 'mole' && !pop.good && pop.hitsRequired === 1 && !pop.juggled) {
        pop.juggled = true;
        return { type: 'mole', regionId: pop.regionId, juggle: true, xFrac: pop.x, yFrac: pop.y };
      }
      if (pop.dying || pop.sinkIn > 0) return null; // 이미 처치됐거나(침몰) 시간초과로 내려가는 중 — 헛방

      // 동물 다타(챕터8, config.animalMultiHit) 도 두더지와 같은 다타 처리 경로를 탄다(사용자 지정).
      if ((pop.type === 'mole' || pop.type === 'animal') && pop.hitsRequired > 1) {
        // 연타 쿨다운 중 = 유효한 타겟이 떠 있는데 무시하는 것 → 헛방 아님(콤보 리셋 X).
        if (pop.hitCooldown > 0 && !isAuto) return { type: pop.type, regionId: pop.regionId, ignored: true, xFrac: pop.x, yFrac: pop.y };
        // 골드 묠니르 지진 / 알리 판취 = 2·3타 두더지·동물도 한 번에 소탕(사용자 지정) — 남은
        // 타수를 한꺼번에 채워 바로 아래 최종 타격 처리로 넘어간다.
        var fullClear = !!(opts && (opts.quake || opts.alipunch));
        pop.hitsTaken = fullClear ? pop.hitsRequired : pop.hitsTaken + 1;
        // 전신(첫 타) + 대포 → 10% 로 연사 발동. 판정은 이 타격 순간.
        if (!fullClear && pop.hitsTaken === 1 && (pop._forceBurst || (config.cannonBurst && rng.next() < BURST_CHANCE + (config.burstBonus || 0)))) pop.burstActive = true;
        if (pop.hitsTaken < pop.hitsRequired) {
          pop.hitCooldown = HIT_COOLDOWN;
          return { type: pop.type, regionId: pop.regionId, done: false, xFrac: pop.x, yFrac: pop.y, hitsTaken: pop.hitsTaken, hitsRequired: pop.hitsRequired, burst: !!pop.burstActive };
        }
      }

      // 최종 타격 — 영역 완성/점수는 지금 확정하되, 실제 "내려가는" 연출은 SINK_DELAY 뒤
      // (망치가 화면에서 두더지에 닿는 순간). tick() 이 sinkIn 을 세다가 dying 으로 넘긴다.
      if (pop.type === 'mole' && !pop.good) completedRegions.add(pop.regionId);
      // killed = 시간초과가 아니라 실제 타격으로 처리됨. 알리 펀치 무적 중엔 동물도 "처치"로 쳐서
      // pop-elements.js 가 두더지와 같은 펀치 연출(넉백·축소)을 태울 수 있게(game.js 쪽에서 게이팅).
      if (pop.type === 'mole' || pop.type === 'animal') pop.killed = true;
      pop.sinkIn = SINK_DELAY;
      // safeAlways = 이 동물/폭탄이 "무적 중에 올라온" 것이면, 무적이 그 사이 끝나서
      // 타격 시점엔 무적이 아니어도 계속 안전(사용자 지정 — "의문사 방지". game.js 가
      // 스폰 순간에 낙인찍음, spawn-scheduler 는 무적 여부를 모르니 그대로 전달만).
      return { type: pop.type, regionId: pop.regionId, done: true, xFrac: pop.x, yFrac: pop.y, safe: !!pop.safeAlways, bombKind: pop.bombKind || null, good: !!pop.good, behavior: pop.behavior || null, golden: !!pop.golden };
    }

    function resolveHit(popId, opts) {
      const pop = active.get(popId);
      const result = pop ? resolveOne(pop, opts) : null;
      if (result) result.popId = pop.id;
      return result;
    }

    // 구멍(영역) 타격: 그 영역의 활성 pop 을 판정한다 (기획서 v1.5 — 구멍별 버튼).
    // 영역당 스폰 지점 1개라 결과는 0개 또는 1개지만, 호출부 편의를 위해 배열로 돌려준다.
    function resolveRegion(regionId, opts) {
      const out = [];
      active.forEach((pop) => {
        if (pop.regionId !== regionId) return;
        const r = resolveOne(pop, opts);
        if (r) { r.popId = pop.id; out.push(r); }
      });
      // v991(사용자 지정): 지진 진행 중(0.64초 잠금) 그 범위의 빈 칸이 같이 깜빡여 누르면 헛방으로 콤보가 끊기던 것 — 무시
      if (!out.length && !(opts && (opts.quake || opts.burst)) && lockedMoleRegionCounts.has(regionId)) {
        const sp = spawnPoints.find((p) => p.regionId === regionId);
        out.push({ type: 'mole', regionId, ignored: true, xFrac: sp ? sp.x : 0.5, yFrac: sp ? sp.y : 0.5 });
      }
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

    // 피버타임 진입 전 정리(사용자 지정: "두더지, 동물들이 다 구멍으로 들어간후, 화면이
    // 정지되고, 아래로 내려가야함") — 떠 있는 모든 두더지/동물을 시간초과와 동일한 자연
    // 퇴장 경로(땅속으로 천천히 내려가는 연출, RETREAT_SEC)로 밀어넣는다. 이미 죽어가는
    // 중이거나 침몰 중인 건 그대로 둔다(중복 처리 방지).
    function forceRetreatAll() {
      active.forEach((pop) => {
        if (!pop.dying && pop.sinkIn <= 0) pop.remaining = 0;
      });
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

    // 디버그 전용: RNG 무시하고 지정한 구멍에 즉시 두더지를 띄운다 (타격점 확인용, 영구 보존).
    function debugForceMole(regionId, poseIndex) {
      const sp = spawnPoints.find((p) => p.regionId === regionId);
      if (!sp || occupiedSpawnPointIds.has(sp.id)) return null;
      const pop = { id: nextPopId++, type: 'mole', spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration * DURATION_MULT[1] };
      pop.dying = false; pop.hitCooldown = 0; pop.hitsRequired = 2; pop.hitsTaken = 0;
      pop.poseIndex = poseIndex != null ? poseIndex : 0;
      pop.sinkIn = 0; pop.killed = false; pop.juggled = false;
      active.set(pop.id, pop);
      occupiedSpawnPointIds.add(sp.id);
      return pop;
    }

    // 디버그 전용: 지정 구멍에 폭탄 든 두더지를 강제 스폰(kind: 'normal'|'strong', 연출 확인용).
    function debugForceBombMole(regionId, kind) {
      const sp = spawnPoints.find((p) => p.regionId === regionId);
      if (!sp || occupiedSpawnPointIds.has(sp.id)) return null;
      const pop = { id: nextPopId++, type: 'mole', spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration };
      pop.dying = false; pop.hitCooldown = 0; pop.hitsRequired = 1; pop.hitsTaken = 0;
      pop.poseIndex = 7; pop.bombKind = kind === 'strong' ? 'strong' : 'normal';
      pop.sinkIn = 0; pop.killed = false; pop.juggled = false;
      active.set(pop.id, pop);
      occupiedSpawnPointIds.add(sp.id);
      return pop;
    }

    // 디버그 전용: 지정 구멍에 즉시 동물을 띄운다(무적 중 hot 하이라이트 확인용, 임시).
    function debugForceAnimal(regionId, poseIndex) {
      const sp = spawnPoints.find((p) => p.regionId === regionId);
      if (!sp || occupiedSpawnPointIds.has(sp.id)) return null;
      const pop = { id: nextPopId++, type: 'animal', spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration };
      pop.poseIndex = poseIndex | 0; // 디버그: 어느 동물·포즈인지 지정
      pop.dying = false; pop.hitCooldown = 0; pop.sinkIn = 0; pop.killed = false;
      active.set(pop.id, pop);
      occupiedSpawnPointIds.add(sp.id);
      return pop;
    }

    return { tick, resolveHit, resolveRegion, isComplete, completedRegionCount, getActivePops, forceCompleteAll, forceRetreatAll, debugForceBurst, debugForceMole, debugForceAnimal, debugForceBombMole, lockMoleRegions, unlockMoleRegions };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SpawnScheduler = api; }
})(typeof window !== 'undefined' ? window : null);
