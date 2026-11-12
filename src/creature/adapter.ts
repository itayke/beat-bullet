// Picks a creature rig by name. Lab genomes plug in here once src/creature/gen/ is vendored.
import type { Params } from '../params';
import type { CreatureRig } from './rig';
import { makeStubRig } from './stub';

export const CREATURE_NAMES = ['stub'] as const;

/** Returns the rig for a name, falling back to the stub (with a reason) for unknown names. */
export function creatureByName(name: string, p: Params): { rig: CreatureRig; warning?: string } {
  if (name === 'stub') return { rig: makeStubRig(p) };
  return { rig: makeStubRig(p), warning: `creature '${name}' unavailable (lab generator not vendored yet); using stub` };
}
