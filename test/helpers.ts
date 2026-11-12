import { P, type Params } from '../src/params';
import { makeStubRig } from '../src/creature/stub';
import { next } from '../src/sim/prng';
import type { Plan, SimState } from '../src/sim/state';

export function params(patch: (p: Params) => void = () => {}): Params {
  const p = structuredClone(P);
  patch(p);
  return p;
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

/** Seeded random plan: a target anywhere in (and a bit beyond) the reach circle, fire about half the time. */
export function randomPlan(s: SimState, rng: number, p: Params): [Plan, number] {
  let a: number, b: number, c: number;
  [a, rng] = next(rng);
  [b, rng] = next(rng);
  [c, rng] = next(rng);
  const reach = p.player.reach * 1.2;
  return [{ target: { x: s.player.x + (a * 2 - 1) * reach, y: s.player.y + (b * 2 - 1) * reach }, fire: c < 0.5 }, rng];
}

export const stubRig = (p: Params) => makeStubRig(p);
