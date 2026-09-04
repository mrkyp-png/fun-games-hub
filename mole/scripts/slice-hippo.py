"""결과화면 하마 6포즈 슬라이스.

입력: Desktop/하마.png (1408x768). 투명이 아니라 회색 체커보드가 픽셀로 박힌 스톡형.
  3열 x 2행 = 6포즈. 위: 기쁨 / 아래: 슬픔.
출력: assets/hippo/{happy1..3,sad1..3}.png — 체커 제거 + 포즈별 알파 bbox 크롭.

체커 제거는 두더지 슬라이스와 동일: 테두리에서 flood fill 로 '무채색 + 체커 밝기'만 투명.
그 뒤 빈 열/행으로 3x2 격자를 잡고, 셀마다 알파 bbox 로 자른다. (헬멧 날아간 포즈,
비구름 뜬 포즈도 셀 y/x 범위 안이라 같이 들어온다.)
"""

import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(os.path.expanduser('~'), 'Desktop', '하마.png')
OUT = os.path.join(ROOT, 'assets', 'hippo')

NAMES = [['happy1', 'happy2', 'happy3'], ['sad1', 'sad2', 'sad3']]


def key_out(im, lo=150, hi=255):
    """테두리 flood fill 로 '무채색 + 체커 밝기 대역' 픽셀만 투명 처리."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def is_bg(r, g, b):
        if max(abs(r - g), abs(g - b), abs(r - b)) > 16:
            return False
        v = (r + g + b) / 3
        return lo <= v <= hi

    seen = bytearray(w * h)
    dq = deque()
    for x in range(w):
        dq.append((x, 0)); dq.append((x, h - 1))
    for y in range(h):
        dq.append((0, y)); dq.append((w - 1, y))
    while dq:
        x, y = dq.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b):
            continue
        px[x, y] = (r, g, b, 0)
        if x > 0: dq.append((x - 1, y))
        if x < w - 1: dq.append((x + 1, y))
        if y > 0: dq.append((x, y - 1))
        if y < h - 1: dq.append((x, y + 1))
    return im


def defringe(im, erode_px=1):
    """알파 1px 깎고, 투명에 붙어 남은 '밝은 회색(체커 잔여)' 만 제거.
    하마 몸통(보라-회색)은 안 건드리게 min(r,g,b)>=185 로 아주 밝은 것만."""
    a = im.split()[3].filter(ImageFilter.MinFilter(erode_px * 2 + 1))
    im.putalpha(a)
    w, h = im.size
    px = im.load()
    kill = []
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al == 0:
                continue
            near_gray = max(abs(r - g), abs(g - b), abs(r - b)) <= 16 and min(r, g, b) >= 185
            if not near_gray:
                continue
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 20:
                        kill.append((x, y))
                        break
    for x, y in kill:
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
    return im


def drop_specks(im, min_area=60):
    """떨어져 나온 작은 알파 조각 제거 (경계 침식 후 남는 점 노이즈)."""
    from collections import deque
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] < 24:
                continue
            comp, dq = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] >= 24:
                        seen[ny * w + nx] = 1
                        dq.append((nx, ny))
            if len(comp) < min_area:
                for x, y in comp:
                    r, g, b, _ = px[x, y]
                    px[x, y] = (r, g, b, 0)
    return im


def feather(im):
    """이진 알파(계단현상)에 얕은 blur 로 AA 만. 본체는 불투명 유지(가파른 곡선)."""
    a = im.split()[3].filter(ImageFilter.GaussianBlur(0.7))
    a = a.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.8) + 40))
    im.putalpha(a)
    return im


def bands(sums, cuts_needed):
    n = len(sums)
    gaps, i = [], 0
    while i < n:
        if sums[i] == 0:
            j = i
            while j < n and sums[j] == 0:
                j += 1
            gaps.append((i, j))
            i = j
        else:
            i += 1
    inner = [g for g in gaps if g[0] > 0 and g[1] < n]
    inner.sort(key=lambda g: g[1] - g[0], reverse=True)
    cut_pts = sorted((g[0] + g[1]) // 2 for g in inner[:cuts_needed])
    edges = [0] + cut_pts + [n]
    return [(edges[k], edges[k + 1]) for k in range(len(edges) - 1)]


def main():
    os.makedirs(OUT, exist_ok=True)
    im = key_out(Image.open(SRC))
    w, h = im.size
    ap = im.split()[3].load()

    col = [0] * w
    row = [0] * h
    for y in range(h):
        for x in range(w):
            if ap[x, y] > 20:
                col[x] += 1
                row[y] += 1

    xbands = bands(col, 2)
    ybands = bands(row, 1)
    assert len(xbands) == 3 and len(ybands) == 2, (len(xbands), len(ybands))

    for r, (y0, y1) in enumerate(ybands):
        for c, (x0, x1) in enumerate(xbands):
            cell = im.crop((x0, y0, x1, y1))
            cell = feather(drop_specks(defringe(cell)))
            bbox = cell.split()[3].getbbox()
            cell = cell.crop(bbox)
            path = os.path.join(OUT, NAMES[r][c] + '.png')
            cell.save(path)
            print(NAMES[r][c], cell.size)


if __name__ == '__main__':
    main()
