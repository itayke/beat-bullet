// Every gameplay, feel and look number lives here, as a plain literal.
// Shape is fixed for a future inspector: `group: { key: literal, // unit, range. STATUS }`.
// Status tags: DECIDED (Itay agreed), PROPOSED (suggested, unconfirmed), OPEN (placeholder, nobody decided).
// Units: cu = creature units (a full-size boss is ~2 x 2 cu), beat = one sim step.

export const P = {
  tempo: {
    beatsPerBar: 4, // beats per bar, for emitter timing (subdiv) and the counter. DECIDED
    bpm: 120, // beats per minute, 100–140. PROPOSED
    planBeats: 2, // freeze/planning window per step, in beats, 1–4. PROPOSED
    introBeats: 4, // extra planning time before the first step, in beats, 0–8. OPEN
    motionBeats: 1, // how long the eased step animation lasts, in beats, 0.5–1. PROPOSED
    timeoutRepeat: true, // on timeout without input: true repeats the last move, false holds still. PROPOSED
  },
  crawl: {
    leadFraction: 0.75, // share of the move covered right on the beat, 0.5–0.9. DECIDED
    leadMs: 150, // time to cover leadFraction, ms, 80–250. PROPOSED
  },
  field: {
    width: 3.5, // playfield width, cu, 2.5–5. PROPOSED
    height: 2, // playfield height, cu, 1.5–3. PROPOSED
    playerMargin: 0.06, // how close the ship may get to the field edge, cu, 0–0.2. OPEN
    playerTopY: 0, // highest y the ship may reach (0 = centre, -height/2 = top edge), cu. OPEN
    despawnMargin: 0.3, // bullets and shots are removed this far outside the field, cu, 0.1–1. PROPOSED
  },
  creature: {
    scale: 0.5, // world size of creature units; 1 = a 2 x 2 boss, which can't fit above the player. OPEN
    anchorX: 0, // creature centre x, cu from field centre. OPEN
    anchorY: -0.5, // creature centre y, cu from field centre (negative = up). OPEN
    driftPerBeat: 0, // creature drift down-screen per beat, cu; 0 holds position. OPEN
  },
  player: {
    startX: 0, // spawn x, cu from field centre. OPEN
    startY: 0.7, // spawn y, cu from field centre (positive = down). OPEN
    reach: 0.3, // max move per beat, cu, 0.15–0.5. PROPOSED
    hitR: 0.02, // hitbox radius, cu, 0.01–0.04. PROPOSED
    grazeR: 0.08, // graze ring radius, cu, 0.05–0.15. PROPOSED
    maxTiltDeg: 8, // max aim tilt at full horizontal reach, degrees, 0–15. PROPOSED
  },
  energy: {
    max: 100, // full bar, energy units. OPEN
    start: 60, // energy at spawn, 0–max. OPEN
    grazeCap: 80, // grazing can't fill above this, 0–max. PROPOSED
    grazeGain: 4, // per grazed bullet, 0–20. OPEN
    shotCost: 2, // per shot fired, 0–10. OPEN
    hitCost: 25, // per bullet hit, 5–100. OPEN
    shotCanKill: false, // false: a shot that would empty the bar doesn't fire. OPEN
  },
  shots: {
    speed: 1, // player shot speed, cu per beat, 0.5–2 (arrival in 1–2 beats). PROPOSED
    r: 0.02, // player shot radius, cu, 0.01–0.05. OPEN
    damage: 1, // weak-point HP removed per shot, 1–5. OPEN
    hullBlocks: true, // creature hull stops player shots. OPEN
    substeps: 8, // shot-vs-creature test slices per beat, 4–32. PROPOSED
  },
  weak: {
    hp: 10, // hits to destroy one weak point, 1–50. OPEN
  },
  enemy: {
    bulletSpeed: 0.25, // base enemy bullet speed, cu per beat, 0.1–0.4. PROPOSED
    speedScale: 1, // global multiplier on bulletSpeed, 0.5–2. PROPOSED
    densityScale: 1, // global multiplier on bullets per volley, 0.25–2. PROPOSED
    bulletR: 0.025, // enemy bullet radius, cu, 0.01–0.05. OPEN
    burstSpeedStep: 0.1, // 'aimed' burst: speed drop per bullet, fraction, 0.05–0.2. PROPOSED
    streamMinSpeed: 0.4, // 'stream' line: slowest bullet as a fraction of speed, 0.2–0.8. PROPOSED
    spinStepDeg: 17, // 'spin' aim: rotation per volley, degrees, 5–45. PROPOSED
  },
  input: {
    tapMaxPx: 8, // pointer travel under which a press is a tap (fire toggle), px, 4–16
    tapMaxMs: 300, // press duration under which a press is a tap, ms, 150–400
    nudgeStep: 0.03, // keyboard target nudge, cu per key press, 0.01–0.1
    allowEarlyCommit: true, // Enter commits the plan before the freeze ends (testing aid)
  },
  debug: {
    startVisible: false, // debug overlay on at launch
    untimedFreeze: false, // freeze waits for Enter instead of timing out (testing aid)
  },
  render: {
    viewPadPx: 16, // gap between field and window edge, px, 0–64
    hudHeightPx: 44, // HUD strip above the field, px, 32–80
    scrollPerBeat: 0.12, // background scroll speed, cu per beat, 0–0.5
    stripeGap: 0.25, // background stripe spacing, cu, 0.1–0.5
    lineWidthPx: 2, // path and ring stroke width, px, 1–4
    previewAlpha: 0.55, // next-beat path opacity, 0–1
    previewDotFrac: 0.6, // end-of-path dot size relative to the bullet, 0.3–1
    dangerSizePx: 9, // danger mark half-size, px, 5–16
    reachAlpha: 0.25, // reach circle opacity, 0–1
    shipSize: 0.05, // ship drawing half-size, cu, 0.03–0.08 (visual only; hitbox is player.hitR)
    gunLen: 0.07, // gun barrel drawing length, local creature units, 0.04–0.12
    gunWidth: 0.035, // gun barrel drawing width, local creature units, 0.02–0.06
    weakPulseBeats: 2, // weak point colour pulse period, beats, 1–4
    hitFlashMs: 220, // screen flash after a hit, ms, 0–400
    highlightRadiusFrac: 0.62, // specular arc radius relative to the shape, 0.4–0.8
    highlightStartDeg: 200, // specular arc start angle (0 = right, 90 = down), degrees
    highlightEndDeg: 250, // specular arc end angle, degrees
    highlightWidthFrac: 0.16, // specular arc stroke width relative to the shape, 0.08–0.25
    highlightAlpha: 0.85, // specular arc opacity, 0–1
    fontSizePx: 16, // HUD text size, px, 12–24
  },
  colors: {
    bg: 0x0b0820, // background
    bgStripe: 0x171236, // scrolling background stripes
    field: 0x110c2c, // playfield fill
    hullA: 0xff3d8b, // creature hull, primary
    hullB: 0xff8a3d, // creature hull, secondary
    gun: 0x7b5cff, // creature guns
    weak: 0x2ef2c8, // weak point
    weakHurt: 0xffffff, // weak point pulse colour
    bullet: 0xffe14d, // enemy bullet
    bulletNew: 0xff9a3d, // volley about to fire (preview)
    player: 0x3dd6ff, // ship
    reach: 0x3dd6ff, // reach circle
    plan: 0xffffff, // planned move line and target
    danger: 0xff2d55, // danger marks
    graze: 0x9dff5c, // graze marks and ring
    shot: 0x9dff5c, // player shots
    energy: 0x9dff5c, // energy bar
    energyLow: 0xff2d55, // energy bar when low
    energyCap: 0xffffff, // graze cap marker
    highlight: 0xfff1c9, // warm specular arc
    text: 0xf4f0ff, // HUD text
    hitFlash: 0xff2d55, // screen flash on hit
  },
  hud: {
    energyLowFrac: 0.3, // bar turns to energyLow below this share of max, 0–1
    energyBarWidthPx: 260, // energy bar width, px, 120–400
    energyBarHeightPx: 12, // energy bar height, px, 6–20
  },
};

export type Params = typeof P;
