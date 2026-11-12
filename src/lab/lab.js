// EFFECTS LAB (dev only: localhost:5199/lab.html; the build leaves it out)
// A page for trying out gourd effects before a look goes into the game. One row per thing to decide:
// "Now" (what the game does today), then the tries from variants.js, each in its own tile, all in step.
// Three kinds of row:
//   break  the gourd flies in, hits a player standing there for scale, and breaks (VARIANTS); loops
//   fire   a player holding the gourd sprays a full load of seeds to the left (FIRING); loops
//   anim   a piece of the game's drawing that can be swapped (ANIM in render/anims.js: bits that move
//          on their own; LOOKS in render/statusLooks.js: bales and players damaged, frozen, glued),
//          shown on a little scene (SCENES), with the try swapped in while its tile is drawn (ANIMS)
//   cannon a gourd cannon firing every loop, and what happens at its muzzle (CANNON)
//   bale   a nearly broken hay bale breaking every loop, by the event for how (BALE): straw, or burn
//          (sitting on a bonfire)
// Some break rows also show what else the game does there (CONTEXT: a blast, the Black Hole growing,
// the Airstrike's target), so the effect is judged with it. Everything is drawn by the game's own code
// (effects, gourds, the player), so a tile looks just like the game.
// Controls along the top: which map's colors to show them on, zoom (round the action), slow motion,
// pause, and a time scrubber (drag it to stop at any moment). Each tile uses the same random numbers
// every loop, so a paused moment is the same every time.

import { CONFIG, PLAYER_COLORS } from '../config.js'
import { addPlayer, createGame, currentMap, stepGame } from '../game/game.js'
import { emptyInput } from '../game/input.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { makeSnapshot } from '../game/snapshot.js'
import { BUILTIN_MAP_IDS, MAPS } from '../maps/builtin.js'
import { ANIM, clock } from '../render/anims.js'
import { LOOKS } from '../render/statusLooks.js'
import { PARTS, drawMapFront, mock, paintBackdrop } from '../render/scenery.js'
import { THEMES } from '../maps/themes.js'
import { CANNON as CANNON_DEF, cannonParts } from '../game/cannons.js'
import { BALE } from '../game/level.js'
import { createEffects, drawEffects, spawnEffect, updateEffects } from '../render/effects.js'
import { GOURD } from '../render/palette.js'
import { drawPlayer, handOf } from '../render/players.js'
import { drawBale, drawBonfire, drawCannon } from '../render/level.js'
import { drawAirstrikeTarget, drawBlackHole, drawFlyingPumpkin, drawPumpkin, drawTrap, pumpkinColors } from '../render/pumpkins.js'
import { lerp } from '../util/math.js'
import { ANIMS, BALE as BALE_BREAKS, CANNON, FIRING, VARIANTS } from './variants.js'

const TILE = { w: 270, h: 170, scale: 48 }   // px, and px per m (at 1x zoom)
const FLOOR = 0.6                             // m: the floor's height above the tile's bottom edge (at 1x zoom)
const LOOP = { fly: 0.3, fire: 0.8, bale: 0.6, length: 2 }   // s (game time): a gourd's flight in, when the cannon fires, when the bale breaks, the whole loop
const HIT = [0.2, 1.05]                       // m: where the gourd breaks (at the player's chest)
const FROM = -2.9                             // m: where it flies in from
const STANDS = { break: HIT[0] + 0.35, fire: 2.2, anim: 1.9, cannon: 2.4, bale: 1.9 }   // m: where the player stands, by kind of row
const FIRE_START = 0.25                       // s: the first shot
const TITLES = { mini: 'Gourd Cluster (each piece)', seed: 'Seed Spitter (each seed hitting)' }   // (rows whose type's own name doesn't say enough)
const SPEEDS = [[1, '1x'], [0.5, '0.5x'], [0.25, '0.25x'], [0, 'Pause']]
const ZOOMS = [1, 2, 3]
const STEP = 1 / 120                          // s: everything moves in fixed steps (so a moment always looks the same)

