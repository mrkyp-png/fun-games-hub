# 강화 화면 공통 그림체 재작업 — 현재 적용본

## V1684 G 이후 로컬 수정 (미배포)

- 배경은 `sky-architecture.webp`로 분리. ImageGen 참조 원본 unified-bg.webp, 생성 `exec-6f48287e-44d9-4d09-9ea5-8c6cee753334.png`.
- 최종 레이어 분리 프롬프트: Preserve entire original canvas and all architecture, banners, tools, garden, benches and floor positions. Remove both white clouds. Make ONLY cyan blue sky areas, including sky through rear arches, genuinely transparent. Blue banners/chest/cup stay opaque. No redraw, recolor, restyle or crop. Architectural foreground layer for separate moving sky. No clouds remain.
- 원래 그려진 구름 대신 기존 퀘스트 구름을 건축 레이어 뒤에 배치. 아래→위 이동 + scale .25→1.8, 360/450/510초(최초 대비10배 느리게). 알 연출도 동일 배경 공유. 하늘 샘플 알파0, 바닥/깃발 알파252 이상 검사.
- **오리 민트 제안은 사용자 거부로 폐기. 최종은 원래 노란색, filter:none. 원본 대기/비행 이미지 경로와 파일 그대로 유지.** 아래 과거 색상행렬 설명 중 오리에 관한 부분은 더 이상 적용되지 않음. 알/받침대만 별도 색상행렬 유지.
- 버튼 노란색은 실제 스코어 선택 탭 색상과 같은 --score-yellow-* 공통 변수 사용.

2026-11-11. 도구: built-in ImageGen. 출력: `mole/assets/workshop/tone-v1684/unified-*.webp`.
원본은 보존. 생성 경로/크기/용량은 `workshop-unified-assets.json`, 포장은 `pack-workshop-unified.py`.

## 참조 기준

- 실제 일일 배경 `assets/daily/bg-v1646.webp`와 테두리 `frame-v1644.png`.
- 실제 퀘스트 배경 `assets/quest/bg-v1648.webp`와 간판 `sign-v1648.png`.
- 실제 스코어 배경 `assets/score/bg-palace-bright-v1567.webp`.
- 단순히 금색/크림색만 맞추는 것이 아니라 매끈하고 둥근 몰드형 3D, 큰 형태, 짧고 부드러운 그림자, 선명한 색상을 공통으로 사용.
- 앞선 bg-score-style/palace-*의 대리석/금속 반사 스타일은 사용자 피드백에 따라 현재 화면에서 사용 중단.

## 최종 프롬프트 세트

Common: Restyle the original target in the EXACT smooth rounded molded toy-like
casual mobile game style shared by approved Daily, Quest and Score references.
Preserve original asset canvas, silhouette, corner geometry and UI content
coordinates. Use warm cream, soft coral, warm yellow trim, sky/cornflower blue.
Broad smooth forms, clean restrained highlights, soft short ambient shadows.
No marble veins, distressed grain, fine engraving, mirror-metal reflections,
baroque detail, neon, bloom, haze, blur or faded overlay. No text, items or new
motifs. Genuine transparent exterior for standalone UI assets.

- Background: keep royal workshop theme, open central 70%, rounded ivory pillars/arches, simple side crafting benches, clear cyan sky and rounded green garden. Large simple cream/peach floor tiles. No mirror floor, floor filigree, central pedestal or characters. Full-bleed portrait 9:16. Daily/Quest are especially authoritative for material and shape simplicity.
- Stage: keep twin cabinet geometry, bolts, plinths, central duck seat and banner at original positions. Cream molded surfaces, small coral accents, warm yellow trim and bolts, light-blue glass, lavender/sky-blue discs. Center cushion/banner cornflower blue, butter-yellow paw. No stone grain or metallic shine.
- Sign: keep original hanging straps, bolts, diamond accents and empty writing area. Cream center, slender coral rim, warm yellow trim/straps, small sky-blue line. No extra star/crown/ribbon.
- Card: keep original star/laurels, bolts, showcase, item plinth, name plaque and quantity plaque. Cream panels, coral rim, warm yellow trim, sky-blue showcase, cornflower-blue pedestal. Smooth simple motifs, no stone block lines.
- Information panel: keep original clipped/stepped corners, four bolts, border thickness and empty center. Cream center, coral outer rim, yellow trim/rounded bolts. No new motifs.

## 애니메이션 원본과 UI

- 오리 대기/비행과 알/파편은 원본 프레임 유지. `workshop-pastel-gold` sRGB 행렬로 노랑/주황을 크림노랑/살구색으로 조정. 검정/흰색 기준과 알파 보존. 예: RGB(255,190,0) → (252,219,128).
- 알 받침대 본체/앞판/보석은 원본 정렬 유지. `workshop-pastel-stand` RGB=.65*원본+.35로 색만 부드럽게. 알파 보존. 배경이나 무기/코스튬에는 적용하지 않음.
- 연출 화면의 밝은 반투명 덮개는 제거한 상태 유지.
- 강화하기 진입: 선택 아이템을 먼저 준비하고 화면 전환 클래스를 제거한 뒤 ScreenNav 즉시 표시. revealOrBands를 호출하지 않음. 뒤로가기 히스토리와 게임 중 제한 유지.

## 검증

새 에셋은 전체 캔버스만 원본 크기로 정규화(잘라 붙임 없음), 기존 9슬라이스 값과 배치 유지.
ImageGen 특성상 픽셀 단위 경계는 원본과 미세하게 다를 수 있음.
이미지 디코드/JS 문법/SW 셸/직접 진입 콜백 회귀/diff 검사 통과.
실제 브라우저·휴대폰 화면과 배포는 아직 확인하지 않음.
