(function (root) {
  'use strict';

  // #mole-pop-layer 안의 두더지/방해물 DOM을 스케줄러 상태에 맞춰 만들고 지운다.
  //
  // 두더지·방해물 모두 같은 470x548(6:7) 캔버스 스프라이트를 .mole-pop(overflow 클립박스)
  // 안에 <img> 로 그리고, "깊이"(0 위 ~ 4 사라짐)에 따라 translateY 로 구멍에 들락날락.
  //   - 두더지: 깊이에 따라 그림도 교체 (전신 / 빠끔 / 모자). 다타 두더지는 중간 깊이에서 멈춤.
  //   - 방해물(동물/폭탄): 그림은 고정(animal=일반 얼굴, bomb=고글), 깊이는 등장(0)/퇴장(4)만.
  // 깊이 전진은 sync() 안에서 시간차로 처리 (게임 메인 루프가 매 프레임 sync 호출).

  const MS = root.MoleGame.MoleSprites;
  const GONE_DEPTH = 4;

  // 대포 장착 시 처치 두더지는 구멍으로 안 내려가고 그 자리에서 그을려 흩뿌리며 사라진다.
  function isCannonEquipped() {
    try { return localStorage.getItem('mole.weapon') === 'cannon'; } catch (e) { return false; }
  }
  const STEP_SEC = 0.055;       // 등장/빠끔 이동: 깊이 한 칸이 화면에 머무는 시간 — 빠르게
  const DYING_STEP_SEC = 0.144; // 타격 후: 전신 그대로 구멍 아래로 "천천히" 미끄러진다 (0→4 ≈ 0.58s)

  function create({ container, onEmerge, faceMap }) {
    const pops = new Map();  // popId -> { el, img, kind, poseIndex, shownDepth, targetDepth, shownFile }
    let lastNow = 0;
    // 활성 사람두더지 = 포즈별 "얼굴+몸체 합성 완료" 이미지 맵 { mole1: url, ... }. null 이면 기본 두더지.
    let faces = faceMap || null;

    // 게임 시작 시 game.js 가 합성 맵을 넘긴다 (없으면 null). 원본 사진은 절대 안 그린다.
    function setFace(map) {
      faces = map || null;
      pops.forEach((m) => { m.shownFile = null; render(m); }); // src 강제 갱신
    }

    function makePop(pop) {
      const el = document.createElement('div');
      el.className = 'mole-pop mole-pop--' + pop.type;
      el.style.left = (pop.x * 100) + '%';
      el.style.top = (pop.y * 100) + '%';
      const img = document.createElement('img');
      img.className = 'mole-pop-img';
      img.alt = '';
      el.appendChild(img);
      container.appendChild(el);
      if (onEmerge) onEmerge(pop.x, pop.y, pop.type); // 구멍에서 올라오는 순간 연출 (흙먼지·링·글로우)
      const m = {
        el, img, kind: pop.type, poseIndex: pop.poseIndex || 0, regionId: pop.regionId,
        shownDepth: GONE_DEPTH, targetDepth: 0, shownFile: null, dying: false,
        blast: false, dyingFrom: 0
      };
      render(m);
      pops.set(pop.id, m);
      return m;
    }

    function fileFor(m, depth) {
      if (depth >= GONE_DEPTH) return null;
      if (m.kind === 'item') return 'shield';   // 실드 아이템 — 고정 스프라이트
      // 타격 후(dying)엔 빠끔 프레임으로 안 바꾸고 전신 그대로 구멍 아래로 내려보낸다.
      if (m.kind === 'mole') {
        return m.dying ? 'mole' + (m.poseIndex + 1) : MS.fileForDepth(Math.round(depth), m.poseIndex);
      }
      return MS.obstacleFile(m.kind, m.poseIndex);
    }

    // 포즈 파일명 → 실제 그릴 URL. 두더지 + 활성 얼굴이면 합성본, 아니면 기본 스프라이트.
    function urlFor(m, file) {
      if (faces && m.kind === 'mole' && faces[file]) return faces[file];
      return MS.spriteUrl(file);
    }

    function render(m) {
      const file = fileFor(m, m.shownDepth);
      if (file && file !== m.shownFile) {
        m.img.setAttribute('src', urlFor(m, file));
        m.shownFile = file;
      }
      m.img.style.visibility = file ? '' : 'hidden';

      if (m.dying && m.blast) {
        // 대포 처치: 구멍으로 안 내려가고 — 그을려(검게) 흔들리다 흐릿하게 흩뿌리며 소멸.
        const span = GONE_DEPTH - m.dyingFrom;
        const k = span > 0 ? Math.min(1, Math.max(0, (m.shownDepth - m.dyingFrom) / span)) : 1;
        const wob = Math.sin(k * Math.PI * 6) * (1 - k) * 9;       // 감쇠하는 좌우 흔들림
        const grow = 1 + k * 0.12;
        const blur = k > 0.55 ? (k - 0.55) * 9 : 0;
        m.img.style.opacity = k < 0.5 ? '1' : String(Math.max(0, 1 - (k - 0.5) / 0.5));
        m.img.style.filter = 'brightness(0.14) sepia(1) contrast(1.4)' + (blur ? ' blur(' + blur.toFixed(1) + 'px)' : '');
        m.img.style.transform = 'translate(-50%, -2%) rotate(' + wob.toFixed(1) + 'deg) scale(' + grow.toFixed(3) + ')';
        return;
      }

      // dying 은 프레임 교체 없이 미끄러지므로 sink 를 선형(0→130%)으로.
      const sink = m.dying ? (m.shownDepth / GONE_DEPTH) * 130 : MS.sinkForDepth(m.shownDepth);
      // 프레임 실제 위치조정 (사용자 지정): 빠끔1 = 0.15cm 위, 빠끔2 = 0.2cm 위,
      // 모자 = 우 0.1cm · 위 0.4cm. 전신 포즈 좌우보정: mole2·mole3 = 좌 0.1cm, mole5 = 좌 0.03cm.
      let peekLift = '';
      let peekX = '-50%';
      if (m.kind === 'mole' && file === 'peek1') peekLift = ' - 0.15cm';
      else if (m.kind === 'mole' && file === 'peek2') peekLift = ' - 0.2cm';
      else if (m.kind === 'mole' && file === 'helmet') { peekLift = ' - 0.4cm'; peekX = 'calc(-50% + 0.1cm)'; }
      else if (m.kind === 'mole' && (file === 'mole2' || file === 'mole3')) peekX = 'calc(-50% - 0.1cm)';
      else if (m.kind === 'mole' && file === 'mole5') peekX = 'calc(-50% - 0.03cm)';
      m.img.style.transform = 'translate(' + peekX + ', calc(' + sink + '%' + peekLift + '))';
    }

    function targetFor(pop) {
      if (pop.dying) return GONE_DEPTH;
      return pop.type === 'mole' ? MS.restingDepth(pop.hitsRequired, pop.hitsTaken) : 0;
    }

    function advance(m, dt) {
      if (m.shownDepth === m.targetDepth) return;
      const dir = Math.sign(m.targetDepth - m.shownDepth);
      const next = m.shownDepth + dir * (dt / (m.dying ? DYING_STEP_SEC : STEP_SEC));
      m.shownDepth = dir > 0 ? Math.min(next, m.targetDepth) : Math.max(next, m.targetDepth);
      render(m);
    }

    function sync(activePops) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
      lastNow = now;

      const ids = new Set(activePops.map((p) => p.id));
      pops.forEach((m, id) => { if (!ids.has(id)) { m.el.remove(); pops.delete(id); } });

      activePops.forEach((pop) => {
        const m = pops.get(pop.id) || makePop(pop);
        if (pop.dying && !m.dying) {          // 침몰 시작 순간 — 대포 여부·시작 깊이 고정
          m.dyingFrom = m.shownDepth;
          // 실제 타격당해 처치된 두더지만 대포 폭발 연출. 시간초과로 안 맞고 물러나는 건
          // 대포모드에서도 기존처럼 그냥 아래로 내려간다(pop.killed=false).
          m.blast = pop.type === 'mole' && pop.killed && isCannonEquipped();
        }
        m.dying = !!pop.dying;
        m.targetDepth = targetFor(pop);
      });

      pops.forEach((m) => advance(m, dt));
    }

    function clear() {
      pops.forEach((m) => m.el.remove());
      pops.clear();
      lastNow = 0;
    }

    // 타격 순간 흰 플래시 (transform 을 안 건드려서 sink 애니메이션과 충돌 없음).
    function flash(popId) {
      const m = pops.get(popId);
      if (m) {
        m.img.classList.remove('mole-pop-img--hit');
        void m.img.offsetWidth;
        m.img.classList.add('mole-pop-img--hit');
      }
    }

    // 그 구멍에 떠 있는(침몰 안 한) 두더지의 현재 시각 프레임 키 — 망치가 프레임별로 조준한다.
    function frameKeyAt(regionId) {
      let key = null;
      pops.forEach((m) => {
        if (key || m.regionId !== regionId || m.kind !== 'mole' || m.dying) return;
        const d = Math.round(m.shownDepth);
        key = d <= 0 ? 'full' : d === 1 ? 'peek1' : d === 2 ? 'peek2' : 'helmet';
      });
      return key;
    }

    return { sync, clear, flash, setFace, frameKeyAt };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.PopElements = api; }
})(typeof window !== 'undefined' ? window : null);