// What else the game shows where these break, by type name: spawn(fx, ev) adds effects with the
// break; under/over(ctx, v, age) draw behind or in front of the player, age s after the break.
const CONTEXT = {
  boom: { spawn: (fx, ev) => spawnEffect(fx, { type: 'boom', r: PUMPKIN_TYPES.boom.blast.radius, ...ev }) },
  blackhole: {
    spawn: (fx, ev) => spawnEffect(fx, { type: 'hole', ...ev }),
    over: (ctx, v, age) => { const h = PUMPKIN_TYPES.blackhole.hole; drawBlackHole(ctx, HIT[0], HIT[1], lerp(h.startRadius, h.maxRadius, Math.min(1, age / h.growTime)), v.X, v.Y, v.s) },
  },
  airstrike: { under: (ctx, v, age) => drawAirstrikeTarget(ctx, HIT[0], 0, Math.min(1, age / PUMPKIN_TYPES.airstrike.delay), PUMPKIN_TYPES.airdrop.radius, v.X, v.Y, v.s) },
}

// The little scenes an animation row shows, by name: draw(ctx, v, t, theme) (t: s, running on), and
// focus: the spot (m) the zoom closes in on.
const AT = [0, 1.3]   // (mid-air, about chest high)
const flying = (typeName, x, y, angle, extra) => ({ x, y, angle, typeName, ripeness: 1, owner: 0, radius: PUMPKIN_TYPES[typeName].radius, heading: null, ...extra })
const onPatch = (ctx, v, theme, typeName, glow, t) => {   // a gourd growing on its patch, its leaves on the ground, and its glow
  const type = PUMPKIN_TYPES[typeName], r = type.radius
  ctx.fillStyle = GOURD.patchLeaf
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(v.X(side * 0.28), v.Y(0.06), 0.2 * v.s, 0.07 * v.s, side * 0.4, 0, Math.PI * 2); ctx.fill() }
  ANIM[glow](ctx, v.X(0), v.Y(r), r * v.s, v.s, type.color, t)
  drawPumpkin(ctx, v.X(0), v.Y(r), r * v.s, 0, type, type.mark, theme.shade)
}
const SCENES = {
  homing: {   // a Homing gourd on the hunt, weaving a little
    focus: AT,
    draw: (ctx, v, t, theme) => {
      const heading = 0.25 * Math.sin(t * 0.8)
      drawFlyingPumpkin(ctx, flying('homing', AT[0] + 0.4 * Math.sin(t * 0.8), AT[1] + 0.15 * Math.sin(t * 1.3), heading - Math.PI / 2, { heading }), { players: [] }, v.X, v.Y, v.s, theme.shade)
    },
  },
  lockOn: { focus: [STANDS.anim, 1.2], draw: () => {} },   // (the player's drawn anyway; the reticle goes on them: see drawAnim)
  patch: { focus: [0, 0.4], draw: (ctx, v, t, theme) => onPatch(ctx, v, theme, 'frost', 'patchGlow', t) },
  superRare: { focus: [0, 0.4], draw: (ctx, v, t, theme) => onPatch(ctx, v, theme, 'boom', 'superRareGlow', t) },
  hole: { focus: AT, draw: (ctx, v) => drawBlackHole(ctx, AT[0], AT[1], 0.6, v.X, v.Y, v.s) },
  spin: {   // a Boomerang and a Buzzsaw spinning in mid-air
    focus: AT,
    draw: (ctx, v, t, theme) => {
      for (const [typeName, x] of [['boomerang', -0.6], ['buzzsaw', 0.6]]) drawFlyingPumpkin(ctx, flying(typeName, x, AT[1], t * 24), { players: [] }, v.X, v.Y, v.s, theme.shade)
    },
  },
  mine: { focus: [0, 0.2], draw: (ctx, v, t, theme) => drawTrap(ctx, { kind: 'landmine', x: 0, y: 0, angle: 0, open: 1 }, v.X, v.Y, v.s, theme.shade) },
  baleDamage: {   // three bales: healthy, damaged, nearly broken
    focus: [0, 0.5],
    draw: (ctx, v, t, theme) => [[-1.25, 1], [0, 0.5], [1.25, 0.2]].forEach(([x, health]) => drawBale(ctx, bale(x, { health }), v.X, v.Y, v.s, theme.shade)),
  },
  baleFrozen: { focus: [0, 0.5], draw: (ctx, v, t, theme) => drawBale(ctx, bale(0, { frozen: true }), v.X, v.Y, v.s, theme.shade) },
  baleGlued: { focus: [0, 0.5], draw: (ctx, v, t, theme) => drawBale(ctx, bale(0, { sticky: true }), v.X, v.Y, v.s, theme.shade) },
  playerFrozen: { focus: [0, 0.95], alone: true, draw: (ctx, v, t, theme) => drawStanding(ctx, v, theme, { frozen: true }) },
  playerGlued: { focus: [0, 0.6], alone: true, draw: (ctx, v, t, theme) => drawStanding(ctx, v, theme, { glued: true }) },
  sunsetSky: { focus: [16, 9], fit: true, alone: true, draw: (ctx, v) => paintBackdrop(ctx, THEMES.sunset, v.X, v.Y, v.s) },   // (all of Scarecrow Field's backdrop)
  campForest: { focus: [16, 6], fit: true, alone: true, draw: (ctx, v) => paintBackdrop(ctx, THEMES.night, v.X, v.Y, v.s) },   // (Bonfire Camp's backdrop, round its forest)
  scarecrow: {   // Scarecrow Field's backdrop round its scarecrow (zoom closes in on it)
    focus: [11.3, 4.1], alone: true,
    draw: (ctx, v) => paintBackdrop(ctx, THEMES.sunset, v.X, v.Y, v.s),
  },
  // Whole maps in a theme with no built-in map (Bonfire Camp's layout), in big tiles; zoom: how close
  // in round focus they start (the zoom buttons multiply it).
  graveTree: { focus: [8, 8.5], zoom: 1.8, fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'graveyard', t) },
  graves: { focus: [24, 7.5], zoom: 1.8, fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'graveyard', t) },
  lavaWhole: { focus: [16, 9], fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'lava', t) },
  lavaVolcano: { focus: [25.3, 8.6], zoom: 2.6, fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'lava', t) },
  graveSky: { focus: [16, 9], fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'graveyard', t) },
  lavaTops: { focus: [10, 5.4], zoom: 3, fit: true, big: true, alone: true, draw: (ctx, v, t) => drawWholeMap(ctx, v, 'lava', t) },
}
const drawWholeMap = (ctx, v, themeKey, t) => {   // (the backdrop drawn now, not from the game's cache: the tries swap pieces of it)
  const map = { ...MAPS.camp, theme: THEMES[themeKey] }
  paintBackdrop(ctx, map.theme, v.X, v.Y, v.s)
  drawMapFront(ctx, map, v.X, v.Y, v.s, null, t)
}
const bale = (x, state) => ({ x, y: BALE.h / 2, angle: 0, health: 1, ...state })
const drawStanding = (ctx, v, theme, state) => {   // the scale player, standing at 0 in this state (in red, so pale blue shows up)
  const p = players.anim
  drawPlayer(ctx, { ...p.snap, color: PLAYER_COLORS[1], ...state }, false, theme, x => v.X(x - p.x), y => v.Y(y - p.feet), v.s)
}
const TABLES = { ANIM, LOOKS, BACKDROP: PARTS }
// The cannon the cannon row fires: on the floor, aimed up and left, firing once a loop at LOOP.fire.
const CANNON_AT = { x: 1.4, y: 0, face: 'top', aim: 155, speed: 9, every: LOOP.length }

