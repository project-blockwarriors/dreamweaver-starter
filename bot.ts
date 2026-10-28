import { createInterface } from 'node:readline';
import { Harness } from './agent/harness.ts';
const agent = new Harness();
// Never await inference here. Actions continue while broker responses arrive on this same stream.
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const message = JSON.parse(line);
    if (message.type === 'prepare' && message.version === 1) {
      console.log(JSON.stringify({ type: 'ready', version: 1, nonce: message.nonce }));
      continue;
    }
    if (message.type === 'model-response') agent.respond(message);
    if (message.type !== 'observation') continue;
    const { action, requests, trace } = agent.step(message.observation);
    console.log(JSON.stringify({ type: 'action', action }));
    for (const request of requests) console.log(JSON.stringify(request));
    if (trace) console.error(JSON.stringify(trace));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Bot failed');
  process.exitCode = 1;
}
