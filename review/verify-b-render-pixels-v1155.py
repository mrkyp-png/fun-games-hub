from pathlib import Path
import numpy as np
from PIL import Image
for phase in ['spawn','approach','hit','combo','stop']:
    before=np.asarray(Image.open(Path('review')/f'render-v1155-before-{phase}.png').convert('RGB')).astype(int)
    after=np.asarray(Image.open(Path('review')/f'render-v1155-after-{phase}.png').convert('RGB')).astype(int)
    delta=np.max(abs(before-after),axis=2)
    print(phase,'changed pixels',int(np.count_nonzero(delta)),'max channel difference',int(delta.max()))
    assert int(delta.max())<=1 and int(np.count_nonzero(delta))<=100,f'{phase}: rendering changed beyond 1/255 edge rounding'
print('PASS before/after rendered pixels at five controlled phases (at most 1/255 edge rounding on <=100 pixels)')
