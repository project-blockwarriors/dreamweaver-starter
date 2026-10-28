import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluate, compare } from '../tools/evaluation.mjs';
test('evaluation retries a lost POST response with the same idempotency and keeps seat-relative scores', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dreamweaver-eval-'));
  const file = join(dir, 'results.json');
  let first = true;
  const ids = [];
  const request = async (path, body) => {
    if (path === '/api/me') return { team: { id: 'team' } };
    if (path === '/api/practice') {
      ids.push(body.idempotency);
      if (first) {
        first = false;
        throw Error('lost response');
      }
      return { id: 'run', status: 'queued' };
    }
    return {
      id: 'run',
      kind: 'practice',
      submission_id: 'revision',
      seat: 0,
      seed: 42,
      house_policy: 'courier',
      status: 'completed',
      protocol: 'dreamweaver.v4',
      ruleset: 'test',
      result: { scores: [40, 20], ticks: 1800 },
    };
  };
  try {
    await assert.rejects(evaluate('revision', file, request), /lost response/);
    await evaluate('revision', file, request);
    assert.equal(ids[0], ids[1]);
    const result = await evaluate('revision', file, request);
    assert.equal(result.meanMargin, 20);
    assert.equal(result.completed, 1);
    await assert.rejects(evaluate('other', file, request), /different submission/);
    const saved = await readFile(file, 'utf8');
    assert.ok(!saved.includes('TOKEN'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('comparison rejects mismatched conditions or incomplete runs', () => {
  const c = {
    opponent: 'guardian',
    seed: 42,
    seat: 1,
    protocol: 'v4',
    ruleset: 'r',
    status: 'completed',
    score: 60,
    opponentScore: 20,
  };
  const a = { submissionId: 'a', cases: [c] },
    b = { submissionId: 'b', cases: [{ ...c, score: 80 }] };
  assert.equal(compare(a, b).meanMarginChange, 20);
  assert.throws(() => compare(a, { ...b, cases: [{ ...c, seat: 0 }] }), /same opponents/);
  assert.throws(() => compare(a, { ...b, cases: [{ ...c, status: 'failed' }] }), /complete/);
});
