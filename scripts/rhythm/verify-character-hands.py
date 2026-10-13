from pathlib import Path
from PIL import Image
import numpy as np, hashlib, json
src=next(Path.home().joinpath('Desktop').glob('*첫번째.png'))
dst=Path('mole/assets/rhythm-b/character-hand-clean-v1044.png')
a=np.array(Image.open(src).convert('RGBA'));b=np.array(Image.open(dst).convert('RGBA'))
assert a.shape==b.shape==(725,2170,4)
assert np.array_equal(a[:,:,:3],b[:,:,:3]),'RGB changed'
assert np.all(b[:,:,3]<=a[:,:,3]),'Added alpha'
allowed=np.zeros(a.shape[:2],bool)
regions=[(480,205,541,247),(560,200,621,245),(745,550,816,600)]
counts=[]
for x0,y0,x1,y1 in regions:
 allowed[y0:y1,x0:x1]=True
 counts.append(int(np.count_nonzero(a[y0:y1,x0:x1,3]!=b[y0:y1,x0:x1,3])))
changed=a[:,:,3]!=b[:,:,3]
assert not np.any(changed&~allowed),'Changed outside requested hands'
report=dict(source=str(src),source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),output=str(dst),size=[2170,725],frames=[2,3,11],alpha_removed_pixels=counts,RGB_unchanged=True,outside_hand_regions_unchanged=True,other_13_frames_unchanged=True)
Path('review/character-hand-clean-v1044.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
