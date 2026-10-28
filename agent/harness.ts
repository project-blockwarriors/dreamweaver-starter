import type { Observation } from '../types.ts';
import { config, type Config } from './config.ts';
import { Memory } from './memory.ts';
import { Models } from './models.ts';
import { skills, reflex, type Plan } from './strategy.ts';
import { tacticQuestion, planningPrompt } from './prompts.ts';

export class Harness {
  memory = new Memory();
  models: Models;
  settings: Config;
  seq = 0;
  tick = 0;
  lastTrace = -100;
  choice: { id: string; until: number } | null = null;
  plan: { value: Plan; until: number } | null = null;
  constructor(settings: Config = config, now?: () => number) {
    this.settings = settings;
    this.models = new Models(settings, now);
  }
  respond(message: unknown) {
    if (!message || typeof message !== 'object') return;
    const response = this.models.respond(message, this.tick);
    if (response?.provider === 'jev' && response.id)
      this.choice = { id: response.id, until: response.requestedTick + this.settings.jev.choiceTicks };
    if (response?.provider === 'claude' && response.plan)
      this.plan = { value: response.plan, until: response.requestedTick + this.settings.planner.planTicks };
  }
  step(o: Observation) {
    if (o.protocol !== 'dreamweaver.v4') throw Error('Expected dreamweaver.v4');
    if (o.matchId !== this.memory.matchId) {
      this.models.reset();
      this.choice = null;
      this.plan = null;
      this.lastTrace = -100;
    }
    this.tick = o.tick;
    this.memory.update(o);
    this.models.expire(o.tick);
    if (this.plan && this.plan.until <= o.tick) this.plan = null;
    if (this.choice && this.choice.until <= o.tick) this.choice = null;
    const choices = skills(o, this.memory, this.settings, this.plan?.value ?? null).slice(0, 12);
    const emergency = reflex(o);
    const chosen =
      this.settings.mode !== 'scripted' && this.choice ? choices.find((s) => s.id === this.choice!.id) : null;
    const selected = chosen ?? choices[0]!;
    const action = emergency?.action ?? selected.run(o);
    action.seq = ++this.seq;
    action.observedTick = o.tick;
    const requests: object[] = [];
    if (o.status === 'running' && !emergency) {
      if (this.settings.mode !== 'scripted' && choices.length > 1) {
        const r = this.models.request(
          'jev',
          o.tick,
          tacticQuestion(o, this.memory, this.plan?.value ?? null, choices),
          choices.map((s) => s.id),
        );
        if (r) requests.push(r);
      }
      if (this.settings.mode === 'hybrid' && o.duration - o.tick > 160) {
        const r = this.models.request('claude', o.tick, { prompt: planningPrompt(o, this.memory) });
        if (r) requests.push(r);
      }
    }
    this.memory.selected = emergency?.reason ?? selected.id;
    const trace =
      o.tick - this.lastTrace >= this.settings.traceEveryTicks
        ? {
            tick: o.tick,
            skill: this.memory.selected,
            source: emergency ? 'reflex' : chosen ? 'jev' : 'local',
            plan: this.plan?.value ?? null,
            lead: o.self.score - o.opponent.score,
            cargo: o.self.cargo,
            requests: this.models.calls,
            modelResults: this.models.metrics,
          }
        : null;
    if (trace) this.lastTrace = o.tick;
    return { action, requests, trace };
  }
}
