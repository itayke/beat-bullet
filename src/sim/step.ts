// One beat of simulation. Pure: no input is mutated, identical input gives identical output.
// Within a beat everything the player can touch moves linearly in f; the eased crawl is a render-time warp.
import type { CreatureRig } from '../creature/rig';
import type { Params } from '../params';
import { clamp, dcos, DEG, dsin, len, type Circle, type Vec2 } from './dmath';
import { closestApproach, firstContact } from './collide';
import { volleysAt } from './emit';
import { stream } from './prng';
import { SIM_VERSION, type Bullet, type BulletPath, type Plan, type Shot, type SimEvent, type SimState } from './state';

/** Everything that happens during one beat, enough to render any fraction f of it. */
export interface BeatTrace {
  beat: number;
  playerFrom: Vec2;
  playerTo: Vec2;
  tilt: number; // aim tilt, radians, positive = right
  bullets: { id: number; from: Vec2; vel: Vec2; r: number; endF: number; fresh: boolean }[]; // endF < 1: removed then
  shots: { id: number; from: Vec2; vel: Vec2; endF: number }[];
  events: SimEvent[];
}

export interface Frame {
  beat: number;
  f: number;
  t: number; // creature time in beats
  player: Vec2;
  tilt: number;
  bullets: { id: number; pos: Vec2; r: number }[];
  shots: { id: number; pos: Vec2 }[];
  events: SimEvent[]; // events that have happened by f
}

const EVENT_ORDER: Record<SimEvent['kind'], number> = {
  volley: 0, fire: 1, graze: 2, hit: 3, shotBlocked: 4, shotHitWeak: 5, weakDestroyed: 6, win: 7, lose: 8,
};

function eventId(e: SimEvent): number {
  switch (e.kind) {
    case 'volley': return e.gun;
    case 'fire': return e.shotId;
    case 'graze': case 'hit': return e.bulletId;
    case 'shotBlocked': case 'shotHitWeak': return e.shotId;
    case 'weakDestroyed': return e.weakId;
    default: return 0;
  }
}

function sortEvents(events: SimEvent[]): SimEvent[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.f - b.e.f || EVENT_ORDER[a.e.kind] - EVENT_ORDER[b.e.kind]
      || eventId(a.e) - eventId(b.e) || a.i - b.i)
    .map((x) => x.e);
}

export function initState(seed: number, rig: CreatureRig, p: Params): SimState {
  return {
    version: SIM_VERSION,
    seed: seed >>> 0,
    beat: 0,
    player: { x: p.player.startX, y: p.player.startY },
    lastMove: { x: 0, y: 0 },
    energy: p.energy.start,
    bullets: [],
    shots: [],
    weak: rig.weakPointsAt(0).map((w) => ({ id: w.id, hp: p.weak.hp })),
    nextId: 1,
    rng: stream(seed >>> 0, 'sim'),
    status: 'playing',
  };
}

/** Clamp a desired target to the reach circle around the ship, then to the ship's allowed area. */
export function clampTarget(from: Vec2, target: Vec2, p: Params): Vec2 {
  let dx = target.x - from.x;
  let dy = target.y - from.y;
  const d = len(dx, dy);
  if (d > p.player.reach) {
    dx = (dx / d) * p.player.reach;
    dy = (dy / d) * p.player.reach;
  }
  const hw = p.field.width / 2 - p.field.playerMargin;
  const hh = p.field.height / 2 - p.field.playerMargin;
  const top = Math.max(-hh, p.field.playerTopY);
  return { x: clamp(from.x + dx, -hw, hw), y: clamp(from.y + dy, top, hh) };
}

/** Aim tilt from planned horizontal movement (desktop fallback for gyro). */
export function tiltFor(moveX: number, p: Params): number {
  return clamp(moveX / p.player.reach, -1, 1) * p.player.maxTiltDeg * DEG;
}

function inBounds(pos: Vec2, p: Params): boolean {
  const hw = p.field.width / 2 + p.field.despawnMargin;
  const hh = p.field.height / 2 + p.field.despawnMargin;
  return pos.x >= -hw && pos.x <= hw && pos.y >= -hh && pos.y <= hh;
}

