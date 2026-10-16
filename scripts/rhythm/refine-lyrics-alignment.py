from pathlib import Path
import sys,json
sys.path.insert(0,str(Path('.tools/lyrics').resolve()));sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio,pad_or_trim
from faster_whisper.tokenizer import Tokenizer
model=WhisperModel(str(Path('.tools/models/faster-whisper-small').resolve()),device='cpu',compute_type='int8',cpu_threads=4)
for sid,title,lang in [('the-world-is-wide','The World Is Wide','en'),('meet-me-halfway','Meet Me Halfway','en')]:
 baseline=json.loads(Path('review',sid+'-lyrics-base.json').read_text(encoding='utf-8'))['cues']
 source=next(Path('.').glob('*/'+title+'.txt'));groups=[];section=None
 for line in source.read_text(encoding='utf-8-sig').splitlines():
  line=line.strip()
  if not line:continue
  if line.startswith('['):groups.append([]);continue
  groups[-1].append(line)
 if sid=='the-world-is-wide':regions=[(13.5,27.35,groups[0]),(27.35,34.5,groups[1]),(34.5,51.2,groups[2]),(58.9,72.6,groups[3]),(72.3,79.5,groups[4]),(79.8,97.8,groups[5]),(108.,119.4,groups[7][:4])]
 else:regions=[(34.5,50.3,[groups[2][0].replace('Come on, come on,','Come on, come on, come on,')]+groups[2][1:]),(76.3,91.,groups[5])]
 audio=decode_audio('mole/audio/rp/'+sid+'.mp3');tok=Tokenizer(model.hf_tokenizer,model.model.is_multilingual,task='transcribe',language=lang);replacements=[];evidence=[]
 for lo,hi,lines in regions:
  crop=audio[int(lo*16000):int(hi*16000)];features=model.feature_extractor(crop);encoded=model.encode(pad_or_trim(features));alltokens=[];boundaries=[]
  for line in lines:boundaries.append(len(alltokens));alltokens+=tok.encode(' '+line)
  aligned=model.find_alignment(tok,[alltokens],encoded,min(features.shape[-1],round(len(crop)/160)))[0];rows=[[] for _ in lines];index=0;count=0
  for w in aligned:
   while index+1<len(lines) and count>=boundaries[index+1]:index+=1
   rows[index].append(w);count+=len(w['tokens'])
  for line,words in zip(lines,rows):
   if not words:continue
   start=round(lo+words[0]['start'],3)
   anchors=[c for c in baseline if c['text']==line and lo<=c['start']<hi and c['coverage']>=.5]
   if anchors:start=min(anchors,key=lambda c:abs(c['start']-start))['start']
   elif words[0]['end']-words[0]['start']>1:start=round(lo+max(words[0]['start'],words[0]['end']-.6),3)
   end=round(min(hi,lo+words[-1]['end']+.2),3)
   if end-start<.15:continue
   if sid=='meet-me-halfway' and line.startswith('Come on, come on, come on,'):start=34.62
   cue={'start':start,'end':end,'text':line,'section':'Aligned vocal phrase','alignment':'forced-supplied-text','coverage':1.};replacements.append(cue);evidence.append({'cue':cue,'words':[{k:float(v) if k in ('start','end','probability') else v for k,v in w.items() if k!='tokens'} for w in words]});print(sid,start,end,line,flush=True)
 p=Path('mole/audio/rp',sid+'-lyrics.json');data=json.loads(p.read_text(encoding='utf-8'));cues=[c for c in data['cues'] if not any(lo<=c['start']<hi for lo,hi,_ in regions)]+replacements
 if sid=='the-world-is-wide':
  cues.append({'start':117.96,'end':118.78,'text':'Hey, hey','section':'Final chorus (partial)','alignment':'extra-repeat-matched','coverage':1.})
 cues.sort(key=lambda c:c['start'])
 for i,c in enumerate(cues):
  if i+1<len(cues):c['end']=min(c['end'],cues[i+1]['start'])
 data['cues']=[c for c in cues if c['end']-c['start']>=.12];data['timingMethod']=data['timingMethod'].split(' Low-coverage')[0]+' Low-coverage vocal sections refined by direct forced alignment of supplied text to audio crops; still requires user playback verification.';p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');Path('review',sid+'-lyrics-forced-alignment.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
