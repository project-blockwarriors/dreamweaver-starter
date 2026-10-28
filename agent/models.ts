import type { Config } from './config.ts';

type Pending = { id: string; tick: number; at: number; choices: string[] };
/** Nonblocking broker requests. Inject a clock in tests; never fetch or read provider keys here. */
export class Models {
  pending = new Map<'jev' | 'claude', Pending>();
  calls = { jev: 0, claude: 0 };
  next = { jev: 0, claude: 0 };
  bytes = 0;
  serial = 0;
  metrics = { accepted: 0, errors: 0, expired: 0, invalid: 0 };
  settings: Config;
  now: () => number;
  constructor(settings: Config, now = () => performance.now()) {
    this.settings = settings;
    this.now = now;
  }
  expire(tick: number) {
    for (const [provider, p] of this.pending) {
      const limits = provider === 'jev' ? this.settings.jev : this.settings.planner;
      if (tick - p.tick > limits.maxAgeTicks || this.now() - p.at > limits.timeoutMs) {
        this.pending.delete(provider);
        this.metrics.expired++;
      }
    }
  }
  request(provider: 'jev' | 'claude', tick: number, body: object, choices: string[] = []) {
    const limits = provider === 'jev' ? this.settings.jev : this.settings.planner;
    if (this.pending.has(provider) || tick < this.next[provider] || this.calls[provider] >= limits.maxCalls)
      return null;
    const requestId = `${provider}:${++this.serial}`;
    const request = { type: 'model', provider, requestId, observedTick: tick, ...body };
    const size = Buffer.byteLength(JSON.stringify(request));
    if (size > this.settings.maxRequestBytes || this.bytes + size > this.settings.maxTotalRequestBytes)
      return null;
    this.pending.set(provider, { id: requestId, tick, at: this.now(), choices });
    this.next[provider] = tick + limits.intervalTicks;
    this.calls[provider]++;
    this.bytes += size;
    return request;
  }
  respond(message: any, tick: number) {
    this.expire(tick);
    const found = [...this.pending].find(([, p]) => p.id === message.requestId);
    if (!found) return null;
    const [provider, p] = found;
    this.pending.delete(provider);
    if (message.error) {
      this.metrics.errors++;
      return null;
    }
    if (provider === 'jev') {
      const id = message.result?.answers?.skill?.choice;
      if (typeof id !== 'string' || !p.choices.includes(id)) {
        this.metrics.invalid++;
        return null;
      }
      this.metrics.accepted++;
      return { provider, id, requestedTick: p.tick };
    }
    try {
      if (message.result?.stop_reason !== 'end_turn') throw Error('Incomplete plan');
      const blocks = message.result.content;
      if (!Array.isArray(blocks) || blocks.length !== 1 || blocks[0].type !== 'text')
        throw Error('Invalid content');
      const plan = JSON.parse(blocks[0].text);
      if (
        !plan ||
        Object.keys(plan).sort().join(',') !== 'bankAt,goal,stance' ||
        !['score', 'deny', 'recover'].includes(plan.goal) ||
        !['safe', 'balanced', 'aggressive'].includes(plan.stance) ||
        !Number.isInteger(plan.bankAt) ||
        plan.bankAt < 1 ||
        plan.bankAt > 3
      )
        throw Error('Invalid plan');
      this.metrics.accepted++;
      return { provider, plan, requestedTick: p.tick };
    } catch {
      this.metrics.invalid++;
      return null;
    }
  }
  reset() {
    this.pending.clear();
    this.calls = { jev: 0, claude: 0 };
    this.next = { jev: 0, claude: 0 };
    this.bytes = 0;
    this.metrics = { accepted: 0, errors: 0, expired: 0, invalid: 0 };
  }
}
