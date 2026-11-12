# Beat Bullet — build handoff

For the code agent working in `github.com/itayke/beat-bullet` (empty repo as of 2026-11-12).
Written by Claude from the design sessions, 2026-11-12. Put this file in the repo root and keep it current.

## 0. Current status (keep this section current)

- **M1 "One fight" is playable** against the stub creature. `npm run dev`, `npm test`.
- **Lab source not vendored.** `beat-bullet-lab` wasn't on this machine or reachable on GitHub, so the game runs on `src/creature/stub.ts` behind the `CreatureRig` interface. See `src/creature/VENDORED.md`.
- Open questions and feel notes for Itay: `REPORT.md`.

## 1. What this is

Beat Bullet is a **beat-frozen shmup**. Play freezes every beat. While frozen, the player sees where every bullet will travel during the next beat and plans one move (and optionally one shot). Then the beat plays out. Enemies are **evolved, not authored**: a seeded genetic algorithm grows creatures from a graph genome. That generator exists as a separate lab project and is **parked**. This repo starts the **game**.

Owner: Itay (founder of Untame; senior engineer and game designer). He prefers direct, critical feedback over hedging. See §9 for how he works.

Reference material (read-only for you; ask Itay for access if links don't open):
- Design doc, authoritative for the creature system: https://claude.ai/artifact/VHSkqJcSq9uEkm2KhHdnXx
- Creature Lab (live tool): https://claude.ai/artifact/PFaCWphwdruTgjPDXTgRBF
- Lab source: the `beat-bullet-lab` project (Vite + TS + vitest + git). See §4 on getting it.

## 2. The goal right now: Milestone 1, "One fight"

A playable browser vertical slice: **one creature, one player, one fight**, built on a **pure, deterministic beat-step simulation** that the lab will later reuse for beatability and difficulty checks.

Why this order: shots alone can't tell us whether a pattern is beatable. That depends on the player model (reach per beat, hitbox, preview, playfield). So the simulation *is* the core of the gameplay, and it must be written once and shared by the game and the lab. Gameplay is currently under-defined compared with the creature work. This milestone is how we find out what the numbers should be.

Done means:
1. `npm run dev` opens a fight against one creature. You can win (destroy the weak point) or lose (energy hits 0), then restart.
2. While frozen, you can see next-beat bullet paths and danger marks for your planned move.
3. Every gameplay number lives in `src/params.ts` (see §6).
4. `src/sim/` passes the determinism tests in §7.
5. You write a short report for Itay: what felt off and which numbers he needs to decide (§10).

## 3. Game rules

Status labels matter. **Decided** = Itay agreed. **Proposed** = Claude suggested it and Itay never confirmed: implement it behind a param and flag it. **Open** = nobody has decided: use a param with a placeholder, and don't invent design.

| Area | Rule | Status |
|---|---|---|
| Freeze | Play freezes on each beat. The freeze is timed and tied to the beat, not indefinite. | Decided |
| Freeze length | Planning window measured in beats (2–3 suggested). On timeout, repeat the last move. | Proposed |
| Preview | Show exactly one beat ahead. Multi-beat lookahead is a later upgrade. | Decided |
| Movement | Player picks a destination inside a **reach circle** around the ship. | Decided |
| Crawl | The move covers ~75% of its distance right on the beat, then crawls the last ~25% during the pause. **No ghosts, no replay.** Use one ease-out curve over the whole beat (≈75% of distance in the first ~150 ms), not two linear segments (that causes a visible speed jolt). | Decided (curve shape Proposed) |
| Crawl semantics | The crawl is the tail of the committed move, not extra time. Collision for the whole step is resolved at commit. The next plan starts from where the crawl ends. | Proposed (follows from the decided rule) |
| Danger | Danger marks warn about a planned move that would be hit. They never block it. | Decided |
| Energy | One bar that is also health. Grazing fills it. Shooting and hits drain it. | Decided |
| Energy cap | A cap, so cautious players can't grind grazes up to full. | Proposed |
| Graze | A bullet that passes within the graze ring without hitting. Counts once per bullet. | Once-per-bullet is Proposed |
| Shooting | Opt-in, at most one shot per beat, fired upward. The fire choice carries over between beats. | Decided (carry-over Proposed) |
| Aim | A few degrees of tilt only. Mobile: gyro tilt (**parked**). Desktop/fallback: tilt is coupled to horizontal movement. | Decided (gyro parked) |
| Player shot travel | Shots take a beat or two to arrive, which makes timed weak points a planning problem. | Proposed |
| Layout | Landscape, scrolling upward. Creature at the top, player at the bottom. | Decided |
| Win / lose | Win: all weak points destroyed. Lose: energy ≤ 0. | Proposed |
| Undo | A separate budget, or deferred. | Open → **out of scope** |
| Soundtrack | Procedural techno tied to on-screen risk. | Open → **out of scope** |

### Enemy fire (already defined by the lab's shot mock; reuse it)
- Emitter genes live in the creature genome: `pattern` ∈ aimed (burst along a line) / fan / ring / stream; `aim` ∈ player / fixed (along the barrel) / spin (rotates each volley); plus `count`, `spread`.
- Timing: `subdiv` = volleys per 4-beat bar (1, 2 or 4). `offset` = beat within the bar, modulo the period. Volleys only fire on whole beats.
- Each volley leaves from the gun's **pose on its fire beat** in world space (the creature moves; bullets don't follow it).
- In the lab this was visual only (`src/render/shots.ts`, timing in `src/gen/emit.ts`). In this repo, `emit.ts`'s timing logic becomes real simulation.
- Known issue: seed bosses range from 6 to 96 bullets per bar. Density needs a band later. For M1, just expose a global density/speed scale param.

