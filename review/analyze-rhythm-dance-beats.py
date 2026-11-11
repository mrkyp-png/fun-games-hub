"""Rebuild entry-music beat metadata; needs ffmpeg and numpy, not a browser."""
import subprocess,wave,json,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
audio=ROOT/'mole/audio/rhythm-entry.mp3';wav=ROOT/'review/rhythm-entry-analysis.wav'
subprocess.run(['ffmpeg','-v','error','-i',str(audio),'-ac','1','-ar','11025','-y',str(wav)],check=True)
with wave.open(str(wav)) as stream:
    rate=stream.getframerate();samples=np.frombuffer(stream.readframes(stream.getnframes()),np.int16).astype(float)/32768
frames=np.lib.stride_tricks.sliding_window_view(samples,1024)[::110]
spectrum=np.abs(np.fft.rfft(frames*np.hanning(1024),axis=1))
flux=np.maximum(np.diff(np.log1p(spectrum*10),axis=0),0).mean(axis=1)
flux=np.maximum(flux-np.median(flux),0)
times=np.arange(len(flux))*110/rate+512/rate+110/rate
scores=[]
for bpm in np.arange(163,168,.02):
    component=np.sum(flux*np.exp(-2j*np.pi*times*bpm/60))
    offset=float((-np.angle(component)/(2*np.pi)*60/bpm)%(60/bpm))
    scores.append((abs(component),float(bpm),offset))
_,bpm,offset=max(scores);period=60/bpm;beats=[]
for expected in np.arange(offset,len(samples)/rate,period):
    candidates=np.flatnonzero(np.abs(times-expected)<.045)
    if len(candidates):
        merit=flux[candidates]*np.exp(-.5*((times[candidates]-expected)/.03)**2)
        beat=float(times[candidates[np.argmax(merit)]])
    else:beat=float(expected)
    beats.append(round(beat,4))
data={'bpm':round(bpm,2),'duration':round(len(samples)/rate,4),'beats':beats,'source':'audio/rhythm-entry.mp3',
      'sha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'method':'Full-track spectral flux, tempo coherence and local onset alignment'}
work=ROOT/'review/rhythm-dance';work.mkdir(exist_ok=True)
(work/'beat-analysis.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
script='/* Offline analysis of the existing entry music; no audio playback changes. */\n(function(root){const data='+json.dumps(data,separators=(',',':'))+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else{root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmDanceBeats=data;}})(typeof window!=="undefined"?window:globalThis);\n'
(ROOT/'mole/js/rhythm-dance-beats.js').write_text(script,encoding='utf-8')
print('BEATS_READY',data['bpm'],len(beats))
