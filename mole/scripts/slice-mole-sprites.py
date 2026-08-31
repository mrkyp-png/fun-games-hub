"""두더지 게임 스프라이트 추출.

입력 (assets/src/, 스톡 이미지 — 투명 대신 회색 체커보드가 픽셀로 박혀 있음):
  - moles-source.png  : 두더지만.png. 5x3 그리드, 흙두둑 없이 두더지 몸통만.
                        왼쪽 3열 = 전신 9종(파란 모자 제외), 오른쪽 = 빠끔 얼굴 / 모자.
  - hole-source.png   : 두더지.png (흙두둑 포함본). 여기서 구멍 그림만 뽑는다.
  - hammer-source.png : 뽕망치.

체커보드 제거 = 테두리 flood fill 로 "무채색 + 체커 밝기 대역" 픽셀만 투명 처리.

두더지 프레임은 **헬멧(빨간색) 폭을 기준으로 스케일을 정규화**해서, 전신이든 빠끔이든
머리 크기와 위치가 화면에서 일치하도록 한 장의 고정 캔버스에 얹는다 (사용자 요청:
"빼꼼이미지는 전신이미지 사이즈에 맞게 크기 조정"). 게임은 모든 프레임을 같은 박스에
그리고, 깊이에 따라 그림 교체 + translateY 로 두더지가 구멍으로 들락날락한다.
"""

import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'src')
MOLES_OUT = os.path.join(ROOT, 'assets', 'moles')
ASSETS_OUT = os.path.join(ROOT, 'assets')


def key_out(im, lo=110, hi=232):
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


def drop_specks(im, min_area=400):
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or px[sx, sy][3] < 20:
                continue
            comp = []
            dq = deque([(sx, sy)])
            seen[sy][sx] = True
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3] >= 20:
                        seen[ny][nx] = True
                        dq.append((nx, ny))
            if len(comp) < min_area:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    return im


