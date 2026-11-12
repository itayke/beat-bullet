// Pixi drawing for the scene and HUD. Reads a snapshot of the game each frame; owns no game state.
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { CreatureRig } from '../creature/rig';
import type { Params } from '../params';
import { DEG, type Vec2 } from '../sim/dmath';
import type { BulletPath, SimEvent, SimState } from '../sim/state';
import type { Frame } from '../sim/step';
import type { View } from './view';

export interface Scene {
  sim: SimState; // state at the start of the beat being planned
  frame: Frame; // what's on screen right now (eased)
  planning: boolean; // past the lead: show reach, plan, preview
  target: Vec2; // clamped planned target
  fire: boolean;
  paths: BulletPath[];
  hits: Extract<SimEvent, { kind: 'hit' }>[];
  grazes: Extract<SimEvent, { kind: 'graze' }>[];
  freezeLeft: number;
  flash: number; // 0..1 hit flash strength
  debug: boolean;
  hash: string;
  notice: string;
}

export class Renderer {
  private bg = new Graphics();
  private fieldMask = new Graphics();
  private world = new Graphics();
  private overlay = new Graphics();
  private debugG = new Graphics();
  private flashG = new Graphics();
  private hudG = new Graphics();
  private hudText: Text;
  private infoText: Text;
  private centerText: Text;

