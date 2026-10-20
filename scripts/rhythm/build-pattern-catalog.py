# 리듬팡 패턴 종합표 생성(V1355 C): pattern_library.py → review/pattern-catalog.png + 리듬팡 패턴 종합표.md
#   python scripts/rhythm/build-pattern-catalog.py [곡id ...]   ← 곡id 를 주면 그 곡들의 후렴별 사용 패턴도 문서에 기록
from pathlib import Path
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pattern_library import B_MOTIFS, A_MOTIFS

F = lambda n: ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', n)
COL = ['#2f7bff', '#ff3b4e', '#ffc400', '#18c95a', '#a24cff', '#ff3fb4', '#ff8a1c', '#19c8e6', '#c0703a']  # 네온 9칸 색
ACOL = ['#009cff', '#ee16a6', '#ffc400', '#10c848']
DIFFS = ['EASY', 'NORMAL', 'HARD']
W, H = 300, 330

def card_b(m):
    im = Image.new('RGB', (W, H), '#11131c'); d = ImageDraw.Draw(im)
    d.text((12, 8), m['id'], font=F(17), fill='#fff'); d.text((12, 32), m['ko'], font=F(14), fill='#bcd')
    order = {}
    for i, shp in enumerate(m['steps']):
        for l in shp: order.setdefault(l, []).append(i + 1)
    for l in range(9):
        x, y = 40 + (l % 3) * 75, 64 + (l // 3) * 75
        on = l in order
        d.ellipse((x, y, x + 62, y + 62), outline=COL[l], width=4, fill=COL[l] if on else '#11131c')
        if on: d.text((x + 31, y + 31), ','.join(map(str, order[l])), font=F(20 if len(order[l]) == 1 else 15), fill='#000', anchor='mm')
        else: d.text((x + 31, y + 31), str(l + 1), font=F(14), fill='#556', anchor='mm')
    tags = ' '.join(f"{k[0]}:{v}박" for k, v in m['step'].items())
    d.text((12, 300), tags, font=F(14), fill='#9f9')
    return im

def card_a(m):
    im = Image.new('RGB', (W, 170), '#1a1410'); d = ImageDraw.Draw(im)
    d.text((12, 8), m['id'], font=F(17), fill='#fff'); d.text((12, 32), m['ko'], font=F(14), fill='#dcb')
    order = {}
    for i, shp in enumerate(m['steps']):
        for l in shp: order.setdefault(l, []).append(i + 1)
    for l in range(4):
        x = 18 + l * 68
        on = l in order
        d.rounded_rectangle((x, 66, x + 60, 126), 10, outline=ACOL[l], width=4, fill=ACOL[l] if on else '#1a1410')
        if on: d.text((x + 30, 96), ','.join(map(str, order[l])), font=F(18 if len(order[l]) <= 2 else 13), fill='#000', anchor='mm')
    d.text((12, 140), ' '.join(f"{k[0]}:{v}박" for k, v in m['step'].items()), font=F(14), fill='#9f9')
    return im

cols = 5
rb = (len(B_MOTIFS) + cols - 1) // cols; ra = (len(A_MOTIFS) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + 20, 60 + rb * (H + 10) + 70 + ra * 180), '#080a10'); d = ImageDraw.Draw(sheet)
d.text((12, 14), '리듬팡 후렴 패턴 종합표 — 네온(3×3, 칸 번호 1~9)   숫자 = 누르는 순서, 같은 숫자 = 동시   E/N/H = 난이도별 간격', font=F(22), fill='#fff')
for i, m in enumerate(B_MOTIFS): sheet.paste(card_b(m), (10 + (i % cols) * W, 60 + (i // cols) * (H + 10)))
y0 = 60 + rb * (H + 10) + 10
d.text((12, y0 + 14), '비치(4버튼, 왼→오 1~4)', font=F(22), fill='#fff')
for i, m in enumerate(A_MOTIFS): sheet.paste(card_a(m), (10 + (i % cols) * W, y0 + 60 + (i // cols) * 180))
Path('review').mkdir(exist_ok=True); sheet.save('review/pattern-catalog.png')

md = ['# 리듬팡 후렴 패턴 종합표', '', '원본 목록: `scripts/rhythm/pattern_library.py` (이 문서는 `python scripts/rhythm/build-pattern-catalog.py <곡id...>` 로 자동 생성).',
      '그림: `review/pattern-catalog.png`. 숫자 = 누르는 순서, 같은 숫자 = 동시 입력. 간격 = 난이도별 묶음 사이 박 수(없는 난이도는 미사용).', '',
      '## 규칙', '- 후렴마다 곡·난이도·후렴번호로 고정된 무작위 순서로 도형을 골라 이어 붙임(다시 만들어도 동일, 곡마다 다름).',
      '- 도형은 통째로만 넣음: 같은 칸 최소 간격(네온 E2.242/N1.898/H1.665초, 비치 0.56초)이나 후렴 끝에 걸리면 다른 도형 → 0~2박 늦춰 안 쓴 도형 → 그래도 안 되면 쉼.',
      '- 바로 앞 도형 반복 금지, 한 후렴에서 안 쓴 도형 우선. 비치는 도형 사이 1박 숨.', '- 최대 동시: EASY 2 / NORMAL 3 / HARD 4(네 모서리·비치 네 개).', '',
      '## 네온(3×3) 칸 번호', '```', '1 2 3', '4 5 6', '7 8 9', '```', '', '| id | 모양 | 순서(칸 번호, 묶음=동시) | E | N | H |', '|---|---|---|---|---|---|']
for m in B_MOTIFS:
    md.append(f"| {m['id']} | {m['ko']} | {' → '.join('+'.join(str(l + 1) for l in s) for s in m['steps'])} | " + ' | '.join(str(m['step'].get(x, '-')) for x in DIFFS) + ' |')
md += ['', '## 비치(4버튼) 버튼 번호: 왼쪽부터 1 2 3 4', '', '| id | 모양 | 순서 | E | N | H |', '|---|---|---|---|---|---|']
for m in A_MOTIFS:
    md.append(f"| {m['id']} | {m['ko']} | {' → '.join('+'.join(str(l + 1) for l in s) for s in m['steps'])} | " + ' | '.join(str(m['step'].get(x, '-')) for x in DIFFS) + ' |')
names = {m['id']: m['ko'] for m in B_MOTIFS + A_MOTIFS}
for sid in sys.argv[1:]:
    s = json.loads(Path('review', sid + '-chart-summary.json').read_text(encoding='utf-8'))
    b = json.loads(Path('mole/audio/rp', sid + '.json').read_text(encoding='utf-8'))
    md += ['', f"## 곡별 사용: {b['title']} (`{sid}`)", '후렴(가사 전사 기반 후보): ' + ', '.join(f"{c['start']:.1f}~{c['end']:.1f}초" for c in b['chorusPattern']), '']
    for g, key in (('네온', 'motifsB'), ('비치', 'motifsA')):
        for dname, chs in s[key].items():
            md.append(f"- {g} {dname}: " + ' / '.join(f"후렴{i + 1}: " + ' → '.join(chs[i]) for i in range(len(chs))))
Path('리듬팡 패턴 종합표.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
print('ok', len(B_MOTIFS), len(A_MOTIFS))
