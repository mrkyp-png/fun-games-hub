import json,hashlib
from pathlib import Path
ids=['le-monde-attendra-demain','meet-me-halfway','paper-engine-ride','the-world-is-wide']
root=Path('mole/audio/rp')
for sid in ids:
 b=json.loads((root/(sid+'.json')).read_text(encoding='utf-8-sig'));a=json.loads((root/(sid+'-a.json')).read_text(encoding='utf-8-sig'))
 for typ,s,key,gaps in [('B',b,'patterns',[2.242,1.898,1.665]),('A',a,'aPatterns',[.56]*3)]:
  for di,d in enumerate(['EASY','NORMAL','HARD']):
   es=s[key][d];last=[-999]* (9 if typ=='B' else 4);minimum=999
   assert len(es)>50 and all(es[i]['time']<es[i+1]['time'] for i in range(len(es)-1))
   assert es[0]['time']>=1.8 and es[-1]['time']<s['length']
   for e in es:
    assert 1<=len(e['lanes'])<=2 and len(set(e['lanes']))==len(e['lanes'])
    if e['sound']!='hat':assert e['time'] in s['beats']
    for lane in e['lanes']:
     assert 0<=lane<len(last);delta=e['time']-last[lane];assert delta>=gaps[di]-1e-6;minimum=min(minimum,delta);last[lane]=e['time']
   assert s['charts'][d]==[e['time'] for e in es for _ in e['lanes']]
   rests=[y['time']-x['time'] for x,y in zip(es,es[1:])];assert max(rests)<1.5
   print(sid,typ,d,'notes',len(s['charts'][d]),'chords',sum(len(e['lanes'])==2 for e in es),'min-gap',round(minimum,4),'max-rest',round(max(rests),4))
for filename,sid in [('Paper-Engine Ride.mp3','paper-engine-ride'),('The World Is Wide.mp3','the-world-is-wide')]:
 source=next(Path('.').glob('*/'+filename));assert source.read_bytes()==(root/(sid+'.mp3')).read_bytes();print('Exact source copy',sid,hashlib.sha256(source.read_bytes()).hexdigest())
assert json.loads((root/'paper-engine-ride.json').read_text())['patterns']!=json.loads((root/'the-world-is-wide.json').read_text())['patterns']
print('PASS all 24 difficulty arrangements, source hashes, timing, spacing, chords, short rests, distinct charts')
