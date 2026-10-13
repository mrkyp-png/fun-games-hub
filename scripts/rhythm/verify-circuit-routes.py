from pathlib import Path
from PIL import Image
import json,re
s=Path('mole/js/rhythm-b-routes.js').read_text(encoding='utf-8');routes=json.loads(s.split('rhythmBCircuitRoutes = ')[1].strip().rstrip(';'))
im=Image.open('mole/assets/rhythm-b/circuit-user.png').convert('RGBA');counts=[]
for i,route in enumerate(routes):
 points=[tuple(map(int,p)) for p in re.findall(r'(\d+),(\d+)',route)];counts.append(len(points))
 for x,y in points:
  r,g,b,a=im.getpixel((x,y));assert a>220 and min(r,g,b)>110
assert len(routes)==80 and max(counts[:40])<=260 and min(counts[40:])>=450
print('PASS: native-metal vertices verified; 40 short routes / 40 long routes')
