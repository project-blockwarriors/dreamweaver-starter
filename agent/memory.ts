import type { Observation } from '../types.ts';

/** Match-local, bounded memory. A new match always starts fresh. Add your own features here. */
export class Memory {
  matchId = '';
  last: Observation | null = null;
  stationarySince = 0;
  deliveries = 0;
  damage = 0;
  selected = '';
  update(o: Observation) {
    if (this.matchId !== o.matchId) {
      this.matchId = o.matchId;
      this.last = null;
      this.deliveries = 0;
      this.damage = 0;
      this.selected = '';
      this.stationarySince = o.tick;
    }
    if (this.last) {
      if (o.self.score > this.last.self.score) this.deliveries++;
      this.damage += Math.max(0, this.last.self.health - o.self.health);
      const a = this.last.self.position ?? this.last.self;
      const b = o.self.position ?? o.self;
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.05) this.stationarySince = o.tick;
    }
    this.last = structuredClone(o);
  }
  summary(o: Observation) {
    return {
      deliveries: this.deliveries,
      damageTaken: this.damage,
      lastSkill: this.selected,
      stationaryTicks: o.tick - this.stationarySince,
      scoreLead: o.self.score - o.opponent.score,
      ticksLeft: o.duration - o.tick,
    };
  }
}
