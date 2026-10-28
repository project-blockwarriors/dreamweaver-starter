import { readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export function summarize(suite) {
  const done = suite.cases.filter((c) => c.status === 'completed');
  return {
    submissionId: suite.submissionId,
    completed: done.length,
    total: suite.cases.length,
    wins: done.filter((c) => c.score > c.opponentScore).length,
    draws: done.filter((c) => c.score === c.opponentScore).length,
    meanMargin: done.length ? done.reduce((s, c) => s + c.score - c.opponentScore, 0) / done.length : null,
    cases: suite.cases,
  };
}
/** One transition per invocation, one hosted game at a time. Re-run to resume; no hidden polling. */
export async function evaluate(submissionId, file, request) {
  if (!submissionId || !file) throw Error('Usage: evaluate SUBMISSION_ID RESULTS.json');
  const lock = await open(file + '.lock', 'wx', 0o600).catch(() => {
    throw Error('Evaluation is already running (lock file exists)');
  });
  const save = async (state) => {
    await writeFile(file + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    await rename(file + '.tmp', file);
  };
  try {
    let state;
    try {
      state = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    const me = await request('/api/me');
    if (!me.team?.id) throw Error('Join a team before evaluating');
    if (!state) {
      const config = JSON.parse(await readFile('evaluation.json', 'utf8'));
      const cases = config.opponents.flatMap((opponent) =>
        config.seeds.flatMap((seed) =>
          [0, 1].map((seat) => ({ opponent, seed, seat, idempotency: randomUUID(), status: 'new' })),
        ),
      );
      if (
        !cases.length ||
        cases.length > 20 ||
        !cases.every(
          (c) =>
            ['courier', 'hoarder', 'guardian', 'raider', 'opportunist'].includes(c.opponent) &&
            Number.isSafeInteger(c.seed) &&
            c.seed >= 0 &&
            c.seed <= 2147483647,
        )
      )
        throw Error('Invalid evaluation matrix (maximum 20 games)');
      state = { version: 1, submissionId, teamId: me.team.id, cases };
      await save(state);
    }
    if (state.version !== 1 || state.submissionId !== submissionId || state.teamId !== me.team.id)
      throw Error('Results belong to a different submission/team; use a new results file');
    const c = state.cases.find((c) => c.status !== 'completed');
    if (!c) return { message: 'Evaluation complete', ...summarize(state) };
    if (c.status === 'failed' || c.status === 'cancelled')
      throw Error(
        'Evaluation contains a failed/cancelled game. Inspect its run ID; do not count it as a loss. Use a new results file to restart.',
      );
    if (!c.runId) {
      // Persisted idempotency protects a retry if the POST succeeds but the response/file write is lost.
      const run = await request('/api/practice', {
        mode: 'submission',
        submissionId,
        housePolicy: c.opponent,
        seed: c.seed,
        seat: c.seat,
        idempotency: c.idempotency,
      });
      c.runId = run.id;
      c.status = run.status;
      await save(state);
      return {
        message: 'Game queued. Run this command again to collect the result.',
        runId: c.runId,
        ...summarize(state),
      };
    }
    const run = await request('/api/jobs/' + encodeURIComponent(c.runId));
    if (
      run.kind !== 'practice' ||
      run.submission_id !== submissionId ||
      run.seat !== c.seat ||
      run.seed !== c.seed ||
      run.house_policy !== c.opponent
    )
      throw Error('Run does not match evaluation case');
    c.status = run.status;
    if (run.status === 'completed') {
      const scores = run.result?.scores;
      if (!Array.isArray(scores) || scores.length !== 2 || !scores.every(Number.isFinite))
        throw Error('Completed run has no valid scores');
      c.score = scores[c.seat];
      c.opponentScore = scores[1 - c.seat];
      c.durationTicks = run.result.ticks;
      if (!Number.isInteger(c.durationTicks) || c.durationTicks <= 0)
        throw Error('Completed run has no valid duration');
      c.protocol = run.protocol;
      c.ruleset = run.ruleset;
    }
    if (run.error) c.error = String(run.error).slice(0, 300);
    await save(state);
    return {
      message:
        run.status === 'completed' ? 'Result saved. Run again for the next case.' : 'Game ' + run.status,
      runId: c.runId,
      ...summarize(state),
    };
  } finally {
    await lock.close();
    await unlink(file + '.lock');
  }
}
export function compare(a, b) {
  const key = (c) => `${c.opponent}/${c.seed}/${c.seat}/${c.protocol}/${c.ruleset}/${c.durationTicks}`;
  if (a.cases.some((c) => c.status !== 'completed') || b.cases.some((c) => c.status !== 'completed'))
    throw Error('Both evaluations must be complete');
  const left = new Map(a.cases.map((c) => [key(c), c]));
  if (
    left.size !== a.cases.length ||
    a.cases.length !== b.cases.length ||
    new Set(b.cases.map(key)).size !== b.cases.length ||
    b.cases.some((c) => !left.has(key(c)))
  )
    throw Error('Compare the same opponents, seeds, seats, rules and duration');
  const deltas = b.cases.map((c) => {
    const old = left.get(key(c));
    return { case: key(c), marginChange: c.score - c.opponentScore - (old.score - old.opponentScore) };
  });
  return {
    before: a.submissionId,
    after: b.submissionId,
    meanMarginChange: deltas.reduce((n, c) => n + c.marginChange, 0) / deltas.length,
    cases: deltas,
  };
}
