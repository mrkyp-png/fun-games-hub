# 리듬팡 후렴 패턴 목록(V1355 C) — 채보 도구(build-pattern-charts.py)와 종합표(build-pattern-catalog.py)가 함께 쓰는 유일한 원본.
# B(네온 3x3) 칸 번호 = 행*3+열: 0 1 2 / 3 4 5 / 6 7 8 (화면 표시는 1~9).  A(비치) 버튼 0~3 = 왼쪽→오른쪽.
# steps: 순서대로 누를 칸 묶음(한 묶음 = 동시 입력).  step: 난이도별 묶음 사이 박 수(없으면 그 난이도엔 안 씀).
R = [(0, 1, 2), (3, 4, 5), (6, 7, 8)]
C = [(0, 3, 6), (1, 4, 7), (2, 5, 8)]
S = lambda *xs: [(x,) for x in xs]

B_MOTIFS = [
    # 줄 쓸기
    dict(id='rows-down', ko='가로줄 위→아래', steps=[R[0], R[1], R[2]], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='rows-up', ko='가로줄 아래→위', steps=[R[2], R[1], R[0]], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='cols-right', ko='세로줄 왼→오', steps=[C[0], C[1], C[2]], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='cols-left', ko='세로줄 오→왼', steps=[C[2], C[1], C[0]], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='rows-split', ko='위·아래줄 → 가운데줄', steps=[R[0], R[2], R[1]], step={'HARD': 2}),
    # 대각선
    dict(id='diag-x', ko='대각선 ↘ → 나머지 모서리(X)', steps=[(0, 4, 8), (2, 6)], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='diag-x2', ko='대각선 ↙ → 나머지 모서리(X)', steps=[(2, 4, 6), (0, 8)], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='diag-pairs', ko='대각 모서리 짝 → 가운데', steps=[(0, 8), (2, 6), (4,)], step={'EASY': 2, 'NORMAL': 2}),
    dict(id='diag-slide', ko='대각선 흘러내림(짝)', steps=[(0, 4), (1, 5), (3, 7), (4, 8)], step={'HARD': 2}),
    dict(id='diag-wave', ko='대각선 물결 1→2·4→3·5·7→6·8→9', steps=[(0,), (1, 3), (2, 4, 6), (5, 7), (8,)], step={'NORMAL': 1, 'HARD': 1}),
    dict(id='diag-wave-back', ko='대각선 물결 되돌리기 9→6·8→3·5·7→2·4→1', steps=[(8,), (5, 7), (2, 4, 6), (1, 3), (0,)], step={'NORMAL': 1, 'HARD': 1}),
    dict(id='diag-three', ko='대각선 셋: 1·5·9 → 2·6 → 4·8', steps=[(0, 4, 8), (1, 5), (3, 7)], step={'NORMAL': 2, 'HARD': 1}),
    dict(id='diag-easy', ko='대각선 짝 흐름 1→2·4→6·8→9', steps=[(0,), (1, 3), (5, 7), (8,)], step={'EASY': 2, 'NORMAL': 1}),
    # 바깥 모서리·십자
    dict(id='corners-burst', ko='네 모서리 → 변 가운데 4 → 가운데', steps=[(0, 2, 6, 8), (1, 3, 5, 7), (4,)], step={'HARD': 2}),
    dict(id='corner-pairs', ko='모서리 위짝 → 아래짝 → 가운데', steps=[(0, 2), (6, 8), (4,)], step={'EASY': 2, 'NORMAL': 2}),
    dict(id='plus-burst', ko='가운데 → 십자 세로 → 십자 가로', steps=[(4,), (1, 7), (3, 5)], step={'EASY': 2, 'NORMAL': 2}),
    dict(id='plus-full', ko='가운데 → 십자 네 칸', steps=[(4,), (1, 3, 5, 7)], step={'HARD': 2}),
    # 숫자 순서(한 칸씩)
    dict(id='seq-1-9', ko='1→9 순서', steps=S(0, 1, 2, 3, 4, 5, 6, 7, 8), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='seq-9-1', ko='9→1 거꾸로', steps=S(8, 7, 6, 5, 4, 3, 2, 1, 0), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='snake', ko='뱀(ㄹ자) 1·2·3→6·5·4→7·8·9', steps=S(0, 1, 2, 5, 4, 3, 6, 7, 8), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='snake-col', ko='세로 뱀 1·4·7→8·5·2→3·6·9', steps=S(0, 3, 6, 7, 4, 1, 2, 5, 8), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='spiral', ko='소용돌이(테두리 → 가운데)', steps=S(0, 1, 2, 5, 8, 7, 6, 3, 4), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='edge-cw', ko='테두리 시계방향', steps=S(0, 1, 2, 5, 8, 7, 6, 3), step={'HARD': 1}),
    dict(id='edge-ccw-pairs', ko='마주보는 칸 짝 회전', steps=[(0, 8), (1, 7), (2, 6), (5, 3)], step={'EASY': 2, 'NORMAL': 2, 'HARD': 1}),
    # 쉬운 짝
    dict(id='row-ends', ko='줄 양끝 짝 위→아래', steps=[(0, 2), (3, 5), (6, 8)], step={'EASY': 2}),
    dict(id='col-ends', ko='열 양끝 짝 왼→오', steps=[(0, 6), (1, 7), (2, 8)], step={'EASY': 2}),
    dict(id='seq-odd', ko='1·3·5·7·9 건너뛰기', steps=S(0, 2, 4, 6, 8), step={'EASY': 2, 'NORMAL': 1}),
]

