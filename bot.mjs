import { createInterface } from 'node:readline';
// stdout is the protocol; send diagnostics to stderr. Never block on a model call.
for await (const line of createInterface({ input: process.stdin })) {
 const message=JSON.parse(line);if(message.type!=='observation')continue;
 const o=message.observation,b=o.self;
 const distance=p=>Math.abs(p.x-b.x)+Math.abs(p.z-b.z);
 const target=b.cargo?o.beacon:[...o.nodes].sort((a,c)=>distance(a)-distance(c))[0];
 let dx=Math.sign(target.x-b.x),dz=dx?0:Math.sign(target.z-b.z),slot=1,activate=distance(target)<=1;
 if(o.hazard.x===b.x&&o.hazard.activeUntil>o.tick&&o.hazard.warnUntil-o.tick<12){dx=b.x<12?1:-1;dz=0;slot=2;activate=true;}
 else if(distance(target)>4&&b.cooldowns[1]===0){slot=2;activate=true;}
 console.log(JSON.stringify({type:'action',action:{seq:o.tick,observedTick:o.tick,dx,dz,slot,activate}}));
}
