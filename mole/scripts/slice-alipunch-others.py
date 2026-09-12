# 알리 펀치 스트레이트/어퍼컷 — 이미 배경투명 사진이라 크롭+외곽선만 (다른 무기 스프라이트와 톤 통일).
import os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(HERE), 'assets', 'weapons')
TARGET_MAX = 440
OUTLINE = 30  # 사용자 지시: 현재(15)의 2배

FILES = [
    (os.path.expanduser('~/Desktop/권투글러브 스트레이트.png'), 'alipunch-straight.png'),
    (os.path.expanduser('~/Desktop/권투글러브 어퍼컷.png'), 'alipunch-upper.png'),
]


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


os.makedirs(OUT_DIR, exist_ok=True)
for src, name in FILES:
    im = Image.open(src).convert('RGBA')
    # 원본이 이미 부드럽게 페이드된 알파(안티에일리어싱 폭이 넓음)라 외곽선 실루엣 계산이
    # 애매해져서(사용자 리포트: "외곽선이 이상하게/파여있다") 위쪽 곡선 부분에 선이 안 그려졌었다.
    # 알파를 먼저 이진화(128 기준)해서 실루엣을 또렷하게 만든 다음 살짝만 블러로 다시 부드럽게.
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v >= 128 else 0).filter(ImageFilter.GaussianBlur(0.8))
    im = Image.merge('RGBA', (r, g, b, a))
    bb = im.split()[3].getbbox()
    if bb:
        im = im.crop(bb)
    if name == 'alipunch-upper.png':
        im = im.crop((0, 0, im.width, int(im.height * 0.92)))  # 바닥의 손목(피부색) 잘라내기
    im = outline(im)
    s = TARGET_MAX / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p = os.path.join(OUT_DIR, name)
    im.save(p, optimize=True)
    print('saved', p, im.size)