A_MOTIFS = [
    dict(id='stairs-up', ko='계단 1→4', steps=S(0, 1, 2, 3), step={'EASY': 2, 'NORMAL': 1, 'HARD': 1}),
    dict(id='stairs-down', ko='계단 4→1', steps=S(3, 2, 1, 0), step={'EASY': 2, 'NORMAL': 1, 'HARD': 1}),
    dict(id='bounce', ko='왕복 1→4→1', steps=S(0, 1, 2, 3, 2, 1, 0), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='zigzag', ko='지그재그 1·3·2·4', steps=S(0, 2, 1, 3), step={'EASY': 2, 'NORMAL': 1, 'HARD': 1}),
    dict(id='zigzag-back', ko='지그재그 4·2·3·1', steps=S(3, 1, 2, 0), step={'NORMAL': 1, 'HARD': 1}),
    dict(id='out-in', ko='양끝 → 안쪽 짝', steps=[(0, 3), (1, 2)], step={'EASY': 2, 'NORMAL': 1, 'HARD': 1}),
    dict(id='in-out', ko='안쪽 → 양끝 짝', steps=[(1, 2), (0, 3)], step={'EASY': 2, 'NORMAL': 1, 'HARD': 1}),
    dict(id='half-swap', ko='왼쪽 짝 ↔ 오른쪽 짝', steps=[(0, 1), (2, 3), (0, 1), (2, 3)], step={'EASY': 2, 'NORMAL': 2, 'HARD': 1}),
    dict(id='cross', ko='1·3 ↔ 2·4 교차', steps=[(0, 2), (1, 3), (0, 2), (1, 3)], step={'EASY': 2, 'NORMAL': 2, 'HARD': 1}),
    dict(id='trill', ko='1·4 번갈아 연타', steps=S(0, 3, 0, 3), step={'HARD': 1}),
    dict(id='all-four', ko='네 개 동시 → 안쪽 → 양끝', steps=[(0, 1, 2, 3), (1, 2), (0, 3)], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='tri-slide', ko='세 개 1·2·3 → 2·3·4 밀기', steps=[(0, 1, 2), (1, 2, 3)], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='tri-wave', ko='세 개 → 한 칸 → 반대 세 개 → 한 칸', steps=[(0, 1, 2), (3,), (1, 2, 3), (0,)], step={'NORMAL': 2, 'HARD': 2}),
    dict(id='four-pulse', ko='네 개 동시 두 번(2박 간격)', steps=[(0, 1, 2, 3), (0, 1, 2, 3)], step={'HARD': 2}),
]

# V1356 C 도형 무리(곡 성격 --favor 용)와 필요한 손(2 = 서로 떨어진 칸 동시 → 두 손). 사용자: 가로줄 3개는 한 손으로 가능.
GROUP = {'rows-down': 'line', 'rows-up': 'line', 'cols-right': 'line', 'cols-left': 'line', 'rows-split': 'line',
         'diag-x': 'diag', 'diag-x2': 'diag', 'diag-pairs': 'diag', 'diag-slide': 'diag', 'diag-wave': 'diag', 'diag-wave-back': 'diag', 'diag-three': 'diag', 'diag-easy': 'diag',
         'corners-burst': 'corner', 'corner-pairs': 'corner', 'plus-burst': 'corner', 'plus-full': 'corner',
         'seq-1-9': 'seq', 'seq-9-1': 'seq', 'snake': 'seq', 'snake-col': 'seq', 'spiral': 'spin', 'edge-cw': 'spin', 'edge-ccw-pairs': 'spin',
         'row-ends': 'line', 'col-ends': 'line', 'seq-odd': 'seq',
         'stairs-up': 'stairs', 'stairs-down': 'stairs', 'bounce': 'stairs', 'zigzag': 'zig', 'zigzag-back': 'zig',
         'out-in': 'pair', 'in-out': 'pair', 'half-swap': 'pair', 'cross': 'zig', 'trill': 'zig', 'all-four': 'chord', 'tri-slide': 'chord', 'tri-wave': 'chord', 'four-pulse': 'chord'}
TWO_HANDS = {'diag-pairs',  # 사용자: 대각선 3개도 한 손 가능
             'corners-burst', 'corner-pairs', 'plus-full', 'edge-ccw-pairs', 'row-ends', 'col-ends', 'cross', 'out-in', 'in-out', 'all-four', 'trill'}
for _m in B_MOTIFS + A_MOTIFS:
    _m['group'] = GROUP[_m['id']]
    _m['hands'] = 2 if _m['id'] in TWO_HANDS else 1
