from pathlib import Path
import sys,json,hashlib,time
sys.path.insert(0,str(Path('.tools/lyrics').resolve()))
sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel
model=WhisperModel(str(Path('.tools/models/faster-whisper-small').resolve()),device='cpu',compute_type='int8',cpu_threads=4,num_workers=1)
songs=[('le-monde-attendra-demain','Le monde attendra demain','fr'),('meet-me-halfway','Meet Me Halfway','en'),('paper-engine-ride','Paper-Engine Ride','en'),('the-world-is-wide','The World Is Wide','en')]
if len(sys.argv)>1:songs=[tuple(x.split('|')) for x in sys.argv[1:]]  # V1354 C: 'id|Title|lang' 로 지정한 곡만(기존 곡 결과 보존)
for sid,title,lang in songs:
 out=Path('review')/(sid+'-transcript.json')
 if out.exists():print('CACHED',sid,flush=True);continue
 source=Path('mole/audio/rp')/(sid+'.mp3');raw=next(Path('.').glob('*/'+title+'.txt')).read_text(encoding='utf-8-sig')
 prompt=' '.join(line.strip() for line in raw.splitlines() if line.strip() and not line.startswith('['))[:600]
 print('START',sid,flush=True);started=time.time();segments,info=model.transcribe(str(source),language=lang,beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False,initial_prompt=prompt)
 data=[]
 for seg in segments:
  entry={'start':seg.start,'end':seg.end,'text':seg.text,'avg_logprob':seg.avg_logprob,'no_speech_prob':seg.no_speech_prob,'words':[{'start':w.start,'end':w.end,'word':w.word,'probability':w.probability} for w in seg.words or []]};data.append(entry);print(sid,round(seg.start,2),round(seg.end,2),seg.text,flush=True)
 out.write_text(json.dumps({'id':sid,'language':lang,'audio_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'model':'faster-whisper-small int8 CPU','prompt':'first 600 supplied lyric characters','segments':data,'note':'Machine transcription and word timing candidates; not manual listening verification.'},ensure_ascii=False,indent=2),encoding='utf-8');print('DONE',sid,round(time.time()-started,1),flush=True)
