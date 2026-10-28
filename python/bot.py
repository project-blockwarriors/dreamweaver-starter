import json,sys
for line in sys.stdin:
    message=json.loads(line)
    if message.get('type')=='prepare' and message.get('version')==1:
        print(json.dumps({'type':'ready','version':1,'nonce':message['nonce']}),flush=True)
        continue
    if message.get('type')!='observation':continue
    o=message['observation'];b=o['self'];tick=o['tick']
    distance=lambda p:abs(p['x']-b['x'])+abs(p['z']-b['z'])
    target=o['beacon'] if b['cargo'] else min(o['nodes'],key=distance)
    sign=lambda x:(x>0)-(x<0)
    dx=sign(target['x']-b['x']);dz=0 if dx else sign(target['z']-b['z']);activate=distance(target)<=1;slot=1
    if b.get('depositUntil',0)>tick or b.get('pulseUntil',0)>tick:dx=dz=0;activate=False
    elif b['cargo'] and distance(o['beacon'])<=1:dx=dz=0;activate=True
    elif distance(target)>4 and b['cooldowns'][1]==0:slot=2;activate=True
    print(json.dumps({'type':'action','action':{'seq':tick,'observedTick':tick,'dx':dx,'dz':dz,'slot':slot,'activate':activate}}),flush=True)
