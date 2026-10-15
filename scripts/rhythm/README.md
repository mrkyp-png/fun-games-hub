# 리듬팡 곡 추가 파이프라인

곡 1개(mp3) → 반주/멜로디 분리 → 난이도별 노트 자동 생성 → `mole/audio/rp/<id>.json` + `<id>-back.mp3` + `<id>-melody.mp3`.

## 준비 (한 번만)
    python -m pip install demucs soundfile      # torch CPU 포함, 수 분 걸림. ffmpeg 필요(PATH)

## 1) 분리 (3분 곡 ≈ 수 분, CPU)
    python -m demucs -n htdemucs -o sep --mp3 path/to/song.mp3
    → sep/htdemucs/<파일명>/drums.mp3 bass.mp3 other.mp3 vocals.mp3
- 노래가 있는 곡이면 vocals 를 멜로디(연주 파트)로 쓰는 게 나을 수 있음 → chart.py 의 'other' / 반주 구성 수정.
- 사용자가 Suno "Get Stems" 로 받은 파일을 주면 분리 생략하고 그 파일 사용(더 깨끗함).

## 2) 채보 생성
    python scripts/rhythm/chart.py <id> <원곡.mp3> sep/htdemucs/<파일명> mole/audio/rp [구간시작초=0] [구간길이초=92]
- 박자: 원곡 전체 스펙트럼 플럭스 자기상관 → BPM·첫 박(beat.py). ⚠ 실제의 2배 BPM 이 나올 수 있음(83곡→166.7) — 채보엔 무관.
- 노트: 멜로디 스템 온셋 세기를 반 박 격자에 매겨, 난이도별(EASY 정박·2박 간격 / NORMAL 정박·1박 / HARD 반박) 세기 순 그리디 선택.
  밀도는 chart.py 의 `charts = {...}` quantile 값으로 조절(피버: EASY 0.05→89개, NORMAL 0.45→114, HARD 0.6→167).
- 레인 배정·꺾임 경로는 게임(rhythm.js buildChart)이 시각만 받아 처리(같은 레인 최소 간격 = 점프 7프레임+0.1초).

## 3) 게임 연결
- 지금은 `mole/js/rhythm.js` CONFIG.songData = 'audio/rp/fever.json' 한 곡 고정. 여러 곡 = 곡 선택 화면 만들고 songData 를 선택값으로.
- 버전 3곳 올리고 배포. 곡 출처를 mole/audio/CREDITS.txt 에 기록.

## 4) 검증
    node scripts/rhythm/bot-test.js HARD    # 로컬 서버(node scripts/serve.js, :8844) 필요. 봇이 완벽 입력 → 결과창 수치 출력
- ⚠ 봇 여러 개 동시 실행 금지(노트북 느려져 가짜 MISS). 봇 입력 시각 = targetTime - (apexFrame+0.5)*jumpFrameMs(현재 0.21초).

