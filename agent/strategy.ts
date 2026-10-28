import type { Action, Observation } from '../types.ts';
import { distance, execute, options, threatened } from '../tactical.ts';
import type { Config } from './config.ts';
import type { Memory } from './memory.ts';

export type Plan = {
  goal: 'score' | 'deny' | 'recover';
  stance: 'safe' | 'balanced' | 'aggressive';
  bankAt: number;
};
export type Skill = {
  id: string;
  description: string;
  value: number;
  // This is ordinary team code, not a fixed organizer action whitelist.
  run: (o: Observation) => Action;
};

/** Immediate reactions run before model advice. Keep channels stationary unless danger requires escape. */
export function reflex(o: Observation): { action: Action; reason: string } | null {
  const legal = options(o);
  const incoming = (o.opponent.pulseUntil ?? 0) > o.tick && distance(o.self, o.opponent) <= 3;
  if (o.self.wardUntil <= o.tick && (threatened(o) || incoming)) {
    const tactic = legal.includes('shield') ? 'shield' : 'escape';
    return { action: execute(o, tactic), reason: tactic };
  }
  if ((o.self.respawnUntil ?? 0) > o.tick) return { action: execute(o, 'bank'), reason: 'respawning' };
  if ((o.self.depositUntil ?? 0) > o.tick) return { action: execute(o, 'bank'), reason: 'finish delivery' };
  if ((o.self.pulseUntil ?? 0) > o.tick) return { action: execute(o, 'intercept'), reason: 'finish disrupt' };
  if (o.self.cargo > 0 && (o.self.cargo === 3 || o.duration - o.tick < distance(o.self, o.beacon) * 20 + 100))
    return { action: execute(o, 'bank'), reason: 'bank before timeout' };
  return null;
}

/** Edit the valuation, invent skills, or replace this module entirely. Travel estimates are heuristics. */
export function skills(o: Observation, memory: Memory, settings: Config, plan: Plan | null): Skill[] {
  const result: Skill[] = [];
  const legal = options(o),
    me = o.self,
    foe = o.opponent;
  const bankAt = plan?.bankAt ?? settings.bankAt;
  const urgent = o.duration - o.tick < distance(me, o.beacon) * 5 + 80;
  if (me.cargo > 0)
    result.push({
      id: 'bank',
      description: `Bank ${me.cargo} crystals for ${me.cargo * 10 + (me.cargo === 3 ? (o.beacon.fullLoadBonus ?? 0) : 0)} points.`,
      value:
        me.cargo >= bankAt || urgent || me.health === 1 || plan?.goal === 'recover'
          ? 100
          : 10 + 20 / (1 + distance(me, o.beacon)),
      run: (o) => execute(o, 'bank'),
    });
  if (me.cargo < 3 && !urgent) {
    for (const n of o.nodes) {
      const travel = distance(me, n) * 4;
      const wait = Math.max(0, (n.readyAt ?? 0) - o.tick - travel);
      if (wait > 40) continue; // Reconsider later; do not send the model to camp an unavailable source.
      const amount = Math.min(n.yield ?? 1, 3 - me.cargo);
      const raced =
        foe.cargo < 3 && (foe.respawnUntil ?? 0) <= o.tick && distance(foe, n) + 2 < distance(me, n);
      const cost = travel + wait + distance(n, o.beacon) * 4 + (o.beacon.depositTicks ?? 24);
      const reward = 10 * amount + (me.cargo + amount === 3 ? (o.beacon.fullLoadBonus ?? 0) : 0);
      const id = `source:${n.x}:${n.z}`;
      // Abandon a route that made no physical progress; channels are handled by reflex().
      const stuck = memory.selected === id && o.tick - memory.stationarySince > 40 && distance(me, n) > 1;
      result.push({
        id,
        description: `Harvest source (${n.x},${n.z}), yield ${amount}, wait ${Math.round(wait / 20)}s, opponent ${raced ? 'closer' : 'farther'}.`,
        value:
          (reward * 120) / Math.max(1, cost) - (raced ? 12 : 0) - (wait > 40 ? 30 : 0) - (stuck ? 50 : 0),
        run: (o) => execute(o, (n.yield ?? 1) > 1 ? 'contest' : 'collect', n),
      });
    }
    for (const l of o.loot ?? []) {
      if (l.until <= o.tick || (l.lockedSeat === me.seat && (l.unlockAt ?? 0) > o.tick)) continue;
      result.push({
        id: `loot:${l.x}:${l.z}`,
        description: `Recover ${l.amount} dropped crystals at (${l.x},${l.z}).`,
        value: 60 / (1 + distance(me, l)),
        run: (o) => execute(o, 'collect', l, 0),
      });
    }
  }
  if (
    legal.includes('intercept') &&
    foe.wardUntil <= o.tick &&
    me.cooldowns[4] === 0 &&
    distance(me, foe) <= 5
  ) {
    result.push({
      id: 'intercept',
      description: 'Interrupt the nearby carrier; steal cargo and bank it. Damage alone scores nothing.',
      value:
        (settings.style === 'raider' || plan?.goal === 'deny' || plan?.stance === 'aggressive' ? 50 : 12) +
        (foe.depositUntil ? 20 : 0),
      run: (o) => execute(o, 'intercept'),
    });
  }
  if (legal.includes('cover') && me.cargo > 0 && distance(me, o.beacon) <= 2)
    result.push({
      id: 'cover',
      description: 'Block the opponent pulse line before banking.',
      value: plan?.stance === 'safe' ? 70 : 25,
      run: (o) => execute(o, 'cover'),
    });
  if (settings.style === 'collector') for (const s of result) if (s.id === 'intercept') s.value -= 40;
  if (!result.length)
    result.push({
      id: 'reposition',
      description: 'Move toward the shrine while supplies recover.',
      value: 0,
      run: (o) => execute(o, 'bank'),
    });
  return result.sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
}