  constructor(app: Application, private p: Params, private view: View, private rig: CreatureRig) {
    const style = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: p.render.fontSizePx, fill: p.colors.text };
    this.hudText = new Text({ text: '', style });
    this.infoText = new Text({ text: '', style: { ...style, fontSize: p.render.infoFontPx } });
    this.infoText.anchor.set(1, 0.5);
    this.infoText.alpha = p.hud.infoAlpha;
    this.centerText = new Text({ text: '', style: { ...style, fontSize: p.render.titleFontPx, align: 'center' } });
    this.centerText.anchor.set(0.5);
    // Everything in world space is clipped to the playfield.
    const field = new Container();
    field.addChild(this.world, this.overlay, this.debugG);
    field.mask = this.fieldMask;
    const hud = new Container();
    hud.addChild(this.hudG, this.hudText, this.infoText);
    app.stage.addChild(this.bg, this.fieldMask, field, this.flashG, hud, this.centerText);
  }

  draw(sc: Scene, screenW: number, screenH: number): void {
    this.drawBackground(sc, screenW, screenH);
    this.world.clear();
    this.drawCreature(sc);
    this.drawShots(sc);
    this.drawBullets(sc);
    this.drawShip(sc.frame.player, sc.frame.tilt);
    this.overlay.clear();
    if (sc.planning && sc.sim.status === 'playing') this.drawPlan(sc);
    this.debugG.clear();
    if (sc.debug) this.drawDebug(sc);
    this.flashG.clear();
    if (sc.flash > 0) this.flashG.rect(0, 0, screenW, screenH).fill({ color: this.p.colors.hitFlash, alpha: sc.flash * this.p.render.hitFlashAlpha });
    this.drawHud(sc, screenW, screenH);
  }

  // ---- primitives ----

  /** Flat disc with the single warm specular arc. */
  private disc(g: Graphics, wx: number, wy: number, wr: number, color: number, alpha = 1): void {
    const v = this.view;
    const x = v.x(wx), y = v.y(wy), r = v.s(wr);
    g.circle(x, y, r).fill({ color, alpha });
    this.highlight(g, x, y, r, alpha);
  }

  private highlight(g: Graphics, x: number, y: number, r: number, alpha = 1): void {
    const h = this.p.render;
    const hr = r * h.highlightRadiusFrac;
    const a0 = h.highlightStartDeg * DEG, a1 = h.highlightEndDeg * DEG;
    g.moveTo(x + Math.cos(a0) * hr, y + Math.sin(a0) * hr)
      .arc(x, y, hr, a0, a1)
      .stroke({ width: r * h.highlightWidthFrac, color: this.p.colors.highlight, alpha: h.highlightAlpha * alpha, cap: 'round' });
  }

  private line(g: Graphics, a: Vec2, b: Vec2, color: number, alpha: number, widthPx = this.p.render.lineWidthPx): void {
    const v = this.view;
    g.moveTo(v.x(a.x), v.y(a.y)).lineTo(v.x(b.x), v.y(b.y)).stroke({ width: widthPx, color, alpha, cap: 'round' });
  }

  private ring(g: Graphics, c: Vec2, wr: number, color: number, alpha: number): void {
    const v = this.view;
    g.circle(v.x(c.x), v.y(c.y), v.s(wr)).stroke({ width: this.p.render.lineWidthPx, color, alpha });
  }

  // ---- layers ----

  private drawBackground(sc: Scene, w: number, h: number): void {
    const { p, view: v } = this;
    const f = v.field();
    this.bg.clear().rect(0, 0, w, h).fill(p.colors.bg);
    this.bg.roundRect(f.x, f.y, f.w, f.h, p.render.fieldCornerPx).fill(p.colors.field);
    this.fieldMask.clear().roundRect(f.x, f.y, f.w, f.h, p.render.fieldCornerPx).fill(0xffffff);
    // Upward scroll: stripes drift down the screen with creature time.
    const gap = p.render.stripeGap;
    const shift = (sc.frame.t * p.render.scrollPerBeat) % gap;
    for (let y = -p.field.height / 2 + shift; y < p.field.height / 2; y += gap) {
      this.bg.rect(f.x, v.y(y), f.w, p.render.stripePx).fill(p.colors.bgStripe);
    }
  }

  private drawCreature(sc: Scene): void {
    const { p, rig, world: g, view: v } = this;
    const t = sc.frame.t;
    rig.hullAt(t).forEach((c, i) => this.disc(g, c.x, c.y, c.r, i === 0 ? p.colors.hullA : p.colors.hullB));
    const len = p.render.gunLen * p.creature.scale;
    for (const gun of rig.gunsAt(t)) {
      const { pos, angle } = gun.pose;
      const back = { x: pos.x - Math.cos(angle) * len, y: pos.y - Math.sin(angle) * len };
      this.line(g, back, pos, p.colors.gun, 1, v.s(p.render.gunWidth * p.creature.scale));
    }
    const hp = new Map(sc.sim.weak.map((w) => [w.id, w.hp]));
    const pulse = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / p.render.weakPulseBeats);
    for (const w of rig.weakPointsAt(t)) {
      const left = hp.get(w.id) ?? 0;
      if (left <= 0) continue;
      this.disc(g, w.pos.x, w.pos.y, w.r, mixColor(p.colors.weak, p.colors.weakHurt, pulse * p.render.weakPulseMix));
      // HP arc around the weak point.
      const r = v.s(w.r) + p.render.weakHpGapPx;
      const a0 = -Math.PI / 2;
      g.moveTo(v.x(w.pos.x), v.y(w.pos.y) - r)
        .arc(v.x(w.pos.x), v.y(w.pos.y), r, a0, a0 + 2 * Math.PI * (left / p.weak.hp))
        .stroke({ width: p.render.lineWidthPx, color: p.colors.weak, alpha: p.render.markAlpha, cap: 'round' });
    }
  }

  private drawBullets(sc: Scene): void {
    for (const b of sc.frame.bullets) this.disc(this.world, b.pos.x, b.pos.y, b.r, this.p.colors.bullet);
  }

  private drawShots(sc: Scene): void {
    for (const s of sc.frame.shots) this.disc(this.world, s.pos.x, s.pos.y, this.p.shots.r, this.p.colors.shot);
  }

  private drawShip(pos: Vec2, tilt: number): void {
    const { p, view: v } = this;
    const s = p.render.shipSize;
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const flat = SHIP_SHAPE.flatMap(([x, y]) => [v.x(pos.x + (x * c - y * sn) * s), v.y(pos.y + (x * sn + y * c) * s)]);
    this.world.poly(flat).fill(p.colors.player);
    this.highlight(this.world, v.x(pos.x), v.y(pos.y), v.s(s) * p.render.shipHighlightFrac);
    // The real hitbox is always visible, shmup-style.
    this.world.circle(v.x(pos.x), v.y(pos.y), Math.max(p.render.hitboxMinPx, v.s(p.player.hitR))).fill(p.colors.text);
  }

  private drawPlan(sc: Scene): void {
    const { p, overlay: g, view: v } = this;
    const c = p.colors;
    const from = sc.sim.player;
    this.ring(g, from, p.player.reach, c.reach, p.render.reachAlpha);

    for (const b of sc.paths) {
      const col = b.fresh ? c.bulletNew : c.bullet;
      this.line(g, b.from, b.to, col, p.render.previewAlpha);
      g.circle(v.x(b.to.x), v.y(b.to.y), v.s(b.r * p.render.previewDotFrac)).fill({ color: col, alpha: p.render.previewAlpha });
      if (b.fresh) this.ring(g, b.from, b.r, col, p.render.previewAlpha);
    }

    const danger = sc.hits.length > 0;
    const r = p.render;
    this.line(g, from, sc.target, danger ? c.danger : c.plan, r.markAlpha);
    g.circle(v.x(sc.target.x), v.y(sc.target.y), r.targetRingPx).stroke({ width: r.lineWidthPx, color: danger ? c.danger : c.plan, alpha: r.markAlpha });
    if (sc.fire) {
      // Shot direction hint from the ship, tilted like the real shot.
      const tilt = Math.max(-1, Math.min(1, (sc.target.x - from.x) / p.player.reach)) * p.player.maxTiltDeg * DEG;
      const len = p.shots.speed;
      this.line(g, from, { x: from.x + Math.sin(tilt) * len, y: from.y - Math.cos(tilt) * len }, c.shot, r.shotHintAlpha);
    }

    for (const gz of sc.grazes) {
      g.circle(v.x(gz.pos.x), v.y(gz.pos.y), r.grazeMarkPx).stroke({ width: r.lineWidthPx, color: c.graze, alpha: r.markAlpha });
    }
    const d = r.dangerSizePx;
    for (const h of sc.hits) {
      const x = v.x(h.pos.x), y = v.y(h.pos.y);
      g.moveTo(x - d, y - d).lineTo(x + d, y + d).moveTo(x + d, y - d).lineTo(x - d, y + d)
        .stroke({ width: r.dangerWidthPx, color: c.danger, cap: 'round' });
      // Where on the planned path the ship gets hit.
      const at = { x: from.x + (sc.target.x - from.x) * h.f, y: from.y + (sc.target.y - from.y) * h.f };
      g.circle(v.x(at.x), v.y(at.y), r.dangerDotPx).fill({ color: c.danger, alpha: r.markAlpha });
    }
  }

  private drawDebug(sc: Scene): void {
    const { p, debugG: g } = this;
    const c = p.colors;
    const a = p.render.debugAlpha;
    this.ring(g, sc.frame.player, p.player.grazeR, c.graze, a);
    this.ring(g, sc.frame.player, p.player.hitR, c.text, a);
    for (const b of sc.frame.bullets) this.ring(g, b.pos, b.r, c.text, a);
    for (const s of sc.frame.shots) this.ring(g, s.pos, p.shots.r, c.text, a);
    for (const h of this.rig.hullAt(sc.frame.t)) this.ring(g, h, h.r, c.text, a);
    for (const w of this.rig.weakPointsAt(sc.frame.t)) this.ring(g, w.pos, w.r, c.weak, a);
  }

  private drawHud(sc: Scene, w: number, h: number): void {
    const { p, hudG: g } = this;
    const c = p.colors;
    const pad = p.render.viewPadPx;
    const bw = p.hud.energyBarWidthPx, bh = p.hud.energyBarHeightPx;
    const by = pad + (p.render.hudHeightPx - bh) / 2;
    const frac = Math.max(0, sc.sim.energy) / p.energy.max;
    g.clear();
    g.roundRect(pad, by, bw, bh, bh / 2).fill({ color: c.text, alpha: p.hud.trackAlpha });
    if (frac > 0) {
      g.roundRect(pad, by, bw * frac, bh, bh / 2).fill(frac < p.hud.energyLowFrac ? c.energyLow : c.energy);
    }
    const capX = pad + bw * (p.energy.grazeCap / p.energy.max);
    const cm = p.hud.capMarkPx, co = p.hud.capOverhangPx;
    g.rect(capX - cm / 2, by - co, cm, bh + 2 * co).fill(c.energyCap);

    // Freeze timer just above the field, spanning its width.
    const f = this.view.field();
    g.rect(f.x, f.y - p.hud.timerGapPx - p.hud.timerHeightPx, f.w * sc.freezeLeft, p.hud.timerHeightPx)
      .fill({ color: c.plan, alpha: p.hud.timerAlpha });

    const beat = sc.sim.beat;
    const bpb = p.tempo.beatsPerBar;
    const dbg = sc.debug ? `   #${beat} ·${sc.sim.bullets.length} ${sc.hash}` : '';
    this.hudText.text = `${Math.max(0, Math.round(sc.sim.energy))}   BAR ${Math.floor(beat / bpb) + 1}.${(beat % bpb) + 1}   FIRE ${sc.fire ? 'ON ' : 'OFF'}${dbg}`;
    this.hudText.position.set(pad + bw + pad, pad + (p.render.hudHeightPx - this.hudText.height) / 2);

    this.infoText.text = `${sc.notice ? '⚠ ' + sc.notice + '   ' : ''}drag: aim  tap/space: fire  wasd: nudge  enter: commit  r: restart  \`: debug`;
    this.infoText.position.set(w - pad, pad + p.render.hudHeightPx / 2);
    // Hints yield to the main HUD line on narrow screens.
    this.infoText.visible = w - pad - this.infoText.width > this.hudText.x + this.hudText.width + pad;

    const st = sc.sim.status;
    this.centerText.visible = st !== 'playing';
    if (st !== 'playing') {
      this.centerText.text = `${st === 'won' ? 'CREATURE DOWN' : 'ENERGY OUT'}\nbeat ${beat} · r / tap to restart`;
      this.centerText.position.set(w / 2, h / 2);
    }
  }
}

/** Unit ship outline (nose, right wing, tail notch, left wing), scaled by render.shipSize. */
const SHIP_SHAPE: [number, number][] = [[0, -1], [0.8, 0.7], [0, 0.35], [-0.8, 0.7]];

/** Linear blend of two 0xRRGGBB colours. */
function mixColor(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return ch(16) | ch(8) | ch(0);
}
