"""로딩화면 소스(assets/src/loading-source.png) 배경 제거 → assets/loading.png.
체커보드 + 로고 주변에 칠해진 옅은 흰색 헤이즈(외곽 흰 노이즈처럼 보임)를 함께 제거한다.
1) 테두리 flood 로 바깥 체커 제거
2) 투명 경계에서 flood — 밝고 채도 낮은 픽셀을 먹어들어간다 (별/글자/두더지의 진한 만화
   외곽선 luma<=70 에서 멈추므로 색이 진한 내부는 안전)
3) 남은 갇힌 중성회색 전역 제거
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


def luma(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def chroma(r, g, b):
    return max(r, g, b) - min(r, g, b)


# ---- 1) 테두리 flood: 바깥 체커 ----
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
    if not (150 <= min(r, g, b) and max(r, g, b) <= 248 and chroma(r, g, b) <= 16):
        continue
    px[x, y] = (r, g, b, 0)
    dq.append((x + 1, y)); dq.append((x - 1, y)); dq.append((x, y + 1)); dq.append((x, y - 1))

# ---- 2) 투명 경계에서 옅은 헤이즈 먹어들어가기 ----
# 이미 투명한 픽셀 전부를 시드로. 밝고(>=160) 저채도(<=40) 픽셀을 제거,
# 진한 만화 외곽선(luma<=72)·채도 높은 색은 통과 못 함 → 글자/별/두더지 내부 안전.
edge = deque()
seen2 = bytearray(W * H)
for y in range(H):
    for x in range(W):
        if px[x, y][3] == 0:
            edge.append((x, y))
            seen2[y * W + x] = 1
while edge:
    x, y = edge.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if nx < 0 or nx >= W or ny < 0 or ny >= H:
            continue
        j = ny * W + nx
        if seen2[j]:
            continue
        r, g, b, a = px[nx, ny]
        if a == 0:
            seen2[j] = 1
            edge.append((nx, ny))
            continue
        if luma(r, g, b) >= 160 and chroma(r, g, b) <= 40:
            px[nx, ny] = (r, g, b, 0)
            seen2[j] = 1
            edge.append((nx, ny))

# ---- 3) 갇힌 중성회색 전역 제거 ----
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if 185 <= min(r, g, b) and max(r, g, b) <= 238 and chroma(r, g, b) <= 8:
            px[x, y] = (r, g, b, 0)

# ---- 프린지 정리 + 축소/양자화 ----
alpha = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
im.putalpha(alpha)
im = im.crop(im.getbbox())
if im.width > 620:
    im = im.resize((620, round(im.height * 620 / im.width)), Image.LANCZOS)
im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(OUT, optimize=True)
print('loading.png', im.size, os.path.getsize(OUT), 'bytes')
