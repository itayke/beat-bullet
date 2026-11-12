// Game loop: owns sim state, the plan being edited, and the beat clock. All rules live in src/sim.
import type { Application } from 'pixi.js';
import type { CreatureRig } from '../creature/rig';
import type { Params } from '../params';
import type { Vec2 } from '../sim/dmath';
import { hashState } from '../sim/hash';
import type { BulletPath, Plan, SimState } from '../sim/state';
import { clampTarget, dangerMarks, initState, preview, resolve, sampleTrace, type BeatTrace, type Frame } from '../sim/step';
import { BeatClock } from './clock';
import { bindInput } from './input';
import { Renderer } from './render';
import { View } from './view';

export class Game {
  private sim!: SimState;
  private trace: BeatTrace | null = null;
  private plan!: Plan;
  private fire = false; // carries over between beats
  private clock: BeatClock;
  private view: View;
  private renderer: Renderer;
  private debug: boolean;
  private flashUntil = 0;
  private flashedThrough = -1; // last eased f whose hit events already flashed
  // Caches recomputed only when their inputs change.
  private paths: BulletPath[] = [];
  private marks: ReturnType<typeof dangerMarks> = { hits: [], grazes: [] };
  private marksKey = '';
  private hash = '';

  constructor(private app: Application, private p: Params, private rig: CreatureRig, private seed: number, private notice: string) {
    this.clock = new BeatClock(p);
    this.view = new View(p);
    this.renderer = new Renderer(app, p, this.view, rig);
    this.debug = p.debug.startVisible;
    bindInput(app.canvas, p, {
      aim: (sx, sy) => this.setTarget(this.view.toWorld(sx, sy)),
      nudge: (dx, dy) => this.setTarget({ x: this.plan.target.x + dx * p.input.nudgeStep, y: this.plan.target.y + dy * p.input.nudgeStep }),
      toggleFire: () => (this.sim.status === 'playing' ? (this.fire = !this.fire) : this.restart()),
      commit: () => this.commit(performance.now()),
      restart: () => this.restart(),
      toggleDebug: () => (this.debug = !this.debug),
    });
    this.restart();
    app.ticker.add(() => this.tick());
  }

  private restart(): void {
    this.sim = initState(this.seed, this.rig, this.p);
    this.trace = null;
    this.fire = false;
    this.flashUntil = 0;
    this.resetPlan();
    this.clock.start(performance.now());
  }

  /** Default plan for a new freeze: repeat the last move (or hold), so a timeout commits what's shown. */
  private resetPlan(): void {
    const m = this.p.tempo.timeoutRepeat ? this.sim.lastMove : { x: 0, y: 0 };
    this.plan = { target: clampTarget(this.sim.player, { x: this.sim.player.x + m.x, y: this.sim.player.y + m.y }, this.p), fire: this.fire };
    this.paths = preview(this.sim, this.rig, this.p);
    this.hash = hashState(this.sim);
    this.marksKey = '';
  }

  private setTarget(t: Vec2): void {
    this.plan = { ...this.plan, target: clampTarget(this.sim.player, t, this.p) };
  }

  private commit(now: number): void {
    if (this.sim.status !== 'playing') return;
    const r = resolve(this.sim, { ...this.plan, fire: this.fire }, this.rig, this.p);
    this.trace = r.trace;
    this.sim = r.next;
    this.flashedThrough = -1;
    this.clock.commit(now);
    this.resetPlan();
  }

  private tick(): void {
    const now = performance.now();
    if (this.sim.status === 'playing' && this.clock.due(now)) this.commit(now);

    const f = this.trace ? this.clock.eased(now) : 1;
    const frame: Frame = this.trace ? sampleTrace(this.trace, f) : this.staticFrame();

    // Flash once for each hit the animation has just reached.
    if (frame.events.some((e) => e.kind === 'hit' && e.f > this.flashedThrough)) this.flashUntil = now + this.p.render.hitFlashMs;
    this.flashedThrough = f;

    const key = `${this.sim.beat}|${this.plan.target.x}|${this.plan.target.y}|${this.fire}`;
    if (key !== this.marksKey) {
      this.marks = dangerMarks(this.sim, { ...this.plan, fire: this.fire }, this.rig, this.p);
      this.marksKey = key;
    }

    this.view.fit(this.app.screen.width, this.app.screen.height);
    this.renderer.draw({
      sim: this.sim,
      frame,
      planning: !this.trace || this.clock.pastLead(now),
      target: this.plan.target,
      fire: this.fire,
      paths: this.paths,
      hits: this.marks.hits,
      grazes: this.marks.grazes,
      freezeLeft: this.clock.freezeLeft(now),
      flash: Math.max(0, (this.flashUntil - now) / this.p.render.hitFlashMs),
      debug: this.debug,
      hash: this.hash,
      notice: this.notice,
    }, this.app.screen.width, this.app.screen.height);
  }

  private staticFrame(): Frame {
    const s = this.sim;
    return {
      beat: s.beat, f: 0, t: s.beat, player: s.player, tilt: 0,
      bullets: s.bullets.map((b) => ({ id: b.id, pos: b.pos, r: b.r })),
      shots: s.shots.map((sh) => ({ id: sh.id, pos: sh.pos })),
      events: [],
    };
  }
}
