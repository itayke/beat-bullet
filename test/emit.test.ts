import { describe, expect, it } from 'vitest';
import type { AimMode, EmitPattern, EmitterSpec } from '../src/creature/rig';
import { firesOn, volleyBullets } from '../src/sim/emit';
import { datan2, len } from '../src/sim/dmath';
import { params } from './helpers';

const PATTERNS: EmitPattern[] = ['aimed', 'fan', 'ring', 'stream'];
const AIMS: AimMode[] = ['player', 'fixed', 'spin'];

describe('emitter timing', () => {
  const p = params();
  const bars = 4;
  const beats = bars * p.tempo.beatsPerBar;

  for (const pattern of PATTERNS) {
    for (const aim of AIMS) {
      for (const subdiv of [1, 2, 4]) {
        it(`${pattern}/${aim} subdiv ${subdiv}: volleys land on the right beats over ${bars} bars`, () => {
          const period = p.tempo.beatsPerBar / subdiv;
          for (let offset = 0; offset < p.tempo.beatsPerBar; offset++) {
            const e: EmitterSpec = { pattern, aim, count: 4, spread: 1, subdiv, offset };
            const fired = [];
            for (let b = 0; b < beats; b++) if (firesOn(e, b, p)) fired.push(b);
            expect(fired).toHaveLength(bars * subdiv);
            for (const b of fired) expect((b - offset) % period === 0 || (b - offset + p.tempo.beatsPerBar) % period === 0).toBe(true);
            expect(fired[0]).toBe(offset % period);
          }
        });
      }
    }
  }

  it('negative and large offsets wrap modulo the period', () => {
    const e: EmitterSpec = { pattern: 'ring', aim: 'fixed', count: 4, spread: 0, subdiv: 2, offset: -1 };
    expect([0, 1, 2, 3, 4, 5].filter((b) => firesOn(e, b, p))).toEqual([1, 3, 5]);
    expect([0, 1, 2, 3].filter((b) => firesOn({ ...e, offset: 7 }, b, p))).toEqual([1, 3]);
  });
});

describe('emitter shapes', () => {
  const p = params();
  const pose = { pos: { x: 0, y: 0 }, angle: 0 };
  const player = { x: 0, y: 1 };
  const speed = p.enemy.bulletSpeed * p.enemy.speedScale;

  it('aim player points at the ship; fixed points along the barrel', () => {
    const [b] = volleyBullets({ pattern: 'aimed', aim: 'player', count: 1, spread: 0, subdiv: 1, offset: 0 }, pose, 0, player, p);
    expect(datan2(b.vel.y, b.vel.x)).toBeCloseTo(Math.PI / 2, 9);
    const [c] = volleyBullets({ pattern: 'aimed', aim: 'fixed', count: 1, spread: 0, subdiv: 1, offset: 0 }, pose, 0, player, p);
    expect(datan2(c.vel.y, c.vel.x)).toBeCloseTo(0, 9);
  });

  it('spin rotates by spinStep per volley', () => {
    const e: EmitterSpec = { pattern: 'aimed', aim: 'spin', count: 1, spread: 0, subdiv: 4, offset: 0 };
    const a0 = volleyBullets(e, pose, 0, player, p)[0].vel;
    const a1 = volleyBullets(e, pose, 1, player, p)[0].vel;
    expect(datan2(a1.y, a1.x) - datan2(a0.y, a0.x)).toBeCloseTo((p.enemy.spinStepDeg * Math.PI) / 180, 9);
  });

  it('ring spreads evenly, fan spans spread, aimed/stream share a line', () => {
    const ring = volleyBullets({ pattern: 'ring', aim: 'fixed', count: 8, spread: 0, subdiv: 1, offset: 0 }, pose, 0, player, p);
    expect(ring).toHaveLength(8);
    ring.forEach((b) => expect(len(b.vel.x, b.vel.y)).toBeCloseTo(speed, 9));
    const fan = volleyBullets({ pattern: 'fan', aim: 'fixed', count: 3, spread: 1, subdiv: 1, offset: 0 }, pose, 0, player, p);
    expect(datan2(fan[0].vel.y, fan[0].vel.x)).toBeCloseTo(-0.5, 9);
    expect(datan2(fan[2].vel.y, fan[2].vel.x)).toBeCloseTo(0.5, 9);
    for (const pattern of ['aimed', 'stream'] as const) {
      const line = volleyBullets({ pattern, aim: 'fixed', count: 4, spread: 0, subdiv: 1, offset: 0 }, pose, 0, player, p);
      line.forEach((b) => expect(b.vel.y).toBeCloseTo(0, 12));
      for (let i = 1; i < line.length; i++) expect(line[i].vel.x).toBeLessThan(line[i - 1].vel.x);
    }
  });
});
