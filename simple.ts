/** A small, replaceable controller. Set dreamweaver.json entrypoint to simple.ts to use it. */
import { createInterface } from 'node:readline';
import { execute, threatened } from './tactical.ts';
import type { Observation } from './types.ts';
let seq=0;
// Your decision function can keep memory, search routes, use models, or emit completely custom actions.
function decide(o:Observation) {
  const returning=o.self.cargo>=2 || (o.self.cargo>0 && o.duration-o.tick<300);
  return execute(o,threatened(o)?'escape':returning?'bank':'collect');
}
for await(const line of createInterface({input:process.stdin})) {
  const message=JSON.parse(line);
  if(message.type==='prepare' && message.version===1)console.log(JSON.stringify({type:'ready',version:1,nonce:message.nonce}));
  if(message.type==='observation')console.log(JSON.stringify({type:'action',action:{...decide(message.observation),seq:++seq,observedTick:message.observation.tick}}));
}
