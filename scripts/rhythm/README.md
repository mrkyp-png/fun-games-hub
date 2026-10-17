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

## 2026-10-17 / V1167 G — 4곡 A/B 공용 구성 및 새 2곡 재현
- 원본 위치는 제작폴더 안 `리듬AB 채보/`. 신규 Paper-Engine Ride.mp3(119.88초, 2872508bytes), The World Is Wide.mp3(119.56초, 2672530bytes)를 변경 없이 게임용 경로에 복사한다. 기존 WAV/MP3와 B 채보는 보존.
- 신규 B 재현: `python scripts/rhythm/analyze-song.py "리듬AB 채보/Paper-Engine Ride.mp3" paper-engine-ride` → `python scripts/rhythm/track-song.py paper-engine-ride` → `python scripts/rhythm/build-song-b-chart.py "리듬AB 채보/Paper-Engine Ride.mp3" paper-engine-ride "Paper-Engine Ride"`. The World Is Wide는 경로/id/title을 해당 곡으로 바꾼다. numpy/scipy/ffmpeg 필요. 분석 JSON/NPZ는 곡별 review/<id>-analysis.json, -features.npz에 분리.
- 신규 박자 중앙 간격 기준 Paper 약136 BPM, World 약139.675 BPM. 16박 단위 에너지의 높은 구간만 drive 후보로 표시. 보컬 후렴을 직접 듣고 확인했다고 주장하지 않는다. 사용자의 실제 플레이 피드백으로 보정하는 분석 기반 1차 채보이다.
- B 동일 칸 최소 기준은 V1166 GREAT/GOOD 10% 확대를 반영해 EASY2.242/NORMAL1.898/HARD1.665초. 두 신규곡은 기존 패턴을 복사하지 않고 곡별 다른 레인 순서/동시 페어/필 위치 사용. 모든 목표박자는 고정. 신나는 구간에 2버튼 동시·반복, 그 외에도 짧은 쉬는 간격 유지.
- A 재현: `python scripts/rhythm/build-song-a-charts.py`. 기존2+신규2 총4곡을 별도의 `<id>-a.json`으로 생성. 음악은 B와 같은 full mix 재사용, A는 4버튼 전용 고정 레인/같은 칸560ms 이상. 구름/무기/점프/210ms입력보정/충돌/점수 디자인 보존. 9레인을 그대로 4레인에 넣지 않는다. Le monde HARD 일부 동시 입력은 4칸 점프 간격 보장을 위해 단일 입력으로 편성.
- A/B 곡 선택은 기존 팝업 재사용. 기존 테스트곡 포함 각5곡. A 최고점 `mole.rp.best.<id>.<difficulty>`, B `mole.rp.b.best.<id>.<difficulty>`; fever2 기존 키 유지. 테스트 기본ON/최고점·퀘스트·티켓보상 제외. A도 테스트에서는 MISS와 관계없이 끝까지 확인 가능하며 일반 A의 MISS10 종료는 기존 그대로.
- 디코딩 캐시는 선택곡1개만 유지하고 같은 곡 A/B는 full mix 버퍼를 재사용하여 4곡을 양쪽에서 중복 보유하지 않도록 한다. A 비동기 로딩 취소/곡 선택 복귀 시 늦은 게임 시작 차단. 새 A 곡 로딩 실패 시 난이도창으로 복귀해 오류를 표시하며 잘못된 곡으로 조용히 대체하지 않는다. 기존 테스트곡의 예비 음악 정책은 유지.
- 검증 도구: verify-four-song-data.py, verify-four-song-b-chart.js, verify-four-song-a-chart.js, verify-four-song-live-records.js. 브라우저 봇은 반드시 순서대로 한 개씩 실행. 가사 티커는 사용자 제공 가사 및 반복 후렴 확인 후 별도 처리하며 채보 에너지 분석과 가사 확정은 구분한다.