## 2026-10-15 / 실제 곡 채보와 B 곡 목록
- B 곡 목록은 rhythm.js CONFIG.bSongs의 {id,title,duration,chart} 항목을 추가하면 된다. chart JSON의 back은 필수, melody는 선택. 기존 fever2 기록키는 유지하고 새 곡은 곡 ID별로 기록을 분리한다.
- Le monde attendra demain: 사용자 제공 Desktop WAV(119.96초/48kHz/stereo/16bit)를 수정하지 않고 MP3 192kbps(약2.88MB)로 인코딩. 원본 전체 사용. 아직 분석 기반 1차 채보이며 실제 사용자 플레이로 박자감/후렴 후보와 난이도를 조정해야 한다.
- 재생성: analyze-suno-song.py → refine-suno-grid.py → track-suno-beats.py → build-suno-b-chart.py. 중간 분석 JSON/NPZ는 review에 생성된다. 드라이브 구간은 스펙트럼 강도 기반 후보이며 보컬 후렴을 직접 청취·확정했다고 표현하지 않는다.
- JSON patterns[난이도]는 {time,lanes:[0..8],sound:'kick'|'snare'|'hat',section} 이벤트 배열이다. lanes2개는 동시 입력, charts에는 동일 시각 두 노트가 보존된다. 기존 숫자 charts만 있는 fever2는 기존 랜덤 배치로 재생한다. beats 배열은 실제 온셋에 맞춘 시각으로 공간 박자 호흡을 동기화한다.
- 새 곡에는 hitFeedback:true, 음악은 full mix를 계속 재생하고 성공에만 사전 생성된 짧은 퍼커션 버퍼를 재생한다. 반주/보컬 분리 파일이 없으므로 실패 시 보컬만 끄는 연출은 사용하지 않는다. 효과음 설정 OFF를 존중한다.
- 테스트 모드가 곡 팝업에서 기본 체크되어 있다. B open/start의 {practice:true} 옵션으로 MISS가 10회 넘어도 곡 끝까지, 결과는 TEST 표기·최고점 저장 제외. V1143 G부터 체크 해제한 일반 모드도 MISS 횟수와 관계없이 곡 끝까지 진행한다. A 규칙은 변경하지 않는다.

## 2026-10-16 / Meet Me Halfway (V1151 G)
- 원본: Desktop/채보/Meet Me Halfway.mp3,119.56초/48kHz/stereo,2686330bytes. 게임용 MP3는 재인코딩 없이 복사하고 SHA256 일치를 검증한다. 원본/기존 곡/기록/디자인 보존.
- 재현: `python scripts/rhythm/analyze-meet-me-halfway.py` → `python scripts/rhythm/track-meet-me-halfway.py` → `python scripts/rhythm/build-meet-me-halfway-chart.py`. numpy/scipy/ffmpeg 필요. 분석 중간파일 review/meet-me-halfway-analysis.json 및 features.npz. 기존 Suno 곡 분석파일과 분리.
- 온셋 자기상관 초기후보141.58BPM,가변박자 추적283박(중앙 간격 기준139.675BPM). 16박 단위 스펙트럼 강도로 drive 후보를 고른다. 47.8~74.7초,88.3~101.8초,108.8~115.3초 후보. 보컬 후렴을 직접 청취·확정했다고 표현하지 않는다. 실제 플레이 의견으로 보정하는 1차 채보.
- 기존곡 레인 배열을 복사하지 않은 난이도별 지그재그/중앙교차 패턴. EASY166노트/28동시, NORMAL332/56동시, HARD360/56동시+강박 사이 온셋 필. 긴 빈 구간을 추가하지 않음: 최대 내부 입력 간격1.033/.534/.534초. 같은칸 실제 최소2.322/1.9156/1.6718초로 공통 기준2.22/1.88/1.65초 충족.
- 검증: verify-meet-me-halfway-data.py(원본SHA,박자·필 온셋/간격/중복/기존과패턴차이), verify-meet-me-halfway-chart.js(전곡 세난이도 올PERFECT/독립동시판정/점수/재시작고정), verify-meet-me-halfway-live.js(실제MP3재생/실제CDP2터치/pause/resume/quit), verify-meet-me-halfway-records.js(TEST최고점제외/새곡별저장/기존2곡및A기록보존/A진입종료). 브라우저 봇은 순차 실행.
- 곡별 정상 최고점 저장키 mole.rp.b.best.meet-me-halfway.<난이도>. 테스트 기본ON/최고점제외, 일반모드도MISS와무관하게 끝까지 진행. A의음악·노트·점수·규칙 변경 없음.
- 게임 틀은 고정. 캐릭터/채보 외 디자인을 임의로 바꾸지 않는다. 사용자 별도지시가 있을 때만 해당범위 수정. 수정 사전 허락/배포 별도 허락/G-C 연속번호/Claude·기존변경보존/후속인수인계 유지.
