"""One 300px cell and one unscaled joint for all 18 cells. Pixel-checked geometry."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json,hashlib
p=Path('mole/assets/rhythm-b');src=Image.open(p/'skeleton-bottom-fixed.png').convert('RGBA');tile=src.crop((26,1056,326,1356))
# Standard central opening. Only inner black recess pixels differ from the sample;
# the four metal corner pieces and outside rails retain original RGB.
hole=Image.new('L',(300,300));d=ImageDraw.Draw(hole);d.polygon([(43,23),(256,23),(276,43),(276,256),(256,276),(43,276),(23,256),(23,43)],fill=255)
a=tile.getchannel('A')
for y in range(300):
 for x in range(300):
  if hole.getpixel((x,y)):a.putpixel((x,y),0)
  elif a.getpixel((x,y))<128:a.putpixel((x,y),253)
tile.putalpha(a);tile.save(p/'uniform-cell.png')
# Original thin-line pixels; extend only the vertical straight section by 2px.
raw=Image.new('RGBA',(300,300));raw.paste(Image.open(p/'button-inner-line-0.png').convert('RGBA'),(5,1))
line=Image.new('RGBA',(300,302));line.paste(raw.crop((0,0,300,150)),(0,0));line.paste(raw.crop((0,149,300,150)).resize((300,2)),(0,150));line.paste(raw.crop((0,150,300,300)),(0,152))
centered=Image.new('RGBA',(300,300));centered.paste(line,(-3,2));mask=centered.getchannel('A')
colors=['#086aff','#ff1529','#ffc400','#05e52e','#a500ff','#ff0099','#ff7900','#00cfff','#a65121']
# Build shared frame geometry, repeating the same tile also across outer half-rails.
frame=src.copy();grid=Image.new('RGBA',(952,956))
for r in range(-1,4):
 for c in range(-1,4):grid.paste(tile,(26+c*300,26+r*300))
node=src.crop((298,1328,355,1385));nm=Image.new('L',(57,57));ImageDraw.Draw(nm).polygon([(10,0),(46,0),(56,10),(56,46),(46,56),(10,56),(0,46),(0,10)],fill=255)
for y in [26,326,626,926]:
 for x in [26,326,626,926]:grid.paste(node,(x-28,y-28),nm)
frame.paste(grid,(0,0));frame.paste(grid,(0,1030))
# Assert every physical opening has exactly the same alpha pixels BEFORE color.
alpha=frame.getchannel('A');ref=alpha.crop((26,26,326,326)).tobytes()
for ybase in [26,1056]:
 for r in range(3):
  for c in range(3):assert alpha.crop((26+c*300,ybase+r*300,326+c*300,ybase+300+r*300)).tobytes()==ref
# Tint native line pixels and their blur, keeping complete physical frame alpha.
upper=Image.new('RGBA',frame.size)
for base in [26,1056]:
 for i,color in enumerate(colors):
  row,col=divmod(i,3);colored=Image.new('RGBA',(300,300),color);colored.putalpha(mask);colored.save(p/f'uniform-inner-line-{i}.png')
  x,y=26+col*300,base+row*300;part=frame.crop((x,y,x+300,y+300));keep=part.getchannel('A');part.alpha_composite(colored.filter(ImageFilter.GaussianBlur(2)));part.alpha_composite(colored);part.putalpha(keep);frame.paste(part,(x,y))
  if base==26:upper.paste(colored,(x,y))
# Preserve every complete connector after the line blur, with no color bleed onto metal.
for base in [26,1056]:
 for yy in [base+j*300 for j in range(4)]:
  for xx in [26,326,626,926]:frame.paste(node,(xx-28,yy-28),nm)
frame.save(p/'skeleton-uniform.png');upper.save(p/'upper-uniform-glow.png')
# Protected HUD/ad interior areas remain exactly unchanged.
assert ImageChops.difference(frame.crop((0,956,952,1028)),src.crop((0,956,952,1028))).getbbox() is None
assert ImageChops.difference(frame.crop((0,1986,952,2078)),src.crop((0,1986,952,2078))).getbbox() is None
report={'cells':18,'pitch':300,'opening_bounds':[23,23,277,277],'opening_width':254,'opening_height':254,'opening_alpha_identical':True,'joint_size':[57,57],'joint_resized':False,'source_tile':[26,1056,326,1356]}
Path('review/uniform-geometry-v1038.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
