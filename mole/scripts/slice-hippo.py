"""결과화면 하마 6포즈 슬라이스.

입력: Desktop/하마.png (1408x768). 투명이 아니라 회색 체커보드가 픽셀로 박힌 스톡형.
  3열 x 2행 = 6포즈. 위: 기쁨 / 아래: 슬픔.
출력: assets/hippo/{happy1..3,sad1..3}.png

파이프라인 (밝은 배경 위에서 외곽선이 깨끗하게 나오도록):
  key_out   : 테두리 flood 로 체커(무채색 2색: 밝은칸/어두운칸)만 투명
  close_notch: flood 가 캐릭터의 밝은 하이라이트(헬멧 램프광 등)를 파먹은 얕은
              노치를 메꿈 (헬멧/손 잘림 방지). 손가락 사이 넓은 틈은 유지.
  defringe  : 알파 1px 침식 + 투명에 붙은 near-white 체커 잔여 제거
  edge_extend: 경계 픽셀의 RGB 를 인접 불투명색으로 덮어씀 → 회색 헤일로 방지
  feather   : 얕은 blur 로 AA 복원 (이제 AA 링이 하마색이라 깨끗)
  drop_specks: 떨어져 나온 작은 조각 제거
그 뒤 3x2 격자(빈 열/행 기준, 각 셀은 양옆 간격 전부 포함해 안 잘림)로 나눠 bbox 크롭.
"""

import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(os.path.expanduser('~'), 'Desktop', '하마.png')
OUT = os.path.join(ROOT, 'assets', 'hippo')

NAMES = [['happy1', 'happy2', 'happy3'], ['sad1', 'sad2', 'sad3']]


def strip_checker(im):
    """소스의 체커보드 격자(칸 피치 ~12px)를 픽셀 패턴으로 직접 찾아 순백으로 눌러
    key_out 이 확실히 지우게 한다. 램프광이 배어들어 warm-tint 된 체커까지 잡힌다.
    하마 피부(불규칙 텍스처)·매끈한 램프광(패턴 없음)은 안 건드림."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    lum = [[0] * h for _ in range(w)]
    for x in range(w):
        col = lum[x]
        for y in range(h):
            r, g, b, _ = px[x, y]
            col[y] = (r + g + b) // 3

    P, Q = 12, 6  # 칸 피치 / 반칸
    hits = bytearray(w * h)
    for x in range(P, w - P):
        for y in range(P, h - P):
            r, g, b, _ = px[x, y]
            if max(abs(r - g), abs(g - b), abs(r - b)) > 28:  # 뚜렷한 유채색
                continue
            c = lum[x][y]
            opp = sum(1 for dx, dy in ((Q, 0), (-Q, 0), (0, Q), (0, -Q))
                      if abs(lum[x + dx][y + dy] - c) > 30)
            same = sum(1 for dx, dy in ((P, 0), (-P, 0), (0, P), (0, -P))
                       if abs(lum[x + dx][y + dy] - c) < 24)
            if opp >= 2 and same >= 3:
                hits[y * w + x] = 1

    # 히트 마스크를 3px 확장 (격자 사이 AA 픽셀까지)
    m = Image.frombytes('L', (w, h), bytes(255 if v else 0 for v in hits))
    m = m.filter(ImageFilter.MaxFilter(7))
    mp = m.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y]:
                px[x, y] = (252, 252, 252, 255)
    return im


def key_out(im):
    """테두리 flood fill — 무채색이고 체커 두 밝기대(어두운칸/밝은칸) 안인 픽셀만 투명.
    범위를 좁게 잡아 캐릭터의 밝은 하이라이트를 덜 먹게 한다."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def is_bg(r, g, b):
        if max(abs(r - g), abs(g - b), abs(r - b)) > 12:  # 무채색 아님 → 전경(캐릭터 하이라이트도 대개 미묘하게 유색)
            return False
        return (r + g + b) / 3 >= 150  # 체커 회색 대역 (밝은칸/어두운칸/사이 AA 전부)

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


