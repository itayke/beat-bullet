// The only creature API the sim may import. Rendering lives in the game layer, never here.
import type { Circle, Vec2 } from '../sim/dmath';

export type { Circle, Vec2 };

export type EmitPattern = 'aimed' | 'fan' | 'ring' | 'stream';
export type AimMode = 'player' | 'fixed' | 'spin';

export interface EmitterSpec {
  pattern: EmitPattern; // aimed = tight burst along a line, fan = arc, ring = full circle, stream = long line
  aim: AimMode; // player = at the ship, fixed = along the barrel, spin = barrel + rotation per volley
  count: number; // bullets per volley before densityScale
  spread: number; // fan arc, radians (unused by other patterns)
  subdiv: number; // volleys per bar: 1, 2 or 4
  offset: number; // beat within the bar, taken modulo the volley period
}

export interface GunPose { pos: Vec2; angle: number } // world units, radians (0 = +x, PI/2 = down-screen)

export interface WeakPoint { id: number; pos: Vec2; r: number }

export interface CreatureRig {
  readonly id: string; // genome hash or 'stub'
  /** Gun poses and emitters. The sim calls this with integer beats; the renderer may pass fractional t. */
  gunsAt(beat: number): { pose: GunPose; emitter: EmitterSpec }[];
  /** Weak points at t beats (fractional allowed). Same ids and order at every t. */
  weakPointsAt(t: number): WeakPoint[];
  /** Coarse shot blockers at t beats. Same count and order at every t. */
  hullAt(t: number): Circle[];
}