const state = { mapId: BUILTIN_MAP_IDS[0], speed: 1, zoom: 1, clock: 0 }
const players = { break: standingPlayer(null), fire: standingPlayer('spitter') }
players.anim = players.cannon = players.bale = players.break
const tiles = []

// --- the page ---

function buildPage() {
  const bar = document.querySelector('.lab-bar')
  bar.innerHTML = `<label>Map <select data-map>${BUILTIN_MAP_IDS.map(id => `<option value="${id}">${MAPS[id].name}</option>`).join('')}</select></label>
    <span class="seg">${ZOOMS.map(z => `<button data-zoom="${z}">Zoom ${z}x</button>`).join('')}</span>
    <span class="seg">${SPEEDS.map(([v, label]) => `<button data-speed="${v}">${label}</button>`).join('')}</span>
    <input type="range" data-time min="0" max="${LOOP.length}" step="0.01" value="0" title="Time in the loop: drag to stop at a moment">`
  bar.querySelector('[data-map]').addEventListener('change', e => { state.mapId = e.target.value })
  for (const b of bar.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { state.speed = +b.dataset.speed; marks() })
  for (const b of bar.querySelectorAll('[data-zoom]')) b.addEventListener('click', () => { state.zoom = +b.dataset.zoom; marks() })
  bar.querySelector('[data-time]').addEventListener('input', e => { state.speed = 0; state.clock = +e.target.value; marks() })
  marks()
  for (const [typeName, tries] of Object.entries(VARIANTS)) {
    addRow('break', typeName, TITLES[typeName] || PUMPKIN_TYPES[typeName].name,
      { label: 'Now', about: 'What the game does today.', make: (fx, ev) => spawnEffect(fx, { type: 'splat', typeName, ripeness: 1, rot: 0, ...ev }) }, tries)
  }
  for (const [typeName, tries] of Object.entries(FIRING)) {
    addRow('fire', typeName, `${PUMPKIN_TYPES[typeName].name} (firing)`, { label: 'Now', about: 'What the game does today.', make: (fx, ev) => spawnEffect(fx, { type: 'spit', typeName, ripeness: 1, ...ev }) }, tries)
  }
  for (const row of Object.values(ANIMS)) addRow('anim', row, row.title, { label: 'Now', about: 'What the game does today.', draw: TABLES[row.table || 'ANIM'][row.piece] }, row.tries)
  const BALE_TITLES = { straw: 'Hay bale: breaking', burn: 'Hay bale: burning up (in a bonfire)' }
  for (const [type, tries] of Object.entries(BALE_BREAKS)) addRow('bale', type, BALE_TITLES[type], { label: 'Now', about: 'What the game does today.', make: (fx, ev) => spawnEffect(fx, { type, ...ev }) }, tries)
  addRow('cannon', 'classic', 'Gourd cannon (firing)', { label: 'Now', about: 'What the game does today.', make: (fx, ev) => spawnEffect(fx, { type: 'cannon', ...ev }) }, CANNON)
}

