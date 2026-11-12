// Hand-authored stand-in creature until the lab's generator is vendored (see VENDORED.md).
// STUB is content, like a genome: local creature units (body fits ~2 x 2), y down, time in beats.
// World placement and size come from params (creature.anchor*, creature.scale).
import type { Params } from '../params';
import { dcos, DEG, dsin, PI, TAU, type Circle, type Vec2 } from '../sim/dmath';
import type { CreatureRig, EmitterSpec, GunPose, WeakPoint } from './rig';

const STUB = {
  sway: { amp: 0.35, periodBeats: 16 }, // whole-body side-to-side
  bob: { amp: 0.06, periodBeats: 6 }, // whole-body up/down
  core: { r: 0.42 },
  shoulders: { x: 0.55, y: -0.1, r: 0.24 },
  arm: {
    baseDeg: 60, // arm direction from the shoulder, mirrored for the left arm (0 = right, 90 = down)
    swingDeg: 28, // swing amplitude
    periodBeats: 8,
    segments: [ // distance from shoulder and radius, root to tip
      { d: 0.3, r: 0.14 },
      { d: 0.5, r: 0.11 },
      { d: 0.66, r: 0.09 },
    ],
    gunDist: 0.78, // muzzle distance from shoulder
  },
  weak: { id: 0, x: 0, y: 0.5, r: 0.09 },
  lid: { orbit: 0.56, r: 0.15, periodBeats: 12, phaseDeg: -90 }, // orbiting plate that periodically covers the weak point
  guns: [
    { arm: -1, emitter: { pattern: 'fan', aim: 'player', count: 5, spread: 50 * DEG, subdiv: 2, offset: 0 } },
    { arm: 1, emitter: { pattern: 'ring', aim: 'spin', count: 10, spread: 0, subdiv: 2, offset: 1 } },
  ] as { arm: number; emitter: EmitterSpec }[],
};

interface Pose { body: Vec2; arms: { side: number; shoulder: Vec2; angle: number }[]; lid: Vec2 }

function poseAt(t: number): Pose {
  const body = {
    x: STUB.sway.amp * dsin((TAU * t) / STUB.sway.periodBeats),
    y: STUB.bob.amp * dsin((TAU * t) / STUB.bob.periodBeats),
  };
  const swing = STUB.arm.swingDeg * DEG * dsin((TAU * t) / STUB.arm.periodBeats);
  const arms = [-1, 1].map((side) => {
    // Right arm angle = base + swing; the left arm mirrors it across the vertical axis.
    const right = STUB.arm.baseDeg * DEG + swing;
    const angle = side > 0 ? right : PI - right;
    return { side, shoulder: { x: body.x + side * STUB.shoulders.x, y: body.y + STUB.shoulders.y }, angle };
  });
  const la = (TAU * t) / STUB.lid.periodBeats + STUB.lid.phaseDeg * DEG;
  const lid = { x: body.x + STUB.lid.orbit * dcos(la), y: body.y + STUB.lid.orbit * dsin(la) };
  return { body, arms, lid };
}

export function makeStubRig(p: Params): CreatureRig {
  const s = p.creature.scale;
  const toWorld = (v: Vec2, t: number): Vec2 => ({
    x: p.creature.anchorX + v.x * s,
    y: p.creature.anchorY + p.creature.driftPerBeat * t + v.y * s,
  });
  const along = (o: Vec2, angle: number, d: number): Vec2 => ({ x: o.x + dcos(angle) * d, y: o.y + dsin(angle) * d });
  const circle = (v: Vec2, r: number, t: number): Circle => {
    const w = toWorld(v, t);
    return { x: w.x, y: w.y, r: r * s };
  };

  return {
    id: 'stub',
    gunsAt(beat) {
      const pose = poseAt(beat);
      return STUB.guns.map((g) => {
        const arm = pose.arms.find((a) => a.side === g.arm)!;
        const gp: GunPose = { pos: toWorld(along(arm.shoulder, arm.angle, STUB.arm.gunDist), beat), angle: arm.angle };
        return { pose: gp, emitter: g.emitter };
      });
    },
    weakPointsAt(t): WeakPoint[] {
      const pose = poseAt(t);
      const w = STUB.weak;
      return [{ id: w.id, pos: toWorld({ x: pose.body.x + w.x, y: pose.body.y + w.y }, t), r: w.r * s }];
    },
    hullAt(t) {
      const pose = poseAt(t);
      const out: Circle[] = [circle(pose.body, STUB.core.r, t)];
      for (const a of pose.arms) {
        out.push(circle(a.shoulder, STUB.shoulders.r, t));
        for (const seg of STUB.arm.segments) out.push(circle(along(a.shoulder, a.angle, seg.d), seg.r, t));
      }
      out.push(circle(pose.lid, STUB.lid.r, t));
      return out;
    },
  };
}
