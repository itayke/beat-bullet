// Beat clock: commits land every planBeats beats; each commit plays one sim beat with an eased f.
// The ease tail (the crawl) overlaps the next freeze, so planning starts while the scene settles.
import type { Params } from '../params';

export class BeatClock {
  private deadline = 0;
  private commitAt = -Infinity;

  constructor(private p: Params) {}

  get beatMs(): number { return 60000 / this.p.tempo.bpm; }
  get cycleMs(): number { return this.p.tempo.planBeats * this.beatMs; }
  get motionMs(): number { return this.p.tempo.motionBeats * this.beatMs; }

  /** Ease-out exponent so that leadFraction of the move is covered after leadMs. */
  private get easeK(): number {
    const u0 = this.p.crawl.leadMs / this.motionMs;
    if (u0 <= 0 || u0 >= 1) return 1;
    return Math.log(1 - this.p.crawl.leadFraction) / Math.log(1 - u0);
  }

  start(now: number): void {
    this.commitAt = -Infinity;
    this.deadline = now + (this.p.tempo.introBeats + this.p.tempo.planBeats) * this.beatMs;
  }

  /** Planning time ran out (never, in untimed debug mode). */
  due(now: number): boolean {
    return !this.p.debug.untimedFreeze && now >= this.deadline;
  }

  commit(now: number): void {
    this.commitAt = now;
    if (now < this.deadline) {
      this.deadline = now + this.cycleMs; // early commit restarts the cycle from now
      return;
    }
    // Stay on the beat grid; after a stall (background tab, slow frame) skip missed beats instead of replaying them.
    do this.deadline += this.cycleMs; while (this.deadline <= now);
  }

  /** Linear progress through the last committed beat's animation, 0..1. */
  progress(now: number): number {
    const u = (now - this.commitAt) / this.motionMs;
    return u < 0 ? 0 : u > 1 ? 1 : u;
  }

  /** Eased scene fraction: the render-time warp of sim f. */
  eased(now: number): number {
    return 1 - Math.pow(1 - this.progress(now), this.easeK);
  }

  /** True once the lead part of the move has played and the scene is crawling or still. */
  pastLead(now: number): boolean {
    return now - this.commitAt >= this.p.crawl.leadMs;
  }

  /** Share of the planning window left, 1 → 0. */
  freezeLeft(now: number): number {
    if (this.p.debug.untimedFreeze) return 1;
    const v = (this.deadline - now) / this.cycleMs;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
}
