// 두더지 게임 서비스워커.
// fetch 전략 = 네트워크 우선: 온라인이면 항상 네트워크에서 최신본을 받고, 캐시는 오프라인
// 폴백 전용으로만 갱신한다. (예전엔 stale-while-revalidate라 배포해도 "다음 실행"에야
// 반영돼 사용자 체감 대기가 길었음 — 온라인=항상 최신, 오프라인=마지막 캐시로 변경.)
// SHELL 목록 자체가 바뀔 때만 CACHE 를 올린다.
// V1524 G: mailbox layout, floating claim-all, inventory loading and shop preview fixes.
// V1525 C: shop day/night and score backgrounds use brightness instead of opacity.
// V1526 C: settings screen redesign (ivory frame, shop cards, unified buttons, new plank, 2x icons), mailbox frame back to ivory.
// V1527 C: settings popups use the shop confirm dialog, reset text, workshop gold hammer game-style chop with 3D tilt.
// V1528 C: cannon faces each hole, barrel pitch aligns its center line to the target, straight recoil, no return to rest.
// V1529 C: daily screen redesign (no moles, workshop/pill buttons, shop icons, seamless 2x marquee border, quest gift box).
// V1530 C: cannon render fix (comment had swallowed return paint), no 3D redraw on recoil, aim solutions prewarmed.
// V1531 C: shop/workshop entry screens, mole tap only on home, X buttons on help/contact/privacy, darker home/score backgrounds.
// V1532 C: score profile photo/ID edit opens as a popup over the score screen.
// V1533 C: cannon side view max rotation, yaw-only aim, recoil only, shell/flame/smoke start 0.3cm toward hole; home background restored.
// V1534 C: cannon fires in sequence (no clone ghosts), fewer forced layouts (fx size cache, asset scan, shake, button press).
// V1535 C: restore hit shake and button bounce (two-frame class restart, per-class rAF).
// V1536 C: no costume glow on in-game moles, no 2D fallback while inventory 3D loads.
// V1537 C: round map tip greeting removed, rear/route 20% see-through + brightness with pan-linked light/shadow, cosmic layers off.
// V1538 C: round map 15% see-through, drag parallax (frame 1.2x, rear 0.8x), pan limited to image overhang (no black edge).
// V1539 C: round map scenery not see-through, stronger pan brightness (65-100%) and edge shadows on all three maps, top glow removed.
// V1540 C: home 리듬팡·두더지팡 new girl/boy mole characters (pop out of box), GO 30% smaller and right; round map pan effects removed, scenery brightness fixed 85%.
// V1541 C: new in-game mole (rise 6 + hit faces 5, no peek frames, multi-hit stays in place), bomb mole uses new rise1, hammer aim for new mole.
// V1542 C: no glow/shadow filter on moles const CACHE = 'mole-game-v1541-C'; animals, mole sprite natural aspect + crisper edges, killed mole holds hit face 0.15s.
// V1543 C: mole sprites sharpened (unsharp mask r1.8 200%).
// V1544 C: bomb mole perf — no fuse sparks, no glow; green outline + pulse, strong bomb red; blast death no per-frame blur.
// V1545 C: Normal round map new front art + frame (crystal cave, rope ladders), new hole coords; PANG word 3% lower.
// V1546 C: Normal map frame back to 100%, crystal glow pulse + twinkle on 14 crystals.
// V1547 C: round map frames 120% brighter (amateur/normal frame, pro side walls), normal top-dark depth shade.
// V1548 C: Normal frame 144% bright, 105% size, time-bomb animals use new bomb style, rabbit 92% + body-centered, hippo centered.
// V1549 C: emerge clods per season (spring leaf+light dirt, summer sand, autumn orange leaves, winter snowballs).
// V1550 C: Amateur round map new bright 3D cartoon art (hazed rear 30%, new route, new wall frame pushed to edges), full-screen map, tap shows/hides mode buttons (top) + wallet/start (bottom), hippo lower.
// V1551 C: Amateur rear back to original brightness, mode buttons aligned with X row, round art regenerated in high resolution (Codex).
// V1552 C: Amateur rear back to hazed 30% (V1550), round art shown at original brightness (no 85% filter).
// V1553 C: Normal round map new bright 3D cartoon art (same layout, 8% lower), new edge frame, old depth shade + crystal glow off; amateur round 7 tip below.
// V1554 C: Pro round map new bright 3D cartoon art (mirrored layout + stairs to round 1), edge frame, lava flow re-aligned (8 streaks, new mask); mode buttons centered on X with X's formula.
// V1555 C: Pro lava flow zones start at each streak's top rim (8 streaks re-measured), new mask.
// V1556 C: Quest screen bright day bg (CSS sky + drifting clouds + front art), 1-4 random butterflies/dragonflies, ach button = workshop yellow button + new arrows.
// V1557 C: Quest ach button brown + original size (panel height restored), max 2 bugs, bugs fly head-first, dragonfly wing flap.
// V1558 C: Daily bright arcade bg (sky + drifting clouds + front art) + slow sunlight sweep/tint; shop = bright market street bg (always day, no dim).
// V1559 C: Shop card panel color per tab (heart/weapon sky, coin/skill mint, ticket/costume pink).
// V1560 C: Round map rear brightness: normal 170%, pro 130% (incl. rear fluid).
// V1561 C: Screen transitions — hammer strike + tinted clouds cover, screens revealed only when all art is loaded (incl. visible 3D weapons), idle warm-up of screen art.
// V1562 C: Transition cover sized by target screen (full vs top panel), hammer hits exact center, min cloud hold 0.5s, pre-colored clouds (item blue), pop uses scale (no slide).
// V1563 C: Top-panel cover spans full screen width (mailbox right strip), full cover when leaving a full-screen screen.
// V1564 C: Upscaled transition clouds/burst (ESRGAN, 1024px), nav taps ignored while a transition runs (rapid-tap glitch).
// V1565 C: Round map bands wait for all visible art (round plates, wave mole, hippo, buttons), max 2.5s.
// V1566 C: Score screen tab / beach-neon labels re-applied in current language on open.
// V1567 G: Bright cloudless score palace background; carpet, rising clouds and score UI unchanged.
// V1568 G: Shared albums, full-screen transitions, Beach gulls, workshop-style Rhythm buttons and clipped press waves.
// V1570 G: Brighter stroke-only frame sweep; spotlights only on type selection; pill song-home button.
// V1571 G: Soft frame-only sweep in deeper matching colors, 30 percent opacity.
// V1572 G: visible build tag and resource/SW versions aligned to 1572.
// V1574 G: new loading stage/performers and source-aligned lamp, eight-bar equalizer and pad effects.
// V1575 G: lens-only alternating middle/outer paired sunglass reflections.
// V1576 G: tab dots inside the shop toggle shell; choices shifted slightly down.
// V1577 G: visible King Punch bounds and fixed shadow; weapon arrival waits for visible, ready models.
// V1578 G: King Punch shadow shares Mjolnir's fixed ground line, independently of lifted gloves.
// V1579 G: per-screen inventory shadows and idle goose mouth-synced sound.
// V1580 G: skip the idle quack MP3 quiet lead-in at mouth opening.
// V1580 G: keep King Punch's current glove transforms in the shop exit clone.
// V1581 G: compact gameplay glow, CSS contact popup and equal mailbox actions.
// V1581 G: KST daily heart/ticket delivery with 3-day catch-up and one test mail.
// V1582 G: retained shop panes, decoded first frames and unified smooth screen entry.
// V1583 G: gate startup on core art only; ignore document fragments as CSS images.
// V1583 G: replay weapon/skill/costume art and captions together on every pane entry.
// V1584 G: retain the original cover until ready; auto-retry without an asset error page.
// V1585 G: diagonal wipes replace glitch transitions, including mail/settings to home.
// V1586 G: prepare rhythm selection frames and freeze the exact song screen before returning home.
// V1587 G: automatic next-round waiting and clone-free rhythm home wipe.
// V1589 G: amateur round-one clay rig, independent hole rim, colored obstacles and restored effects.
// V1590 G: lower-hole checkerboard, selected v41, equal paired board cells and compact popup HUD.
// V1591 G: full viewport paired squares without notch or fixed HUD reservation.
// V1592 G: PANG on the matching keypad button; paired boards at95% viewport fit.
// V1593 G: joined 18-cell field, inverse control tiles and responsive six-slot HUD rails.
// V1605 G: clay character, enlarged pain-eye expression, RGB vertex colors and bomb shell centering.
// V1609 C: 3D 홈(?home3d=1 검토 전용) 바다 물결·빨간 점 알림, 화면 버전 표시를 커밋 번호와 맞춤(V1606~1608 C 는 home3d 가지 커밋).
// V1610 C: 3D 홈 바다를 실제 물결 모양으로(6겹 방향 물결 법선·하늘 반사·햇빛 반짝임·얕은 해안색·해안 거품).
// V1611 C: 3D 홈 해 이동(10분 한 바퀴·항상 낮)·그림자(섬 1초마다·두더지·구름 매 프레임)·입체 구름 5개, 그리기 반복 중복으로 걷기 동작이 멈추던 문제 수정.
// V1612 C: 3D 홈 그림자 매끄럽게(하드웨어 PCF 3x3, 두더지 전용 좁은 지도, 구름 그림자 계산식), 해 1시간·구름 초당 0.06 으로 아주 천천히.
// V1613 C: 3D 홈 놀이기구 2개(디스코 팡팡·바이킹, 임시 형태) 타기·내리기, 작은 지도 삭제(사용자 지정).
// V1614 C: 3D 홈을 기본 홈으로(?home3d=0 = 구형 홈 비교용), 검토 훅은 ?h3debug=1 에서만, iframe 초안 파일은 바탕화면 보관 폴더로 이동.
// V1615 C: 두더지팡 건물 = 아케이드 게임기(구멍 9개·게임 뿅망치 걸이·간판 상자 글자), 크기 2.84배, 시작 카메라는 아래에서 올려다보다 점프하면 보통 각도로.
// V1616 C: 두더지팡 게임기 뿅망치 가볍게(면 수 줄임)·야구공 그림(Tex_ 부품)·걸이 망치 머리 아래로, 아래 몸통 × 0.6·화면 아래 분홍 틈 × 0.5.
// V1617 C: 시작 때 일일출석 파일(daily.js)이 없으면 오류 칸에 받은 상태 기록 + 한 번 더 불러와 만들기(나머지 준비는 계속).
// V1618 C: 폰에 저장된 08:01 일일출석 'reading create' 예전 오류 기록 1회 삭제.
// V1619 C: 두더지팡 게임기 = 바로 시작(라운드 지도 없이)·구멍 = 1~8라운드(깬 구멍 빛, 지금 라운드 두더지, 가운데 보스 말)·모드 버튼 3개·화면 'OO N라운드 / BEST'.
// V1620 C: 깬 구멍 빛 = 구멍 위로 은은하게 퍼지는 빛(구멍과 같은 라운드 색).
// V1621 C: 라운드 지도 화면 완전 삭제(round-map*.js·roundmap-window.css·assets/roundmap), 띠 전환 = js/shape-transition.js, 라운드 깨면 광장으로, 리듬팡 버튼 = 시작.
// V1622 C: 게임기 정면에서 닿으면 동전 구멍으로 빨려 들어가 라운드 구멍 두더지로, 나가기 버튼(조이스틱 자리), 게임 끝나면 처음 시작 구멍에서.
// V1623 C: FPS 표시 위치 규칙 되살림(V1621 삭제 때 같이 사라져 화면 스크롤), 게임기 시작 = 구형 홈 연출 없이 바로, 동전 구멍 = 하늘색 테두리 세로 틈, 두더지 쏙 빨려 듦.
// V1624 C: V1623 C 와 같은 내용(Pages 배포 단계 일시 실패로 다시 올림).
// V1625 C: 빨려 들 때 서 있던 자세·방향 그대로, 나올 때도 동전 구멍에서 정면 보며, 동전 구멍 판 하늘색 테두리 위아래 가운데, 게임기 화면에서 간판까지 보이게.
// V1626 C: 게임기 화면으로 옮겨 갈 때 카메라가 게임기 몸통을 뚫고 지나가 화면이 가려지던 것 → 높이 올라 위로 넘어감.
// V1627 C: 나가기 = 동전 구멍에서 작게 나와 커지며, 나간 뒤 나가기 버튼 남던 버그 수정, 게임기 화면 크기 조정, 지금 라운드 구멍 금빛 깜빡임.
// V1628 C: 나가기 = 오른쪽 동전 구멍에서 화면 가운데로 나오며 커짐, 카메라는 뒤로만(좌우 안 움직임).
// V1629 C: 나가기 = 동전 구멍에서 작게(15%) 보이고 사선 한 줄로 가운데까지 나오며 커짐. 카메라 고정 값이 두더지 위치까지 바꾸던 버그 수정.
// V1630 C: 바이킹 놀이기구 삭제 → 해변 앞바다 배(Tripo), 점프 연타 날기·갑판 걷기·바다 빠지면 하트 -1·배 5분 → 광고 보면 하트 2(1시간 1번, 1분 안에) → 시작 구멍, 게임기 옆 점프 버튼이 예전 홈으로 게임 진입하던 버그 수정.
// V1631 C: 광장 우체통 삭제 → 설정 밑 메일 아이콘(빨간 점) + 상점 하트 팝업 모양의 메일 팝업, 배 보상 창도 같은 모양.
// V1632 C: 섬 반지름 12 → 16(건물 자리 그대로), 울타리·덤불·해변·배 바깥으로, 그림자 범위 넓힘.
// V1633 C: 코드로 만든 디스코 팡팡 삭제 → Tripo 디스코 팡팡(상판·받침, 배치만, 3만 면·그림 1024).
// V1634 C: 배포 정리 — 게임이 안 쓰는 옛 두더지 모델(mole-v41*.glb)·스프라이트 원본(assets/src) 저장소에서 뺌(바탕화면 에셋 보관장/배포정리_2026-11-06 보관).
// V1635 C: 날기 높이·거리 제한 없음, 높이 따라 카메라 올라가 섬이 작게 보임, 바다가 따라옴, 안개 거리 늘림, 오른쪽 높이 표시.
// V1636 C: 배 물에 잠김(수면 -0.62 빠뜨린 것), 갑판 = 배 그림 안 타원, 울타리 걸어서 못 지나감(해변↔섬은 날아서).
// V1637 C: 설정 창 새 톤 — 아이콘 9개 교체(ChatGPT 파스텔 3D), 나무판 없앰, 이름판·버튼·스위치·카드 색만 CSS로.
// V1638 C: 설정 창 가운데·메일함 테두리 통일·뒤 광장 어둡게, 설정 전환 효과 없음, 닫기 버튼 창 아래, 문의·언어·메일함 좌우 폭 = 설정 창, 종이비행기·편지(빨간 하트) 새 그림, 광장 메일 버튼은 기존 그림.
// V1639 C: 스코어 CSS 새 톤(줄 크림+금색, 리듬팡 탭 하늘색, 안내 띠 크림) + 새 간판(사용자 ChatGPT).
// V1640 C: 스코어 배경 = 놀이공원 무대, 양탄자 = 보라·노랑 새 그림(사용자 ChatGPT), 리듬팡 곡 줄·앨범 제목 새 톤.
// V1641 C: 스코어 양탄자 = 기존 크기의 95%.
// V1642 C: 스코어 배경 = 기존 궁전 그림으로 되돌림(놀이공원 배경 안 씀).
// V1643 C: 메일함 안 편지(env-*) = 새 편지 그림(읽은 편지는 흐린 회색), 광장 버튼만 기존 그림.
// V1644 C: 일일 화면 새 톤 — 새 간판·새 큰 틀(9조각), 카드 크림+금색, 미수령 크림 회색.
// V1645 C: 일일 판 비율 = 틀 그림(원·별 안 늘어남), 카드 상하좌우 가운데(49px), 안쪽 카드 작게, '매일 출석하고' 글 삭제.
// V1646 C: 일일 배경 = 새 그림(선물 방, 사용자 ChatGPT) — 옛 배경 속 두더지 없어짐.
// V1647 C: 퀘스트 CSS 새 톤(나무 갈색 → 크림+금색, 올클리어 연보라, 업적 버튼 크림).
// V1648 C: 퀘스트·업적 새 간판(빈 간판+제목 가운데)·새 배경(놀이공원 광장).
const CACHE = 'mole-game-v1648-C';

