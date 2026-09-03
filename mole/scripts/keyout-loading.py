"""로딩화면 소스(assets/src/loading-source.png, 흰 배경) → assets/loading.png (투명).
테두리에서 near-white flood fill (진한 만화 외곽선에서 멈춤) + 프린지 정리 + 축소/양자화.
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
    if min(r, g, b) < 232:        # 흰색 아님 → 경계(만화 외곽선/색)
        continue
    px[x, y] = (r, g, b, 0)
    dq.append((x + 1, y)); dq.append((x - 1, y)); dq.append((x, y + 1)); dq.append((x, y - 1))

# 프린지 정리 — 알파 살짝 침식 + 블러
alpha = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
im.putalpha(alpha)
im = im.crop(im.getbbox())

if im.width > 620:
    im = im.resize((620, round(im.height * 620 / im.width)), Image.LANCZOS)
im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(OUT, optimize=True)
print('loading.png', im.size, os.path.getsize(OUT), 'bytes')