function staticTrace(s: SimState): BeatTrace {
  return {
    beat: s.beat,
    playerFrom: s.player,
    playerTo: s.player,
    tilt: 0,
    bullets: s.bullets.map((b) => ({ id: b.id, from: b.pos, vel: { x: 0, y: 0 }, r: b.r, endF: 1, fresh: false })),
    shots: s.shots.map((sh) => ({ id: sh.id, from: sh.pos, vel: { x: 0, y: 0 }, endF: 1 })),
    events: [],
  };
}

interface ShotContact { f: number; weakId: number; pos: Vec2 } // weakId -1 = hull

/** Earliest creature contact of one shot during the beat, tested over fixed substeps. */
function shotContact(
  from: Vec2, vel: Vec2, hullAt: Circle[][], weakAt: Circle[][], weakIds: number[], p: Params,
): ShotContact | null {
  const n = p.shots.substeps;
  for (let k = 0; k < n; k++) {
    const fa = k / n;
    const fb = (k + 1) / n;
    const ax = from.x + vel.x * fa;
    const ay = from.y + vel.y * fa;
    const bx = from.x + vel.x * fb;
    const by = from.y + vel.y * fb;
    let best: ShotContact | null = null;
    const test = (c0: Circle, c1: Circle, weakId: number) => {
      const d0x = ax - c0.x;
      const d0y = ay - c0.y;
      const u = firstContact(d0x, d0y, bx - c1.x - d0x, by - c1.y - d0y, c0.r + p.shots.r);
      if (u < 0) return;
      const f = fa + (fb - fa) * u;
      // Earliest wins; on a tie the weak point wins over the hull.
      if (!best || f < best.f || (f === best.f && best.weakId < 0 && weakId >= 0)) {
        best = { f, weakId, pos: { x: from.x + vel.x * f, y: from.y + vel.y * f } };
      }
    };
    weakAt[k].forEach((c, i) => test(c, weakAt[k + 1][i], weakIds[i]));
    hullAt[k].forEach((c, i) => test(c, hullAt[k + 1][i], -1));
    if (best) return best;
  }
  return null;
}

