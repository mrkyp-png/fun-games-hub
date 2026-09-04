"""결과화면 하마 6포즈 슬라이스.

입력: Desktop/하마 배경완전제거.png (1536x1024, 진짜 투명 배경/알파 채널).
  3열 x 2행 = 6포즈. 위: 기쁨(happy1~3) / 아래: 슬픔(sad1~3).
출력: assets/hippo/{happy1..3,sad1..3}.png (최대 420px)

소스가 진짜 투명이라 처리는 단순:
  - 열: 빈 세로 구간으로 3분할 (bands)
  - 행: 두 줄이 세로로 겹쳐 빈 구간이 없어 → 중앙 최소밀도 지점에서 절단
  - 셀마다: 작은 조각 제거 → edge_extend(AA 경계에 남은 배경색 오염을 하마색으로) → bbox 크롭 → 축소
"""

import os
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(os.path.expanduser('~'), 'Desktop', '하마 배경완전제거.png')
OUT = os.path.join(ROOT, 'assets', 'hippo')

NAMES = [['happy1', 'happy2', 'happy3'], ['sad1', 'sad2', 'sad3']]


def drop_specks(im, min_area=200):
    """떨어져 나온 작은 알파 조각 제거."""
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


def edge_extend(im, iters=2):
    """불투명 픽셀의 RGB 를 바깥으로 iters px 확장 — AA 반투명 경계 픽셀이 배경색
    (흐린 보라)이 아니라 하마색을 갖게 해 헤일로를 없앤다. 알파는 안 건드림."""
    w, h = im.size
    px = im.load()
    ap = im.split()[3].load()
    solid = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if ap[x, y] >= 235:
                solid[y * w + x] = 1
    for _ in range(iters):
        adds = []
        for y in range(h):
            for x in range(w):
                if solid[y * w + x]:
                    continue
                rs = gs = bs = cnt = 0
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and solid[ny * w + nx]:
                            pr, pg, pb, _ = px[nx, ny]
                            rs += pr; gs += pg; bs += pb; cnt += 1
                if cnt >= 2:
                    adds.append((x, y, rs // cnt, gs // cnt, bs // cnt))
        for x, y, rr, gg, bb in adds:
            px[x, y] = (rr, gg, bb, px[x, y][3])
            solid[y * w + x] = 1
    return im


def bands(sums, cuts_needed):
    """빈 구간(합 0)으로 나누되, 각 밴드는 양옆 빈 구간 전체를 포함한다."""
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
    inner = sorted((g for g in gaps if g[0] > 0 and g[1] < n),
                   key=lambda g: g[1] - g[0], reverse=True)[:cuts_needed]
    inner.sort()
    lefts = [0] + [g[0] for g in inner]
    rights = [g[1] for g in inner] + [n]
    return list(zip(lefts, rights))


def min_density_cut(vals, lo, hi):
    """[lo,hi) 에서 값이 가장 낮은 인덱스 (두 줄이 붙어 있을 때 절단선)."""
    return min(range(lo, hi), key=lambda i: vals[i])


def main():
    os.makedirs(OUT, exist_ok=True)
    src = Image.open(SRC).convert('RGBA')
    w, h = src.size
    ap = src.split()[3].load()
    col = [0] * w
    row = [0] * h
    for y in range(h):
        for x in range(w):
            if ap[x, y] > 30:
                col[x] += 1
                row[y] += 1

    xbands = bands(col, 2)
    assert len(xbands) == 3, len(xbands)
    ycut = min_density_cut(row, int(h * 0.38), int(h * 0.60))
    ybands = [(0, ycut), (ycut, h)]

    for r, (y0, y1) in enumerate(ybands):
        for c, (x0, x1) in enumerate(xbands):
            cell = src.crop((x0, y0, x1, y1))
            cell = drop_specks(cell, min_area=200)
            cell = edge_extend(cell, iters=2)
            cell = cell.crop(cell.split()[3].getbbox())
            if max(cell.size) > 420:
                s = 420 / max(cell.size)
                cell = cell.resize((round(cell.width * s), round(cell.height * s)), Image.LANCZOS)
            path = os.path.join(OUT, NAMES[r][c] + '.png')
            cell.save(path)
            print(NAMES[r][c], cell.size)


if __name__ == '__main__':
    main()
