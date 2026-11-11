"""Package ImageGen artwork without cropping or painting over original UI corners."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r'C:\Users\master\.codex\generated_images\01a1c7c9-988b-7c81-bb61-6412c87356b4')
BASE = ROOT / 'mole/assets/workshop'
OUT = BASE / 'tone-v1684'
JOBS = [
    ('unified-bg', '0f812282-ebbb-4bbf-bab5-be1e8059f487', None),
    ('unified-stage', 'de0bf2ce-bda9-44bc-a1c0-48876faf47b6', 'clarity-v1434/stage.png'),
    ('unified-sign', '29e7f97e-31c9-4ebf-84e8-c780d579c2a5', 'sign.png'),
    ('unified-card', '4be19202-ee8d-485d-93cd-b2eaac561437', 'pick/card-blue.png'),
    ('unified-panel', '56190219-7fe7-4130-94bf-a5f6c59e5399', 'clarity-v1434/panel.png'),
]
OUT.mkdir(exist_ok=True)
report = []
for name, identifier, original in JOBS:
    source = SRC / ('exec-' + identifier + '.png')
    with Image.open(source) as generated:
        image = generated.convert('RGB' if original is None else 'RGBA')
        if original:
            with Image.open(BASE / original) as old:
                image = image.resize(old.size, Image.Resampling.LANCZOS)
        dest = OUT / (name + '.webp')
        image.save(dest, format='WEBP', quality=94, method=4)
        if original:
            assert image.getchannel('A').getextrema()[0] == 0
        report.append(dict(name=name, generated=str(source), original=original, size=image.size, bytes=dest.stat().st_size))
        print(name, image.size, dest.stat().st_size)
(ROOT / 'review/workshop-unified-assets.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