// 화면별 BGM(audio/bgm-*.mp3)은 v275 부터 SHELL 에 포함 — 기본 켜짐(v272)이라 항상 필요하고,
// 캐시가 안 돼 있으면 오프라인/느린망에서 재생 실패했음.
// vendor/face_mesh/*(약 10MB, 얼굴인식)는 SHELL 제외 — 사람두더지 메이커 처음 열 때만 필요.
// 처음 요청될 때 아래 fetch 핸들러가 알아서 캐시한다.
const SHELL = [
  './clay-round1-local.css',
  './js/clay-rig-math.js',
  './js/clay-rig-runtime.js',
  './js/clay-round1-local.js',
  './assets/checkerboard-v1590/cell-0.webp',
  './assets/checkerboard-v1590/cell-1.webp',
  './assets/checkerboard-v1590/cell-2.webp',
  './assets/checkerboard-v1590/cell-3.webp',
  './assets/checkerboard-v1590/cell-4.webp',
  './assets/checkerboard-v1590/cell-5.webp',
  './assets/checkerboard-v1590/cell-6.webp',
  './assets/checkerboard-v1590/cell-7.webp',
  './assets/checkerboard-v1590/cell-8.webp',
  './assets/checkerboard-v1590/floor-mask.webp',
  './assets/checkerboard-v1590/mole-clay-v43.glb',
  './assets/clay-round1-local/field.webp',
  './assets/clay-round1-local/hole-back.webp',
  './assets/clay-round1-local/hole-front.webp',
  './assets/clay-round1-local/mole-belly-v15.glb',
  './rhythm-type-lighting-v1569.css',
  './js/rhythm-type-lighting-v1569.js',
  './assets/rhythm/type-lights-v1569/stage-dark.webp',
  './assets/rhythm/type-lights-v1569/mount.webp',
  './assets/rhythm/type-lights-v1569/heads-six-poses.webp',
  './assets/rhythm/type-lights-v1569/beams-four.webp',
  './assets/rhythm/type-lights-v1569/stars-eight.webp',
  './rhythm-buttons-v1568.css',
  './js/rhythm-button-feedback-v1568.js',
  './js/shop-models-v1509.js',
  './js/game-cannon-model-v1509.js',
  './assets/ui-approved-v1509/shop-tab-sword.png',
  './assets/ui-approved-v1509/shop-tab-skill-orb.png',
  './assets/skill-tab-layers-20261030/hand-2x.png',
  './assets/skill-tab-layers-20261030/ring-matte-gold-2x.png',
  './assets/skill-tab-v1519/ring-repaired-2x.png',
  './assets/skill-tab-v1519/lightning-atlas.png',
  './assets/skill-tab-v1519/lightning-1.png',
  './assets/skill-tab-v1519/lightning-2.png',
  './assets/skill-tab-v1519/lightning-3.png',
  './assets/skill-tab-v1519/lightning-4.png',
  './assets/skill-tab-v1519/lightning-5.png',
  './assets/ui-approved-v1509/shop-tab-costume.png',
  './assets/shop-models-v1509/hammer-v5-batched-v1509.glb',
  './assets/shop-models-v1509/goldhammer-v18-batched-v1520.glb',
  './assets/shop-models-v1509/cannon-v1-batched-v1509.glb',
  './assets/weapon-stills-v1509/cannon-hero.png',
  './assets/weapon-stills-v1509/cannon-front.png',
  './assets/weapon-stills-v1509/goldhammer-front.png',
  './assets/weapon-stills-v1509/goldhammer-15.png',
  './assets/workshop/goose-idle-original-aligned-v1499.webp',
  './assets/shop-ui-v1452/coin-option-01.png',
  './assets/score/bg-palace-bright-v1567.webp',
  './assets/score/icon-close-red.svg',
  './assets/score/icon-back-red.svg',
  './assets/score/icon-help-blue.svg',
  './assets/inventory/ui-v1379/title-blue-9slice-v1508.svg',
  './assets/score/card-1-clean-75c39b75eb.svg',
  './assets/score/card-2-clean-6cf5c67ce5.svg',
  './assets/score/card-3-clean-aa5a6fdc34.svg',
  './assets/score/icon-info-blue.svg',
  './assets/score/notice-frame-9slice-v1496.svg',
  './js/item-inventory.js',
  './js/shop-scenery-v1486.js',
  './assets/shop-background-v1486/market-v1558.jpg',
  './assets/ui-transition-v1561/cloud.webp',
  './assets/ui-transition-v1561/cloud-blue.webp',
  './assets/ui-transition-v1561/cloud-sky.webp',
  './assets/ui-transition-v1561/cloud-pink.webp',
  './assets/ui-transition-v1561/cloud-orange.webp',
  './assets/ui-transition-v1561/cloud-purple.webp',
  './assets/ui-transition-v1568/cloud-green.webp',
  './assets/ui-transition-v1568/cloud-teal.webp',
  './assets/ui-transition-v1568/cloud-red.webp',
  './assets/ui-transition-v1561/burst.webp',
  './assets/shop-background-v1486/night.jpg',
  './assets/skills/shop-hd-v1484/shield-clean.webp',
  './assets/skills/shop-hd-v1484/targeting-clean.webp',
  './assets/skills/shop-hd-v1484/ai-clean.webp',
  './assets/skills/shop-hd-v1484/set-triangle-clean.webp',
  './js/asset-loader-v1477.js',
  './assets/ui-approved-v1476/ticket-stack-08.webp',
  './assets/ui-approved-v1476/ticket-stack-02.webp',
  './assets/ui-approved-v1476/ticket-stack-11.webp',
  './assets/ui-approved-v1476/ticket-stack-14.webp',

  './assets/shop-ticket-options/ticket-option-01.png',
  './assets/shop-ticket-options/ticket-option-09.png',
  './assets/game-image-manifest-v1470.json',
  './assets/shop-ui-v1452/coin-single.png',
  './assets/shop-ui-v1452/coin-stack-three.png',
  './assets/shop-ui-v1452/coin4-source.png',
  './assets/shop-ui-v1452/coin4-button-left.png',
  './assets/shop-ui-v1452/coin4-toggle-right.png',
  './assets/shop-ui-v1452/coin-option-01-bright20.png',
  './assets/shop-ui-v1452/coin-option-05-bright20.png',
  './assets/shop-ui-v1452/coin-option-06-bright20.png',
  './assets/shop-ui-v1452/coin-option-09-bright20.png',
  './assets/shop-ui-v1452/ticket-single.png',
  './assets/ui-approved-v1476/ticket-single.webp',
  './assets/workshop/notice-clean-v2.png',
  './assets/workshop/exclamation-blue-v1.png',
  './assets/inventory/ui-v1379/help-round-transparent.webp',
  './assets/inventory/ui-v1379/ability-pill-transparent.webp',
  './assets/inventory/ui-v1379/equip-pill-transparent.webp',
  './assets/inventory/ui-v1379/cabinet-frame-clean-v1413.webp',
  './assets/inventory/ui-v1379/grade-basic.webp',
  './assets/rhythm/ui/ic-ticket-note-v1424.webp',
  './assets/home2/btn-frame-sky-v1423.png',
  './assets/inventory/ui-v1379/pill-blue-w42-v1412.webp',
  './assets/inventory/ui-v1379/pill-blue-w65-v1412.webp',
  './assets/workshop/w-alipunch-idle-v1406.png',
  './assets/workshop/ham-gold-v1407.webp',
  './assets/workshop/ham-gold-zap1-v1409.webp',
  './assets/workshop/ham-gold-zap2-v1409.webp',
  './assets/workshop/ham-gold-zap3-v1409.webp',
  './assets/workshop/ham-gold-zap4-v1409.webp',
  './assets/workshop/ham-gold-zap5-v1409.webp',
  './assets/workshop/ham-gold-zap6-v1409.webp',
  './assets/weapons/goldpaw-zap1-v1409.webp',
  './assets/weapons/goldpaw-zap2-v1409.webp',
  './assets/weapons/goldpaw-zap3-v1409.webp',
  './assets/weapons/goldpaw-zap4-v1409.webp',
  './assets/weapons/goldpaw-zap5-v1409.webp',
  './assets/weapons/goldpaw-zap6-v1409.webp',
  './assets/weapons/goldpaw-90-zap1-v1409.webp',
  './assets/weapons/goldpaw-90-zap2-v1409.webp',
  './assets/costume/char-blue_bears-v1406.webp',
  './assets/costume/char-blue_bears-blink-v1406.webp',
  './assets/costume/char-mount_stars-blink-v1406.webp',
  './assets/costume/char-cloud_cups-blink-v1406.webp',
  './assets/costume/char-mount_stars-v1406.webp',
  './assets/costume/char-cloud_cups-v1406.webp',
  './assets/costume/outfit-blue_bears.png',
  './assets/costume/outfit-mount_stars.png',
  './assets/costume/outfit-cloud_cups.png',
  './assets/inventory/ui-v1379/approved-mallet-redend-v1405.webp',
  './assets/inventory/skill-v1403/tab-cream.webp',
  './assets/inventory/skill-v1403/tab-orange.webp',
  './assets/home-btn-matte-v1405.png',
  './assets/score/btn-undo-matte-v1405.png',
  './assets/inventory/skill-v1403/frame-clean-v1413.webp',
  './assets/inventory/skill-v1403/case.webp',
  './assets/inventory/skill-v1403/slotpanel.webp',
  './assets/inventory/skill-v1403/slotring.webp',
  './assets/inventory/skill-v1403/card.webp',
  './assets/inventory/skill-v1403/countbox.webp',
  './assets/skills/targeting-v1403.png',
  './assets/workshop/w-cannon-v1398.png',
  './assets/workshop/w-cannon-front-v1435.png',
  './assets/workshop/w-goldhammer-v1398.png',
  './assets/workshop/w-alipunch-v1398.png',
  './assets/inventory/ui-v1379/plate-basic-clean-v1412.webp',
  './assets/inventory/ui-v1379/plate-rare-clean-v1412.webp',
  './assets/inventory/ui-v1379/plate-epic-clean-v1412.webp',
  './assets/inventory/ui-v1379/plate-legend-clean-v1412.webp',
  './assets/inventory/ui-v1379/grade-rare.webp',
  './assets/inventory/ui-v1379/grade-epic.webp',
  './assets/inventory/ui-v1379/grade-legend.webp',
  './assets/inventory/ui-v1379/approved-mallet.webp',
  './assets/weapons/mallet-yaw10-rest15-v1379.png',



  './js/rhythm-status-art.js',
  './js/rhythm-status-fx.js',
  './assets/rhythm/status-perfect-v1237/star.png',
  './assets/rhythm/status-perfect-v1237/star-map.png',
  './assets/rhythm/status-perfect-v1237/shell.png',
  './assets/rhythm/status-perfect-v1237/crab.png',
  './assets/rhythm/status-perfect-v1237/crab-map.png',
  './assets/rhythm/status-perfect-v1237/gull.png',
  './assets/rhythm/status-perfect-v1237/gull-map.png',
  './assets/rhythm/ui-status-v1232/clock.png',
  './assets/rhythm/ui-status-v1230/score-box.png',
  './assets/rhythm/ui-status-v1230/score-icons.png',
  './assets/rhythm/ui-status-v1230/judgement-box.png',
  './assets/rhythm/ui-status-v1230/judgement-icons.png',
  './assets/rhythm/ui-status-v1230/combo-box.png',
  './assets/rhythm/ui-status-v1230/combo-icons.png',
  './assets/rhythm/ui-status-v1230/time-box.png',
  './assets/rhythm/ui-status-v1230/time-icons.png',
  './assets/rhythm/ui/d-frame-neon-song-cloud-v1224.svg',
  './assets/rhythm/ui/d-frame-neon-difficulty-cloud-v1224.svg',
  './assets/rhythm/ui/d-frame-beach-song-v1220.svg',
  './assets/rhythm/ui/go-frame-beach-blue-v1227.png',
  './assets/rhythm/ui/go-frame-neon-v1198.png',
  './assets/rhythm/ui/go-inner-neon-v1198.png',
  './assets/rhythm/ui/p-frame-neon-v1197.png',
  './assets/rhythm/ui/p-frame-neon-straight-v1216.png',
  './assets/rhythm/ui/p-inner-neon-v1197.png',
  './assets/rhythm/ui/p-frame-clean-v1196.png',
  './assets/rhythm/ui/btn-neon-type-v1211.png',
  './assets/rhythm/ui/d-frame-type-clean-v1210.png',
  './js/rhythm-beach.js',
  './assets/rhythm/beach-v1172/hippo-happy.webp',
  './assets/rhythm/beach-v1172/hippo-hurt.webp',
  './assets/rhythm/beach-v1172/hippo-arm.webp',
  './assets/rhythm/beach-v1172/hippo-hand-mallet.webp',
  './assets/rhythm/beach-v1172/hippo-hand-mallet-v2.png',
  './assets/rhythm/beach-v1172/hippo-cloud-clump-1-v2.png',
  './assets/rhythm/beach-v1172/hippo-cloud-clump-2-v2.png',
  './assets/rhythm/beach-v1172/hippo-cloud-clump-3-v2.png',
  './assets/rhythm/beach-v1172/sea-atlas.webp',
  './assets/rhythm/beach-v1172/target-1.svg',
  './assets/rhythm/beach-v1172/target-2.svg',
  './assets/rhythm/beach-v1172/target-3.svg',
  './assets/rhythm/beach-v1172/target-4.svg',
  './assets/rhythm/beach-target-v1250/target-1.svg',
  './assets/rhythm/beach-target-v1250/target-2.svg',
  './assets/rhythm/beach-target-v1250/target-3.svg',
  './assets/rhythm/beach-target-v1250/target-4.svg',
  './assets/rhythm/type-cyber-bg-clean-v1213.webp',
  './assets/rhythm/albums-v1568/le-monde-attendra-demain.webp',
  './assets/rhythm/albums-v1568/meet-me-halfway.webp',
  './assets/rhythm/albums-v1568/paper-engine-ride.webp',
  './assets/rhythm/albums-v1568/the-world-is-wide.webp',
  './assets/rhythm/albums-v1568/be-my-destiny.webp',
  './assets/rhythm/albums-v1568/take-this-night-around.webp',

  './js/rhythm-lyrics.js',
  './audio/rp/le-monde-attendra-demain-lyrics.json',
  './audio/rp/meet-me-halfway-lyrics.json',
  './audio/rp/paper-engine-ride-lyrics.json',
  './audio/rp/the-world-is-wide-lyrics.json',
  './audio/rp/be-my-destiny-lyrics.json',
  './audio/rp/take-this-night-around-lyrics.json',
  './audio/rp/paper-engine-ride.mp3',
  './audio/rp/paper-engine-ride.json',
  './audio/rp/the-world-is-wide.mp3',
  './audio/rp/the-world-is-wide.json',
  './audio/rp/le-monde-attendra-demain-a.json',
  './audio/rp/meet-me-halfway-a.json',
  './audio/rp/paper-engine-ride-a.json',
  './audio/rp/the-world-is-wide-a.json',
  './audio/rp/be-my-destiny.mp3',
  './audio/rp/be-my-destiny.json',
  './audio/rp/be-my-destiny-a.json',
  './audio/rp/take-this-night-around.mp3',
  './audio/rp/take-this-night-around.json',
  './audio/rp/take-this-night-around-a.json',
  './assets/rhythm/bg-beach-calm-v1164.png',
  './assets/rhythm/ui-status-v1164/score.png',
  './assets/rhythm/ui-status-v1164/judgement.png',
  './assets/rhythm/ui-status-v1164/combo.png',
  './assets/rhythm/ui-status-v1164/time.png',
  './assets/loading-v1573/stage-2x.webp',
  './assets/loading-v1574/characters-4x.webp',
  './assets/loading-v1574/front-panel.webp',
  './audio/rp/meet-me-halfway.mp3',
  './audio/rp/meet-me-halfway.json',
  './assets/rhythm-b/button-face-v1120/face-0.svg',
  './assets/rhythm-b/button-face-v1120/face-1.svg',
  './assets/rhythm-b/button-face-v1120/face-2.svg',
  './assets/rhythm-b/button-face-v1120/face-3.svg',
  './assets/rhythm-b/button-face-v1120/face-4.svg',
  './assets/rhythm-b/button-face-v1120/face-5.svg',
  './assets/rhythm-b/button-face-v1120/face-6.svg',
  './assets/rhythm-b/button-face-v1120/face-7.svg',
  './assets/rhythm-b/button-face-v1120/face-8.svg',

  './assets/rhythm-b/combo-core-mask-v1124.svg',
  './assets/rhythm-b/combo-inner-frame-v1124.svg',
  './assets/rhythm-b/upper-core-v1124/core-0.svg',
  './assets/rhythm-b/upper-core-v1124/core-1.svg',
  './assets/rhythm-b/upper-core-v1124/core-2.svg',
  './assets/rhythm-b/upper-core-v1124/core-3.svg',
  './assets/rhythm-b/upper-core-v1124/core-4.svg',
  './assets/rhythm-b/upper-core-v1124/core-5.svg',
  './assets/rhythm-b/upper-core-v1124/core-6.svg',
  './assets/rhythm-b/upper-core-v1124/core-7.svg',
  './assets/rhythm-b/upper-core-v1124/core-8.svg',

  './assets/rhythm-b/button-base-v1118/press-0.svg',
  './assets/rhythm-b/button-base-v1118/press-1.svg',
  './assets/rhythm-b/button-base-v1118/press-2.svg',
  './assets/rhythm-b/button-base-v1118/press-3.svg',
  './assets/rhythm-b/button-base-v1118/press-4.svg',
  './assets/rhythm-b/button-base-v1118/press-5.svg',
  './assets/rhythm-b/button-base-v1118/press-6.svg',
  './assets/rhythm-b/button-base-v1118/press-7.svg',
  './assets/rhythm-b/button-base-v1118/press-8.svg',

  './assets/rhythm-b/button-base-v1118/base-0.svg',
  './assets/rhythm-b/button-face-v1124/face-0.svg',
  './assets/rhythm-b/button-base-v1118/base-1.svg',
  './assets/rhythm-b/button-face-v1124/face-1.svg',
  './assets/rhythm-b/button-base-v1118/base-2.svg',
  './assets/rhythm-b/button-face-v1124/face-2.svg',
  './assets/rhythm-b/button-base-v1118/base-3.svg',
  './assets/rhythm-b/button-face-v1124/face-3.svg',
  './assets/rhythm-b/button-base-v1118/base-4.svg',
  './assets/rhythm-b/button-face-v1124/face-4.svg',
  './assets/rhythm-b/button-base-v1118/base-5.svg',
  './assets/rhythm-b/button-face-v1124/face-5.svg',
  './assets/rhythm-b/button-base-v1118/base-6.svg',
  './assets/rhythm-b/button-face-v1124/face-6.svg',
  './assets/rhythm-b/button-base-v1118/base-7.svg',
  './assets/rhythm-b/button-face-v1124/face-7.svg',
  './assets/rhythm-b/button-base-v1118/base-8.svg',
  './assets/rhythm-b/button-face-v1124/face-8.svg',

  './assets/rhythm-b/glass-lower-v1109/lower-0.png',
  './assets/rhythm-b/glass-lower-v1109/lower-1.png',
  './assets/rhythm-b/glass-lower-v1109/lower-2.png',
  './assets/rhythm-b/glass-lower-v1109/lower-3.png',
  './assets/rhythm-b/glass-lower-v1109/lower-4.png',
  './assets/rhythm-b/glass-lower-v1109/lower-5.png',
  './assets/rhythm-b/glass-lower-v1109/lower-6.png',
  './assets/rhythm-b/glass-lower-v1109/lower-7.png',
  './assets/rhythm-b/glass-lower-v1109/lower-8.png',

  './',
  './index.html',
  './style.css',
  '../cosmic-theme.css',
  '../common/settings.css',
  '../common/settings.js',
  '../common/i18n.js',
  './js/i18n-strings.js',
  './manifest.json',
  './icons/icon-192-hippo.png',
  './icons/icon-512-hippo.png',
  './assets/board-scene.jpg',
  './assets/board-scene-spring.jpg',
  './assets/board-scene-summer.jpg',
  './assets/board-scene-autumn.jpg',
  './assets/board-scene-winter.jpg',
  './assets/board-scene-night.jpg',
  './assets/avatar-mole.png',
  './assets/avatar-hippo.png',
  './assets/cloud1.png',
  './assets/cloud2.png',
  './assets/hammer.png',
  './assets/weapons/cannon-a1.png',
  './assets/weapons/cannon-a2.png',
  './assets/weapons/cannon-a3.png',
  './assets/weapons/cannon-a4.png',
  './assets/weapons/cannon-a5.png',
  './assets/weapons/cannon-ball.png',
  './assets/weapons/cannon-fx1.png',
  './assets/weapons/cannon-fx4.png',
  './assets/weapons/cannon-fx5.png',
  './assets/weapons/goldpaw-v1382.webp',
  './assets/weapons/cannon-a1-nol-v1392.png',
  './assets/weapons/cannon-a2-nol-v1392.png',
  './assets/weapons/cannon-a3-nol-v1392.png',
  './assets/weapons/cannon-a3-mirror-nol-v1392.png',
  './assets/weapons/cannon-a4-nol-v1392.png',
  './assets/weapons/cannon-a4-mirror-nol-v1392.png',
  './assets/weapons/cannon-a5-nol-v1392.png',
  './assets/weapons/cannon-intro-body-nol-v1392.png',
  './assets/weapons/cannon-intro-body-flip-nol-v1392.png',
  './assets/weapons/cannon-intro-wheel-nol-v1392.png',
  './assets/weapons/goldpaw-90-v1385.webp',
  './assets/weapons/kingfist-idle-v1390.webp',
  './assets/weapons/kingfist-jab-v1390.webp',
  './assets/weapons/kingfist-jab-mirror-v1390.webp',
  './assets/weapons/kingfist-straight-v1390.webp',
  './assets/weapons/kingfist-upper-v1390.webp',
  './assets/weapons/goldhammer.png',
  './assets/weapons/goldhammer-0.png',
  './assets/weapons/goldhammer-90.png',
  './assets/weapons/alipunch-jab.png',
  './assets/weapons/alipunch-straight.png',
  './assets/weapons/alipunch-upper.png',
  './assets/costume/char-blue_bears-detail.png',
  './assets/costume/char-red_wings-detail.png',
  './assets/costume/char-mount_stars-detail.png',
  './assets/costume/char-sun_giants-detail.png',
  './assets/costume/char-cloud_cups-detail.png',
  './assets/costume/emblem-blue_bears.png',
  './assets/costume/emblem-red_wings.png',
  './assets/costume/emblem-mount_stars.png',
  './assets/costume/emblem-sun_giants.png',
  './assets/costume/emblem-cloud_cups.png',
  './assets/costume/emblem-cap-blue_bears.png',
  './assets/costume/emblem-cap-red_wings.png',
  './assets/costume/emblem-cap-mount_stars.png',
  './assets/costume/emblem-cap-sun_giants.png',
  './assets/costume/emblem-cap-cloud_cups.png',
  './assets/costume2/card-blue_bears.jpg',
  './assets/costume2/card-red_wings.jpg',
  './assets/costume2/card-mount_stars.jpg',
  './assets/costume2/card-sun_giants.jpg',
  './assets/costume2/card-cloud_cups.jpg',
  './assets/costume2/bg-cabin.jpg',
  './assets/costume2/sign.png',
  './assets/costume2/tab-frame.png',
  './assets/costume2/tab-green.png',
  './assets/costume2/tab-blue.png',
  './assets/costume2/tab-green-press.png',
  './assets/costume2/tab-blue-press.png',
  './assets/contact/bar.png',
  './assets/contact/btn.png',
  './assets/contact/field.png',
  './assets/contact/frame.png',
  './assets/contact/frame-top.png',
  './assets/contact/frame-filled.png',
  './assets/contact/leaf-bl.png',
  './assets/contact/leaf-br.png',
  './assets/contact/leaf.png',
  './assets/contact/plane.png',
  './assets/contact/trail.png',
  './assets/settings2/card.png',
  './assets/settings2/head.png',
  './assets/settings2/ic-contact.png',
  './assets/settings2/ic-globe.png',
  './assets/settings2/ic-guide.png',
  './assets/settings2/ic-music.png',
  './assets/settings2/ic-noad.png',
  './assets/settings2/ic-shield.png',
  './assets/settings2/ic-sound.png',
  './assets/settings2/ic-trash.png',
  './assets/settings2/ic-vib.png',
  './assets/settings2/ic-contact-2x.png',
  './assets/settings2/ic-globe-2x.png',
  './assets/settings2/ic-guide-2x.png',
  './assets/settings2/ic-music-2x.png',
  './assets/settings2/ic-noad-2x.png',
  './assets/settings2/ic-shield-2x.png',
  './assets/settings2/ic-sound-2x.png',
  './assets/settings2/ic-trash-2x.png',
  './assets/settings2/ic-vib-2x.png',
  './assets/settings2/plank-A-v1526.png',
  './assets/settings2/plank.png',
  './assets/settings2/slot-arrow.png',
  './assets/settings2/slot-drop.png',
  './assets/settings2/tog-off.png',
  './assets/settings2/tog-on.png',
  './assets/settings2/wood.png',
  './assets/mailbox/back.png',
  './assets/mailbox/bg.jpg',
  './assets/mailbox/btn-blue.png',
  './assets/mailbox/btn-green.png',
  './assets/mailbox/btn-red.png',
  './assets/mailbox/card.png',
  './assets/mailbox/env-blue.png',
  './assets/mailbox/env-heart.png',
  './assets/mailbox/env-pink.png',
  './assets/mailbox/env-read.png',
  './assets/mailbox/env-red.png',
  './assets/mailbox/env-yellow.png',
  './assets/mailbox/frame-bare.png',
  './assets/mailbox/ic-check.png',
  './assets/mailbox/ic-mail.png',
  './assets/mailbox/plank.png',
  './assets/mailbox/rw-coin.png',
  './assets/mailbox/rw-gift.png',
  './assets/mailbox/rw-heart.png',
  './assets/mailbox/rw-ticket.png',
  './assets/photo2/card-blue.png',
  './assets/photo2/card-gold.png',
  './assets/photo2/coll-bg.jpg',
  './assets/photo2/coll-card.png',
  './assets/photo2/emb-blue_bears.png',
  './assets/photo2/emb-cloud_cups.png',
  './assets/photo2/emb-mount_stars.png',
  './assets/photo2/emb-red_wings.png',
  './assets/photo2/emb-sun_giants.png',
  './assets/photo2/frame.png',
  './assets/photo2/stand.png',
  './assets/skin2/arrow-l.png',
  './assets/skin2/arrow-r.png',
  './assets/skin2/bg-skill.jpg',
  './assets/skin2/bg-weapon.jpg',
  './assets/skin2/ic-active.png',
  './assets/skin2/ic-passive.png',
  './assets/skin2/rt-cream.png',
  './assets/skin2/rt-panel.png',
  './assets/skin2/rt-plank.png',
  './assets/skin2/rt-slot.png',
  './assets/skin2/sk-cell.png',
  './assets/skin2/sk-next.png',
  './assets/skin2/sk-plank.png',
  './assets/skin2/sk-plus.png',
  './assets/skin2/sk-pnum.png',
  './assets/skin2/sk-prev.png',
  './assets/skin2/sk-restore.png',
  './assets/skin2/w-cardframe.png',
  './assets/costume2/box-frame-s.png',
  './assets/costume2/box-frame-w.png',
  './assets/costume2/leather-w.png',
  './assets/costume2/parchment.png',
  './assets/costume2/leaf-a.png',
  './assets/costume2/leaf-b.png',
  './assets/costume/logo.png',
  './assets/costume/bg-stadium.jpg',
  './assets/costume/clock.png',
  './assets/costume/trophy.png',
  './assets/skills/freeze.png',
  './assets/skills/gold-double-v2.png',
  './assets/skills/targeting.png',
  './assets/skills/carpet_bombing.png',
  './assets/skills/ai.png',
  './assets/skills/shield.png',
  './assets/skills/fever_time.png',
  './assets/skills/active_skill.png',
  './assets/skills/passive_skill.png',
  './assets/skills/restore.png',
  './assets/photo/background.jpg',
  './assets/photo/collection-grid.jpg',
  './assets/photo/pedestal_blue.png',
  './assets/photo/pedestal_gold.png',
  './assets/photo/collection-trophy.png',
  './assets/photo/collection-starbar.png',
  './assets/photo/characters/round_blue_bears-hd.webp',
  './assets/photo/characters/round_mount_stars-hd.webp',
  './assets/photo/characters/round_cloud_cups-hd.webp',
  './assets/photo/characters/sturdy_blue_bears-hd.webp',
  './assets/photo/characters/sturdy_mount_stars-hd.webp',
  './assets/photo/characters/sturdy_cloud_cups-hd.webp',
  './assets/photo/characters/sharp_blue_bears-hd.webp',
  './assets/photo/characters/sharp_mount_stars-hd.webp',
  './assets/photo/characters/sharp_cloud_cups-hd.webp',
  './assets/photo/characters/round_blue_bears.png',
  './assets/photo/characters/sturdy_blue_bears.png',
  './assets/photo/characters/sharp_blue_bears.png',
  './assets/photo/characters/round_red_wings.png',
  './assets/photo/characters/sturdy_red_wings.png',
  './assets/photo/characters/sharp_red_wings.png',
  './assets/photo/characters/round_mount_stars.png',
  './assets/photo/characters/sturdy_mount_stars.png',
  './assets/photo/characters/sharp_mount_stars.png',
  './assets/photo/characters/round_sun_giants.png',
  './assets/photo/characters/sturdy_sun_giants.png',
  './assets/photo/characters/sharp_sun_giants.png',
  './assets/photo/characters/round_cloud_cups.png',
  './assets/photo/characters/sturdy_cloud_cups.png',
  './assets/photo/characters/sharp_cloud_cups.png',
  './assets/costume/tshirt.png',
  './assets/shop/single-heart.png',
  './assets/shop/ad-icon.png',
  './assets/shop-ui-v1450/01-awning.webp',
  './assets/shop-ui-v1450/11-heart.webp',
  './assets/shop-ui-v1450/12-quantity-badge.webp',
  './assets/shop-ui-v1450/27-coins-three.webp',
  './assets/shop-ui-v1450/costume-icon.png',
  './assets/shop-ui-v1450/skill-icon.png',
  './assets/shop-ui-v1450/ticket-icon.webp',
  './assets/ui-approved-v1476/ad-icon.webp',
  './assets/inventory/ui-v1379/nameplate.webp',
  './assets/shop-ui-v1450/heart-jar-full.png',
  './assets/shop/mini-1.png',
  './assets/shop/mini-2.png',
  './assets/shop/mini-3.png',
  './assets/shop/mini-4.png',
  './assets/shop/mini-5.png',
  './assets/shop/mini-6.png',
  './assets/hippo/happy1.png',
  './assets/hippo/happy2.png',
  './assets/hippo/happy3.png',
  './assets/hippo/sad1.png',
  './assets/hippo/sad2.png',
  './assets/hippo/sad3.png',
  './assets/moles/mole2-rise1.png',
  './assets/moles/mole2-rise2.png',
  './assets/moles/mole2-rise3.png',
  './assets/moles/mole2-rise4.png',
  './assets/moles/mole2-rise5.png',
  './assets/moles/mole2-rise6.png',
  './assets/moles/mole2-hit1.png',
  './assets/moles/mole2-hit2.png',
  './assets/moles/mole2-hit3.png',
  './assets/moles/mole2-hit4.png',
  './assets/moles/mole2-hit5.png',
  './assets/moles/mole1.png',
  './assets/moles/mole-head1.png',
  './assets/moles/mole-peek1.png',
  './assets/moles/mole-head2.png',
  './assets/moles/mole-peek2.png',
  './assets/moles/mole-head3.png',
  './assets/moles/mole-peek3.png',
  './assets/moles/mole-head4.png',
  './assets/moles/mole-peek4.png',
  './assets/moles/mole-head5.png',
  './assets/moles/mole-peek5.png',
  './assets/moles/mole-head6.png',
  './assets/moles/mole-peek6.png',
  './assets/moles/mole-head7.png',
  './assets/moles/mole-peek7.png',
  './assets/moles/mole-head8.png',
  './assets/moles/mole-peek8.png',
  './assets/moles/mole9.png',
  './assets/moles/mole-head9.png',
  './assets/moles/mole-peek9.png',
  './assets/moles/mole10.png',
  './assets/moles/mole-head10.png',
  './assets/moles/mole-peek10.png',
  './assets/moles/mole11.png',
  './assets/moles/mole-head11.png',
  './assets/moles/mole-peek11.png',
  './assets/moles/mole12.png',
  './assets/moles/mole-head12.png',
  './assets/moles/mole-peek12.png',
  './assets/moles/mole13.png',
  './assets/moles/mole-head13.png',
  './assets/moles/mole-peek13.png',
  './assets/moles/mole14.png',
  './assets/moles/mole-head14.png',
  './assets/moles/mole-peek14.png',
  './assets/moles/mole15.png',
  './assets/moles/mole-head15.png',
  './assets/moles/mole-peek15.png',
  './assets/moles/lion1.png',
  './assets/moles/lion-head1.png',
  './assets/moles/lion-peek1.png',
  './assets/moles/lion2.png',
  './assets/moles/lion-head2.png',
  './assets/moles/lion-peek2.png',
  './assets/moles/lion3.png',
  './assets/moles/lion-head3.png',
  './assets/moles/lion-peek3.png',
  './assets/moles/lion4.png',
  './assets/moles/lion-head4.png',
  './assets/moles/lion-peek4.png',
  './assets/moles/lion5.png',
  './assets/moles/lion-head5.png',
  './assets/moles/lion-peek5.png',
  './assets/moles/lion6.png',
  './assets/moles/lion-head6.png',
  './assets/moles/lion-peek6.png',
  './assets/moles/rabbit1.png',
  './assets/moles/rabbit-head1.png',
  './assets/moles/rabbit-peek1.png',
  './assets/moles/rabbit2.png',
  './assets/moles/rabbit-head2.png',
  './assets/moles/rabbit-peek2.png',
  './assets/moles/rabbit3.png',
  './assets/moles/rabbit-head3.png',
  './assets/moles/rabbit-peek3.png',
  './assets/moles/rabbit4.png',
  './assets/moles/rabbit-head4.png',
  './assets/moles/rabbit-peek4.png',
  './assets/moles/rabbit5.png',
  './assets/moles/rabbit-head5.png',
  './assets/moles/rabbit-peek5.png',
  './assets/moles/rabbit6.png',
  './assets/moles/rabbit-head6.png',
  './assets/moles/rabbit-peek6.png',
  './assets/moles/hippo1.png',
  './assets/moles/hippo-head1.png',
  './assets/moles/hippo-peek1.png',
  './assets/moles/hippo2.png',
  './assets/moles/hippo-head2.png',
  './assets/moles/hippo-peek2.png',
  './assets/moles/hippo3.png',
  './assets/moles/hippo-head3.png',
  './assets/moles/hippo-peek3.png',
  './assets/moles/hippo4.png',
  './assets/moles/hippo-head4.png',
  './assets/moles/hippo-peek4.png',
  './assets/moles/hippo5.png',
  './assets/moles/hippo-head5.png',
  './assets/moles/hippo-peek5.png',
  './assets/moles/hippo6.png',
  './assets/moles/hippo-head6.png',
  './assets/moles/hippo-peek6.png',
  './assets/moles/tiger1.png',
  './assets/moles/tiger-head1.png',
  './assets/moles/tiger-peek1.png',
  './assets/moles/tiger2.png',
  './assets/moles/tiger-head2.png',
  './assets/moles/tiger-peek2.png',
  './assets/moles/tiger3.png',
  './assets/moles/tiger-head3.png',
  './assets/moles/tiger-peek3.png',
  './assets/moles/tiger4.png',
  './assets/moles/tiger-head4.png',
  './assets/moles/tiger-peek4.png',
  './assets/moles/tiger5.png',
  './assets/moles/tiger-head5.png',
  './assets/moles/tiger-peek5.png',
  './assets/moles/tiger6.png',
  './assets/moles/tiger-head6.png',
  './assets/moles/tiger-peek6.png',
  './assets/moles/mole2.png',
  './assets/moles/mole3.png',
  './assets/moles/mole4.png',
  './assets/moles/mole5.png',
  './assets/moles/mole6.png',
  './assets/moles/mole7.png',
  './assets/moles/mole8.png',
  './assets/moles/peek1.png',
  './assets/moles/peek2.png',
  './assets/moles/helmet.png',
  './assets/moles/hole.png',
  './assets/moles/hole-front.png',
  './assets/moles/hole-spring.png',
  './assets/moles/hole-front-spring.png',
  './assets/moles/hole-summer.png',
  './assets/moles/hole-front-summer.png',
  './assets/moles/hole-autumn.png',
  './assets/moles/hole-front-autumn.png',
  './assets/moles/hole-winter.png',
  './assets/moles/hole-front-winter.png',
  './assets/moles/hole-night.png',
  './assets/moles/hole-front-night.png',
  './assets/moles/shield.png',
  './assets/moles/rabbit.png',
  './assets/moles/rabbit-x.png',
  './assets/moles/tiger.png',
  './assets/moles/tiger-x.png',
  './assets/moles/hippo.png',
  './assets/moles/hippo-x.png',
  './assets/moles/lion.png',
  './assets/moles/lion-x.png',
  './assets/moles/dog.png',
  './assets/moles/dog-x.png',
  './assets/round-moles/mole1.png',
  './assets/round-moles/mole2.png',
  './assets/round-moles/mole3.png',
  './assets/round-moles/mole4.png',
  './assets/round-moles/mole5.png',
  './assets/round-moles/mole6.png',
  './audio/hammer-sfx-02.mp3',
  './audio/goldhammer-spin.mp3',
  './audio/goldhammer-sfx-01.mp3',
  './audio/goldhammer-sfx-02.mp3',
  './audio/goldhammer-sfx-04.mp3',
  './audio/goldhammer-sfx-06.mp3',
  './audio/goldhammer-sfx-10.mp3',
  './audio/goldhammer-sfx-12.mp3',
  './audio/goldhammer-sfx-15.mp3',
  './audio/goose-surprise.mp3',
  './audio/goose-idle-quack-v1579.mp3',
  './audio/goose-wings.mp3',
  './audio/mole-emerge.mp3',
  './audio/punch-jab.mp3',
  './audio/punch-straight.mp3',
  './audio/punch-upper.mp3',
  './audio/punch-hookL.mp3',
  './audio/punch-hookR.mp3',
  './audio/hit1.mp3',
  './audio/hit2.mp3',
  './audio/hit3.mp3',
  './audio/hit4.mp3',
  './audio/countdown-jump-mixkit.mp3',
  './audio/ready-female-calm.mp3',
  './audio/ready-male-emphasis.mp3',
  './audio/bgm-home-1.mp3',
  './audio/bgm-home-2.mp3',
  './audio/bgm-home-3.mp3',
  './audio/bgm-home-4.mp3',
  './audio/bgm-home-5.mp3',
  './audio/bgm-home-6.mp3',
  './audio/rhythm-entry.mp3',
  './assets/home2/splash-art.webp',
  './audio/bgm-more.mp3',
  './audio/bgm-game-1.mp3',
  './js/levels.js',
  './js/progress.js',
  './js/rng.js',
  './js/combo-score.js',
  './js/grid-partition.js',
  './js/spawn-scheduler.js',
  './js/mole-sprites.js',
  './js/costume-teams.js',
  './js/skills.js',
  './js/photo-studio.js',
  './js/face-detect.js',
  './js/pop-elements.js',
  './js/hole-layer.js',
  './js/hit-fx.js',
  './js/lane-hammer.js',
  './js/lane-cannon.js',
  './js/lane-boxing.js',
  './js/weapon-pool.js',
  './js/lane-controls.js',
  './js/region-reveal.js',
  './js/hud.js',
  './js/sky.js',
  './js/screen-nav.js',
  './js/economy.js',
  './js/ads.js',
  './js/face-maker.js',
  './js/shop.js',
  './js/daily.js',
  './workshop-enhance.css',
  './js/workshop-enhance.js',
  './assets/workshop/enhance-v1433/egg-first.png',
  './assets/workshop/enhance-v1433/egg-growing.png',
  './assets/workshop/enhance-v1433/egg-intact.png',
  './assets/workshop/enhance-v1433/egg-separated.png',
  './assets/workshop/enhance-v1433/front-gem.png',
  './assets/workshop/enhance-v1433/pedestal-body.png',
  './assets/workshop/enhance-v1433/pedestal-front.png',
  './assets/workshop/enhance-v1433/radial-rays.png',
  './assets/workshop/enhance-v1433/smoke-1.png',
  './assets/workshop/enhance-v1433/smoke-2.png',
  './assets/workshop/enhance-v1433/smoke-3.png',
  './assets/workshop/enhance-v1433/smoke-4.png',
  './assets/workshop/enhance-v1433/sparkle-1.png',
  './assets/workshop/enhance-v1433/sparkle-2.png',
  './assets/workshop/enhance-v1433/sparkle-3.png',
  './assets/workshop/enhance-v1433/sparkle-4.png',
  './js/workshop.js',
  './js/quest.js',
  './js/rhythm.js',
  './js/rhythm-b-routes.js',
  './js/rhythm-b-flow.js',
  './js/rhythm-b-play.js',
  './assets/rhythm-b/character/hoverboard-v1260/run-strip.png',
  './assets/rhythm-b/character/hoverboard-v1260/frame-00.png',
  './assets/rhythm-b/character/hoverboard-v1260/frame-01.png',
  './js/rhythm-b.js',
  './assets/rhythm-b/skeleton-uniform.png',
  './assets/rhythm-b/upper-uniform-glow.png',
  './assets/rhythm-b/note-inner-line-0.png',
  './assets/rhythm-b/note-inner-line-1.png',
  './assets/rhythm-b/note-inner-line-2.png',
  './assets/rhythm-b/note-inner-line-3.png',
  './assets/rhythm-b/note-inner-line-4.png',
  './assets/rhythm-b/note-inner-line-5.png',
  './assets/rhythm-b/note-inner-line-6.png',
  './assets/rhythm-b/note-inner-line-7.png',
  './assets/rhythm-b/note-inner-line-8.png',
  './assets/rhythm-b/uniform-inner-line-0.png',
  './assets/rhythm-b/uniform-inner-line-1.png',
  './assets/rhythm-b/uniform-inner-line-2.png',
  './assets/rhythm-b/uniform-inner-line-3.png',
  './assets/rhythm-b/uniform-inner-line-4.png',
  './assets/rhythm-b/uniform-inner-line-5.png',
  './assets/rhythm-b/uniform-inner-line-6.png',
  './assets/rhythm-b/uniform-inner-line-7.png',
  './assets/rhythm-b/uniform-inner-line-8.png',
  './assets/rhythm-b/circuit-user.png',
  './assets/rhythm-b/circuit-thin.svg',
  './assets/rhythm-b/circuit-rim.svg',
  './assets/rhythm-b/combo-background-mask.svg',
  './assets/rhythm-b/mini-user.png',
  './assets/rhythm-b/pause-options.png',
  './js/face-studio.js',
  './js/score-screen.js',
  './js/settings-screen.js',
  './js/inventory-screen.js',
  './js/mailbox.js',
  './js/mailbox-daily.js',
  './js/contact.js',
  './js/fever-field.js',
  './js/shape-transition.js',
  './js/game.js',
  './assets/workshop/clarity-v1434/panel.png',
  './assets/workshop/clarity-v1434/stage.png',
];

