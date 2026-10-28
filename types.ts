export interface Action {
  seq: number;
  observedTick: number;
  dx: number;
  dz: number;
  slot: number;
  activate: boolean;
}
export interface Bot {
  seat: number;
  entityType?: 'PLAYER';
  connected?: boolean;
  heldSlot?: number;
  position?: { x: number; y: number; z: number; yaw: number; pitch: number };
  x: number;
  z: number;
  health: number;
  cargo: number;
  flux: number;
  score: number;
  wardUntil: number;
  cooldowns: number[];
  respawnUntil?: number;
  recoveryUntil?: number;
  depositUntil?: number;
  pulseUntil?: number;
  facingX?: number;
  facingZ?: number;
}
export interface Observation {
  protocol: string;
  ruleset: string;
  matchId: string;
  tick: number;
  duration: number;
  status: 'idle' | 'running' | 'completed';
  self: Bot;
  opponent: Bot;
  beacon: {
    x: number;
    z: number;
    multiplier?: number;
    depositTicks?: number;
    fullLoadBonus?: number;
    bonusAt?: number;
    movesAt?: number;
    next?: { x: number; z: number };
  };
  nodes: { x: number; z: number; readyAt?: number; yield?: number; replenishTicks?: number }[];
  hazard: { x: number; warnUntil: number; activeUntil: number };
  blocks: { x: number; z: number; until: number }[];
  loot?: { x: number; z: number; amount: number; until: number; lockedSeat?: number; unlockAt?: number }[];
}
export interface ArenaState {
  actorType?: 'minecraft-player';
  playersReady?: boolean;
  controllers?: string[];
  protocol: string;
  ruleset: string;
  matchId: string;
  tick: number;
  duration: number;
  status: string;
  bots: Bot[];
  beacon: {
    x: number;
    z: number;
    multiplier?: number;
    depositTicks?: number;
    fullLoadBonus?: number;
    bonusAt?: number;
    movesAt?: number;
    next?: { x: number; z: number };
  };
  nodes: { x: number; z: number; readyAt?: number; yield?: number; replenishTicks?: number }[];
  hazard: { x: number; warnUntil: number; activeUntil: number };
  blocks: { x: number; z: number; until: number }[];
  loot?: { x: number; z: number; amount: number; until: number; lockedSeat?: number; unlockAt?: number }[];
  events: {
    id?: number;
    tick: number;
    kind: string;
    seat: number;
    target?: number;
    amount?: number;
    points?: number;
    cause?: string;
    x?: number;
    z?: number;
  }[];
}
