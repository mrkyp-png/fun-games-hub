"""무기 스킨 스프라이트 슬라이스.

입력:
  Desktop/대포.png       (5포즈) — #3(우상단) = 대기 자세 (포신 좌상향, 우하단 코너용)
  Desktop/대포 화염.png  (발사 시퀀스, #3와 같은 각도) — 여기선 **화염·연기만** 크롭 (대포 제외).
                         (fire 시트의 대포는 포구가 찌그러져 있어 본체로 못 씀.)
  assets/src/cannon-angles.jpg  (대포 11종 시트, 흰 배경) — 조준 포즈 2개 크롭.
                         (= Desktop/진짜 파일.jpeg, 재현용으로 커밋됨.)

출력 assets/weapons/:
  cannon.png       대포 본체 (대포.png #3, ~40° 좌상향) — 중간 각도 조준 포즈
  cannon-low.png   시트 중간줄 2번째 (~28° 좌상향) — 얕은 각도 조준 포즈
  cannon-steep.png 시트 위쪽줄 2번째 (정면 3/4, 포신 거의 수직) — 가파른 각도 조준 포즈
  cannon-flash.png 총구 화염만 (좌상향, 오른쪽 끝 = 포구 부착점)
  cannon-smoke.png 총구 연기만
"""

import os
from collections import deque
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(HERE), 'assets', 'src')
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
_DESK = os.path.join(os.path.expanduser('~'), 'Desktop')


def _find(repo_name, desk_name):
    """repo assets/src (커밋본) 우선, 없으면 바탕화면 루트 / '대포 이미지/'."""
    for c in (os.path.join(SRC, repo_name),
              os.path.join(_DESK, desk_name),
              os.path.join(_DESK, '대포 이미지', desk_name)):
        if os.path.exists(c):
            return c
    return os.path.join(SRC, repo_name)


SRC_CANNON = _find('cannon-poses.png', '대포.png')
SRC_FIRE = _find('cannon-fire.png', '대포 화염.png')
SRC_ANGLES = os.path.join(os.path.dirname(HERE), 'assets', 'src', 'cannon-angles.jpg')

# cannon-angles.jpg (2496x1664) 셀 박스 — 연결요소 검출로 잡은 값
ANGLE_BOXES = {
    'cannon-steep': (627, 40, 975, 566),    # 위쪽줄 2번째 (정면, 포신 수직)
    'cannon-low':   (976, 551, 1576, 1037),  # 중간줄 2번째 (~28° 좌상향)
}


def key_white(im, band=4):
    """흰 배경을 테두리 flood 로 제거 + 경계의 밝은 AA 프린지(흰 테두리 노이즈)까지 먹는다.
    대포 아웃라인은 어두워서(luma<80) flood 가 거기서 멈추고, 나무·문장·불꽃은 채도가
    있어 안전. band = 실루엣 가장자리에서 몇 px 까지 프린지로 볼지."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size

    def lum(x, y):
        r, g, b, _ = px[x, y]
        return (r + g + b) / 3

    def chroma(x, y):
        r, g, b, _ = px[x, y]
        return max(r, g, b) - min(r, g, b)

    def bg_pure(x, y):        # 확실한 배경(흰색)
        return px[x, y][3] > 0 and lum(x, y) > 208 and chroma(x, y) < 30

    def fringe(x, y):         # 경계의 밝은 저채도 AA 밴드
        return px[x, y][3] > 0 and lum(x, y) >= 132 and chroma(x, y) <= 44

    # 1) 테두리에서 순수 배경 flood
    dist = [-1] * (w * h)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg_pure(x, y):
                dist[y * w + x] = 0
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if bg_pure(x, y):
                dist[y * w + x] = 0
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        d = dist[y * w + x]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if not (0 <= nx < w and 0 <= ny < h) or dist[ny * w + nx] != -1:
                continue
            i = ny * w + nx
            if bg_pure(nx, ny):
                dist[i] = 0
                dq.append((nx, ny))
            elif d < band and fringe(nx, ny):   # 경계 band px 안의 밝은 프린지도 먹음
                dist[i] = d + 1
                dq.append((nx, ny))
    for i in range(w * h):
        if dist[i] >= 0:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)

    # 2) 알파 1px 침식 + 살짝 블러로 계단 완화
    al = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(al)

    # 3) 남은 밝은 반투명 프린지 제거
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 255 and lum(x, y) > 175 and chroma(x, y) < 40:
                px[x, y] = (r, g, b, 0)
    return im


def round_ball(src, cx, cy, r):
    """대포 화염 시트에서 철구를 (cx,cy) 중심 반지름 r 로 잘라 원형 알파 마스크."""
    from PIL import ImageDraw
    crop = src.crop((cx - r, cy - r, cx + r, cy + r)).convert('RGBA')
    n = crop.size[0]
    px = crop.load()
    for y in range(n):          # 밝은 주황 불꼬리 픽셀 제거
        for x in range(n):
            rr, gg, bb, a = px[x, y]
            if rr > 150 and rr > bb + 60:
                px[x, y] = (rr, gg, bb, 0)
    m = Image.new('L', (n * 4, n * 4), 0)
    ImageDraw.Draw(m).ellipse((2, 2, n * 4 - 2, n * 4 - 2), fill=255)
    m = m.resize((n, n), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    crop.putalpha(m)
    return crop


def drop_specks(im, min_area=1200):
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


def keep_largest(im):
    """가장 큰 알파 연결요소만 남긴다 (크롭에 딸려온 옆 대포 조각 제거)."""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    best = []
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
            if len(comp) > len(best):
                best = comp
    keep = set(best)
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return im


def crop_bbox(im, box):
    c = drop_specks(im.crop(box))
    bb = c.split()[3].getbbox()
    return c.crop(bb) if bb else c


def cap(im, mx):
    if max(im.size) <= mx:
        return im
    s = mx / max(im.size)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)

    # 조준 포즈 2개 (흰 배경 시트에서 키아웃 + bbox 트림) — 소스가 repo 안이라 항상 실행
    ang = Image.open(SRC_ANGLES).convert('RGBA')
    for name, box in ANGLE_BOXES.items():
        sp = keep_largest(key_white(ang.crop(box)))
        bb = sp.split()[3].getbbox()
        if bb:
            sp = sp.crop(bb)
        cap(sp, 600).save(os.path.join(OUT, name + '.png'))

    # 아래는 바탕화면 원본이 있을 때만 (이미 생성·커밋돼 있음)
    if os.path.exists(SRC_CANNON):
        cn = Image.open(SRC_CANNON).convert('RGBA')
        cap(crop_bbox(cn, (1112, 40, 1522, 528)), 340).save(os.path.join(OUT, 'cannon.png'))
    if os.path.exists(SRC_FIRE):
        fr = Image.open(SRC_FIRE).convert('RGBA')
        # 화염 = 불꽃+스파크+바깥 연기 넓게. 포신 금속만 제외.
        cap(crop_bbox(fr, (14, 0, 408, 300)), 460).save(os.path.join(OUT, 'cannon-flash.png'))
        cap(crop_bbox(fr, (792, 36, 1010, 290)), 280).save(os.path.join(OUT, 'cannon-smoke.png'))
        # 포탄 = 깨끗한 원형 철구 (불꼬리 죽이고 원형 알파 마스크).
        round_ball(fr, 55, 576, 33).save(os.path.join(OUT, 'cannon-ball.png'))

    for n in ('cannon', 'cannon-low', 'cannon-steep', 'cannon-flash', 'cannon-smoke', 'cannon-ball'):
        p = os.path.join(OUT, n + '.png')
        print(n, Image.open(p).size, os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main()
