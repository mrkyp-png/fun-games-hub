"""PWA 아이콘 생성 — 로딩화면.png(두더지팡! 로고 + 두더지 캐릭터) 전체를
코스믹 다크 배경 + 따뜻한 글로우 위에 얹는다. maskable 안전영역(중앙 ~80%) 안.
소스: assets/loading.png
실행: python scripts/make-app-icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'icons')
SRC = os.path.join(ROOT, 'assets', 'loading.png')
BG = (13, 10, 36)          # cosmic-theme --bg #0d0a24
GLOW = (255, 176, 84)      # 따뜻한 주황 글로우 (캐릭터 톤과 맞춤)

art = Image.open(SRC).convert('RGBA')
# 로고(두더지팡!) + 캐릭터 전부. 바깥 색종이/별 여백만 트림.
art = art.crop(art.getbbox())
char = art


def build(size):
    im = Image.new('RGBA', (size, size), BG + (255,))
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = int(size * 0.40)
    gd.ellipse([size // 2 - r, size // 2 - r + int(size * 0.04),
                size // 2 + r, size // 2 + r + int(size * 0.04)], fill=GLOW + (110,))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.13)))
    sd = ImageDraw.Draw(im)
    for (fx, fy, rad) in [(0.14, 0.16, 0.013), (0.85, 0.13, 0.016), (0.9, 0.82, 0.012),
                          (0.1, 0.8, 0.011), (0.5, 0.07, 0.01)]:
        x, y, rr = fx * size, fy * size, rad * size
        sd.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 235))
    # 로고+캐릭터 — maskable 안전영역(중앙 원) 안, 긴 변이 아이콘의 ~78%
    fit = size * 0.78
    scale = fit / max(char.width, char.height)
    c = char.resize((max(1, int(char.width * scale)), max(1, int(char.height * scale))), Image.LANCZOS)
    x = (size - c.width) // 2
    y = (size - c.height) // 2
    im.alpha_composite(c, (x, y))
    im.convert('RGB').save(os.path.join(OUT, f'icon-{size}.png'))
    print(f'icon-{size}.png  ({c.size} char)')


build(192)
build(512)
