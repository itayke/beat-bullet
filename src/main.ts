// Entry: read URL params (?seed=…&creature=…), boot Pixi, start the fight.
import { Application } from 'pixi.js';
import { creatureByName } from './creature/adapter';
import { Game } from './game/game';
import { P } from './params';

const DEFAULT_SEED = 1;

async function main() {
  const q = new URLSearchParams(location.search);
  const seed = Number.parseInt(q.get('seed') ?? '', 10);
  const { rig, warning } = creatureByName(q.get('creature') ?? 'stub', P);
  if (warning) console.warn(warning);

  const app = new Application();
  await app.init({ resizeTo: window, background: P.colors.bg, antialias: true, autoDensity: true, resolution: window.devicePixelRatio });
  document.body.appendChild(app.canvas);
  new Game(app, P, rig, Number.isFinite(seed) ? seed : DEFAULT_SEED, warning ?? '');
}

main();
