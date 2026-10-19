"""Dependency-free Python starter; stdout is reserved for protocol messages."""
import json,sys

def sign(value): return (value>0)-(value<0)
for line in sys.stdin:
    message=json.loads(line)
    if message.get('type')!='observation': continue
    o=message['observation'];bot=o['self']
    def distance(p): return abs(p['x']-bot['x'])+abs(p['z']-bot['z'])
    target=o['beacon'] if bot['cargo'] else min(o['nodes'],key=distance)
    dx=sign(target['x']-bot['x']);dz=0 if dx else sign(target['z']-bot['z'])
    slot=1;activate=distance(target)<=1
    if o['hazard']['x']==bot['x'] and o['hazard']['activeUntil']>o['tick'] and o['hazard']['warnUntil']-o['tick']<12:
        dx=1 if bot['x']<12 else -1;dz=0;slot=2;activate=True
    elif distance(target)>4 and bot['cooldowns'][1]==0:
        slot=2;activate=True
    print(json.dumps({'type':'action','action':{'seq':o['tick'],'observedTick':o['tick'],'dx':dx,'dz':dz,'slot':slot,'activate':activate}}),flush=True)
