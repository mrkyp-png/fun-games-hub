"""라운드별(봄/여름/가을/겨울) 구멍 이미지 슬라이싱.

입력: 바탕화면 "두더지팡 구멍" 폴더의 계절별 완성 이미지(이미 투명배경, 통짜 구멍 하나).
출력: assets/moles/hole-<season>.png(뒤) + hole-front-<season>.png(앞턱).

기존 slice-mole-sprites.py 의 hole 처리(크레스트 감지: 각 열에서 '구멍 속(어두움) →
앞턱(밝음)'으로 바뀌는 지점을 찾아 그 아래만 앞턱으로 분리)를 그대로 재사용 — 계절
이미지도 동일하게 밝은 돌턱 rim + 어두운 갈색 구덩이 내부 구조라 같은 로직이 통한다.
"""

import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MOLES_OUT = os.path.join(ROOT, 'assets', 'moles')
SEASON_SRC = r'C:\Users\master\Desktop\두더지팡 구멍'

SEASONS = {
    'spring': '봄.png',
    'summer': '여름.png',
    'autumn': '가을.png',
    'winter': '겨울.png',
}

OUT_W = 536  # 기존 hole.png(268x136)의 2배 — 레티나 대비


def slice_one(season, filename):
    im = Image.open(os.path.join(SEASON_SRC, filename)).convert('RGBA')
    scale = OUT_W / im.width
    out_h = round(im.height * scale)
    im = im.resize((OUT_W, out_h), Image.LANCZOS)
    w, h = im.size
    px = im.load()

    def _lum(x, y):
        r, g, b, a = px[x, y]
        return (r + g + b) / 3 if a > 20 else 255

    crest = []
    for x in range(w):
        c = h
        for y in range(h // 3, h - 1):
            if px[x, y][3] > 20 and _lum(x, y) > 75 and _lum(x, max(0, y - 5)) < 60:
                c = y
                break
        crest.append(c)
    for _ in range(4):
        crest = [crest[0]] + [sorted((crest[i - 1], crest[i], crest[i + 1]))[1]
                              for i in range(1, w - 1)] + [crest[-1]]

    im.save(os.path.join(MOLES_OUT, 'hole-' + season + '.png'))

    front = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    fpx = front.load()
    for x in range(w):
        for y in range(crest[x], h):
            r, g, b, a = px[x, y]
            fade = min(1.0, (y - crest[x] + 1) / 4)
            fpx[x, y] = (r, g, b, round(a * fade))
    front.save(os.path.join(MOLES_OUT, 'hole-front-' + season + '.png'))
    print(season, 'done', w, h)


if __name__ == '__main__':
    for season, filename in SEASONS.items():
        slice_one(season, filename)