// V1333 C: 662개 파일을 addAll 로 한꺼번에 요청하면 폰 크롬이 동시 요청 한도를 넘겨(ERR_INSUFFICIENT_RESOURCES)
// 그 순간 화면의 다른 그림 요청까지 실패 → 시작·X·재화 아이콘이 깨진 그림으로 뜸. 6개씩 나눠 차례로 받는다.
// Activate quickly. The page owns durable per-file preparation and its start gate.
// A large/offline asset must never hold service-worker installation open.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Images are immutable or versioned assets in this game. Return the local copy
  // immediately when available; waiting for the network made cached icons appear late.
  if (e.request.destination === 'image' || e.request.headers.get('X-Mole-Asset-Preparation') === '1' || /\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.test(e.request.url)) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      // The foreground queue watches byte progress and retries stalled transfers.
      // Do not abort a slow but healthy image response after a fixed duration.
      const response = await fetch(e.request);
      if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
        const copy = response.clone();
        e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copy)).catch(() => {}));
      }
      return response;
    })());
    return;
  }

  // 네트워크 우선: 온라인이면 항상 최신본을 바로 받는다(캐시는 오프라인 폴백용으로만 갱신).
  // 예전엔 stale-while-revalidate(캐시본 먼저)라 "항상 한 번 밀려서 반영"됐음 — 사용자가
  // 폰에서 대기가 길다고 느껴 네트워크 우선으로 변경.
  e.respondWith((async () => {
    try {
      // js/css 는 no-cache(브라우저 HTTP 캐시 건너뛰고 서버 재검증) — 배포 직후 index.html 만
      // 새로 오고 js 하나가 캐시본이라 i18n 키가 날것으로 뜨는 "반쪽 갱신" 방지. navigate 등은 평소대로.
      // navigate(첫 화면 index.html)도 no-cache(v739) — GitHub Pages 가 index.html 을 max-age=600 으로 줘서, 설치 앱
      // (start_url=index.html, 브라우저 탭 /mole/ 과 캐시 키가 다름)이 최대 10분간 옛 첫 화면을 쓰며 새 배포를 못 알아챘음.
      const revalidate = e.request.mode === 'navigate' || e.request.destination === 'script' || e.request.destination === 'style';
      // 첫 화면(navigate)은 주소에 매번 다른 꼬리표를 붙여 GitHub Pages CDN 의 서버별 옛 복사본(최대 10분)을 건너뛰고
      // 원본에서 받는다(v740) — 연속 배포 직후 앱 버전이 새 것↔예전 것으로 왔다 갔다 하던 문제.
      let req = e.request;
      if (e.request.mode === 'navigate') {
        const u = new URL(e.request.url); u.searchParams.set('_fresh', Date.now());
        req = new Request(u.toString(), { credentials: 'same-origin' });
      }
      // Keep UI images alive on slow mobile links. The 5s bound remains on
      // navigation/script/style requests so app startup can still fall back.
      const controller = new AbortController();
      const visual = e.request.destination === 'image' || /\.(?:png|jpe?g|webp|gif|svg|glb)(?:$|\?)/i.test(e.request.url);
      const timeout = revalidate || !visual ? setTimeout(() => controller.abort(), 5000) : null;
      let res;
      try {
        const fetchRequest = new Request(req, { signal: controller.signal });
        res = await fetch(fetchRequest, revalidate ? { cache: 'no-store' } : undefined);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      // V1333 C: 순간 네트워크 실패(동시 요청 한도 등)로 그림이 깨진 채 남지 않게 0.4초 뒤 한 번 더 받아 본다
      // 오프라인 + 캐시에 없음. undefined 를 반환하면 브라우저가 "인터넷 연결 없음" 페이지를 띄우므로 금지.
      if (e.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});

