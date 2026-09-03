"""PWA 아이콘 생성 — 로딩화면.png(두더지팡! 캐릭터)에서 캐릭터만 잘라
코스믹 다크 배경 + 따뜻한 글로우 위에 얹는다. maskable 안전영역(중앙 ~80%) 안.
소스: assets/src/loading-source.png (체커보드 배경 제거된 투명 PNG)
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
art = art.crop(art.getbbox())
W, H = art.size
# 캐릭터 = 하단부. 로고+글로우 구름 아래(세로 43%부터)만 사용.
char = art.crop((0, int(H * 0.43), W, H))
char = char.crop(char.getbbox())


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
    # 캐릭터 — 안전영역 안, 폭 ~86%
    target_w = int(size * 0.86)
    scale = target_w / char.width
    c = char.resize((target_w, max(1, int(char.height * scale))), Image.LANCZOS)
    x = (size - c.width) // 2
    y = int(size * 0.52 - c.height * 0.46)
    im.alpha_composite(c, (x, y))
    im.convert('RGB').save(os.path.join(OUT, f'icon-{size}.png'))
    print(f'icon-{size}.png  ({c.size} char)')


build(192)
build(512)
