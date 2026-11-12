# M1 report: "One fight"

For Itay. 2026-11-12.

**State:** playable vertical slice against a stub creature. `npm run dev` gives a fight you can win or lose, then restart with R or a tap. The sim is pure and deterministic, with 69 passing tests. Every number is in `src/params.ts`, tagged DECIDED, PROPOSED or OPEN.

**Caveat on "feel":** I verified the game by stepping it in headless Chrome and reading screenshots, not by playing it in real time. The observations below come from those frames and from the numbers. Real-time feel (is 1 s enough to plan, does the crawl read well) needs your hands.

## 1. Blocker: lab source

The `beat-bullet-lab` source isn't on this machine, and `github.com/itayke/beat-bullet-lab` returns not-found (it may be private or named differently). Per §4 I didn't block. The sim depends only on `CreatureRig`, and `src/creature/stub.ts` implements it: a core, two arms with guns (fan aimed at the player; ring with spin), one weak point, and an orbiting "lid" hull piece that periodically covers the weak point, so shot timing matters.
**Need from you:** the lab repo (URL or a local path). Vendoring is a short job: copy `src/gen/`, record the commit, and write the `grow()` adapter.

## 2. Decisions needed (current placeholder in brackets)

1. **Playfield vs boss size.** A 2 × 2 boss can't fit above the player in a 2-unit-tall field. I added `creature.scale` [0.5, so the boss draws at 1 × 1] and kept `field.width/height` [3.5 × 2]. Options: shrink bosses (scale), grow the field (≈ 3.5 × 3.5, which isn't landscape any more), or let the boss overhang the top edge. This choice also sets what "reach 0.3" means relative to the creature.
2. **Freeze length and timeout.** [`planBeats` 2 at 120 BPM = 1.0 s per decision; timeout commits the plan on screen, which starts as "repeat last move"]. My guess is that 1 s is too short to read ~40 bullets plus their paths. Try 3 beats, or 100 BPM.
3. **Energy economy.** [start 60 / max 100 / graze cap 80 / graze +4 / shot −2 / hit −25]. With these, standing still dies at beat 6 against the stub, from three aimed fans. Two related questions:
   - **Multi-hit per beat.** Nothing stops several bullets from one volley hitting in the same beat (−50 or more). Do you want i-frames, "max one hit per beat", or is that fine?
   - **Can a shot empty the bar?** [`shotCanKill` false: a shot that would bring energy to 0 or below doesn't fire]. I added this guard so you can't kill yourself by shooting. It's OPEN.
4. **Player shots.** [speed 1 cu/beat ≈ 1–2 beats to arrive, damage 1, weak HP 10, hull blocks shots]. With hull blocking and the lid, roughly 10 accurate shots win the fight.
5. **Creature on screen.** [holds position, sways ±0.175 cu; `creature.driftPerBeat` 0]. The background scrolls; the creature doesn't drift.
6. **Ship area.** [`field.playerTopY` 0: the ship stays in the lower half]. I invented this so the ship can't fly into the boss (there's no body collision). It's OPEN. Say if you'd rather have body contact.

## 3. What looks off (observed)

- **Aimed fire is weak against the reach circle.** Volleys aim at the ship's position at the start of the beat. Reach (0.3/beat) is greater than bullet speed (0.25/beat), so a sideways move every beat beats aimed fans. Since a timeout repeats the last move, drifting is the default, and the ship drifts into walls. Leading shots (aim at the planned position) would break the one-beat-preview fairness, so I didn't touch it.
- **Clutter.** At about 30 bullets per bar from just two guns, the frozen screen has 40–50 bullets with paths at beat 8. The preview is readable but busy. Density scaling (`enemy.densityScale`) is already a param. Also consider fading paths for bullets heading away from the ship.
- **Mobile drag.** The target sits under the finger, so the finger covers the ship and danger marks. A relative drag (finger offset from the ship) is likely better. Not built.
- **`?seed=` does nothing visible yet.** The stub creature isn't seeded, and the sim's PRNG stream is reserved but unused. It will matter once lab genomes plug in.

## 4. Interpretations I made (please confirm or correct)

| Topic | What I built | Status |
|---|---|---|
| Beat timeline | Commits land on a fixed grid every `planBeats` beats. Each commit plays one sim beat over `motionBeats` (1 beat) with one ease-out curve, `1 − (1−u)^k`, with k chosen so 75% is covered by 150 ms. Planning UI (reach, paths, marks) appears once the lead is done, while the crawl finishes. Enter commits early and restarts the grid. | PROPOSED |
| Timeout | The plan always starts as "repeat last move" (or "hold" if `timeoutRepeat` is false), and the timeout commits whatever is shown. So the marks always describe what will happen on timeout. | PROPOSED |
| Collision radii | Hit = `hitR + bulletR`; graze = `grazeR + bulletR` (ring touches the bullet's edge). Touching counts as a hit. | PROPOSED |
| Graze timing | Counted on the first beat the bullet passes inside the ring; never again for that bullet. Energy events apply in time order within a beat. | PROPOSED |
| Shot origin | Spawns at the ship's start position on the beat, tilted by `maxTiltDeg × (dx / reach)`. | PROPOSED |
| `aimed` vs `stream` | The lab's semantics were unavailable. `aimed` = a tight burst on one line (speeds drop by `burstSpeedStep`). `stream` = a long line (speeds spread evenly down to `streamMinSpeed`). Replace with the lab's `emit.ts` on vendoring. | PROPOSED |
| Spin step | Global `enemy.spinStepDeg` per volley, not a per-emitter gene. | PROPOSED |
| Bullet speed | Global `enemy.bulletSpeed × speedScale`, not per emitter. | PROPOSED |
| Intro | `introBeats` 4 extra beats of planning before beat 0. | OPEN |
| Graze marks | Danger marks (hits) are required; I also show graze marks for the planned move. | added, easy to remove |

## 5. Determinism notes

- `dmath` replaces sin/cos/atan2 with polynomials (error < 1e-9 vs `Math`). Sim and creature code use only `+ − × ÷ sqrt round floor`, and a guard test enforces it.
- The golden 200-beat hash runs on pinned params (`test/fixtures/golden-params.json`), so tuning `params.ts` never breaks it. Changing sim rules or the stub creature does, by design: bump `SIM_VERSION` and run `npx vitest run -u`.
- The lab's `dmath`/`prng` should replace mine on vendoring if they differ. That changes the hash, so bump the version then.

## 6. Suggested next steps

1. Vendor the lab generator, play one real seed genome (pod ring or tentacle core), and compare its density against the stub's.
2. Settle the six decisions above, starting with playfield size and freeze length, since they shape everything else.
3. A handful of real-time playtests, then the beatability bot (it can call `resolve` directly; `dangerMarks` is already the one-beat search primitive).
