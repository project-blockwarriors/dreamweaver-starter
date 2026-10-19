#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const [command, ...args] = process.argv.slice(2);
const url = process.env.DREAMWEAVER_URL ?? 'https://mcpanel.blockwarriors.ai/dreamweaver';
const endpoint = new URL(url);
if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname))
  throw Error('Use HTTPS');
async function request(path: string, body?: unknown) {
  const token = process.env.DREAMWEAVER_TOKEN;
  if (!token) throw Error('Create an agent token in the Dreamweaver workspace; set DREAMWEAVER_TOKEN');
  const r = await fetch(url + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw Error(data.error ?? 'Request failed');
  console.log(JSON.stringify(data, null, 2));
}
try {
  switch (command) {
    case 'doctor':
      console.log(
        JSON.stringify({
          node: process.version,
          protocol: 'dreamweaver.v1',
          endpoint: url,
          tokenConfigured: !!process.env.DREAMWEAVER_TOKEN,
        }),
      );
      break;
    case 'status':
      await request('/jobs');
      break;
    case 'submit':
      if (!args[0]) throw Error('Usage: submit TAG_OR_COMMIT');
      await request('/submissions', { ref: args[0] });
      break;
    case 'link':
      if (!args[0]) throw Error('Usage: link OWNER/REPO');
      await request('/repository', { repository: args[0] });
      break;
    case 'select':
      if (!args[0]) throw Error('Usage: select SUBMISSION_ID [qualifier|finals]');
      await request('/selections', { submissionId: args[0], phase: args[1] ?? 'qualifier' });
      break;
    case 'practice':
      if (!args[0]) throw Error('Usage: practice SUBMISSION_ID');
      await request('/practice', {
        mode: 'submission',
        submissionId: args[0],
        idempotency: crypto.randomUUID(),
      });
      break;
    case 'replay': {
      const lines = (await readFile(args[0]!, 'utf8'))
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      const states = lines.filter((l) => l.type === 'state');
      console.log(
        JSON.stringify({ manifest: lines[0], frames: states.length, final: states.at(-1) }, null, 2),
      );
      break;
    }
    default:
      console.log(
        'Dreamweaver CLI: doctor | link OWNER/REPO | submit TAG | select ID [qualifier|finals] | practice ID | status | replay FILE',
      );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Command failed');
  process.exitCode = 1;
}