def fill_holes(im):
    """이미지 테두리에 안 닿는 투명 영역(= 캐릭터 안에 갇힌 구멍, 주로 flood 가
    파먹은 헬멧 램프광)을 다시 불투명으로. RGB 는 원본(하이라이트)이 그대로 살아난다."""
    w, h = im.size
    ap = im.split()[3].load()
    bg = bytearray(w * h)
    dq = deque()
    for x in range(w):
        for yy in (0, h - 1):
            if ap[x, yy] < 25:
                dq.append((x, yy))
    for y in range(h):
        for xx in (0, w - 1):
            if ap[xx, y] < 25:
                dq.append((xx, y))
    while dq:
        x, y = dq.popleft()
        i = y * w + x
        if bg[i]:
            continue
        bg[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and ap[nx, ny] < 25:
                dq.append((nx, ny))
    px = im.load()
    for y in range(h):
        for x in range(w):
            if ap[x, y] < 25 and not bg[y * w + x]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 255)
    return im


def close_notch(im, k=7):
    """알파 close (dilate k → erode k) — flood 가 파먹은 얕은 노치(≤k//2 px)를 메꾼다.
    메꿔진 자리는 원본 RGB(하이라이트)가 그대로 살아난다. 손가락 사이 넓은 틈은 유지."""
    a = im.split()[3]
    a = a.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    im.putalpha(a)
    return im


def open_thin(im, k=5):
    """알파 open (erode → dilate) — 얇은 돌기(램프광이 배어든 체커 조각이 헬멧에
    가늘게 붙은 것)를 끊어낸다. 손가락 등 ≥k//2*2 px 굵기는 유지."""
    a = im.split()[3]
    a = a.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    im.putalpha(a)
    return im


def trim_floaters(im, k=9, keep_min=1500):
    """알파를 k px erode 했을 때 큰 성분에서 떨어져 나가는 조각(헬멧에 가늘게 붙은
    체커 얼룩)을 원본에서 제거. erode 로 인한 본체 가장자리 손상은 keep-mask 를 다시
    dilate 해 복원 — 즉 '끊긴 작은 조각'만 없애고 형태/디테일은 유지."""
    w, h = im.size
    a = im.split()[3]
    eroded = a.filter(ImageFilter.MinFilter(k))
    ep = eroded.load()
    seen = bytearray(w * h)
    keep = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or ep[sx, sy] < 30:
                continue
            comp, dq = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and ep[nx, ny] >= 30:
                        seen[ny * w + nx] = 1
                        dq.append((nx, ny))
            if len(comp) >= keep_min:
                for x, y in comp:
                    keep[y * w + x] = 1
    km = Image.frombytes('L', (w, h), bytes(255 if v else 0 for v in keep))
    km = km.filter(ImageFilter.MaxFilter(k))  # erode 되돌리기 (본체 가장자리 복원)
    kp = km.load()
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0 and not kp[x, y]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def defringe(im):
    """알파 1px 침식 + 투명에 붙어 남은 near-white(체커 잔여)만 제거."""
    im.putalpha(im.split()[3].filter(ImageFilter.MinFilter(3)))
    w, h = im.size
    px = im.load()
    kill = []
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al == 0:
                continue
            if not (max(abs(r - g), abs(g - b), abs(r - b)) <= 14 and min(r, g, b) >= 200):
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


def edge_extend(im, iters=4):
    """불투명 픽셀의 RGB 를 바깥으로 iters px 확장. 이후 feather 로 생기는 AA 링이
    체커색(회색)이 아니라 하마색을 갖게 되어 헤일로가 안 보인다. 알파는 안 건드림."""
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


