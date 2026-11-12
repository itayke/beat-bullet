import { describe, expect, it } from 'vitest';
import { datan2, dcos, dsin, wrapAngle } from '../src/sim/dmath';

describe('dmath', () => {
  it('sin/cos match Math within 1e-9 over a wide range', () => {
    for (let a = -50; a <= 50; a += 0.0137) {
      expect(Math.abs(dsin(a) - Math.sin(a))).toBeLessThan(1e-9);
      expect(Math.abs(dcos(a) - Math.cos(a))).toBeLessThan(1e-9);
    }
  });

  it('atan2 matches Math within 1e-9 in every quadrant', () => {
    for (let y = -3; y <= 3; y += 0.071) {
      for (let x = -3; x <= 3; x += 0.073) {
        expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-9);
      }
    }
    expect(datan2(0, 0)).toBe(0);
    expect(datan2(1, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(datan2(0, -1)).toBeCloseTo(Math.PI, 12);
  });

  it('wrapAngle lands in [-PI, PI]', () => {
    for (let a = -100; a < 100; a += 0.37) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThanOrEqual(Math.PI);
    }
  });
});
