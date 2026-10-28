import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('dreamweaver.json', 'utf8'));
assert.equal(manifest.protocol, 'dreamweaver.v4');
assert(['node24', 'python312'].includes(manifest.runtime), 'Unsupported runtime');
assert(
  /^[a-zA-Z0-9_./-]{1,120}$/.test(manifest.entrypoint) &&
    !manifest.entrypoint.startsWith('/') &&
    !manifest.entrypoint.split('/').includes('..'),
  'Entrypoint must stay in the repository',
);
assert(existsSync(manifest.entrypoint), 'Entrypoint missing');
assert(
  existsSync(manifest.runtime === 'node24' ? 'package-lock.json' : 'requirements.txt'),
  'Commit the dependency lock file',
);
const fixture = JSON.parse(readFileSync('fixtures/observation.json', 'utf8'));
const messages = [fixture, structuredClone(fixture), structuredClone(fixture)];
messages[1].observation.tick = 24;
messages[1].observation.self.cargo = 2;
messages[2].observation.tick = 28;
messages[2].observation.hazard = { x: 2, warnUntil: 36, activeUntil: 64 };
const opening = structuredClone(fixture);
opening.observation.tick = 0;
opening.observation.status = 'idle';
const output = spawnSync(
  manifest.runtime === 'node24' ? process.execPath : 'python3',
  [manifest.entrypoint],
  {
    input:
      [{ type: 'prepare', version: 1, nonce: 'local-protocol-check' }, opening, ...messages]
        .map((m) => JSON.stringify(m))
        .join('\n') + '\n',
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  },
);
assert.ifError(output.error);
assert.equal(output.status, 0, output.stderr);
const replies = output.stdout
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
assert.deepEqual(
  replies[0],
  { type: 'ready', version: 1, nonce: 'local-protocol-check' },
  'Acknowledge prepare after initializing your agent, before emitting actions or model requests',
);
const actions = output.stdout
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
  .filter((m) => m.type === 'action')
  .map((m) => m.action);
assert(actions.length >= 4, 'Return an action for each observation');
let seq = -1;
for (const action of actions) {
  assert(Number.isInteger(action.seq) && action.seq > seq, 'Sequence must increase');
  seq = action.seq;
  assert([0, 20, 24, 28].includes(action.observedTick), 'Use the observation tick');
  for (const axis of ['dx', 'dz'])
    assert(Number.isInteger(action[axis]) && Math.abs(action[axis]) <= 1, `Invalid ${axis}`);
  assert(Number.isInteger(action.slot) && action.slot >= 1 && action.slot <= 5, 'Invalid hotbar slot');
  assert.equal(typeof action.activate, 'boolean');
}
console.log(
  `Protocol check passed: ${actions.length} actions. This checks I/O, not match strength or sandbox compatibility.`,
);