def degrey(im, iters=6):
    """헬멧 램프광 주변으로 체커가 배어든 얼룩(무채색 + 밝음 + 국소 밝기 변동 큼 =
    체커 무늬)을 주변 유채색으로 덮는다. 매끈한 진짜 하이라이트(변동 작음)는 보존.
    가장자리부터 안쪽으로 여러 번 훑어 완전히 없앤다."""
    w, h = im.size
    px = im.load()
    for _ in range(iters):
        ap = im.split()[3].load()
        fix = []
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]
                if al < 200:
                    continue
                if max(abs(r - g), abs(g - b), abs(r - b)) > 20 or (r + g + b) / 3 < 160:
                    continue
                rs = gs = bs = cnt = 0
                vmin, vmax = 999, -1
                for dx in range(-3, 4):
                    for dy in range(-3, 4):
                        nx, ny = x + dx, y + dy
                        if not (0 <= nx < w and 0 <= ny < h) or ap[nx, ny] < 200:
                            continue
                        pr, pg, pb, _ = px[nx, ny]
                        v = (pr + pg + pb) / 3
                        vmin = min(vmin, v); vmax = max(vmax, v)
                        if max(abs(pr - pg), abs(pg - pb), abs(pr - pb)) > 20:
                            rs += pr; gs += pg; bs += pb; cnt += 1
                if cnt >= 3 and (vmax - vmin) > 38:  # 국소 변동 크다 = 체커
                    fix.append((x, y, rs // cnt, gs // cnt, bs // cnt))
        if not fix:
            break
        for x, y, rr, gg, bb in fix:
            px[x, y] = (rr, gg, bb, px[x, y][3])
    return im


def strip_bloom(im, iters=10):
    """램프광이 (지금은 투명해진) 배경으로 번진 밝은-웜 블룸 = 캐릭터가 아님 → 투명.
    '진한 유채색(헬멧 빨강 등)'에 안 닿은 밝은-웜 픽셀만 지운다. 가장자리부터 여러 번
    훑어서 헬멧 위로 삐져나온 크림색 얼룩을 완전히 제거. 램프광 본체는 헬멧에 둘러싸여
    유지된다."""
    w, h = im.size
    px = im.load()
    for _ in range(iters):
        ap = im.split()[3].load()
        kill = []
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]
                if al < 150:
                    continue
                if not (min(r, g, b) >= 140 and max(r, g, b) - min(r, g, b) <= 62
                        and (r + g + b) / 3 >= 172):
                    continue
                anchored = near_edge = False
                for dx in range(-3, 4):
                    for dy in range(-3, 4):
                        nx, ny = x + dx, y + dy
                        if not (0 <= nx < w and 0 <= ny < h):
                            continue
                        na = ap[nx, ny]
                        if na < 30:
                            near_edge = True
                        elif na >= 200 and abs(dx) <= 2 and abs(dy) <= 2:
                            pr, pg, pb, _ = px[nx, ny]
                            if max(abs(pr - pg), abs(pg - pb), abs(pr - pb)) > 34 and (pr + pg + pb) / 3 < 205:
                                anchored = True
                if near_edge and not anchored:  # 실루엣 가장자리 + 진한색에 안 닿음 = 배경 블룸
                    kill.append((x, y))
        if not kill:
            break
        for x, y in kill:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    return im


def feather(im):
    """얕은 blur 로 AA 만. 본체는 불투명 유지(가파른 곡선)."""
    a = im.split()[3].filter(ImageFilter.GaussianBlur(0.7))
    a = a.point(lambda v: 0 if v < 45 else min(255, (v - 45) * 2))
    im.putalpha(a)
    return im


def drop_specks(im, min_area=80):
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


def bands(sums, cuts_needed):
    """빈 구간(합 0)으로 나누되, 각 밴드는 양옆 빈 구간 전체를 포함한다 (콘텐츠 안 잘림)."""
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


def main():
    os.makedirs(OUT, exist_ok=True)
    raw = key_out(Image.open(SRC))

    # 격자 감지는 raw 알파로 (close/extend 는 열 간격을 메꿔 격자를 없앰).
    proj = drop_specks(raw.copy(), min_area=400)  # 큰 하이라이트 얼룩 제거해 격자 오염 방지
    ap = proj.split()[3].load()
    w, h = raw.size
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
            # 클리닝은 셀 단위로 — close/extend 가 옆 포즈로 번지지 않게.
            cell = raw.crop((x0, y0, x1, y1))
            cell = drop_specks(cell, min_area=400)
            cell = fill_holes(cell)              # 램프광 등 갇힌 구멍 복원
            cell = drop_specks(cell, min_area=400)
            cell = trim_floaters(cell, k=9)      # 헬멧에 붙은 체커 얼룩 잘라내기
            cell = strip_bloom(cell)             # 헬멧 위로 번진 크림색 램프광 블룸 제거
            cell = degrey(cell, iters=6)         # 유채색 옆 잔여 체커 얼룩
            cell = drop_specks(cell, min_area=400)
            cell = feather(edge_extend(defringe(cell)))
            cell = drop_specks(cell, min_area=80)
            bbox = cell.split()[3].getbbox()
            cell = cell.crop(bbox)
            path = os.path.join(OUT, NAMES[r][c] + '.png')
            cell.save(path)
            print(NAMES[r][c], cell.size)


if __name__ == '__main__':
    main()
