#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
const [command, ...args] = process.argv.slice(2);
const url = process.env.DREAMWEAVER_URL ?? 'https://mcpanel.blockwarriors.ai/dreamweaver';
const endpoint = new URL(url);
if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname))
  throw Error('Use HTTPS');
async function request(path: string, body?: unknown, raw = false, publicRead = false) {
  const token = process.env.DREAMWEAVER_TOKEN;
  if (!token && !publicRead)
    throw Error('Create an agent token in the workspace; set DREAMWEAVER_TOKEN privately');
  const r = await fetch(url + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const data = (await r.json()) as any;
    throw Error(data.error ?? 'Request failed');
  }
  return raw ? r.text() : (r.json() as any);
}
const show = (v: unknown) => console.log(JSON.stringify(v, null, 2));
try {
  switch (command) {
    case 'doctor': {
      if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Use Node 24');
      const config = await request('/api/config', undefined, false, true);
      let manifest;
      try {
        manifest = JSON.parse(await readFile(args[0] ?? 'dreamweaver.json', 'utf8'));
      } catch (e) {
        throw Error('Bot manifest: ' + (e as Error).message);
      }
      if (manifest.protocol !== config.game.protocol)
        throw Error(`Bot protocol ${manifest.protocol} differs from active ${config.game.protocol}`);
      await readFile(manifest.entrypoint);
      const me = await request('/api/me');
      show({
        ok: true,
        node: process.version,
        game: config.game,
        team: me.team?.name ?? null,
        repository: me.repo?.full_name ?? null,
        participantExecution: config.participantExecutionEnabled,
        entrypoint: manifest.entrypoint,
      });
      break;
    }
    case 'status':
      show(await request('/api/jobs'));
      break;
    case 'inspect':
      if (!args[0]) throw Error('Usage: inspect RUN_ID');
      show(await request('/api/jobs/' + encodeURIComponent(args[0])));
      break;
    case 'cancel':
      if (!args[0]) throw Error('Usage: cancel RUN_ID');
      show(await request('/api/jobs/' + encodeURIComponent(args[0]) + '/cancel', {}));
      break;
    case 'submit':
      if (!args[0]) throw Error('Usage: submit TAG_OR_COMMIT');
      show(await request('/api/submissions', { ref: args[0] }));
      break;
    case 'link':
      if (!args[0]) throw Error('Usage: link OWNER/REPO');
      show(await request('/api/repository', { repository: args[0] }));
      break;
    case 'select':
      if (!args[0]) throw Error('Usage: select SUBMISSION_ID [qualifier|finals]');
      show(await request('/api/selections', { submissionId: args[0], phase: args[1] ?? 'qualifier' }));
      break;
    case 'practice':
      if (!args[0])
        throw Error(
          'Usage: practice SUBMISSION_ID [courier|hoarder|guardian|raider|opportunist] [SEED] [SEAT:0|1]',
        );
      show(
        await request('/api/practice', {
          mode: 'submission',
          submissionId: args[0],
          housePolicy: args[1] ?? 'courier',
          ...(args[2] ? { seed: Number(args[2]) } : {}),
          seat: Number(args[3] ?? 0),
          idempotency: crypto.randomUUID(),
        }),
      );
      break;
    case 'repeat': {
      if (!args[0]) throw Error('Usage: repeat RUN_ID [NEW_SUBMISSION_ID]');
      const old = await request('/api/jobs/' + encodeURIComponent(args[0]));
      if (old.kind !== 'practice') throw Error('Only practice runs can be repeated');
      show(
        await request('/api/practice', {
          mode: 'submission',
          submissionId: args[1] ?? old.submission_id,
          housePolicy: old.house_policy,
          seed: old.seed,
          seat: old.seat,
          idempotency: crypto.randomUUID(),
        }),
      );
      break;
    }
    case 'download': {
      if (!args[0] || !args[1]) throw Error('Usage: download RUN_ID OUTPUT.ndjson');
      const replay = await request('/api/replays/' + encodeURIComponent(args[0]), undefined, true);

      await writeFile(args[1], replay, { flag: 'wx', mode: 0o600 });
      show({ saved: args[1] });
      break;
    }
    default:
      console.log(
        'Dreamweaver: doctor [MANIFEST] | link OWNER/REPO | submit TAG | select ID [qualifier|finals] | practice ID [OPPONENT] [SEED] [SEAT] | status | inspect RUN_ID | cancel RUN_ID | repeat RUN_ID [REVISION] | download RUN_ID FILE',
      );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Command failed');
  process.exitCode = 1;
}
