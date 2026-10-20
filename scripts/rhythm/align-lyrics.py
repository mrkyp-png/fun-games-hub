from pathlib import Path
import json,re,unicodedata,difflib,hashlib,sys
IDS=[('le-monde-attendra-demain','Le monde attendra demain'),('meet-me-halfway','Meet Me Halfway'),('paper-engine-ride','Paper-Engine Ride'),('the-world-is-wide','The World Is Wide')]
if len(sys.argv)>1:IDS=[tuple(x.split('|')) for x in sys.argv[1:]]  # V1354 C: 'id|Title' 로 지정한 곡만(기존 곡 가사 JSON 덮어쓰기 방지)
def tokens(text):return re.findall(r"[^\W_]+(?:['\u2019][^\W_]+)*",text,flags=re.UNICODE)
def norm(text):return ''.join(c for c in unicodedata.normalize('NFD',text.lower()) if c.isalnum() and not unicodedata.combining(c))
def similarity(a,b):return 1. if a==b else difflib.SequenceMatcher(None,a,b).ratio()
for sid,title in IDS:
 transcript=Path('review')/(sid+'-transcript.json')
 if not transcript.exists():continue
 src=next(Path('.').glob('*/'+title+'.txt'));raw=src.read_text(encoding='utf-8-sig');lines=[];section='';expected=[]
 for line in raw.splitlines():
  line=line.strip()
  if not line:continue
  if line.startswith('['):section=line.strip('[]');continue
  row={'text':line,'section':section,'words':tokens(line),'indices':[]};idx=len(lines)
  for word in row['words']:expected.append((norm(word),idx))
  lines.append(row)
 data=json.loads(transcript.read_text(encoding='utf-8'));heard=[]
 for seg in data['segments']:
  for w in seg['words']:
   for word in tokens(w['word']):heard.append({**w,'norm':norm(word)})
 n,m=len(expected),len(heard);dp=[[0.]*(m+1) for _ in range(n+1)];back=[bytearray(m+1) for _ in range(n+1)]
 for i in range(1,n+1):dp[i][0]=-i*.95;back[i][0]=1
 for j in range(1,m+1):dp[0][j]=-j*.8;back[0][j]=2
 for i in range(1,n+1):
  for j in range(1,m+1):
   sim=similarity(expected[i-1][0],heard[j-1]['norm']);match=dp[i-1][j-1]+(1.7*sim+(m-j)*1e-6 if sim>=.6 else -1.5)
   options=[match,dp[i-1][j]-.95,dp[i][j-1]-.8];choice=max(range(3),key=lambda k:options[k]);dp[i][j]=options[choice];back[i][j]=choice
 used=set();i,j=max(range(n+1),key=lambda k:dp[k][m]),m
 while i or j:
  op=back[i][j]
  if op==0:
   if similarity(expected[i-1][0],heard[j-1]['norm'])>=.6:lines[expected[i-1][1]]['indices'].append(j-1);used.add(j-1)
   i-=1;j-=1
  elif op==1:i-=1
  else:j-=1
 cues=[];review=[]
 for row in lines:
  ix=sorted(row['indices']);coverage=len(ix)/max(1,len(row['words']))
  if ix and coverage>=.45:
   start=heard[ix[0]]['start'];end=heard[ix[-1]]['end']
   if end<=start:end=start+.3
   cues.append({'start':round(start,3),'end':round(end+.2,3),'text':row['text'],'section':row['section'],'alignment':'matched','coverage':round(coverage,3)})
  if coverage<.8:review.append({'kind':'low-coverage-source-line','text':row['text'],'coverage':round(coverage,3),'matchedTimes':[[heard[k]['start'],heard[k]['end']] for k in ix]})
 # Recover extra repeats only from supplied wording; unrelated ASR hallucinations never enter the game.
 cursor=0
 while cursor<m:
  if cursor in used:cursor+=1;continue
  best=None
  for row in lines:
   ws=[norm(w) for w in row['words']]
   for length in range(min(len(ws),m-cursor),1,-1):
    ix=list(range(cursor,cursor+length))
    if any(k in used for k in ix):continue
    score=sum(similarity(ws[k],heard[cursor+k]['norm']) for k in range(length))/length
    if length==2 and (len(ws)<4 or score<.999 or sum(heard[k]['probability'] for k in ix)/2<.65):continue
    if score>=.88 and all(heard[k]['end']-heard[k]['start']<2. for k in ix):
     quality=score*length
     if best is None or quality>best[0]:best=(quality,row,length,ix,score)
  if best:
   _,row,length,ix,score=best;start=heard[ix[0]]['start'];end=heard[ix[-1]]['end'];text=' '.join(row['words'][:length])
   if end>start and end-start<15:
    cues.append({'start':round(start,3),'end':round(end+.2,3),'text':text,'section':'Extra repeat','alignment':'extra-repeat-matched','coverage':round(score,3)});used.update(ix);review.append({'kind':'extra-repeat-matched','start':start,'end':end,'text':text});cursor+=length;continue
  cursor+=1
 # Report unmatched audible candidates separately, never replace user lyrics with recognizer guesses.
 unused=[]
 for k,w in enumerate(heard):
  if k not in used:
   if unused and w['start']-unused[-1][-1]['end']<.5:unused[-1].append(w)
   else:unused.append([w])
 for group in unused:
  if len(group)>=2:review.append({'kind':'unmatched-audio-candidate','start':group[0]['start'],'end':group[-1]['end'],'text':''.join(w['word'] for w in group),'probability':round(sum(w['probability'] for w in group)/len(group),3)})
 cues.sort(key=lambda c:c['start']);duration=json.loads(Path('mole/audio/rp',sid+'.json').read_text(encoding='utf-8'))['length'];filtered=[]
 for k,c in enumerate(cues):
  c['end']=round(min(c['end'],cues[k+1]['start'] if k+1<len(cues) else duration,duration),3)
  if c['end']-c['start']>=.12:filtered.append(c)
 result={'id':sid,'title':title,'language':data['language'],'sourceLyricsSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'audioSha256':data['audio_sha256'],'timingMethod':'Local Whisper word timestamps aligned to supplied lines; extra repeats only reuse matching supplied wording. Automatic first pass, not manual listening verification.','cues':filtered}
 Path('review',sid+'-lyrics-base.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 Path('mole/audio/rp',sid+'-lyrics.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');Path('review',sid+'-lyrics-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf-8');print(sid,'source lines',len(lines),'cues',len(filtered),'review',len(review))
