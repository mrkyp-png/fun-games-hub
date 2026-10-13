from PIL import Image
import numpy as np
from pathlib import Path
import json
before=np.array(Image.open('review/rhythm-b-depth-after-v1046.png').convert('RGBA'));after=np.array(Image.open('review/rhythm-b-depth-pressed-v1046.png').convert('RGBA'))
s=390/952;top=(884-2078*s)/2;counts=[]
for i in range(9):
 cx=(176+(i%3)*300)*s;cy=top+(1206+(i//3)*300)*s
 x0,x1=int(cx-115*s),int(cx+115*s);y0,y1=int(cy-115*s),int(cy+115*s)
 counts.append(int(np.any(before[y0:y1,x0:x1]!=after[y0:y1,x0:x1],axis=2).sum()))
assert counts[0]>0 and counts[1:]==[0]*8,counts
Path('review/b-button-isolation-v1047.json').write_text(json.dumps({'changed_pixels_per_button':counts,'note':'Reduced motion freezes legitimate circuit flow; compare one press against eight untouched button interiors.'},indent=2),encoding='utf-8')
print('PASS: pressed button pixels change; other eight button interiors unchanged:',counts)
