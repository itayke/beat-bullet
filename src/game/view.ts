// World (creature units, origin at field centre, y down) to screen pixels, letterboxed under the HUD.
import type { Params } from '../params';
import type { Vec2 } from '../sim/dmath';

export class View {
  scale = 1; // px per creature unit
  cx = 0;
  cy = 0;

  constructor(private p: Params) {}

  fit(w: number, h: number): void {
    const r = this.p.render;
    const availW = w - 2 * r.viewPadPx;
    const availH = h - 2 * r.viewPadPx - r.hudHeightPx;
    this.scale = Math.max(1, Math.min(availW / this.p.field.width, availH / this.p.field.height));
    this.cx = w / 2;
    this.cy = r.viewPadPx + r.hudHeightPx + availH / 2;
  }

  x(wx: number): number { return this.cx + wx * this.scale; }
  y(wy: number): number { return this.cy + wy * this.scale; }
  s(len: number): number { return len * this.scale; }

  toWorld(sx: number, sy: number): Vec2 {
    return { x: (sx - this.cx) / this.scale, y: (sy - this.cy) / this.scale };
  }

  /** Field rectangle in screen pixels. */
  field(): { x: number; y: number; w: number; h: number } {
    const w = this.s(this.p.field.width);
    const h = this.s(this.p.field.height);
    return { x: this.cx - w / 2, y: this.cy - h / 2, w, h };
  }
}