/** Resolve one beat: next state, ordered events, and the trace used by sample() and the renderer. */
export function resolve(s: SimState, plan: Plan, rig: CreatureRig, p: Params): { next: SimState; events: SimEvent[]; trace: BeatTrace } {
  if (s.status !== 'playing') return { next: s, events: [], trace: staticTrace(s) };

  const from = s.player;
  const to = clampTarget(from, plan.target, p);
  const move = { x: to.x - from.x, y: to.y - from.y };
  const tilt = tiltFor(move.x, p);
  const events: SimEvent[] = [];
  let nextId = s.nextId;

  // Volleys on this beat leave from the guns' current poses.
  const bullets: (Bullet & { fresh: boolean })[] = s.bullets.map((b) => ({ ...b, fresh: false }));
  for (const v of volleysAt(rig, s.beat, from, p)) {
    const ids: number[] = [];
    for (const sp of v.bullets) {
      const id = nextId++;
      ids.push(id);
      bullets.push({ id, pos: sp.pos, vel: sp.vel, r: p.enemy.bulletR, grazed: false, fresh: true });
    }
    events.push({ kind: 'volley', f: 0, gun: v.gun, bulletIds: ids });
  }

  // Opt-in shot, fired upward from the ship on the beat, tilted by horizontal movement.
  const shots: Shot[] = s.shots.map((sh) => ({ ...sh }));
  let fireCost = 0;
  if (plan.fire && (p.energy.shotCanKill || s.energy - p.energy.shotCost > 0)) {
    const id = nextId++;
    shots.push({ id, pos: { x: from.x, y: from.y }, vel: { x: dsin(tilt) * p.shots.speed, y: -dcos(tilt) * p.shots.speed } });
    events.push({ kind: 'fire', f: 0, shotId: id });
    fireCost = p.energy.shotCost;
  }

  // Enemy bullets vs the ship: exact swept test of two linear motions.
  const bulletEnd = new Map<number, number>();
  const grazedNow = new Set<number>();
  for (const b of bullets) {
    const d0x = b.pos.x - from.x;
    const d0y = b.pos.y - from.y;
    const dvx = b.vel.x - move.x;
    const dvy = b.vel.y - move.y;
    const u = firstContact(d0x, d0y, dvx, dvy, p.player.hitR + b.r);
    if (u >= 0) {
      bulletEnd.set(b.id, u);
      events.push({ kind: 'hit', f: u, bulletId: b.id, pos: { x: b.pos.x + b.vel.x * u, y: b.pos.y + b.vel.y * u } });
      continue;
    }
    if (b.grazed) continue;
    const ca = closestApproach(d0x, d0y, dvx, dvy);
    const gr = p.player.grazeR + b.r;
    if (ca.dist2 <= gr * gr) {
      grazedNow.add(b.id);
      events.push({ kind: 'graze', f: ca.u, bulletId: b.id, pos: { x: b.pos.x + b.vel.x * ca.u, y: b.pos.y + b.vel.y * ca.u } });
    }
  }

  // Player shots vs weak points and hull, sampled at fixed substeps (creature motion is non-linear).
  const alive = new Set(s.weak.filter((w) => w.hp > 0).map((w) => w.id));
  const n = p.shots.substeps;
  const hullAt: Circle[][] = [];
  const weakAt: Circle[][] = [];
  let weakIds: number[] = [];
  for (let k = 0; k <= n; k++) {
    const t = s.beat + k / n;
    hullAt.push(p.shots.hullBlocks ? rig.hullAt(t) : []);
    const wps = rig.weakPointsAt(t).filter((w) => alive.has(w.id));
    weakIds = wps.map((w) => w.id);
    weakAt.push(wps.map((w) => ({ x: w.pos.x, y: w.pos.y, r: w.r })));
  }
  const shotEnd = new Map<number, number>();
  for (const sh of shots) {
    const c = shotContact(sh.pos, sh.vel, hullAt, weakAt, weakIds, p);
    if (!c) continue;
    shotEnd.set(sh.id, c.f);
    if (c.weakId < 0) events.push({ kind: 'shotBlocked', f: c.f, shotId: sh.id, pos: c.pos });
    else events.push({ kind: 'shotHitWeak', f: c.f, shotId: sh.id, weakId: c.weakId, pos: c.pos });
  }

  // Apply energy and damage in time order. A hit on a weak point already destroyed this beat is a no-op.
  let energy = s.energy - fireCost;
  const hp = new Map(s.weak.map((w) => [w.id, w.hp]));
  const sorted = sortEvents(events);
  const out: SimEvent[] = [];
  for (const e of sorted) {
    if (e.kind === 'graze') {
      if (energy < p.energy.grazeCap) energy = Math.min(energy + p.energy.grazeGain, p.energy.grazeCap);
    } else if (e.kind === 'hit') {
      energy -= p.energy.hitCost;
    } else if (e.kind === 'shotHitWeak') {
      const h = hp.get(e.weakId)!;
      if (h <= 0) continue;
      hp.set(e.weakId, h - p.shots.damage);
      if (h - p.shots.damage <= 0) {
        out.push(e);
        out.push({ kind: 'weakDestroyed', f: e.f, weakId: e.weakId });
        continue;
      }
    }
    out.push(e);
  }
  energy = Math.min(energy, p.energy.max);

  const weak = s.weak.map((w) => ({ id: w.id, hp: Math.max(0, hp.get(w.id)!) }));
  let status: SimState['status'] = 'playing';
  if (energy <= 0) {
    status = 'lost';
    out.push({ kind: 'lose', f: 1 });
  } else if (weak.every((w) => w.hp <= 0)) {
    status = 'won';
    out.push({ kind: 'win', f: 1 });
  }

  const nextBullets: Bullet[] = [];
  for (const b of bullets) {
    if (bulletEnd.has(b.id)) continue;
    const pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
    if (!inBounds(pos, p)) continue;
    nextBullets.push({ id: b.id, pos, vel: b.vel, r: b.r, grazed: b.grazed || grazedNow.has(b.id) });
  }
  const nextShots: Shot[] = [];
  for (const sh of shots) {
    if (shotEnd.has(sh.id)) continue;
    const pos = { x: sh.pos.x + sh.vel.x, y: sh.pos.y + sh.vel.y };
    if (inBounds(pos, p)) nextShots.push({ id: sh.id, pos, vel: sh.vel });
  }

  const next: SimState = {
    version: s.version,
    seed: s.seed,
    beat: s.beat + 1,
    player: to,
    lastMove: move,
    energy,
    bullets: nextBullets,
    shots: nextShots,
    weak,
    nextId,
    rng: s.rng,
    status,
  };

  const trace: BeatTrace = {
    beat: s.beat,
    playerFrom: from,
    playerTo: to,
    tilt,
    bullets: bullets.map((b) => ({ id: b.id, from: b.pos, vel: b.vel, r: b.r, endF: bulletEnd.get(b.id) ?? 1, fresh: b.fresh })),
    shots: shots.map((sh) => ({ id: sh.id, from: sh.pos, vel: sh.vel, endF: shotEnd.get(sh.id) ?? 1 })),
    events: out,
  };
  return { next, events: out, trace };
}

