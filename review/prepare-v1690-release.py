from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parent.parent
for name in ['mole/index.html','mole/js/home3d.js','mole/js/rhythm-type-mole.js','mole/js/rhythm-beach-moles.js']:
    path=root/name;text=path.read_text(encoding='utf-8')
    text=re.sub(r'1690-(?:beach|sand)-local-\d+','1690-G',text).replace('1689-G','1690-G').replace('V 1689 G','V 1690 G')
    path.write_text(text,encoding='utf-8')
path=root/'mole/sw.js';text=path.read_text(encoding='utf-8');text,n=re.subn(r"^const CACHE = '[^']+';","const CACHE = 'mole-game-v1690-G';",text,flags=re.M);assert n==1
if '// V1690 G:' not in text:text=re.sub(r'^const CACHE =','// V1690 G: Sand beach, continuous ocean, combo turns and reactive hair; clear text-only signs, gentle warm entrance flow and corrected beach/water landing.\nconst CACHE =',text,count=1,flags=re.M)
path.write_text(text,encoding='utf-8')
production=['mole/index.html','mole/style.css','mole/sw.js','mole/js/home3d.js','mole/js/home3d-layout.js','mole/js/home3d-renderer.js','mole/js/home3d-signs.js','mole/js/rhythm-type-mole.js','mole/js/rhythm.js','mole/js/rhythm-beach.js','mole/js/rhythm-beach-ocean.js','mole/js/rhythm-beach-moles.js','mole/js/rhythm-beach-stunts.js','mole/assets/home3d/plaza.glb','mole/assets/home3d/plaza.blend']
production += [str(p.relative_to(root)).replace('\\','/') for p in sorted((root/'mole/assets/rhythm/beach-sand-hole-v1690').iterdir()) if p.is_file()]
reviews=['review/prepare-v1690-release.py','review/build-home-plaza.py','review/prepare-beach-sand-v1690.py','review/check-beach-sand-layers.py','review/verify-live-appearances.cjs','review/live-appearance-verification.json','review/verify-beach-hole-placement.cjs','review/verify-beach-plaza-v1690.cjs','review/verify-beach-ground-water-v1690.cjs','review/verify-rhythm-result-horizon-v1690.cjs','review/verify-beach-stunts-v1690.cjs','review/verify-rhythm-gate.cjs','review/export-beach-stunt-proof.cjs','review/render-beach-stunt-proof.py','review/render-beach-water-reference.py','review/render-gate-flow-reference.py','review/beach-plaza-v1690/plaza-before.glb','review/beach-plaza-v1690/rhythm-beach-before.js','review/beach-plaza-v1690/README.md','review/beach-stunts-v1690/README.md','review/release-v1690.md','review/release-v1690-manifest.json']
for file in production+reviews:
    if file!='review/release-v1690-manifest.json':assert (root/file).is_file(),file
def digest(path):
    data=(root/path).read_bytes()
    if Path(path).suffix in ['.js','.css','.html','.json','.md']:data=data.replace(b'\r\n',b'\n')
    return hashlib.sha256(data).hexdigest()
manifest={'version':'V1690 G','baseCommit':'87400a40c1876df2655d8b97eb980426322d77fe','hashFormat':'SHA256; LF-normalized text, unchanged binary bytes','production':{p:digest(p) for p in production},'realBrowserVerified':False,'phonePerformanceVerified':False,'deploymentStatusAtPreparation':'pending; record remote SHA and Pages success separately after push'}
(root/'review/release-v1690-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(root/'review/release-v1690-files.txt').write_text('\n'.join(production+reviews)+'\n',encoding='utf-8')
assert 'V 1690 G' in (root/'mole/index.html').read_text(encoding='utf-8')
print('V1690 release scope:',len(production),'production/source assets;',len(reviews),'review/source files')
