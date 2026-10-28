import type { Observation } from '../types.ts';
import type { Memory } from './memory.ts';
import type { Plan, Skill } from './strategy.ts';

export function context(o: Observation, memory: Memory, plan: Plan | null) {
  return {
    tick: o.tick,
    memory: memory.summary(o),
    self: o.self,
    opponent: o.opponent,
    shrine: o.beacon,
    nodes: o.nodes,
    hazard: o.hazard,
    walls: o.blocks,
    loot: o.loot ?? [],
    plan,
  };
}
export function tacticQuestion(o: Observation, memory: Memory, plan: Plan | null, choices: Skill[]) {
  return {
    state: context(o, memory, plan),
    questions: {
      skill: {
        type: 'choice',
        instructions:
          'Win Dream Relay by banking more points than the house. Pick a feasible skill for the next half-second. Bank 1/2/3 crystals for 10/20/40 points after a stationary 24-tick channel. Compare refill times, source races, travel and remaining time. Damage has no points. Avoid idle waiting and aimless chasing. The code handles immediate defense; a plan is advice. 20 ticks = 1 second.',
        criteria: Object.fromEntries(choices.map((s) => [s.id, s.description])),
      },
    },
  };
}
export function planningPrompt(o: Observation, memory: Memory) {
  return (
    'Plan the next ten seconds in Dream Relay. Return ONLY JSON with goal (score|deny|recover), stance (safe|balanced|aggressive), bankAt (integer 1..3). No prose. One bot per team. Carry at most 3 crystals; a stationary 24-tick delivery scores 10/20/40 for 1/2/3. Core yields 2, outer sources 1. Disrupt can steal cargo but damage earns no points. Emergency code reacts immediately and Jev chooses short skills. Choose a useful strategy from the observed state and match memory:\n' +
    JSON.stringify(context(o, memory, null))
  );
}
