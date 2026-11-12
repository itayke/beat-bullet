// Seeded integer hashing and PRNG streams. All state is a plain uint32 so it can live inside SimState.
// API mirrors the lab's stream(hash2(seed, i), 'name'); swap for the lab's prng.ts once vendored.

/** 32-bit integer mix (lowbias32). */
export function mix32(x: number): number {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function hash2(a: number, b: number): number {
  return mix32((mix32(a >>> 0) ^ Math.imul(b >>> 0, 0x9e3779b9)) >>> 0);
}

/** FNV-1a over a string, for stream names and state hashing. */
export function hashStr(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

/** Initial state of a named stream, so adding a stream never shifts another's draws. */
export function stream(seed: number, name: string): number {
  return hash2(seed, hashStr(name));
}

/** One draw: returns a float in [0, 1) and the next stream state (mulberry32 step). */
export function next(state: number): [value: number, state: number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
