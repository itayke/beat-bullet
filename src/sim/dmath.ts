// Deterministic math: only + - * / sqrt and exact rounding, so results are bit-identical across JS engines.
// Polynomial approximations replace Math.sin/cos/atan2 (their precision is implementation-defined).

export interface Vec2 { x: number; y: number }
export interface Circle { x: number; y: number; r: number }

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;
export const DEG = PI / 180;

const QUARTER_PI = 0.7853981633974483;
const TAN_PI_8 = 0.41421356237309503;

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(a: number): number {
  return a - TAU * Math.round(a / TAU);
}

/** sin via range reduction to [-PI/2, PI/2] and a degree-15 Taylor polynomial (error < 1e-9). */
export function dsin(a: number): number {
  let x = wrapAngle(a);
  if (x > HALF_PI) x = PI - x;
  else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  // Horner form of x - x^3/3! + x^5/5! - ... + x^13/13! - x^15/15!
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880
    + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))));
}

export function dcos(a: number): number {
  return dsin(a + HALF_PI);
}

/** atan for |x| <= tan(PI/8), odd Taylor series to x^21 (error < 1e-10). */
function atanSmall(x: number): number {
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 3 + x2 * (1 / 5 + x2 * (-1 / 7 + x2 * (1 / 9 + x2 * (-1 / 11
    + x2 * (1 / 13 + x2 * (-1 / 15 + x2 * (1 / 17 + x2 * (-1 / 19 + x2 * (1 / 21)))))))))));
}

/** atan for x in [0, 1], folded around tan(PI/4) into the small range. */
function atanUnit(x: number): number {
  if (x <= TAN_PI_8) return atanSmall(x);
  return QUARTER_PI + atanSmall((x - 1) / (x + 1));
}

export function datan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  // Angle within the first octant pair, then mirrored into the right quadrant.
  let a = ay <= ax ? atanUnit(ay / ax) : HALF_PI - atanUnit(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export function vlerp(a: Vec2, b: Vec2, f: number): Vec2 {
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
