// Canonical state hash: key-sorted JSON (JS number formatting is engine-independent), two FNV-1a passes.
import { hashStr } from './prng';

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/** 64-bit hex hash of any plain-data value. */
export function hashState(v: unknown): string {
  const s = canonical(v);
  const a = hashStr(s);
  const b = hashStr(s, 0x9747b28c);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
