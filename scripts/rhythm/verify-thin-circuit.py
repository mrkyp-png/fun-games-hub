from pathlib import Path
import json,re,xml.etree.ElementTree as ET,numpy as np,cv2
from scipy.ndimage import distance_transform_edt
p=Path('mole/assets/rhythm-b/circuit-thin.svg');root=ET.fromstring(p.read_text());assert root.attrib['viewBox']=='0 0 1281 1228';assert root.attrib['preserveAspectRatio']=='none'
g=root.find('{http://www.w3.org/2000/svg}g');assert g.attrib['stroke-width']=='6';paths=list(g);assert len(paths)==1
wire=np.zeros((1228,1281),np.uint8)
for part in paths[0].attrib['d'].split('M')[1:]:
 points=np.array([[int(x),int(y)] for x,y in re.findall(r'(\d+),(\d+)',part)],np.int32)
 cv2.polylines(wire,[points],True,1,1)
distance=distance_transform_edt(wire==0)
s=Path('mole/js/rhythm-b-routes.js').read_text();routes=json.loads(s.split('window.MoleGame.rhythmBCircuitRoutes = ')[1].strip().rstrip(';'))
d=[]
for route in routes:
 for x,y in re.findall(r'(\d+),(\d+)',route):d.append(distance[int(y),int(x)])
assert max(d)<=2,max(d)
print('PASS: one static SVG path; 6 sourcepx stroke (~0.52CSSpx at390); original coordinate mapping; all80 white-light routes align within',round(max(d),3),'sourcepx')