### Player model (all Proposed; none confirmed by Itay)
In creature units (a boss fills about 2 × 2):
- Playfield ≈ 3.5 × 2 (landscape)
- Reach 0.3 per beat (~12 beats to cross the field)
- Hitbox radius 0.02; graze ring ≈ 0.08
- Bullet speed 0.1–0.4 per beat
- Tempo 100–140 BPM

**⚠ These numbers conflict.** A 2 × 2 boss can't sit above the player in a field 2 units tall. Add a `creatureScale` param (and keep the playfield dimensions as params) instead of silently choosing a fix. Point this out to Itay in your report.

## 4. Creature source (blocker check: do this first)

The game consumes creatures from the lab's generator core: `beat-bullet-lab/src/gen/` (genome, `grow`, `prng`, `emit`, seeds, validity) plus the renderer in `src/render/`. That project was built in a cloud session. **Ask Itay whether he has a local copy before anything else.** The published lab page is a minified bundle, so don't try to reconstruct the source from it.

- **If the source is available:** vendor `src/gen/` into `src/creature/gen/` **unchanged**, and record the lab commit hash in `src/creature/VENDORED.md`. Don't refactor it. The lab's future versions need to drop back in cleanly. Write an adapter (below) next to it.
- **If it isn't:** don't block. Write the adapter interface and a hand-authored **stub rig** (a core, two guns with different patterns, one weak point, simple sinusoidal motion). The sim only depends on the interface.

```ts
// src/creature/rig.ts — the only creature API the sim may import
export interface GunPose { pos: Vec2; angle: number }              // world units, radians (deterministic trig, see §5)
export interface CreatureRig {
  readonly id: string;                                              // genome hash or 'stub'
  gunsAt(beat: number): { pose: GunPose; emitter: EmitterSpec }[];  // pose at an integer beat
  weakPointsAt(t: number): { id: number; pos: Vec2; r: number }[];  // t = beats, fractional allowed
  hullAt(t: number): Circle[];                                      // coarse blockers for player shots
  draw?: never;                                                     // rendering is not the sim's business
}
```

Lab facts the adapter needs:
- `grow(genome, { t })` returns parts with poses, plus an `aabb`. Validity is sampled at t = 0, 1.5, 3.75, 7.25, so motion is periodic in beat-ish time. Confirm the unit of `t` in the source before relying on it.
- Validity v2: ≥ 1 gun, ≥ 1 weak point with radius ≥ 0.022, bounding box ≤ 2 × 2, ≤ 240 parts.
- Seed genomes: serpent, jellyfish, pod ring, tentacle core. For M1, use one seed genome (pod ring or tentacle core) or a creature Itay picks from the lab.

## 5. Architecture

Stack (decided): **TypeScript + Vite**, **PixiJS** for the game renderer (canvas2D stays in the lab), **vitest**. Capacitor for platform builds comes later. Godot/C# was rejected (no C# web export in Godot 4); revisit only if TS becomes a real performance blocker.

```
src/
  params.ts        every tunable number (see §6)
  sim/             PURE. No DOM, no Pixi, no Date, no Math.random, no performance.now
    dmath.ts       deterministic sin/cos/atan2/sqrt (reuse the lab's if it has one)
    prng.ts        seeded streams (reuse the lab's stream(hash2(seed, i), 'name'))
    state.ts       SimState, Plan, Event types
    emit.ts        volleys from rig + emitter specs, per beat
    collide.ts     swept tests
    step.ts        step(), sample(), preview()
  creature/        rig.ts, adapter.ts, stub.ts, gen/ (vendored)
  game/            Pixi app, beat clock, input, render, HUD
test/
```

### Simulation contract
```ts
interface Plan { target: Vec2; fire: boolean }   // target clamped to the reach circle
step(s: SimState, plan: Plan, rig: CreatureRig, p: Params): { next: SimState; events: SimEvent[] }
sample(s, plan, rig, p, f: number): Frame        // scene at fraction f ∈ [0,1] of the beat, same math as step
preview(s, rig, p): BulletPath[]                 // next-beat paths shown during the freeze
```
- `step` is pure: it doesn't mutate its input, and the same input always gives the same output. `SimState` is plain data (serializable, hashable). Integer `beat` counter. PRNG state is stored inside the state, not in module globals.
- Within a beat, sim motion is **linear in f** for bullets, player and player shots. The ease-out crawl is a **render-time warp of f** applied to the whole scene. Then bullet-vs-player is an exact closest-approach test of two linear motions, so nothing tunnels. Creature parts move non-linearly, so test shots against weak points and hull with a fixed integer substep count (a param).
- Events: `volley`, `graze`, `hit`, `shotHitWeak`, `shotBlocked`, `weakDestroyed`, `win`, `lose`. Energy changes are applied in `step` from these events.
- Danger marks come from a dry-run of `step` with the candidate plan. Since `step` is pure, that's free, and the marks always agree with what will actually happen.

