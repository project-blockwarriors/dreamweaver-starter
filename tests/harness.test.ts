import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Harness } from '../agent/harness.ts';
import { execute, question } from '../tactical.ts';
import { config } from '../agent/config.ts';
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/observation.json', import.meta.url), 'utf8'),
).observation;
const obs = (tick = 20) => ({ ...structuredClone(fixture), tick });
const settings = (mode: 'jev' | 'scripted' | 'hybrid' = 'jev') => ({ ...structuredClone(config), mode });
const reply = (id: string, choice: string) => ({ requestId: id, result: { answers: { skill: { choice } } } });

test('slow model never blocks actions; response is bounded by request age, not arrival time', () => {
  let now = 0;
  const h = new Harness(settings(), () => now);
  const a = h.step(obs());
  const request = a.requests[0] as any;
  assert.ok(request);
  const id = Object.keys(request.questions.skill.criteria)[1]!;
  for (let tick = 24; tick <= 40; tick += 4) {
    now += 200;
    const b = h.step(obs(tick));
    assert.ok(b.action.seq > a.action.seq);
    assert.equal(b.action.observedTick, tick);
  }
  h.respond(reply(request.requestId, id));
  assert.equal(h.choice, null);
  assert.ok(h.models.metrics.expired);
});
test('accepted skill executes only while still feasible; duplicate/foreign replies are ignored', () => {
  const h = new Harness(settings(), () => 0);
  const a = h.step(obs());
  const request = a.requests[0] as any;
  const id = Object.keys(request.questions.skill.criteria)[1]!;
  h.respond(reply('unknown', id));
  assert.equal(h.choice, null);
  h.respond(reply(request.requestId, id));
  assert.equal(h.choice?.id, id);
  h.respond(reply(request.requestId, 'intercept'));
  assert.equal(h.choice?.id, id);
  const o = obs(24);
  o.self.cargo = 3;
  const result = h.step(o);
  assert.match(h.memory.selected, /bank/);
  assert.equal(result.action.observedTick, 24);
});
test('provider error, invalid choice and missing response retain a working local policy', () => {
  for (const response of [
    { error: 'quota exhausted' },
    { result: { answers: { skill: { choice: 'teleport' } } } },
  ]) {
    const h = new Harness(settings(), () => 0);
    const r = h.step(obs()).requests[0] as any;
    h.respond({ requestId: r.requestId, ...response });
    const a = h.step(obs(24));
    assert.equal(h.choice, null);
    assert.ok(a.action);
  }
});
test('hybrid planner validates full output; truncated plans cannot control the bot', () => {
  const h = new Harness(settings('hybrid'), () => 0);
  const requests = h.step(obs()).requests as any[];
  const p = requests.find((r) => r.provider === 'claude');
  assert.ok(p);
  const plan = { goal: 'score', stance: 'safe', bankAt: 2 };
  h.respond({
    requestId: p.requestId,
    result: { stop_reason: 'max_tokens', content: [{ type: 'text', text: JSON.stringify(plan) }] },
  });
  assert.equal(h.plan, null);
  const next = h.step(obs(220)).requests as any[];
  const p2 = next.find((r) => r.provider === 'claude');
  h.respond({
    requestId: p2.requestId,
    result: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(plan) }] },
  });
  assert.deepEqual(h.plan?.value, plan);
  h.step(obs(421));
  assert.equal(h.plan, null);
});
test('new match discards old model responses, memory, plans and budgets without reusing IDs', () => {
  const h = new Harness(settings(), () => 0);
  const old = h.step(obs()).requests[0] as any;
  const o = obs();
  o.matchId = 'new-match';
  const next = h.step(o).requests[0] as any;
  assert.notEqual(old.requestId, next.requestId);
  h.respond(reply(old.requestId, 'bank'));
  assert.equal(h.choice, null);
  assert.equal(h.models.calls.jev, 1);
  assert.equal(h.memory.deliveries, 0);
});
test('emergency shield overrides model advice; otherwise delivery stays stationary', () => {
  const h = new Harness(settings('scripted'));
  const o = obs();
  o.self.cargo = 3;
  o.self.depositUntil = 44;
  const channel = h.step(o);
  assert.equal(channel.action.dx, 0);
  assert.equal(channel.action.dz, 0);
  assert.equal(channel.action.activate, false);
  o.tick = 24;
  o.hazard = { x: o.self.x, warnUntil: 30, activeUntil: 60 };
  const escape = h.step(o);
  assert.equal(escape.action.slot, 3);
  assert.equal(escape.action.activate, true);
  assert.equal(escape.requests.length, 0);
});
test('call/byte budgets and scripted mode prevent unwanted provider requests', () => {
  const c = settings();
  c.jev.maxCalls = 1;
  const h = new Harness(c, () => 0);
  const r = h.step(obs()).requests[0] as any;
  h.respond({ requestId: r.requestId, error: 'offline' });
  assert.equal(h.step(obs(60)).requests.length, 0);
  const tiny = settings();
  tiny.maxTotalRequestBytes = 1;
  assert.equal(new Harness(tiny).step(obs()).requests.length, 0);
  assert.equal(new Harness(settings('scripted')).step(obs()).requests.length, 0);
});
test('endgame banks partial loads and a running channel is not interrupted by strategy', () => {
  const o = obs(3540);
  o.self.cargo = 1;
  o.self.x = 12;
  o.self.z = o.beacon.z + 1;
  const h = new Harness(settings('scripted'));
  const result = h.step(o);
  assert.match(h.memory.selected, /bank/);
  assert.equal(result.action.activate, true);
  assert.equal(result.action.dx, 0);
});

test('route commitment prevents model jitter but cargo changes release the intent', () => {
  const h = new Harness(settings(), () => 0);
  const a = h.step(obs());
  const request = a.requests[0] as any;
  const first = h.memory.selected;
  const other = Object.keys(request.questions.skill.criteria).find((id) => id !== first)!;
  h.respond(reply(request.requestId, other));
  h.step(obs(24));
  assert.equal(h.memory.selected, first);
  const loaded = obs(28);
  loaded.self.cargo = 3;
  h.step(loaded);
  assert.match(h.memory.selected, /bank/);
  assert.equal(h.intent, null);
});

test('0.6 motor collects two-crystal flank supplies and prompts use the observed bonus', () => {
  const o = obs(100);
  o.self.x = 4;
  o.self.z = 5;
  o.self.cargo = 0;
  const a = execute(o, 'collect');
  assert.equal(a.activate, true);
  assert.equal(a.dx, 0);
  assert.equal(a.dz, 0);
  o.self.cargo = 2;
  assert.match(question(o).questions.tactic.criteria.bank, /10\/20\/35/);
  const h = new Harness(settings('jev'), () => 0);
  const r = h.step(o).requests[0] as any;
  assert.match(r.questions.skill.instructions, /10\/20\/35/);
  assert.doesNotMatch(r.questions.skill.instructions, /10\/20\/40/);
});

test('short native matches return two crystals before the last crossing becomes too late', () => {
  const o = obs(840);
  o.duration = 1200;
  o.self.x = 4;
  o.self.z = 20;
  o.self.cargo = 2;
  const h = new Harness(settings('jev'), () => 0);
  const result = h.step(o);
  assert.equal(h.memory.selected, 'bank before timeout');
  assert.equal(result.requests.length, 0);
  assert.ok(result.action.dx > 0 || result.action.dz < 0);
});