// subject: the pumpkin type's name (break, fire) or the ANIMS row (anim)
function addRow(kind, subject, title, now, tries) {
  const row = document.createElement('section')
  row.innerHTML = `<h2>${title}</h2><div class="lab-tiles"></div>`
  document.querySelector('.lab-rows').append(row)
  const colors = PUMPKIN_TYPES[subject] && pumpkinColors(PUMPKIN_TYPES[subject], 1, 0)   // (a gourd's row: its colors)
  const looks = [now, ...tries.map((v, i) => ({ label: `${'ABCDE'[i]} · ${v.name}`, about: v.about, draw: v.draw, make: v.make && ((fx, ev) => v.make(fx, ev, colors)) }))]
  for (const look of looks) {
    const fig = document.createElement('figure')
    fig.innerHTML = `<canvas></canvas><figcaption><b>${look.label}</b> ${look.about}</figcaption>`
    row.querySelector('.lab-tiles').append(fig)
    const canvas = fig.querySelector('canvas'), dpr = window.devicePixelRatio || 1, k = kind === 'anim' && SCENES[subject.scene].big ? 2 : 1   // (big: twice the size)
    const w = TILE.w * k, h = TILE.h * k
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const tile = { kind, subject, look, ctx: canvas.getContext('2d'), dpr, w, h, seed: tiles.length + 1 }
    tile.script = SCRIPTS[kind](subject, look)
    reset(tile)
    tiles.push(tile)
  }
}

function marks() {
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', +b.dataset.speed === state.speed)
  for (const b of document.querySelectorAll('[data-zoom]')) b.classList.toggle('on', +b.dataset.zoom === state.zoom)
}

// --- a tile ---

// Meters to tile pixels, zoomed in round `focus`, which stays where it would be at 1x (or, centered:
// sits in the middle of the tile, for the animation rows' scenes).
function view(focus, centered) {
  const s = TILE.scale * state.zoom
  const x0 = centered ? TILE.w / 2 : TILE.w * 0.45 + focus[0] * TILE.scale, y0 = centered ? TILE.h * 0.55 : TILE.h - (FLOOR + focus[1]) * TILE.scale
  return { X: x => x0 + (x - focus[0]) * s, Y: y => y0 - (y - focus[1]) * s, s }
}
// A whole map's backdrop fitted to the tile's height at 1x (zoom closes in round `focus`; and the
// scene's own zoom, if it has one).
function fitView(focus, tile, zoom = 1) {
  const s = tile.h / CONFIG.view.h * state.zoom * zoom
  return { X: x => tile.w / 2 + (x - focus[0]) * s, Y: y => tile.h / 2 - (y - focus[1]) * s, s }
}
const FOCUS = { break: () => HIT, fire: () => muzzle().slice(0, 2), anim: tile => SCENES[tile.subject.scene].focus, cannon: () => { const m = cannonParts(CANNON_AT).muzzle; return [m.x, m.y] }, bale: () => [0, BALE.h / 2] }

