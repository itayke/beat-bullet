# Beat Bullet

A beat-frozen shmup. Play freezes on every beat. While it's frozen you see where every bullet will travel during the next beat, then you plan one move and optionally one shot. Enemies will be evolved by a seeded genetic algorithm; that work lives in the separate lab project. This repo is the game.

Status: **Milestone 1, "One fight"**: one stub creature, one ship, one fight, on a pure deterministic simulation. See [HANDOFF.md](HANDOFF.md) for the design brief and [REPORT.md](REPORT.md) for open questions.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: determinism, collision, emitters, guards
npm run build      # typecheck + production bundle
```

URL params: `?seed=<int>&creature=stub`. Only `stub` exists until the lab generator is vendored. Other names fall back to the stub and show a warning.

## Controls

| Input | Action |
|---|---|
| Drag (mouse or touch) | Set the move target inside the reach circle |
| Tap / click, Space | Toggle fire (the choice carries over between beats) |
| Arrows / WASD | Nudge the target |
| Enter | Commit early (testing aid, `input.allowEarlyCommit`) |
| R | Restart |
| `` ` `` | Debug overlay: hitboxes, graze ring, state hash |

When the freeze times out, the plan on screen is committed. A new freeze starts with your last move already planned (`tempo.timeoutRepeat`), so you can do nothing and keep the same move.

## Tuning

Every gameplay, feel and look number is in [src/params.ts](src/params.ts), one literal per line with its unit, sane range and status tag:

- `DECIDED`: Itay agreed.
- `PROPOSED`: suggested, not confirmed.
- `OPEN`: placeholder; nobody has decided.

Vite hot-reloads edits. A test enforces the file's `key: literal, // comment` shape, so a future inspector panel can map rows to lines.

## Layout

```
src/
  params.ts       all tunables
  sim/            pure deterministic sim (no DOM, Pixi, Date, Math.random or Math.sin & co.)
    dmath.ts      polynomial sin/cos/atan2 (bit-exact across engines)
    prng.ts       seeded hash + streams; state is a uint32 stored in SimState
    state.ts      SimState, Plan, SimEvent, SIM_VERSION
    emit.ts       volley timing (subdiv/offset) and patterns (aimed/fan/ring/stream × player/fixed/spin)
    collide.ts    swept closest-approach and first-contact tests
    step.ts       resolve / step / sample / preview / dangerMarks
    hash.ts       canonical state hash
  creature/       CreatureRig interface, stub rig, adapter (lab generator goes in gen/)
  game/           Pixi renderer, beat clock, input, HUD
test/             vitest suites; golden-run params are pinned in test/fixtures
```

### Simulation in one paragraph

`resolve(state, plan, rig, params)` advances one beat. Volleys fire from the guns' poses on that beat. Inside the beat, the ship, bullets and shots move linearly in `f ∈ [0, 1]`, so bullet-vs-ship collision is an exact swept test and nothing tunnels. Shots against the (non-linear) creature are tested over `shots.substeps` slices. Events are applied in time order to energy and weak-point HP. `preview` gives the next beat's bullet paths. `dangerMarks` is a dry run of the same step, so marks can't disagree with the outcome. The eased crawl is a render-time warp of `f` and never touches the sim.

### Determinism

- Sim code uses only `+ − × ÷ sqrt` and exact rounding. A guard test greps `src/sim` and `src/creature` for forbidden calls.
- The golden test runs 200 scripted beats on pinned params and the stub rig, and snapshots the state hash. If it changes on purpose (sim rules or stub creature data), bump `SIM_VERSION` and update the snapshot with `npx vitest run -u`. Tuning `params.ts` doesn't affect it.
