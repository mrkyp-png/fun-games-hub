"""Inspect packed alpha alignment and draw the extracted inner edge for asset QA."""
from pathlib import Path
import json
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parent.parent
folder = root / 'mole/assets/rhythm/beach-sand-hole-v1690'
geometry = json.loads((folder / 'geometry.json').read_text(encoding='utf-8'))
back = Image.open(folder / 'hole-back.png').convert('RGBA')
front = Image.open(folder / 'hole-front.png').convert('RGBA')
mask = Image.open(folder / 'hole-occlusion.png').convert('RGBA')
assert back.size == front.size == mask.size == (geometry['width'], geometry['height'])
expected = ImageChops.multiply(back.getchannel('A'), mask.getchannel('A'))
error = ImageChops.difference(front.getchannel('A'), expected).getextrema()[1]
assert error <= 1
assert back.getpixel((back.width // 2, round(back.height * .42)))[3] >= 250
assert back.getpixel((0, 0))[3] == 0
assert len(geometry['frontCurvePixels']) == back.width
preview = Image.new('RGBA', (back.width, back.height * 2), '#eed2a0')
preview.alpha_composite(back, (0, 0))
preview.alpha_composite(front, (0, back.height))
ImageDraw.Draw(preview).line(list(enumerate(geometry['frontCurvePixels'])), fill='#49ead5', width=2)
preview.convert('RGB').save(root / 'review/beach-sand-layers-qa.jpg')
print(f'PASS sand layers: {back.size}, source alpha preserved, interior alpha >=250/255, front/mask max alpha error={error}/255')