// What happens in a tile's loop, by kind of row: a list of { at (s), run(tile) }.
const SCRIPTS = {
  break: (typeName, look) => [{
    at: LOOP.fly,
    run: tile => { const ev = { x: HIT[0], y: HIT[1] }; CONTEXT[typeName]?.spawn?.(tile.fx, ev); look.make(tile.fx, ev) },
  }],
  fire: (typeName, look) => {
    const type = PUMPKIN_TYPES[typeName], seed = PUMPKIN_TYPES.seed
    return Array.from({ length: type.ammo }, (_, i) => ({
      at: FIRE_START + i * type.fireInterval,
      run: tile => {   // (like Player.fireSeed: a little spread)
        const [x, y, aim] = muzzle(), a = aim + (Math.random() - 0.5) * 0.12, dx = Math.cos(a), dy = Math.sin(a)
        tile.seeds.push({ x, y, vx: dx * type.seedSpeed, vy: dy * type.seedSpeed, g: CONFIG.gravity * seed.gravityScale })
        look.make(tile.fx, { x, y, dx, dy })
      },
    }))
  },
  anim: () => [],
  bale: (subject, look) => [{ at: LOOP.bale, run: tile => look.make(tile.fx, { x: 0, y: BALE.h / 2 }) }],
  cannon: (typeName, look) => [{
    at: LOOP.fire,
    run: tile => {   // (like cannons.js's fire: the gourd out of the muzzle, and the cannon event)
      const { muzzle, dir, aim } = cannonParts(CANNON_AT), r = PUMPKIN_TYPES[CANNON_DEF.ammo].radius
      tile.seeds.push({ x: muzzle.x + dir.x * r, y: muzzle.y + dir.y * r, vx: dir.x * CANNON_AT.speed, vy: dir.y * CANNON_AT.speed, g: CONFIG.gravity, type: CANNON_DEF.ammo })
      look.make(tile.fx, { x: muzzle.x, y: muzzle.y, angle: aim })
    },
  }],
}

const reset = tile => Object.assign(tile, { fx: createEffects(), at: 0, next: 0, seeds: [], random: seeded(tile.seed) })

