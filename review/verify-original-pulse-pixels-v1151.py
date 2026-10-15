from PIL import Image
import numpy as np,json
for lane in [0,4,8]:
 m=json.load(open(f'review/pulse-metrics-{lane}-v1151.json'));im=np.asarray(Image.open(f'review/pulse-isolated-{lane}-v1151.png').convert('RGB'));ratio=im.shape[1]/m['frame']['width'];yy,xx=np.indices(im.shape[:2]);xs=xx/ratio;ys=yy/ratio;baseline=np.asarray(Image.open(f'review/pulse-isolated-before-{lane}-v1151.png').convert('RGB'));lit=np.max(abs(im.astype(int)-baseline.astype(int)),2)>5
 for j,c in enumerate(m['glasses']):
  if j==lane:continue
  mask=(xs-c['x'])**2+(ys-c['y'])**2<(c['r']-2)**2
  assert not lit[mask].any(),(lane,'glass intrusion',j)
 source=m['glasses'][lane];outside=(abs(xs-source['x'])>60)|(abs(ys-source['y'])>60)
 assert np.count_nonzero(lit & outside)>200,(lane,'no propagation')
 print('PASS pixels',lane,'outside cell',np.count_nonzero(lit & outside),'all other glass interiors clear')
