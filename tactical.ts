import type { Action, Observation } from './types.ts';
export type Tactic = 'bank' | 'collect' | 'contest' | 'intercept' | 'shield' | 'escape' | 'cover';
export type StrategicPlan = {
  matchId: string;
  createdTick: number;
  expiresTick: number;
  objective: 'bank' | 'collect' | 'contest' | 'deny' | 'recover';
  stance: 'safe' | 'balanced' | 'aggressive';
  bankAt: number;
  summary: string;
};
type Point = { x: number; z: number };
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const alive = (o: Observation) => (o.self.respawnUntil ?? 0) <= o.tick;
const ready = (o: Observation, slot: number) =>
  o.self.cooldowns[slot - 1] === 0 && (o.self.recoveryUntil ?? 0) <= o.tick;
const free = (o: Observation, x: number, z: number) =>
  x >= 0 && x <= 24 && z >= 0 && z <= 24 && !o.blocks.some((b) => b.x === x && b.z === z && b.until > o.tick);
export const threatened = (o: Observation) =>
  o.self.x === o.hazard.x && o.hazard.activeUntil > o.tick && o.hazard.warnUntil - o.tick <= 16;
function pulseClear(o: Observation) {
  const a = o.self,
    b = o.opponent,
    n = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
  for (let i = 1; i < n; i++)
    if (!free(o, Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.z + ((b.z - a.z) * i) / n)))
      return false;
  return true;
}
export function coverDirection(o: Observation): readonly [number, number] | undefined {
  if (
    !ready(o, 4) ||
    o.self.flux < 1 ||
    distance(o.self, o.opponent) < 2 ||
    distance(o.self, o.opponent) > 5 ||
    !pulseClear(o)
  )
    return;
  // Only offer walls which actually intersect the opponent's pulse line.
  const n = Math.max(Math.abs(o.opponent.x - o.self.x), Math.abs(o.opponent.z - o.self.z));
  return dirs.find(([dx, dz]) => {
    const p = { x: o.self.x + dx, z: o.self.z + dz };
    if (
      !free(o, p.x, p.z) ||
      distance(p, o.opponent) === 0 ||
      distance(p, o.beacon) === 0 ||
      o.nodes.some((node) => distance(p, node) === 0)
    )
      return false;
    for (let i = 1; i < n; i++) {
      if (
        Math.round(o.opponent.x + ((o.self.x - o.opponent.x) * i) / n) === p.x &&
        Math.round(o.opponent.z + ((o.self.z - o.opponent.z) * i) / n) === p.z
      )
        return true;
    }
    return false;
  });
}
function supplyCost(o: Observation, node: Observation['nodes'][number]) {
  const yieldCount = Math.min(node.yield ?? 1, Math.max(1, 3 - o.self.cargo));
  return (distance(o.self, node) + Math.max(0, (node.readyAt ?? 0) - o.tick) / 4 + 8) / yieldCount;
}
function coreNode(o: Observation) {
  return o.nodes.find((node) => (node.yield ?? 1) === (o.ruleset === 'dream-relay.0.6' ? 3 : 2));
}
function supplyChoice(o: Observation): Tactic {
  const core = coreNode(o);
  const outer = o.nodes.filter((n) => n !== core);
  return core && supplyCost(o, core) < Math.min(...outer.map((n) => supplyCost(o, n)))
    ? 'contest'
    : 'collect';
}
export function options(o: Observation): Tactic[] {
  if (!alive(o)) return [];
  const result: Tactic[] = [];
  if (o.self.cargo > 0) result.push('bank');
  if (o.self.cargo < 3) {
    result.push('collect');
    if (coreNode(o)) result.push('contest');
  }
  if (
    (o.opponent.respawnUntil ?? 0) <= o.tick &&
    (o.opponent.cargo > 0 || distance(o.opponent, o.beacon) <= 4)
  )
    result.push('intercept');
  if (
    o.self.flux > 0 &&
    ready(o, 3) &&
    o.self.wardUntil <= o.tick &&
    (threatened(o) || distance(o.self, o.opponent) <= 5 || o.self.depositUntil)
  )
    result.push('shield');
  if (
    threatened(o) ||
    o.self.health === 1 ||
    ((o.opponent.pulseUntil ?? 0) > o.tick && distance(o.self, o.opponent) <= 3)
  )
    result.push('escape');
  if (coverDirection(o)) result.push('cover');
  return result;
}
// Same movement and ability implementation for both Jev and the scripted comparison.
function route(o: Observation, target: Point, radius = 1): [number, number] {
  if (distance(o.self, target) <= radius) return [0, 0];
  const queue: [number, number, number, number][] = [[o.self.x, o.self.z, 0, 0]];
  const seen = new Set([`${o.self.x}:${o.self.z}`]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z, firstX, firstZ] = queue[i];
    for (const [dx, dz] of dirs) {
      const nx = x + dx,
        nz = z + dz,
        k = `${nx}:${nz}`;
      if (!free(o, nx, nz) || seen.has(k)) continue;
      if (
        nx === o.hazard.x &&
        o.hazard.activeUntil > o.tick &&
        o.hazard.warnUntil - o.tick < 12 &&
        o.self.wardUntil <= o.tick
      )
        continue;
      seen.add(k);
      const fx = i === 0 ? dx : firstX,
        fz = i === 0 ? dz : firstZ;
      if (distance({ x: nx, z: nz }, target) <= radius) return [fx, fz];
      queue.push([nx, nz, fx, fz]);
    }
  }
  return [0, 0];
}
export function scriptedChoice(o: Observation): Tactic {
  if (
    (o.opponent.pulseUntil ?? 0) > o.tick &&
    distance(o.self, o.opponent) <= 3 &&
    o.self.wardUntil <= o.tick
  ) {
    if (o.self.depositUntil && coverDirection(o)) return 'cover';
    return ready(o, 3) && o.self.flux ? 'shield' : 'escape';
  }
  if (threatened(o) && o.self.wardUntil <= o.tick)
    return o.self.depositUntil && ready(o, 3) && o.self.flux ? 'shield' : 'escape';
  if (
    o.opponent.depositUntil &&
    distance(o.self, o.opponent) <= 3 &&
    ready(o, 5) &&
    o.opponent.wardUntil <= o.tick
  )
    return 'intercept';
  if (o.self.cargo > 0) {
    if (
      distance(o.self, o.beacon) <= 2 &&
      distance(o.self, o.opponent) <= 3 &&
      ready(o, 3) &&
      o.self.flux &&
      o.self.wardUntil <= o.tick
    )
      return 'shield';
    const near = o.nodes.some((n) => distance(o.self, n) <= 1 && (n.readyAt ?? 0) <= o.tick);
    if (near && o.self.cargo < 3 && o.self.health > 1) return supplyChoice(o);
    return 'bank';
  }
  return supplyChoice(o);
}
export function execute(o: Observation, tactic: Tactic, targetOverride?: Point, targetRadius = 1): Action {
  const a: Action = { seq: o.tick, observedTick: o.tick, dx: 0, dz: 0, slot: 1, activate: false };
  if (!alive(o)) return a;
  if (threatened(o) && o.self.wardUntil <= o.tick && tactic !== 'shield') tactic = 'escape';
  if (tactic === 'shield' && ready(o, 3) && o.self.flux > 0) return { ...a, slot: 3, activate: true };
  if (tactic === 'cover') {
    const direction = coverDirection(o);
    if (direction) return { ...a, dx: direction[0], dz: direction[1], slot: 4, activate: true };
    tactic = scriptedChoice(o);
  }
  if ((o.self.pulseUntil ?? 0) > o.tick && tactic !== 'escape') return a;
  // Stay still while depositing, unless immediate danger or a selected defensive ability interrupts.
  if (o.self.depositUntil && o.self.depositUntil > o.tick && tactic !== 'escape') return a;
  if (tactic === 'escape') {
    const safe = dirs
      .filter(([x, z]) => free(o, o.self.x + x, o.self.z + z) && o.self.x + x !== o.hazard.x)
      .sort(
        (a, b) =>
          distance({ x: o.self.x + b[0], z: o.self.z + b[1] }, o.opponent) -
          distance({ x: o.self.x + a[0], z: o.self.z + a[1] }, o.opponent),
      )[0];
    if (safe) return { ...a, dx: safe[0], dz: safe[1], slot: ready(o, 2) ? 2 : 1, activate: ready(o, 2) };
    return ready(o, 3) && o.self.flux > 0 ? { ...a, slot: 3, activate: true } : a;
  }
  let target: Point = o.beacon,
    radius = 1;
  if (tactic === 'intercept') {
    if (distance(o.self, o.opponent) <= 3 && ready(o, 5) && o.opponent.wardUntil <= o.tick && pulseClear(o))
      return { ...a, slot: 5, activate: true };
    target = o.opponent;
    radius = 2;
  } else if (tactic === 'contest' && coreNode(o)) {
    target = coreNode(o)!;
  } else if (tactic === 'collect') {
    const loot = (o.loot ?? [])
      .filter((l) => l.until > o.tick && (l.lockedSeat !== o.self.seat || (l.unlockAt ?? 0) <= o.tick))
      .sort((a, b) => distance(o.self, a) - distance(o.self, b))[0];
    if (loot && distance(o.self, loot) <= 6) {
      target = loot;
      radius = 0;
    } else
      target =
        o.nodes.filter((n) => n !== coreNode(o)).sort((a, b) => supplyCost(o, a) - supplyCost(o, b))[0] ??
        o.beacon;
  }
  if (targetOverride) {
    target = targetOverride;
    radius = targetRadius;
  }
  if (distance(o.self, target) <= radius) return { ...a, activate: tactic !== 'intercept' };
  [a.dx, a.dz] = route(o, target, radius);
  if (distance(o.self, target) > 5 && ready(o, 2)) {
    // Avoid a dash ending inside an active hazard; exact geometry is code's responsibility.
    let x = o.self.x,
      z = o.self.z;
    for (let i = 0; i < 4; i++) {
      if (!free(o, x + a.dx, z + a.dz)) break;
      x += a.dx;
      z += a.dz;
    }
    if (x !== o.hazard.x || o.hazard.activeUntil <= o.tick) {
      a.slot = 2;
      a.activate = true;
    }
  }
  return a;
}
export function tactical(o: Observation) {
  return execute(o, scriptedChoice(o));
}
export function question(o: Observation, plan?: StrategicPlan | null) {
  const available = options(o);
  const descriptions: Record<Tactic, string> = {
    bank: o.beacon.fullLoadBonus
      ? `Deliver at the fixed shrine: hold still for ${o.beacon.depositTicks ?? 24} ticks (${(o.beacon.depositTicks ?? 24) / 20} seconds). One/two/three crystals score 10/20/${30 + o.beacon.fullLoadBonus}. Movement or damage cancels the channel; Ward and cover preserve it.`
      : 'Deliver current cargo at the beacon. A 12-tick stationary channel earns 10 per crystal, or 15 during bonus. Damage/movement cancels it. Passive opponents do not block it.',
    collect:
      'Take a flank source or recover dropped cargo. Read each source yield and readyAt; carry up to 3, excess yield is lost. Harvest grants flux.',
    contest:
      o.ruleset === 'dream-relay.0.6'
        ? 'Race for the north cache at (12,4): three crystals, first ready at tick 300, then refills 900 ticks after harvest. Four flank sources give two each and refill in 160 ticks. Camping the cache sacrifices reliable flank income. Compare arrival times and remaining capacity.'
        : o.beacon.fullLoadBonus
          ? 'Race for the center core: two crystals, first ready at tick 100, then refills 240 ticks after harvest. Capacity three; excess yield is lost. Compare arrival times and refill before committing.'
          : 'Take the shared center source: two crystals per harvest, refills every 200 ticks (10 seconds). First available at tick 100. Both bots can race for it. Consider arrival time, remaining cooldown and opponent; do not wait there when outer supplies are faster.',
    intercept:
      (o.beacon.fullLoadBonus
        ? 'A successful hit spills one carried crystal. The victim cannot recover it for 20 ticks; either bot can then collect it. Bank stolen cargo to score. '
        : '') +
      'Chase the opponent and use Disrupt within 3 blocks, if ready and unshielded. Deals one damage, interrupts delivery and pushes them two blocks. No kill points. ' +
      ([
        'dream-relay.0.3-preview',
        'dream-relay.0.4-player-preview',
        'dream-relay.0.5-strategy-preview',
        'dream-relay.0.6',
      ].includes(o.ruleset)
        ? 'Telegraphs for 10 ticks (0.5 seconds); movement or damage cancels our charge. Opponents can dodge, ward or weave before it fires.'
        : 'Fires immediately.'),
    shield:
      'Spend one flux on Ward now: 20 ticks of immunity. Protect a valuable delivery or survive a hazard. Requires 8 ticks recovery before another ability.',
    escape:
      'Move away from the hazard or opponent; use Dash if ready. Preserve cargo/health, temporarily give up the objective.',
    cover:
      'Place an adjacent wall that blocks the current opponent pulse line for 100 ticks. Costs one flux. May obstruct travel. ' +
      ([
        'dream-relay.0.3-preview',
        'dream-relay.0.4-player-preview',
        'dream-relay.0.5-strategy-preview',
        'dream-relay.0.6',
      ].includes(o.ruleset)
        ? 'Preserves an active delivery channel; useful against repeated attacks while banking.'
        : 'Cancels an active delivery channel; use before banking.'),
  };
  return {
    state: {
      goal: 'Maximize our final score relative to opponent. This is a real-time crystal-delivery arena; 20 ticks = one second. Choose a tactical priority, not prose.',
      ...(plan
        ? {
            strategy: plan,
            strategyInstruction:
              'Treat the planner as a short-term preference. Re-check feasibility and danger now; never delay an emergency response to follow stale advice.',
          }
        : {}),
      tick: o.tick,
      timeLeft: o.duration - o.tick,
      self: o.self,
      opponent: o.opponent,
      beacon: { ...o.beacon, distance: distance(o.self, o.beacon) },
      opponentDistance: distance(o.self, o.opponent),
      incomingPulseTicks: Math.max(0, (o.opponent.pulseUntil ?? 0) - o.tick),
      hazard: o.hazard,
      threatened: threatened(o),
      nodes: o.nodes.map((n) => ({ ...n, distance: distance(o.self, n) })),
      blocks: o.blocks,
      loot: o.loot ?? [],
    },
    questions: {
      tactic: {
        type: 'choice',
        instructions:
          (o.beacon.fullLoadBonus
            ? `Compare banking now with combining supplies for a ${30 + o.beacon.fullLoadBonus}-point full load. Avoid waiting at a source whose refill or opponent arrival makes another route better. `
            : 'Deliver cargo frequently. ') +
          'Select the most useful available tactic for the next half-second. Prefer collection over aimless combat. Defend a threatened channel; avoid hazards. React to a charged enemy pulse with cover, shield or escape before it fires. Consider bonus timing, cooldowns, health, cargo and opponent behavior. Do not chase an invulnerable opponent.',
        criteria: Object.fromEntries(available.map((k) => [k, descriptions[k]])),
      },
    },
  };
}
export class TacticalPolicy {
  plan: StrategicPlan | null = null;
  pending: { id: string; tick: number; choices: Tactic[]; at: number } | null = null;
  choice: Tactic | null = null;
  chosenTick = -100;
  nextCall = 0;
  calls = 0;
  lastMatch = '';
  metrics = {
    accepted: 0,
    late: 0,
    invalid: 0,
    errors: 0,
    fallbackSteps: 0,
    modelSteps: 0,
    choices: {} as Record<string, number>,
  };
  constructor(publicMode: 'scripted' | 'jev' = 'jev') {
    this.mode = publicMode;
  }
  mode: 'scripted' | 'jev';
  respond(message: any, currentTick: number) {
    if (!this.pending || message.requestId !== this.pending.id) return;
    const p = this.pending;
    this.pending = null;
    if (message.error) {
      this.metrics.errors++;
      return;
    }
    if (currentTick - p.tick > 16 || performance.now() - p.at > 800) {
      this.metrics.late++;
      return;
    }
    const choice = message.result?.answers?.tactic?.choice;
    if (!p.choices.includes(choice)) {
      this.metrics.invalid++;
      return;
    }
    this.choice = choice;
    this.chosenTick = currentTick;
    this.metrics.accepted++;
    this.metrics.choices[choice] = (this.metrics.choices[choice] ?? 0) + 1;
  }
  step(o: Observation) {
    if (this.lastMatch !== o.matchId) {
      this.lastMatch = o.matchId;
      this.choice = null;
      this.chosenTick = -100;
      this.pending = null;
      this.nextCall = 0;
      this.calls = 0;
    }
    if (this.pending && performance.now() - this.pending.at > 1000) {
      this.pending = null;
      this.metrics.late++;
    }
    if (this.plan && (this.plan.matchId !== o.matchId || this.plan.expiresTick <= o.tick)) this.plan = null;
    const available = options(o);
    let request: any = null;
    if (
      this.mode === 'jev' &&
      available.length > 1 &&
      !this.pending &&
      o.tick >= this.nextCall &&
      this.calls < 360
    ) {
      const id = `${o.matchId}:${o.self.seat}:${++this.calls}`;
      this.pending = { id, tick: o.tick, choices: available, at: performance.now() };
      this.nextCall = o.tick + 10;
      request = {
        type: 'model',
        provider: 'jev',
        requestId: id,
        observedTick: o.tick,
        ...question(o, this.plan),
      };
    }
    const selected =
      this.mode === 'jev' && this.choice && o.tick - this.chosenTick <= 20 && available.includes(this.choice)
        ? this.choice
        : null;
    if (selected) this.metrics.modelSteps++;
    else this.metrics.fallbackSteps++;
    return {
      action: execute(o, selected ?? scriptedChoice(o)),
      request,
      tactic: selected ?? scriptedChoice(o),
      source: selected ? 'jev' : 'scripted',
    };
  }
}