def blobs(im, min_size=6000):
    """키아웃된 이미지의 불투명 연결성분들을 {bbox, center, pts} 로 반환 (작은 건 버림).
    동물 시트는 동물이 격자 칸 안에 반듯이 놓여 있지 않아, 칸 크롭 대신 성분으로 집는다."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    out = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] < 20:
                continue
            comp = []
            dq = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] >= 20:
                        seen[ny * w + nx] = 1
                        dq.append((nx, ny))
            if len(comp) < min_size:
                continue
            xs = [p[0] for p in comp]
            ys = [p[1] for p in comp]
            out.append({
                'bbox': (min(xs), min(ys), max(xs) + 1, max(ys) + 1),
                'center': (sum(xs) / len(xs), sum(ys) / len(ys)),
                'pts': set(comp),
            })
    return out


def cut_blob(im, blob):
    """blob['bbox'] 로 자르되, 그 사각형에 걸친 다른 성분 픽셀은 지워 대상만 남긴다."""
    x0, y0, x1, y1 = blob['bbox']
    crop = im.crop(blob['bbox'])
    cp = crop.load()
    for y in range(y1 - y0):
        for x in range(x1 - x0):
            if (x + x0, y + y0) not in blob['pts']:
                r, g, b, _ = cp[x, y]
                cp[x, y] = (r, g, b, 0)
    return crop


def defringe(im, erode_px=2):
    """스티커 흰 테두리 제거: 알파를 erode_px 만큼 깎고, 남은 near-white 가장자리 픽셀도 지운다."""
    a = im.split()[3].filter(ImageFilter.MinFilter(erode_px * 2 + 1))
    im.putalpha(a)
    w, h = im.size
    px = im.load()
    kill = []
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if al == 0 or min(r, g, b) <= 205:
                continue
            near_edge = False
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 20:
                        near_edge = True
            if near_edge:
                kill.append((x, y))
    for x, y in kill:
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
    return im


def eat_fringe(im, chroma=34, lo=90, band=5):
    """투명 경계에서 안쪽으로 '무채색' 픽셀(체커 잔여 + 어두운 외곽선과 체커 사이 AA 밴드)을
    파먹는다 (flood). 단 **원본 실루엣 경계에서 band(px) 이내**만 먹는다 — 그래야
    흰 토끼 얼굴처럼 넓고 밝은 본체는 안 건드리고(중심이 경계에서 멀다), 별/스월 사이
    좁은 틈에 갇힌 체커는 (전부 경계 근처라) 지워진다. key_out 다음 2차 패스."""
    w, h = im.size
    px = im.load()

    # 1) 원본 투명 마스크에서 band px 확장 = "경계 근처" 마스크
    orig_transparent = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 20:
                orig_transparent[y * w + x] = 1
    near_edge = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            hit = False
            for dy in range(-band, band + 1):
                if hit:
                    break
                for dx in range(-band, band + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and orig_transparent[ny * w + nx]:
                        hit = True
                        break
            if hit:
                near_edge[y * w + x] = 1

    # 2) 투명 경계에서 flood, near_edge 안의 무채색 픽셀만 제거
    seen = bytearray(w * h)
    dq = deque()

    def enqueue(x, y):
        if 0 <= x < w and 0 <= y < h and not seen[y * w + x] and px[x, y][3] >= 20:
            seen[y * w + x] = 1
            dq.append((x, y))

    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 20:
                enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1)
    while dq:
        x, y = dq.popleft()
        if not near_edge[y * w + x]:
            continue
        r, g, b, a = px[x, y]
        if a < 20 or (r + g + b) / 3 < lo or max(abs(r - g), abs(g - b), abs(r - b)) > chroma:
            continue
        px[x, y] = (r, g, b, 0)
        enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1)
    return im


def smooth_alpha(im):
    """1px 삐침·계단 제거: 알파를 median+blur 후 재이진화해 실루엣을 매끈하게."""
    a = im.split()[3].filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(a.point(lambda v: 255 if v > 150 else 0))
    return im


def helmet_region(im):
    """가장 큰 빨간 헬멧 덩어리의 (bbox, area). area 로 스케일을 맞추면 헬멧이 기울어져도
    (모자 튀어나온 포즈 등) 일관된 크기가 나온다 (bbox 폭 기준은 기울기에 약함)."""
    w, h = im.size
    px = im.load()
    red = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 40 and r > 120 and r > g * 1.5 and r > b * 1.4:
                red[y][x] = True
    seen = [[False] * w for _ in range(h)]
    best = None
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or not red[sy][sx]:
                continue
            comp = []
            dq = deque([(sx, sy)])
            seen[sy][sx] = True
            while dq:
                x, y = dq.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and red[ny][nx]:
                        seen[ny][nx] = True
                        dq.append((nx, ny))
            if best is None or len(comp) > len(best):
                best = comp
    if not best:
        return None
    xs = [p[0] for p in best]
    ys = [p[1] for p in best]
    return ((min(xs), min(ys), max(xs) + 1, max(ys) + 1), len(best))


# 전신 8종 (파란 모자 r2c2, 팔벌린 r0c3 은 크기가 튀어서 제외 — 사용자 피드백).
CELLS = {
    'mole1': (0, 0), 'mole2': (1, 0), 'mole3': (2, 0), 'mole4': (0, 1),
    'mole5': (1, 1), 'mole6': (2, 1), 'mole7': (0, 2), 'mole8': (1, 2),
}
NAMED_BOXES = {
    'peek1':  (1130, 214, 1404, 384),  # 빠끔 (눈 크게)
    'peek2':  (1130, 38, 1404, 196),   # 빠끔 (눈 감음)
    'helmet': (852, 250, 1120, 394),   # 모자만
}


def main():
    os.makedirs(MOLES_OUT, exist_ok=True)
    for f in os.listdir(MOLES_OUT):
        os.remove(os.path.join(MOLES_OUT, f))

    sheet = key_out(Image.open(os.path.join(SRC, 'moles-source.png')))
    W, H = sheet.size
    cw, ch = W / 5, H / 3

    # --- 1) 원본 프레임 추출 + 흰 테두리 제거 + 헬멧 측정 ---
    raw = {}
    all_boxes = {n: (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
                 for n, (c, r) in CELLS.items()}
    all_boxes.update(NAMED_BOXES)
    for name, box in all_boxes.items():
        piece = smooth_alpha(defringe(eat_fringe(drop_specks(sheet.crop(box)))))
        bb = piece.getbbox()
        raw[name] = piece.crop(bb) if bb else piece

    helmets = {n: helmet_region(im) for n, im in raw.items()}

    # --- 2) 얼굴 크기 정규화 (사용자: "얼굴의 크기로 맞춰야함, 안경 쓴 두더지 기준").
    #        헬멧은 포즈마다 각도가 달라 크기가 튀므로, 눈 사이 거리로 잰 얼굴 크기 비율을
    #        한 번 측정해 표로 박아둔다 (mole7=안경 두더지 기준 1.0). 빠끔/모자는 추가로 10% 축소.
    #        그 뒤 모든 프레임의 "내용 아래끝(발치)"을 공통 캔버스 바닥에, 헬멧 중심으로 가로 정렬.
    # 코 높이에서 잰 볼(얼굴) 폭 비율 — mole7(안경 두더지) = 1.0. cheek.py 로 측정.
    # (mole5 는 손이 볼을 가려 측정 부정확 → 다른 포즈 평균값 사용)
    FACE_SCALE = {
        'mole1': 1.05, 'mole2': 1.03, 'mole3': 0.99, 'mole4': 1.04,
        'mole5': 1.03, 'mole6': 1.08, 'mole7': 1.00, 'mole8': 1.02,
        'peek1': 0.99, 'peek2': 0.97, 'helmet': 1.00,
    }
    PEEK_EXTRA = 0.90  # 사용자: 빠끔/모자는 추가로 10% 축소
    BASE = 1.40        # 절대 크기 (화면에서의 두더지 크기)
    MOLE_DX = {'mole3': -5}  # 특정 포즈만 가로 미세보정 (캔버스 px, -=왼쪽). mole3=손 든 포즈 왼쪽 0.3mm

    OUT_W, OUT_H = 470, 548  # 6:7 비율 고정 (style.css .mole-pop aspect-ratio 와 물림)

    for name, im in raw.items():
        hb, _ = helmets[name]
        scale = BASE * FACE_SCALE[name]
        if name in ('peek1', 'peek2', 'helmet'):
            scale *= PEEK_EXTRA
        scaled = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        cb = scaled.getbbox()
        hcx = (hb[0] + hb[2]) / 2 * scale
        canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
        canvas.alpha_composite(scaled, (round(OUT_W / 2 - hcx) + MOLE_DX.get(name, 0), round(OUT_H - cb[3])))
        canvas.save(os.path.join(MOLES_OUT, name + '.png'))

    # --- 2b) 방해물 동물 (동물들3.png — 흙두둑 없는 상반신 격자).
    #         일반 얼굴 = "다른 동물"(목숨 -1), 고글 쓴 버전(-x) = "폭탄"(시간 -3초).
    # 이 시트의 어두운 체커 칸은 밝기 ~100 근처라 기본 lo=110 로는 안 지워진다 → lo 를 낮춘다.
    an_sheet = key_out(Image.open(os.path.join(SRC, 'animals-source.png')), lo=78, hi=238)
    acw, ach = an_sheet.size[0] / 7, an_sheet.size[1] / 4

    # 동물은 칸 안에 반듯이 놓여 있지 않아, 성분(blob)으로 집는다: nominal 칸 중심에 가장 가까운 blob.
    # (col, row, 최종 스프라이트 목표 폭 px) — 두더지 몸통(~195px, canvas 470x548) 근처로.
    ANIMALS = {
        'rabbit':   (0, 0, 188), 'tiger':   (0, 1, 200), 'hippo':   (0, 2, 208),
        'lion':     (0, 3, 208), 'dog':     (5, 2, 196),
        'rabbit-x': (4, 0, 188), 'tiger-x': (3, 1, 200), 'hippo-x': (4, 2, 208),
        'lion-x':   (3, 3, 208), 'dog-x':   (5, 3, 196),
    }
    an_blobs = blobs(an_sheet, min_size=6000)
    for name, (c, r, target_w) in ANIMALS.items():
        tx, ty = (c + 0.5) * acw, (r + 0.5) * ach
        blob = min(an_blobs, key=lambda b: (b['center'][0] - tx) ** 2 + (b['center'][1] - ty) ** 2)
        im = smooth_alpha(defringe(eat_fringe(cut_blob(an_sheet, blob))))
        bb = im.getbbox()
        im = im.crop(bb) if bb else im
        scale = target_w / im.width
        scaled = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
        cb = scaled.getbbox()
        canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
        canvas.alpha_composite(scaled, (round(OUT_W / 2 - (cb[0] + cb[2]) / 2), round(OUT_H - cb[3])))
        canvas.save(os.path.join(MOLES_OUT, name + '.png'))

    # --- 3) 구멍: hole.png(뒤) + hole-front.png(앞턱).
    #     앞턱을 두더지 위에 겹쳐, 두더지 아랫몸이 "구멍 모양대로" 가려지게 한다
    #     (예전엔 .mole-pop 을 직선으로 잘라서 그 밑에 구멍 속이 비쳤음 — seam).
    #     두 장을 같은 캔버스 크기로 저장해야 겹칠 때 어긋나지 않으므로 bbox 트림은 안 한다.
    holes_sheet = key_out(Image.open(os.path.join(SRC, 'hole-source.png')))
    hole = defringe(drop_specks(holes_sheet.crop((852, 590, 1120, 726))))
    hw, hh = hole.size
    hpx = hole.load()

    def _lum(x, y):
        r, g, b, a = hpx[x, y]
        return (r + g + b) / 3 if a > 20 else 255

    # 볏(crest): 각 열에서 '구멍 속(어두움) → 앞턱(밝음)'으로 다시 밝아지는 y. 이 아래가 앞턱.
    crest = []
    for x in range(hw):
        c = hh
        for y in range(hh // 3, hh - 1):
            if hpx[x, y][3] > 20 and _lum(x, y) > 75 and _lum(x, max(0, y - 5)) < 60:
                c = y
                break
        crest.append(c)
    for _ in range(4):  # 튀는 값 median 스무딩
        crest = [crest[0]] + [sorted((crest[i - 1], crest[i], crest[i + 1]))[1]
                              for i in range(1, hw - 1)] + [crest[-1]]

    # 구멍 속이 거의 검정(평균 밝기 ~56)이라, 어두운 픽셀일수록 따뜻한 갈색으로 섞어
    # "흙 구덩이"로 보이게 한다 (사용자: 시커먼 구멍이 눈에 띈다).
    for y in range(hh):
        for x in range(hw):
            r, g, b, a = hpx[x, y]
            if a < 20:
                continue
            lum = (r + g + b) / 3
            if lum >= 90:
                continue
            t = (90 - lum) / 90 * 0.72
            hpx[x, y] = (round(r * (1 - t) + 104 * t),
                         round(g * (1 - t) + 72 * t),
                         round(b * (1 - t) + 48 * t), a)
    hole.save(os.path.join(MOLES_OUT, 'hole.png'))

    # 앞턱: 볏 아래 픽셀만 (밝기 보정된 상태 그대로), 윗변 4px 는 알파 페이드로 부드럽게.
    front = Image.new('RGBA', (hw, hh), (0, 0, 0, 0))
    fpx = front.load()
    for x in range(hw):
        for y in range(crest[x], hh):
            r, g, b, a = hpx[x, y]
            fade = min(1.0, (y - crest[x] + 1) / 4)
            fpx[x, y] = (r, g, b, round(a * fade))
    front.save(os.path.join(MOLES_OUT, 'hole-front.png'))

    # --- 4) 뽕망치 (손잡이 포함 전체 — lane-hammer 가 우측 하단 축에서 대각 스윙) ---
    hammer = key_out(Image.open(os.path.join(SRC, 'hammer-source.png')), lo=150, hi=255)
    hammer = drop_specks(hammer, min_area=200)
    hbx = hammer.getbbox()
    hammer.crop(hbx).save(os.path.join(ASSETS_OUT, 'hammer.png'))

    print(f'canvas {OUT_W}x{OUT_H}')
    print('moles/:', sorted(os.listdir(MOLES_OUT)))
    print('assets/hammer.png written')


if __name__ == '__main__':
    main()
