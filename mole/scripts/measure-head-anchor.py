"""최종 두더지 스프라이트에서 빨간 헬멧을 찾아 얼굴 원 앵커를 산출한다.
출력(stdout): mole-sprites.js 에 붙일 HEAD_ANCHOR JS 객체 한 줄.

스프라이트(470x548)는 콘텐츠가 캔버스 바닥에 정렬돼 있고 상단은 투명 여백.
헬멧(선명한 빨강)의 위쪽 가장자리(y0)와 폭(헬멧 띠 구간의 x 범위)을 재서,
얼굴 원 중심을 헬멧 아래로 내린다. 전신 프레임과 빠끔/모자 프레임은 내리는 양이 다르다.

재실행: python scripts/measure-head-anchor.py  (값이 어긋나면 아래 상수 3개 튜닝)
"""
import os
import sys
import json
from PIL import Image

HERE = os.path.dirname(__file__)
SPRITES = os.path.join(HERE, '..', 'assets', 'moles')
FULL = ['mole1', 'mole2', 'mole3', 'mole4', 'mole5', 'mole6', 'mole7', 'mole8']
PEEK = ['peek1', 'peek2', 'helmet']

FULL_DROP = 0.85     # 전신: 얼굴 중심 = 헬멧 위 + 이 배수 * 헬멧폭(높이단위)
PEEK_DROP = 0.30     # 빠끔/모자: 얼굴을 덜 내려서 이마·눈만 rim 위로 보이게
FACE_R_MULT = 0.55   # 얼굴 반지름 = 헬멧 폭 * 이 값
CANVAS_W, CANVAS_H = 470, 548


def is_helmet_red(r, g, b, a):
    return a > 60 and r > 150 and g < 85 and b < 85 and abs(g - b) < 40


def helmet_metrics(im):
    """헬멧 위 가장자리 y0(px), 헬멧 띠 구간의 x 중심·폭(px). 못 찾으면 None."""
    px = im.convert('RGBA').load()
    w, h = im.size
    y0 = None
    for y in range(h):
        row_has = False
        for x in range(w):
            if is_helmet_red(*px[x, y]):
                row_has = True
                break
        if row_has:
            y0 = y
            break
    if y0 is None:
        return None
    # 헬멧 띠 = y0 부터 캔버스 높이의 15% 구간
    band_lo, band_hi = y0, min(h, y0 + int(0.15 * h))
    xs = []
    for y in range(band_lo, band_hi):
        for x in range(w):
            if is_helmet_red(*px[x, y]):
                xs.append(x)
    if not xs:
        return None
    return y0, (min(xs) + max(xs)) / 2.0, (max(xs) - min(xs))


def anchor(im, drop):
    w, h = im.size
    m = helmet_metrics(im)
    if not m:
        return {'cx': 0.5, 'cy': 0.6, 'r': 0.17}
    y0, hcx, hw = m
    hw_frac = hw / w
    hw_h = hw_frac * (CANVAS_W / CANVAS_H)   # 폭을 높이 단위 비율로
    cx = hcx / w
    cy = (y0 / h) + drop * hw_h
    r = max(0.08, hw_frac * FACE_R_MULT)
    return {'cx': round(cx, 4), 'cy': round(cy, 4), 'r': round(r, 4)}


def main():
    out = {}
    for f in FULL:
        p = os.path.join(SPRITES, f + '.png')
        if os.path.exists(p):
            out[f] = anchor(Image.open(p), FULL_DROP)
    for f in PEEK:
        p = os.path.join(SPRITES, f + '.png')
        if os.path.exists(p):
            out[f] = anchor(Image.open(p), PEEK_DROP)
    print('  const HEAD_ANCHOR = ' + json.dumps(out, ensure_ascii=False).replace('"', '') + ';')
    for k, v in out.items():
        print('  // %s: cx=%s cy=%s r=%s' % (k, v['cx'], v['cy'], v['r']), file=sys.stderr)


if __name__ == '__main__':
    main()
