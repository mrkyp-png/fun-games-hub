# 알리 펀치 기본 글러브(잽/라이트훅/레프트훅 공용) — 소스: ~/Desktop/권투글러브 기본(잽, 라이트훅 레프트훅).png
# 배경이 블러된 빨강~노랑 그라데이션 사진이라 에지 기반 접근(이전 두 번 시도)이 다 실패 —
# OpenCV GrabCut(사각형 초기화)으로 전경/배경 분리.
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
SRC = os.path.expanduser('~/Desktop/권투글러브 기본(잽, 라이트훅 레프트훅).png')
OUT = os.path.join(OUT_DIR, 'alipunch-jab.png')
TARGET_MAX = 440
OUTLINE = 30  # 사용자 지시: 현재(15)의 2배

img_pil = Image.open(SRC).convert('RGB')
img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)  # cv2.imread 는 한글 경로 못 읽어서 PIL 경유
h, w = img.shape[:2]
mask = np.zeros((h, w), np.uint8)
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)
margin_x, margin_top, margin_bot = int(w * 0.08), int(h * 0.03), int(h * 0.06)
rect = (margin_x, margin_top, w - 2 * margin_x, h - margin_top - margin_bot)
cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 8, cv2.GC_INIT_WITH_RECT)
alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype('uint8')
# GrabCut 이 원본 사진의 그림자/얼룩을 글러브로 잘못 포함시켜 오른쪽에 튀어나온 돌기가 생김
# (사용자 리포트: "워터마크 지운 자국") — 그 좌표대(실측)만 수동으로 깎아낸다.
alpha[960:1140, 780:] = 0

# 가장 큰 연결 성분만 남기기(잔여 배경 조각 제거) + 살짝 팽창(가장자리 보존) + 스무딩.
n, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, connectivity=8)
if n > 1:
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    alpha = np.where(labels == largest, 255, 0).astype('uint8')
kernel = np.ones((5, 5), np.uint8)
alpha = cv2.dilate(alpha, kernel, iterations=1)
alpha = cv2.GaussianBlur(alpha, (5, 5), 0)

im = Image.open(SRC).convert('RGBA')
r, g, b, _ = im.split()
a = Image.fromarray(alpha)
out = Image.merge('RGBA', (r, g, b, a))
bb = out.split()[3].getbbox()
if bb:
    out = out.crop(bb)


def outline(cell, px_w=OUTLINE):
    pad = px_w + 2
    canv = Image.new('RGBA', (cell.width + pad * 2, cell.height + pad * 2), (0, 0, 0, 0))
    canv.alpha_composite(cell, (pad, pad))
    sil = canv.split()[3].point(lambda v: 255 if v >= 40 else 0)
    dil = sil.filter(ImageFilter.MaxFilter(2 * px_w + 1)).filter(ImageFilter.GaussianBlur(0.6))
    o = Image.new('RGBA', canv.size, (0, 0, 0, 0))
    o.paste(Image.new('RGBA', canv.size, (18, 16, 18, 255)), (0, 0), dil)
    o.alpha_composite(canv)
    bb2 = o.split()[3].getbbox()
    return o.crop(bb2) if bb2 else o


out = outline(out)
s = TARGET_MAX / max(out.size)
if s < 1:
    out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
os.makedirs(OUT_DIR, exist_ok=True)
out.save(OUT, optimize=True)
print('saved', OUT, out.size)
