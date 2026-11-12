// Sim data types. SimState is plain JSON data: serializable, hashable, never mutated by step().
import type { Vec2 } from './dmath';

/** Bump whenever step() output changes for the same input; the golden hash test enforces this. */
export const SIM_VERSION = 1;

export interface Bullet {
  id: number;
  pos: Vec2; // at the start of the current beat
  vel: Vec2; // cu per beat
  r: number;
  grazed: boolean; // graze counts once per bullet
}

export interface Shot {
  id: number;
  pos: Vec2;
  vel: Vec2;
}

export interface WeakState { id: number; hp: number }

export type Status = 'playing' | 'won' | 'lost';

export interface SimState {
  version: number;
  seed: number;
  beat: number; // integer beat counter; the state describes the instant this beat starts
  player: Vec2;
  lastMove: Vec2; // previous step's displacement, for timeout repeat
  energy: number;
  bullets: Bullet[];
  shots: Shot[];
  weak: WeakState[];
  nextId: number;
  rng: number; // PRNG stream state; reserved for seeded emitter variation, carried so it stays deterministic
  status: Status;
}

export interface Plan {
  target: Vec2; // clamped to the reach circle and field by step()
  fire: boolean;
}

export type SimEvent =
  | { kind: 'volley'; f: 0; gun: number; bulletIds: number[] }
  | { kind: 'fire'; f: 0; shotId: number }
  | { kind: 'graze'; f: number; bulletId: number; pos: Vec2 }
  | { kind: 'hit'; f: number; bulletId: number; pos: Vec2 }
  | { kind: 'shotHitWeak'; f: number; shotId: number; weakId: number; pos: Vec2 }
  | { kind: 'shotBlocked'; f: number; shotId: number; pos: Vec2 }
  | { kind: 'weakDestroyed'; f: number; weakId: number }
  | { kind: 'win'; f: 1 }
  | { kind: 'lose'; f: 1 };

/** Path of one enemy bullet over the next beat, as shown during the freeze. */
export interface BulletPath {
  id: number;
  from: Vec2;
  to: Vec2;
  r: number;
  fresh: boolean; // spawned by this beat's volley (not on screen yet)
}
