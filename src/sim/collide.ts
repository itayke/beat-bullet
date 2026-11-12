// Swept tests between linearly moving circles over a normalized interval u in [0, 1].
// d0 = relative position at u = 0, dv = change in relative position over the interval.

/** Closest approach of two linear motions: squared distance and when it happens. */
export function closestApproach(d0x: number, d0y: number, dvx: number, dvy: number): { u: number; dist2: number } {
  const a = dvx * dvx + dvy * dvy;
  let u = a === 0 ? 0 : -(d0x * dvx + d0y * dvy) / a;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const x = d0x + dvx * u;
  const y = d0y + dvy * u;
  return { u, dist2: x * x + y * y };
}

/** First u in [0, 1] where the distance is <= r (touching counts), or -1 if never. */
export function firstContact(d0x: number, d0y: number, dvx: number, dvy: number, r: number): number {
  const c = d0x * d0x + d0y * d0y - r * r;
  if (c <= 0) return 0;
  const a = dvx * dvx + dvy * dvy;
  if (a === 0) return -1;
  const b = 2 * (d0x * dvx + d0y * dvy);
  if (b >= 0) return -1; // moving apart or tangentially away
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const u = (-b - Math.sqrt(disc)) / (2 * a);
  return u <= 1 ? u : -1;
}