## V1167 G / 문장별 가사 티커 재현·검토
- 사용자 제공 4개 원본 TXT는 `리듬AB 채보/`에 보존. 타이밍 없는 원본을 노래 길이로 균등 분배하지 않는다. 로컬 faster-whisper1.2.1 + av15.1.0 + Systran/faster-whisper-small CPU int8를 사용한 단어 시각 후보 → 제공 가사와 전역 정렬 → 약한 구간의 원문 강제 정렬 순서이다. 수동 청취 확인이나 완벽한 동기화로 보고하지 않는다.
- 분석 도구와 모델은 `.tools/lyrics`, `.tools/models`에만 설치하고 .gitignore에서 제외. 음원 외부 전송 없음. 게임에는 작은 *-lyrics.json과 단일 텍스트 컨트롤러만 추가하며 모델/추론 코드가 실행되지 않는다.
- `python scripts/rhythm/transcribe-lyrics.py` → `python scripts/rhythm/align-lyrics.py` → `python scripts/rhythm/refine-lyrics-alignment.py`. 도구 디렉터리는 권한 때문에 샌드박스에서 접근 제한이 있을 수 있어 필요한 경우 승인된 권한 환경에서 실행. CPU 분석과 브라우저 봇을 동시에 돌려 성능을 판정하지 말 것.
- raw transcript/review/base/forced-alignment JSON은 review에 보존. 인식되지 않은 뒤쪽 원문을 앞쪽 후렴에 억지로 붙이지 않도록 끝부분 미정렬 허용. 불확실한 인식 문장을 가사로 대신 쓰지 않는다. 제공 문구와 맞는 추가 반복만 표시. Meet 첫 후렴의 Come on 3회는 인식 후보에 맞춰 원문 반복으로 정렬. World 마지막 Hey, hey는 부분 후렴으로 취급하며 남은 가사를 끝에 억지로 압축하지 않는다.
- 사용자 재생 확인이 특히 필요한 구간: Meet 약49.9~57.1초의 제공 원문에 없는 짧은 반복/추임새, Paper 약66.0~71.6초의 반복 보컬, World 마지막 약118초 이후 실제 끝부분과 원문 Final Chorus/Outro 차이. 불명확한 단어는 임의 제작하지 않고 사용자 확인 후 보완한다.
- 컨트롤러는 기존 A/B 오디오 시계로 문장 시작/종료를 판단하고 문장 변경 때만 textContent 변경. 긴 문장만 transform 스크롤, pause/resume 동기화, 간주/종료/곡변경에서 숨김. 새 RAF·캔버스·블러·프레임별 텍스트 재생성 없음. B 정상 안전여백32px은 그대로, 노치 기기에서는 가사 높이를 안전영역 아래에 확보.

## V1170 G — A 성능 및 공용 팝업 검증
- A/B 정상 전곡 완주·4곡 선택, 테스트 UI 제거. 원본 채보·음악과 점수 보존. B GREAT/GOOD 추가10%(A대비1.21), PERFECT 불변.
- node review/verify-popups-v1170.js / verify-rhythm-a-render-v1170.js / verify-rhythm-b-windows-v1170.js / verify-b-song-entry-v1170.js
- node review/profile-rhythm-a-v1170.js optimized: 실제 Edge HARD20초 프레임 측정. baseline/optimized JSON은 로컬 측정이며 폰 성능 보장이 아니다.
- A 대기/종료 무기 hidden, 스폰 큐/활성 배열/프레임 버퍼/PANG풀 재사용. 궤적1600샘플 비교와346노트 전체 생명주기 검증. 게임 효과 삭제 금지.
- 앨범 생성 프롬프트/원본/최종경로 review/album-prompts-v1170.json. 기존 광고 서비스는 개발 스텁, 실제 광고망은 별도 작업.
- 기존 V1168/1169 가사 변경 포함 미배포 V1170. 작업·배포 허락 분리 및 기존 변경 보존, 다음 기믹은 사용자와 논의부터.
