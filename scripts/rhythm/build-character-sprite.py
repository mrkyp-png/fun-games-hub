from pathlib import Path
from PIL import Image
import json
source=Path('mole/assets/rhythm-b/character-hand-clean-v1044.png');im=Image.open(source).convert('RGBA')
boxes=[(35,26,238,315),(302,28,231,311),(565,26,243,318),(835,32,239,315),(1100,30,239,317),(1369,31,240,315),(1636,31,237,316),(1898,31,235,313),(25,367,238,323),(284,367,243,324),(562,368,239,320),(831,367,238,325),(1083,371,258,314),(1367,371,241,322),(1634,373,240,315),(1898,369,236,324)]
out=Path('mole/assets/rhythm-b/character');out.mkdir(exist_ok=True)
strip=Image.new('RGBA',(280*16,350));meta=[]
for i,(x,y,w,h) in enumerate(boxes):
 crop=im.crop((x-4,y-4,x+w+4,y+h+4));frame=Image.new('RGBA',(280,350));ox=(280-crop.width)//2;oy=342-crop.height
 frame.paste(crop,(ox,oy));frame.save(out/f'frame-{i:02}.png');strip.paste(frame,(i*280,0));meta.append(dict(frame=i,source_box=[x-4,y-4,x+w+4,y+h+4],offset=[ox,oy]))
strip.save(out/'run-strip.png');(out/'frames.json').write_text(json.dumps(dict(size=[280,350],fps=12,frames=meta),indent=2),encoding='utf-8')
print('16 frames, uniform 280x350, no resizing; feet anchored to y342')
