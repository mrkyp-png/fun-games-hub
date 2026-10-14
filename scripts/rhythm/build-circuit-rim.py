from pathlib import Path
import cv2,numpy as np
from PIL import Image
from skimage.morphology import opening,disk,remove_small_objects
p=Path('mole/assets/rhythm-b');a=np.array(Image.open(p/'circuit-user.png').convert('RGBA'))
mask=remove_small_objects(opening((a[:,:,3]>220)&(a[:,:,:3].min(axis=2)>110),disk(2)),max_size=59)
contours,_=cv2.findContours(mask.astype('uint8'),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
c=max(contours,key=cv2.contourArea);pts=cv2.approxPolyDP(c,1.0,True).reshape(-1,2)
d='M'+' L'.join(f'{x},{y}' for x,y in pts)+' Z'
s=(p/'circuit-thin.svg').read_text(encoding='utf-8');s=s.replace('</svg>','<defs><filter id="rim-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path data-outer-rim="true" d="'+d+'" fill="none" stroke="#fff" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" filter="url(#rim-glow)"/></svg>')
(p/'circuit-rim.svg').write_text(s,encoding='utf-8');print('outer outline points:',len(pts),'area:',cv2.contourArea(c))
