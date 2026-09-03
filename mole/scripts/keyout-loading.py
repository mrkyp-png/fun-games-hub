"""로딩화면 소스(assets/src/loading-source.png)의 체커보드 배경 제거 → assets/loading.png.
1) 테두리 flood fill 로 바깥 체커 제거
2) 남은 갇힌 체커(로고 글로우 사이 등) 를 좁은 중성회색 밴드로 전역 제거
실행: python scripts/keyout-loading.py
"""
import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'src', 'loading-source.png')
OUT = os.path.join(ROOT, 'assets', 'loading.png')

im = Image.open(SRC).convert('RGBA')
W, H = im.size
px = im.load()


def neutral(r, g, b):
    return max(r, g, b) - min(r, g, b) <= 14


def is_bg_flood(r, g, b):
    return 175 <= min(r, g, b) and max(r, g, b) <= 245 and neutral(r, g, b)


# 1) 테두리 flood
seen = bytearray(W * H)
dq = deque()
for x in range(W):
    dq.append((x, 0)); dq.append((x, H - 1))
for y in range(H):
    dq.append((0, y)); dq.append((W - 1, y))
while dq:
    x, y = dq.popleft()
    if x < 0 or x >= W or y < 0 or y >= H:
        continue
    i = y * W + x
    if seen[i]:
        continue
    seen[i] = 1
    r, g, b, a = px[x, y]
    if not is_bg_flood(r, g, b):
        continue
    px[x, y] = (r, g, b, 0)
    dq.append((x + 1, y)); dq.append((x - 1, y)); dq.append((x, y + 1)); dq.append((x, y - 1))

# 2) 갇힌 체커 전역 제거 — 좁은 밴드(체커는 ~192/229, 아트의 흰 하이라이트는 245+)
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if 185 <= min(r, g, b) and max(r, g, b) <= 238 and (max(r, g, b) - min(r, g, b)) <= 8:
            px[x, y] = (r, g, b, 0)

# 프린지 정리
alpha = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
im.putalpha(alpha)
im = im.crop(im.getbbox())

# 스플래시용 축소 + 양자화
if im.width > 620:
    im = im.resize((620, round(im.height * 620 / im.width)), Image.LANCZOS)
im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(OUT, optimize=True)
print('loading.png', im.size, os.path.getsize(OUT), 'bytes')
