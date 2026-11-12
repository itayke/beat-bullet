import { describe, expect, it } from 'vitest';
import { firstContact } from '../src/sim/collide';
import { resolve } from '../src/sim/step';
import type { CreatureRig } from '../src/creature/rig';
import type { SimState } from '../src/sim/state';
import { initState } from '../src/sim/step';
import { params } from './helpers';

// A rig with no guns, no hull and an unreachable weak point isolates bullet-vs-player tests.
const emptyRig: CreatureRig = {
  id: 'empty',
  gunsAt: () => [],
  weakPointsAt: () => [{ id: 0, pos: { x: 0, y: -100 }, r: 0.01 }],
  hullAt: () => [],
};

function withBullet(p: ReturnType<typeof params>, pos: { x: number; y: number }, vel: { x: number; y: number }): SimState {
  const s = initState(1, emptyRig, p);
  return { ...s, player: { x: 0, y: 0 }, bullets: [{ id: 1, pos, vel, r: p.enemy.bulletR, grazed: false }], nextId: 2 };
}

describe('collide', () => {
  it('fast bullet crossing the ship within one beat hits (no tunnelling)', () => {
    const p = params();
    const s = withBullet(p, { x: -1, y: 0.005 }, { x: 2, y: 0 }); // passes through the hitbox mid-beat
    const { events, next } = resolve(s, { target: { x: 0, y: 0 }, fire: false }, emptyRig, p);
    const hit = events.find((e) => e.kind === 'hit');
    expect(hit).toBeDefined();
    expect(hit!.f).toBeGreaterThan(0.4);
    expect(hit!.f).toBeLessThan(0.5);
    expect(next.bullets).toHaveLength(0);
    expect(next.energy).toBe(p.energy.start - p.energy.hitCost);
  });

  it('moving ship and moving bullet that cross paths hit', () => {
    const p = params();
    const s = withBullet(p, { x: 0.2, y: 0 }, { x: -0.2, y: 0.2 }); // meets the ship at (0.1, 0.1) at f = 0.5
    const { events } = resolve(s, { target: { x: 0.2, y: 0.2 }, fire: false }, emptyRig, p);
    expect(events.some((e) => e.kind === 'hit')).toBe(true);
  });

  it('near pass inside the graze ring grazes without hitting, once per bullet', () => {
    const p = params();
    const gap = (p.player.hitR + p.player.grazeR) / 2 + p.enemy.bulletR; // between hit and graze radii
    const s = withBullet(p, { x: -0.1, y: gap }, { x: 0.2, y: 0 });
    const r1 = resolve(s, { target: { x: 0, y: 0 }, fire: false }, emptyRig, p);
    expect(r1.events.map((e) => e.kind)).toEqual(['graze']);
    expect(r1.next.energy).toBe(Math.min(p.energy.start + p.energy.grazeGain, p.energy.grazeCap));
    expect(r1.next.bullets[0].grazed).toBe(true);
    // Same bullet still inside the ring next beat (ship follows it): no second graze.
    const r2 = resolve(r1.next, { target: { x: 0.2, y: 0 }, fire: false }, emptyRig, p);
    expect(r2.events.filter((e) => e.kind === 'graze')).toHaveLength(0);
  });

  it('pass outside the graze ring does nothing', () => {
    const p = params();
    const s = withBullet(p, { x: -0.5, y: p.player.grazeR + p.enemy.bulletR + 0.01 }, { x: 1, y: 0 });
    expect(resolve(s, { target: { x: 0, y: 0 }, fire: false }, emptyRig, p).events).toHaveLength(0);
  });

  it('graze cap: grazing never fills past grazeCap', () => {
    const p = params((q) => { q.energy.start = q.energy.grazeCap - 1; });
    const gap = (p.player.hitR + p.player.grazeR) / 2 + p.enemy.bulletR;
    const s = withBullet(p, { x: -0.1, y: gap }, { x: 0.2, y: 0 });
    expect(resolve(s, { target: { x: 0, y: 0 }, fire: false }, emptyRig, p).next.energy).toBe(p.energy.grazeCap);
  });

  it('exact tangent counts as contact; a hair further misses', () => {
    // Binary-exact values: relative path y = 0.25 tangent to r = 0.25 at u = 0.5.
    expect(firstContact(-1, 0.25, 2, 0, 0.25)).toBe(0.5);
    expect(firstContact(-1, 0.25 + 2 ** -20, 2, 0, 0.25)).toBe(-1);
    // Contact exactly at the end of the interval, and overlap at the start.
    expect(firstContact(-1, 0, 0.75, 0, 0.25)).toBe(1);
    expect(firstContact(0.1, 0, 5, 0, 0.25)).toBe(0);
    // Moving away never contacts.
    expect(firstContact(1, 0, 1, 0, 0.25)).toBe(-1);
  });
});
