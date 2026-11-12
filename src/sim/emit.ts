// Volley timing and bullet spawning. Volleys fire only on whole beats, from the gun's pose on that beat.
import type { CreatureRig, EmitterSpec, GunPose } from '../creature/rig';
import type { Params } from '../params';
import { datan2, dcos, dsin, DEG, TAU, type Vec2 } from './dmath';

/** Beats between volleys for an emitter. */
export function volleyPeriod(e: EmitterSpec, p: Params): number {
  return p.tempo.beatsPerBar / e.subdiv;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** True when the emitter fires on this integer beat. */
export function firesOn(e: EmitterSpec, beat: number, p: Params): boolean {
  const period = volleyPeriod(e, p);
  return mod(beat - e.offset, period) === 0;
}

/** Index of the volley fired on this beat (drives spin aim). */
export function volleyIndex(e: EmitterSpec, beat: number, p: Params): number {
  return Math.floor((beat - mod(e.offset, volleyPeriod(e, p))) / volleyPeriod(e, p));
}

export interface SpawnSpec { pos: Vec2; vel: Vec2 }

/** Bullets of one volley: muzzle position and per-beat velocity. */
export function volleyBullets(
  e: EmitterSpec, pose: GunPose, beat: number, playerPos: Vec2, p: Params,
): SpawnSpec[] {
  const speed = p.enemy.bulletSpeed * p.enemy.speedScale;
  const count = Math.max(1, Math.round(e.count * p.enemy.densityScale));

  let base = pose.angle;
  if (e.aim === 'player') base = datan2(playerPos.y - pose.pos.y, playerPos.x - pose.pos.x);
  else if (e.aim === 'spin') base = pose.angle + volleyIndex(e, beat, p) * p.enemy.spinStepDeg * DEG;

  const out: SpawnSpec[] = [];
  for (let i = 0; i < count; i++) {
    let angle = base;
    let s = speed;
    switch (e.pattern) {
      case 'aimed': // tight burst: same line, slightly slower bullets behind the lead
        s = speed * (1 - i * p.enemy.burstSpeedStep);
        break;
      case 'stream': // long line: speeds spread evenly down to streamMinSpeed
        s = count === 1 ? speed : speed * (1 - (i / (count - 1)) * (1 - p.enemy.streamMinSpeed));
        break;
      case 'fan':
        angle = count === 1 ? base : base + e.spread * (i / (count - 1) - 0.5);
        break;
      case 'ring':
        angle = base + (TAU * i) / count;
        break;
    }
    out.push({
      pos: { x: pose.pos.x, y: pose.pos.y },
      vel: { x: dcos(angle) * s, y: dsin(angle) * s },
    });
  }
  return out;
}

/** All volleys fired on this beat, in gun order. */
export function volleysAt(rig: CreatureRig, beat: number, playerPos: Vec2, p: Params) {
  const out: { gun: number; bullets: SpawnSpec[] }[] = [];
  rig.gunsAt(beat).forEach((g, gun) => {
    if (firesOn(g.emitter, beat, p)) out.push({ gun, bullets: volleyBullets(g.emitter, g.pose, beat, playerPos, p) });
  });
  return out;
}
