import bpy,sys,runpy,shutil,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'mole/assets/characters-v1689';DEST.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT.parent/'두더지_헤어작업_20261112/Rigged_4_styles_v18'
for style in ['Mohawk','Spiky','Curly','Forelock']:shutil.copy2(SOURCE/'exports'/('Hair_'+style+'_only.glb'),DEST/('hair-'+style.lower()+'.glb'))
sys.argv=['build-mole-smile.py','--',str(ROOT/'mole/assets/checkerboard-v1590/mole-clay-v43.glb'),str(DEST/'mole-game-smile.glb')]
runpy.run_path(str(ROOT/'review/live-appearances/build-mole-smile-source-snapshot.py'),run_name='__main__')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'review/mole-game-smile-v1689.blend'))
print('LIVE_ASSETS_READY: original game motions and bomb carrier retained, Smile added to both bodies')
