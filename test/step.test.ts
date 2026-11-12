import { describe, expect, it } from 'vitest';
import { closestApproach, firstContact } from '../src/sim/collide';
import { hashState } from '../src/sim/hash';
import { stream } from '../src/sim/prng';
import { SIM_VERSION, type SimState } from '../src/sim/state';
import { clampTarget, dangerMarks, initState, preview, resolve, sample, step } from '../src/sim/step';
import type { Params } from '../src/params';
import goldenParams from './fixtures/golden-params.json';
import { deepFreeze, params, randomPlan, stubRig } from './helpers';

const SEED = 12345;

/** Scripted run with seeded random plans on frozen params, so tuning params.ts never moves the golden hash. */
function scriptedRun(beats: number) {
  const p = structuredClone(goldenParams) as Params;
  p.energy.hitCost = 1; // keeps the run alive for the whole script
  const rig = stubRig(p);
  let s = initState(SEED, rig, p);
  let rng = stream(SEED, 'test-plans');
  const counts: Record<string, number> = {};
  for (let i = 0; i < beats; i++) {
    let plan;
    [plan, rng] = randomPlan(s, rng, p);
    const r = step(s, plan, rig, p);
    for (const e of r.events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    s = r.next;
  }
  return { s, counts };
}

describe('step', () => {
  it('is pure: frozen input, deep-equal output on repeat', () => {
    const p = deepFreeze(params());
    const rig = stubRig(p);
    let s = initState(SEED, rig, p);
    let rng = stream(SEED, 'purity');
    for (let i = 0; i < 40; i++) {
      deepFreeze(s);
      let plan;
      [plan, rng] = randomPlan(s, rng, p);
      deepFreeze(plan);
      const before = JSON.stringify(s);
      const a = step(s, plan, rig, p);
      const b = step(s, plan, rig, p);
      expect(a).toEqual(b);
      expect(JSON.stringify(s)).toBe(before);
      s = a.next;
    }
  });

  it('golden hash over a scripted 200-beat run (change only with a SIM_VERSION bump)', () => {
    const { s, counts } = scriptedRun(200);
    expect(s.version).toBe(SIM_VERSION);
    expect(s.beat).toBe(200);
    // The script must actually exercise the rules, or the hash proves little.
    for (const k of ['volley', 'fire', 'graze', 'hit', 'shotHitWeak', 'shotBlocked']) expect(counts[k] ?? 0).toBeGreaterThan(0);
    expect({ version: SIM_VERSION, hash: hashState(s) }).toMatchSnapshot();
  });

  it('a game over freezes the state', () => {
    const p = params();
    const rig = stubRig(p);
    const s: SimState = { ...initState(SEED, rig, p), status: 'lost' };
    const r = step(s, { target: { x: 0, y: 0 }, fire: true }, rig, p);
    expect(r.next).toBe(s);
    expect(r.events).toHaveLength(0);
  });

  it('sample at f = 1 matches the next state; f = 0 matches the current one', () => {
    const p = params();
    const rig = stubRig(p);
    let s = initState(SEED, rig, p);
    let rng = stream(SEED, 'sample');
    for (let i = 0; i < 60; i++) {
      let plan;
      [plan, rng] = randomPlan(s, rng, p);
      const { next } = step(s, plan, rig, p);
      const f0 = sample(s, plan, rig, p, 0);
      const f1 = sample(s, plan, rig, p, 1);
      expect(f0.player).toEqual(s.player);
      expect(f1.player).toEqual(next.player);
      const at1 = new Map(f1.bullets.map((b) => [b.id, b.pos]));
      for (const b of next.bullets) expect(at1.get(b.id)).toEqual(b.pos);
      s = next;
    }
  });

  it('preview paths and danger marks agree with step on 1,000 random plans', () => {
    const p = params((q) => { q.energy.hitCost = 1; });
    const rig = stubRig(p);
    let s = initState(SEED, rig, p);
    let rng = stream(SEED, 'preview');
    let hitsSeen = 0;
    for (let i = 0; i < 1000; i++) {
      let plan;
      [plan, rng] = randomPlan(s, rng, p);
      const paths = preview(s, rig, p);
      const { next, events } = step(s, plan, rig, p);

      // Every surviving bullet ends exactly where its preview path ends.
      const ends = new Map(paths.map((b) => [b.id, b.to]));
      for (const b of next.bullets) expect(ends.get(b.id)).toEqual(b.pos);

      // Independent check: recompute hits from the preview paths alone and the planned move.
      const to = clampTarget(s.player, plan.target, p);
      const mx = to.x - s.player.x;
      const my = to.y - s.player.y;
      const expected = paths.filter((b) => firstContact(b.from.x - s.player.x, b.from.y - s.player.y,
        b.to.x - b.from.x - mx, b.to.y - b.from.y - my, p.player.hitR + b.r) >= 0).map((b) => b.id).sort((a, b) => a - b);
      const actual = events.filter((e) => e.kind === 'hit').map((e) => (e as { bulletId: number }).bulletId).sort((a, b) => a - b);
      expect(actual).toEqual(expected);

      const marks = dangerMarks(s, plan, rig, p);
      expect(marks.hits.map((e) => e.bulletId).sort((a, b) => a - b)).toEqual(actual);
      // Graze marks are near-misses of not-yet-grazed bullets.
      const grazed = new Set(s.bullets.filter((b) => b.grazed).map((b) => b.id));
      for (const g of marks.grazes) {
        const b = paths.find((x) => x.id === g.bulletId)!;
        expect(grazed.has(b.id)).toBe(false);
        const ca = closestApproach(b.from.x - s.player.x, b.from.y - s.player.y, b.to.x - b.from.x - mx, b.to.y - b.from.y - my);
        expect(ca.dist2).toBeLessThanOrEqual((p.player.grazeR + b.r) ** 2);
      }

      hitsSeen += actual.length;
      s = next.status === 'playing' ? next : initState(SEED + i, rig, p); // keep sampling after a win
    }
    expect(hitsSeen).toBeGreaterThan(0);
  });

  it('plans are clamped to the reach circle and the ship area', () => {
    const p = params();
    const from = { x: 0, y: 0.5 };
    const t = clampTarget(from, { x: 10, y: 0.5 }, p);
    expect(t.x).toBeCloseTo(p.player.reach, 12);
    const top = clampTarget({ x: 0, y: p.field.playerTopY }, { x: 0, y: -10 }, p);
    expect(top.y).toBe(p.field.playerTopY);
  });

  it('shots cost energy, travel upward and can destroy the weak point', () => {
    const p = params((q) => { q.weak.hp = 1; q.shots.hullBlocks = false; });
    const rig = stubRig(p);
    let s = initState(SEED, rig, p);
    const wp = rig.weakPointsAt(0)[0];
    s = { ...s, player: { x: wp.pos.x, y: s.player.y } };
    let won = false;
    for (let i = 0; i < 12 && !won; i++) {
      const r = resolve(s, { target: s.player, fire: true }, rig, p);
      if (i === 0) {
        expect(r.events.some((e) => e.kind === 'fire')).toBe(true);
        expect(r.trace.shots[0].vel.y).toBeLessThan(0);
      }
      won = r.next.status === 'won';
      s = r.next;
    }
    expect(won).toBe(true);
  });

  it('shotCanKill = false: a shot that would empty the bar does not fire', () => {
    const p = params((q) => { q.energy.start = q.energy.shotCost; });
    const rig = stubRig(p);
    const s = initState(SEED, rig, p);
    const r = resolve(s, { target: s.player, fire: true }, rig, p);
    expect(r.events.some((e) => e.kind === 'fire')).toBe(false);
  });
});