// Moves a tile to time t in the loop (starting the loop over first if t is behind it).
function playTo(tile, t) {
  if (t < tile.at) reset(tile)
  while (tile.at < t) {
    const step = Math.min(STEP, t - tile.at)
    while (tile.next < tile.script.length && tile.script[tile.next].at <= tile.at + step) {
      const random = Math.random   // (the tile's own fixed random numbers)
      Math.random = tile.random
      try { tile.script[tile.next++].run(tile) } finally { Math.random = random }
    }
    updateEffects(tile.fx, step)
    for (const sd of tile.seeds) { sd.vy -= sd.g * step; sd.x += sd.vx * step; sd.y += sd.vy * step }
    tile.at += step
  }
}
const seeded = seed => () => {   // (mulberry32)
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function drawTile(tile, t) {
  const { ctx, dpr, kind } = tile, theme = MAPS[state.mapId].theme, scene = kind === 'anim' && SCENES[tile.subject.scene], age = t - LOOP.fly
  const v = scene?.fit ? fitView(FOCUS[kind](tile), tile, scene.zoom) : view(FOCUS[kind](tile), kind === 'anim')
  const context = kind === 'break' && CONTEXT[tile.subject]
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = theme.sky || theme.bands[0]
  ctx.fillRect(0, 0, tile.w, tile.h)
  ctx.fillStyle = theme.platform
  ctx.fillRect(0, v.Y(0), tile.w, tile.h)
  ctx.fillStyle = theme.platformTop
  ctx.fillRect(0, v.Y(0), tile.w, 0.12 * v.s)
  if (context?.under && age >= 0) context.under(ctx, v, age)
  const p = players[kind], at = x => v.X(x - p.x + STANDS[kind]), up = y => v.Y(y - p.feet)
  if (!(kind === 'anim' && SCENES[tile.subject.scene].alone)) drawPlayer(ctx, p.snap, false, theme, at, up, v.s)
  if (kind === 'anim') return drawAnim(tile, v, theme, at, up)
  const fire = kind === 'bale' && tile.subject === 'burn' && { x: 0, y: 0, w: 1.4 }
  if (fire) drawBonfire(ctx, fire, v.X, v.Y, v.s, false, theme.shade)
  if (kind === 'bale' && t < LOOP.bale) drawBale(ctx, bale(0, { health: 0.2 }), v.X, v.Y, v.s, theme.shade)
  if (fire) drawBonfire(ctx, fire, v.X, v.Y, v.s, true)
  if (kind === 'cannon') drawCannon(ctx, CANNON_AT, ((LOOP.fire - t) % LOOP.length + LOOP.length) % LOOP.length, v.X, v.Y, v.s, theme.shade)
  if (kind === 'break' && t < LOOP.fly) {   // flying in, spinning
    const type = PUMPKIN_TYPES[tile.subject], u = t / LOOP.fly
    drawPumpkin(ctx, v.X(FROM + (HIT[0] - FROM) * u), v.Y(HIT[1] + 0.25 * (1 - u)), type.radius * v.s, -t * 14, type, type.mark, theme.shade)
  }
  if (context?.over && age >= 0) context.over(ctx, v, age)
  for (const sd of tile.seeds) {   // (seeds, or the cannon's gourd)
    const type = PUMPKIN_TYPES[sd.type || 'seed']
    drawPumpkin(ctx, v.X(sd.x), v.Y(sd.y), type.radius * v.s, sd.type ? -tile.at * 6 : Math.atan2(sd.vy, sd.vx), type, type.mark, sd.type && theme.shade)
  }
  drawEffects(ctx, tile.fx, theme, v.X, v.Y, v.s)
}

// An animation row's tile: its scene, with this tile's version of the piece swapped in and the clock
// set to the lab's (so pause and the scrubber stop it), then both put back.
function drawAnim(tile, v, theme, at, up) {
  const { piece, scene } = tile.subject, table = TABLES[tile.subject.table || 'ANIM'], real = table[piece], realNow = clock.now, t = state.clock
  table[piece] = tile.look.draw
  clock.now = () => t
  try {
    SCENES[scene].draw(tile.ctx, v, t, theme)
    if (scene === 'lockOn') { const torso = players.anim.snap.parts[0]; ANIM.lockOn(tile.ctx, at(torso[0]), up(torso[1]), v.s, t) }
  } finally { table[piece] = real; clock.now = realNow }
}

// Where a firing player's seeds leave the gourd (tile m) and which way (radians), as in Player.fireSeed.
function muzzle() {
  const p = players.fire, [hx, hy] = handOf(p.snap), [ax, ay] = p.snap.aim
  const a = Math.atan2(ay - hy, ax - hx), x = hx - p.x + STANDS.fire, y = hy - p.feet
  return [x + Math.cos(a) * 0.15, y + Math.sin(a) * 0.15, a]
}

// A player from a real (headless) game, standing still facing left (holding a gourd of this type, or
// nothing). x: where they stand; feet: the top of the floor under them (both in the game's meters).
function standingPlayer(held) {
  const game = createGame()
  addPlayer(game, 0)
  const p = game.players[0]
  if (held) p.held = { typeName: held, power: 1, ripeness: 1, ammo: PUMPKIN_TYPES[held].ammo, blocks: 0 }
  for (let i = 0; i < 120; i++) {
    const at = p.torso.getPosition()
    stepGame(game, [{ ...emptyInput(), aimX: at.x - 5, aimY: at.y + 0.3 }])
  }
  const snap = makeSnapshot(game).players[0], at = p.torso.getPosition()
  const under = currentMap(game).platforms.filter(f => Math.abs(at.x - f.x) <= f.w / 2 && f.y + f.h / 2 <= at.y)
  const feet = Math.max(...under.map(f => f.y + f.h / 2))   // (the top of the floor they stand on)
  return { snap, x: at.x, feet }
}

// --- start (last: everything above has to be set up first) ---

buildPage()
let last = performance.now()
requestAnimationFrame(function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * state.speed
  last = now
  state.clock += dt
  const t = state.clock % LOOP.length
  document.querySelector('[data-time]').value = t
  for (const tile of tiles) {
    playTo(tile, t)
    drawTile(tile, t)
  }
  requestAnimationFrame(frame)
})
