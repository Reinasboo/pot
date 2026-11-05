from pathlib import Path
import math, wave
import numpy as np

# An original, restrained score: soft A-minor / F-major / C-major / G-major arpeggios.
# No samples or third-party music are used.
rate=48000
duration=90
audio=np.zeros(rate*duration,dtype=np.float32)
def note(start,duration,frequency,gain=.04):
    pos=int(start*rate)
    n=min(int(duration*rate),len(audio)-pos)
    if n<=0:return
    t=np.arange(n,dtype=np.float32)/rate
    envelope=(1-np.exp(-t*30))*np.exp(-t*1.7)
    signal=(np.sin(2*np.pi*frequency*t)+.18*np.sin(2*np.pi*frequency*2*t)) * envelope * gain
    audio[pos:pos+n]+=signal
chords=[[220,261.626,329.628,440],[174.614,220,261.626,349.228],[130.813,196,261.626,329.628],[195.998,246.942,293.665,391.995]]
beat=60/84
for step in range(int(duration/beat)):
    t=step*beat
    chord=chords[(step//8)%4]
    note(t,3,chord[step%4],.038 if step%2==0 else .026)
    if step%4==0: note(t,3,chord[0]/2,.024)
for start in [1.2,12.64,19,28.47,35,42.4,47.22,57.54,74.15,80]:
    note(start,.18,880,.018)
fade=np.ones(len(audio),dtype=np.float32)
fade[:rate*2]=np.linspace(0,1,rate*2)
fade[-rate*4:]=np.linspace(1,0,rate*4)
audio*=fade
stereo=np.column_stack([audio,np.roll(audio,180)*.97])
with wave.open(str(Path(__file__).resolve().parents[1]/'public/score.wav'),'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())
print('Created 90-second original score')
