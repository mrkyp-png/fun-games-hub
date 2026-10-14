"""Create a code-native thin-line SVG from the unchanged circuit's metal centerlines."""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,json,hashlib
from skimage.morphology import opening,disk,remove_small_objects,skeletonize
p=Path('mole/assets/rhythm-b');source=p/'circuit-user.png';a=np.array(Image.open(source).convert('RGBA'))
metal=(a[:,:,3]>220)&(a[:,:,:3].min(axis=2)>110)
metal=remove_small_objects(opening(metal,disk(2)),max_size=59)
sk=skeletonize(metal)
contours,_=cv2.findContours(sk.astype('uint8'),cv2.RETR_LIST,cv2.CHAIN_APPROX_NONE)
paths=[]
for c in contours:
 if len(c)<4:continue
 points=cv2.approxPolyDP(c,.65,True).reshape(-1,2)
 if len(points)<2:continue
 paths.append('M'+' L'.join(f'{x},{y}' for x,y in points)+' Z')
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1281" height="1228" viewBox="0 0 1281 1228" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">'+'<path d="'+' '.join(paths)+'"/>'+'</g></svg>\n'
(p/'circuit-thin.svg').write_text(svg,encoding='utf-8')
Path('review/circuit-thin-v1061.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'same original metal mask/opening as existing light routes, skeleton centerlines, contour simplification0.65 sourcepx','paths':len(paths),'stroke_source_px':6,'estimated_stroke_css_px_at390':6*244/1164*390/952,'size':[1281,1228],'preserveAspectRatio':'none'},indent=2),encoding='utf-8')
print('SVG created:',len(paths),'paths;',len(svg),'bytes; original PNG unchanged')