### Determinism rules (decided for the generator; apply them to the sim too)
Seeded PRNG streams, an integer beat clock, no transcendental `Math.*` in sim code (use `dmath`), no pixel-based logic, and versioned behaviour (`SIM_VERSION` in state). A golden-hash harness across Chromium, WebKit and Firefox is planned. For M1, a node-side golden hash is enough, but don't write anything that would break the cross-engine version.

### Game shell (M1 level of polish)
- Beat clock: freeze for `planBeats × 60/bpm` seconds → commit → play the beat with the eased f → freeze again. The crawl tail overlaps the start of the next freeze, as the rule says.
- Input: pointer drag sets the target inside the reach circle. Click/tap or Space toggles fire. Keyboard fallback: arrows/WASD nudge the target. Enter commits early (useful while testing; behind a param).
- Render: creature, enemy bullets, player, player shots, reach circle, next-beat paths, danger marks, energy bar, beat/bar counter. Debug overlay toggle (hitboxes, graze rings, state hash).
- URL params: `?seed=…&creature=stub|<seed-genome-name>`.
- Visual direction (established): flat, rounded primitives in vivid colours, an 80s 16-bit feel **without pixel art**, no outline stroke or drop shadow by default, and a single warm specular highlight arc on shapes. Port the lab's Bestiary drawing to Pixi Graphics if that's quick. Otherwise, drawing the lab's canvas2D renderer into a texture is acceptable for M1.

## 6. Parameters: non-negotiable

Itay tunes by editing literals, not by asking an agent. He wants a future Unity-Inspector-style panel that **edits the source literals themselves** and relies on hot reload (not a runtime override layer). So:
- Every gameplay and feel number goes in `src/params.ts` as a plain literal, grouped, with a one-line comment giving unit and sane range, e.g. `reach: 0.3, // creature units per beat, 0.15–0.5`.
- No magic numbers elsewhere. No computed defaults hiding a literal. Derived values are computed at the use site from params.
- Keep the file shape trivially parseable (one `export const P = { group: { key: literal, // comment } }`) so an inspector can map rows to lines later.
- Mark unconfirmed values with `// PROPOSED` or `// OPEN` in the comment.

## 7. Tests (vitest)

- `step` purity: deep-equal outputs for identical inputs; input objects frozen in the test to catch mutation.
- Golden hash: a scripted 200-beat run against the stub rig and a fixed seed → snapshot hash. Any change to it must be deliberate (bump `SIM_VERSION`).
- `preview` and danger marks agree with `step` on 1,000 random plans.
- Collision: fast bullet crossing the player between substeps (must hit); near pass inside the graze ring (graze, no hit); exact tangent cases.
- Emitter timing: `subdiv`/`offset` volleys land on the right beats over 4 bars, for each pattern and aim mode.
- A guard test that greps `src/sim/` for `Math.random`, `Date`, `performance`, `Math.sin|cos|tan|atan|exp|log|pow`.

## 8. Out of scope for M1 (don't build)

GA/evolution, the appeal judge, MAP-Elites archive, the generating-bar, minions derived from the boss, gyro aiming, undo, soundtrack, Capacitor, cross-browser harness, menus/meta.

**Next, after M1 (for context only):** a bot limited to the player's information that must survive an encounter with a margin (beatability), retrying deterministically from `hash(seed, attempt)` on failure; objective difficulty from a heat map of shot coverage plus weak-point occlusion over a ~10 s emulated run, exported so the lab can use it as fitness; the **shutter** node (which also gives a weak-point-exposure validity rule); shot-blocking armour; multiple weak points; the cross-engine determinism harness. New node types get chosen for what they change in play first, looks second.

## 9. Working with Itay

- Parametrize everything (§6). He dislikes vibe coding and wants fine control over look and feel.
- Separate "decided" from "proposed" in everything you report. Past sessions went wrong when a suggestion got treated as a decision.
- He reacts best to something running. Get a crude playable loop early, then iterate, rather than polishing the sim in isolation for days.
- Push back with reasons when something in this doc is wrong. It was written before any gameplay code existed.
- Commit in small, described steps using the repo's git identity. Don't push to `main` without asking.

## 10. Questions to raise with Itay (don't decide them yourself)

1. Is the `beat-bullet-lab` source available locally? (§4)
2. Player-model numbers, and the playfield-vs-boss-size conflict (§3).
3. Freeze length in beats, and what happens on timeout.
4. Energy economy: graze gain, shot cost, hit cost, cap, starting value.
5. Player shot speed and damage, weak-point HP, and whether the hull blocks shots.
6. Does the creature hold position on screen while the background scrolls, or drift?
