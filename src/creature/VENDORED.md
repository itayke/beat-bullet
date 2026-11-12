# Vendored lab generator

Status: **not vendored yet.** The `beat-bullet-lab` source (`src/gen/`, `src/render/`) wasn't available when M1 started, so the game runs against a hand-authored stub rig in `stub.ts`.

When the source is available:
1. Copy the lab's `src/gen/` here as `src/creature/gen/` **unchanged** (no refactors, so later lab versions drop back in cleanly).
2. Record the lab commit hash below.
3. Implement a `CreatureRig` over `grow(genome, { t })` in `adapter.ts` (confirm the unit of `t` first) and register seed-genome names in `CREATURE_NAMES`.
4. Replace `sim/prng.ts` and `sim/dmath.ts` internals with the lab's versions if they differ, then bump `SIM_VERSION`.

Lab commit: _none_
