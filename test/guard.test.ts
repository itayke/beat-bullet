import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sim-path code must stay deterministic: no wall clock, no Math.random, no engine-specific transcendentals.
const SIM_DIRS = ['src/sim', 'src/creature'];
const EXCLUDE = ['src/creature/gen']; // vendored lab code follows the lab's own rules
const FORBIDDEN = [/Math\.random/, /\bDate\b/, /\bperformance\b/, /Math\.(sin|cos|tan|atan|atan2|exp|log|pow|hypot)\b/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (EXCLUDE.includes(p)) return [];
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('determinism guard', () => {
  for (const f of SIM_DIRS.flatMap(files)) {
    it(`${f} has no forbidden calls`, () => {
      const src = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      for (const re of FORBIDDEN) expect(src, `${re} in ${f}`).not.toMatch(re);
    });
  }

  it('sim does not import DOM, Pixi or game code', () => {
    for (const f of files('src/sim')) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/from ['"](pixi\.js|\.\.\/game)/);
    }
  });
});

describe('params file shape', () => {
  it('every value line is `key: literal, // comment` inside a group', () => {
    const lines = readFileSync('src/params.ts', 'utf8').split('\n');
    const start = lines.findIndex((l) => l.startsWith('export const P = {'));
    const end = lines.findIndex((l, i) => i > start && l === '};');
    for (const l of lines.slice(start + 1, end)) {
      if (/^ {2}\w+: \{$/.test(l) || /^ {2}\},$/.test(l)) continue;
      expect(l, l).toMatch(/^ {4}\w+: (-?\d+(\.\d+)?|0x[0-9a-f]+|true|false), \/\/ .+$/);
    }
  });
});
