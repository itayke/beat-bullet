// Pointer and keyboard input, translated into intent callbacks. No game state lives here.
import type { Params } from '../params';

export interface InputHandlers {
  aim(sx: number, sy: number): void; // drag: set target at a screen point
  nudge(dx: number, dy: number): void; // keyboard: move target by whole nudge steps
  toggleFire(): void;
  commit(): void;
  restart(): void;
  toggleDebug(): void;
}

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1],
};

export function bindInput(el: HTMLElement, p: Params, h: InputHandlers): () => void {
  let down: { id: number; x: number; y: number; t: number; drag: boolean } | null = null;

  const onDown = (e: PointerEvent) => {
    if (down) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, drag: false };
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > p.input.tapMaxPx) down.drag = true;
    if (down.drag) h.aim(e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    if (!down.drag && e.timeStamp - down.t <= p.input.tapMaxMs) h.toggleFire();
    down = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat && e.code !== 'Space' && !NUDGE[e.code]) return;
    const n = NUDGE[e.code];
    if (n) h.nudge(n[0], n[1]);
    else if (e.code === 'Space') { if (!e.repeat) h.toggleFire(); }
    else if (e.code === 'Enter' && p.input.allowEarlyCommit) h.commit();
    else if (e.code === 'KeyR') h.restart();
    else if (e.code === 'Backquote') h.toggleDebug();
    else return;
    e.preventDefault();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
  };
}