export function step(s: SimState, plan: Plan, rig: CreatureRig, p: Params): { next: SimState; events: SimEvent[] } {
  const r = resolve(s, plan, rig, p);
  return { next: r.next, events: r.events };
}

/** Scene at fraction f of a resolved beat. Objects removed at endF are gone once f > endF. */
export function sampleTrace(tr: BeatTrace, f: number): Frame {
  return {
    beat: tr.beat,
    f,
    t: tr.beat + f,
    player: { x: tr.playerFrom.x + (tr.playerTo.x - tr.playerFrom.x) * f, y: tr.playerFrom.y + (tr.playerTo.y - tr.playerFrom.y) * f },
    tilt: tr.tilt,
    bullets: tr.bullets.filter((b) => f <= b.endF)
      .map((b) => ({ id: b.id, pos: { x: b.from.x + b.vel.x * f, y: b.from.y + b.vel.y * f }, r: b.r })),
    shots: tr.shots.filter((sh) => f <= sh.endF)
      .map((sh) => ({ id: sh.id, pos: { x: sh.from.x + sh.vel.x * f, y: sh.from.y + sh.vel.y * f } })),
    events: tr.events.filter((e) => e.f <= f),
  };
}

export function sample(s: SimState, plan: Plan, rig: CreatureRig, p: Params, f: number): Frame {
  return sampleTrace(resolve(s, plan, rig, p).trace, f);
}

/** Next-beat paths for every enemy bullet, including the volley about to fire. Independent of the plan. */
export function preview(s: SimState, rig: CreatureRig, p: Params): BulletPath[] {
  if (s.status !== 'playing') return []; // nothing moves after the fight ends
  const out: BulletPath[] = s.bullets.map((b) => ({
    id: b.id, from: b.pos, to: { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y }, r: b.r, fresh: false,
  }));
  let id = s.nextId;
  for (const v of volleysAt(rig, s.beat, s.player, p)) {
    for (const sp of v.bullets) {
      out.push({ id: id++, from: sp.pos, to: { x: sp.pos.x + sp.vel.x, y: sp.pos.y + sp.vel.y }, r: p.enemy.bulletR, fresh: true });
    }
  }
  return out;
}

/** Danger (hit) and graze marks for a candidate plan: a dry run of the real step, so they always agree. */
export function dangerMarks(s: SimState, plan: Plan, rig: CreatureRig, p: Params) {
  const ev = resolve(s, plan, rig, p).events;
  return {
    hits: ev.filter((e): e is Extract<SimEvent, { kind: 'hit' }> => e.kind === 'hit'),
    grazes: ev.filter((e): e is Extract<SimEvent, { kind: 'graze' }> => e.kind === 'graze'),
  };
}
