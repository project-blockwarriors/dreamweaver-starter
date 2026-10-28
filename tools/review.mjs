import { readFile } from 'node:fs/promises';
const [file, seatText = '0'] = process.argv.slice(2);
if (!file || !['0', '1'].includes(seatText)) throw Error('Usage: npm run review -- REPLAY.ndjson [SEAT:0|1]');
const seat = Number(seatText),
  frames = (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((f) => f.type === 'state' && f.bots);
if (!frames.length) throw Error('No game states in replay');
const events = new Map();
for (const f of frames)
  for (const e of f.events ?? []) events.set(e.id ?? `${e.tick}:${e.kind}:${e.seat}:${e.target}`, e);
const own = [...events.values()].filter((e) => e.seat === seat);
const counts = {};
for (const e of own) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
const end = frames.at(-1);
console.log(
  JSON.stringify(
    {
      matchId: end.matchId,
      ruleset: end.ruleset,
      seat,
      status: end.status,
      score: end.bots[seat].score,
      opponentScore: end.bots[1 - seat].score,
      unbankedCargo: end.bots[seat].cargo,
      events: counts,
      reviewMoments: own
        .filter((e) =>
          ['deposit-interrupted', 'cargo-spilled', 'respawn', 'rejected-action'].includes(e.kind),
        )
        .slice(0, 20)
        .map((e) => ({ seconds: e.tick / 20, kind: e.kind, cause: e.cause })),
      nextStep:
        'Open this replay in Dream Relay. Inspect the first failed delivery; change one hypothesis, then repeat both seats with the same seed.',
    },
    null,
    2,
  ),
);
