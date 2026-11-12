// EFFECTS — purely visual stuff (particles, blast clouds, rings, popups). Not part of
// the physics, so each computer makes its own from the game's events. Their colors are in FX
// (palette.js), by event.
//
// The flat look: nothing fades into a blob. Particles shrink away instead of fading, and come in
// shapes (PARTICLE_SHAPES: round dots, tumbling 5-sided chunks of rind, seeds, ice shards, leaves,
// rubber scraps, shavings, drops, sparks, stars, ...). Each can have its own gravity, air drag and side-to-side
// flutter, so ice drops fast while leaves float down. A blast (every `boom`)
// is a white flash plus a cloud of flat puffs that pop out, cool from yellow to orange to the map's
// smoke color, drift up and shrink away (the style guide's puff cloud, scaled to the blast).
//
//   createEffects()                            the empty set
//   spawnEffect(effects, ev)                   what a game event looks like (EFFECTS, by event type)
//   updateEffects(effects, dt)                 moves and ages everything, drops what's done
//   drawEffects(ctx, effects, theme, X, Y, s)  draws the clouds, particles and rings (popups: hud.js)
//   emit(effects, opts), ring(effects, ...)    the building blocks of a break (and the effects lab's tries)

import { CONFIG } from '../config.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { FX } from './palette.js'
import { pumpkinColors } from './pumpkins.js'
import { mixHex } from '../util/color.js'
import { lerp } from '../util/math.js'

export function createEffects() {
  // clouds: blasts' puff clouds { x, y, k (scale), age, life, puffs: [{ ang, d, r, hot }] }
  // popups: floating text (damage numbers, KO!; look: how hud.js draws it); rings: expanding circles (blasts, a Black Hole closing)
  // shake: { amount (m), age, life } fading screen shake (an airdrop landing), or null
  return { particles: [], clouds: [], popups: [], rings: [], shake: null }
}

// One particle. shape: one of PARTICLE_SHAPES; seed: a random number fixing a chunk's outline (and its
// flutter); gravity: times the game's; drag: how fast the air slows it (per s); sway: how hard it
// flutters side to side (m/s); spin: how fast it tumbles (rad/s).
function particle(effects, x, y, vx, vy, life, r, color, shape = 'dot', { gravity = 0.6, drag = 0, sway = 0, spin = 8 } = {}) {
  effects.particles.push({ x, y, vx, vy, life, age: 0, r, color, shape, spin: (Math.random() - 0.5) * 2 * spin, seed: Math.random(), gravity, drag, sway })
}

// n particles from (x, y): all round, or `spread` radians either side of `heading`. Each picks its
// speed (m/s), life (s) and size (m, half across) from the [min, max] ranges, and a color in turn.
// lift: m/s added upward; from: m out from (x, y) along its way that each starts (with a negative speed,
// they fly back in: sucked in). gravity, drag, sway, spin: as particle() above.
export function emit(effects, { x, y, n, colors, speed, life, size, shape = 'dot', lift = 0, heading = 0, spread = Math.PI, from = 0, ...motion }) {
  for (let i = 0; i < n; i++) {
    const a = heading + (Math.random() * 2 - 1) * spread, v = lerp(speed[0], speed[1], Math.random())
    particle(effects, x + Math.cos(a) * from, y + Math.sin(a) * from, Math.cos(a) * v, Math.sin(a) * v + lift, lerp(life[0], life[1], Math.random()),
      lerp(size[0], size[1], Math.random()), colors[i % colors.length], shape, motion)
  }
}

// An expanding ring (r: m, how big it gets; life: s).
export const ring = (effects, x, y, r, color, life) => effects.rings.push({ x, y, r, color, age: 0, life })

// A burst of n particles flying out from (x, y).
function burst(effects, x, y, n, colors, speed, life, size, lift = 0, shape) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = lerp(speed[0], speed[1], Math.random())
    particle(effects, x, y, Math.cos(a) * v, Math.sin(a) * v + lift, lerp(life[0], life[1], Math.random()),
      lerp(size[0], size[1], Math.random()), colors[i % colors.length], shape)
  }
}

// n particles sprayed from (x, y) along (dx, dy) (a unit vector), up to `spread` radians either side of it.
function spray(effects, x, y, n, colors, [dx, dy], spread, speed, life, size, lift = 0, shape) {
  const heading = Math.atan2(dy, dx)
  for (let i = 0; i < n; i++) {
    const a = heading + (Math.random() * 2 - 1) * spread
    const v = lerp(speed[0], speed[1], Math.random())
    particle(effects, x, y, Math.cos(a) * v, Math.sin(a) * v + lift, lerp(life[0], life[1], Math.random()),
      lerp(size[0], size[1], Math.random()), colors[i % colors.length], shape)
  }
}

// A blast's puff cloud (see the top). k: its scale (1 for a 1.25 m blast, the style guide's size).
// look: its flash and puff colors (FX.boom: fire; FX.iceburst: cold).
const CLOUD = { puffs: 11, life: 1.6, flash: 0.35 }
function cloud(effects, x, y, k, look = FX.boom) {
  const puffs = Array.from({ length: CLOUD.puffs }, (_, i) => i === 0
    ? { ang: 0, d: 0, r: 0.22 + Math.random() * 0.2, hot: 1 }   // (the first sits in the middle, hottest)
    : { ang: Math.random() * Math.PI * 2, d: 0.15 + Math.random() * 0.45, r: 0.22 + Math.random() * 0.2, hot: 1 - 0.6 * Math.random() })
  effects.clouds.push({ x, y, k, age: 0, life: CLOUD.life, puffs, look })
}

// A Teleport's specks (flickering dots in purples and pinks), all over the body (torso's middle at x, y):
//   leave    where you were: spread round it, sucked in fast and gone
//   arrive   where you appear (both ends of a swap): popping out, stopping almost at once, then sinking and flickering out
const WARP_ROWS = [-0.6, -0.2, 0.2, 0.6]   // (heights over the body, m from its middle)
const WARP = {
  leave: (fx, { x, y }) => { for (const dy of WARP_ROWS) emit(fx, { x, y: y + dy, n: 7, colors: FX.warp, speed: [-3.4, -2.6], from: 0.6, life: [0.18, 0.23], size: [0.035, 0.07], shape: 'mote', gravity: 0 }) },
  arrive: (fx, { x, y }) => { for (const dy of WARP_ROWS) emit(fx, { x, y: y + dy, n: 8, colors: FX.warp, speed: [1.5, 3.5], life: [0.6, 1.1], size: [0.035, 0.075], shape: 'mote', gravity: 0.06, drag: 7 }) },
}

// What each game event looks like, by event type (events with no entry show nothing).
const EFFECTS = {
  boom: (fx, ev) => {
    cloud(fx, ev.x, ev.y, ev.r / 1.25)
    burst(fx, ev.x, ev.y, 40, FX.boom.burst, [4, 13], [0.35, 0.8], [0.05, 0.14], 2)
  },
  iceburst: (fx, ev) => {   // an Ice Bomb: a cold puff cloud (white to pale blue) and ice shards spinning out to its edge
    cloud(fx, ev.x, ev.y, ev.r / 1.6, FX.iceburst)
    emit(fx, { x: ev.x, y: ev.y, n: 22, colors: FX.iceburst.shards, speed: [5, 12], life: [0.3, 0.5], size: [0.06, 0.12], shape: 'shard', gravity: 0.4, drag: 2, spin: 14 })
    emit(fx, { x: ev.x, y: ev.y, n: 8, colors: [FX.iceburst.flash], speed: [1, 4], life: [0.35, 0.6], size: [0.06, 0.09], shape: 'sparkle', gravity: 0, drag: 3, spin: 4 })
  },
  pierce: (fx, ev) => {   // a Buzzsaw cutting through someone (or a bale): chips of squash spraying on ahead of it
    const t = PUMPKIN_TYPES[ev.typeName], chips = [t.rib, t.color, FX.pierce.rind, FX.pierce.flesh]   // (its ribs, its skin, dark rind, pale flesh)
    spray(fx, ev.x, ev.y, 24, chips, [ev.dx, ev.dy], 0.6, [5, 12], [0.35, 0.65], [0.045, 0.08], 1.5, 'chunk')
    burst(fx, ev.x, ev.y, 10, chips, [1.5, 4], [0.25, 0.45], [0.035, 0.06], 0, 'chunk')   // (and some falling off where it cut)
  },
  snap: (fx, ev) => burst(fx, ev.x, ev.y, 14, FX.snap, [2, 6], [0.25, 0.45], [0.03, 0.06], 1.5),   // a Chomper biting
  wilt: (fx, ev) => burst(fx, ev.x, ev.y, 10, FX.wilt, [0.5, 2], [0.5, 0.9], [0.03, 0.06], 1),     // a Chomper shriveling away
  hole: (fx, ev) => burst(fx, ev.x, ev.y, 18, FX.hole, [1.5, 5], [0.3, 0.6], [0.03, 0.07]),
  swallow: (fx, ev) => burst(fx, ev.x, ev.y, 14, FX.swallow, [0.5, 2], [0.2, 0.4], [0.03, 0.06]),
  collapse: (fx, ev) => {   // a hole closing: a last purple pulse
    burst(fx, ev.x, ev.y, 24, FX.collapse.burst, [3, 9], [0.3, 0.6], [0.03, 0.07])
    fx.rings.push({ x: ev.x, y: ev.y, r: ev.r * 2.5, color: FX.collapse.ring, age: 0, life: 0.45 })
  },
  shake: (fx, ev) => { fx.shake = { amount: Math.max(ev.amount, fx.shake ? fx.shake.amount : 0), age: 0, life: 0.45 } },
  pop: (fx, ev) => burst(fx, ev.x, ev.y, 8, [ev.color, FX.seed], [1.5, 4], [0.2, 0.35], [0.03, 0.06]),
  cannon: (fx, ev) => {   // a gourd cannon firing: a cone of hot sparks out the barrel, smoke rolling forward and drifting up
    emit(fx, { x: ev.x, y: ev.y, n: 10, colors: [FX.boom.puff.hot, FX.boom.puff.warm, FX.boom.puff.cool], speed: [4, 9], life: [0.08, 0.18], size: [0.06, 0.1], heading: ev.angle, spread: 0.35, gravity: 0, drag: 6 })
    emit(fx, { x: ev.x, y: ev.y, n: 8, colors: FX.cannon.smoke, speed: [1, 3.5], life: [0.6, 1], size: [0.08, 0.14], heading: ev.angle, spread: 0.5, gravity: -0.1, drag: 3 })
  },
  block: (fx, ev) => burst(fx, ev.x, ev.y, 12, FX.block, [2, 6], [0.2, 0.4], [0.03, 0.07], 1),
  freeze: (fx, ev) => burst(fx, ev.x, ev.y, 16, FX.freeze, [1.5, 5], [0.3, 0.6], [0.03, 0.07]),
  warp: (fx, ev) => WARP[ev.how](fx, ev),   // a Teleport (see WARP)
  thaw: (fx, ev) => emit(fx, { x: ev.x, y: ev.y, n: 12, colors: FX.iceburst.shards, speed: [2, 5], life: [0.3, 0.5], size: [0.04, 0.07], shape: 'shard', gravity: 1, spin: 12 }),   // a frozen cannon's ice breaking off
  straw: (fx, ev) => {   // a hay bale breaking (or swallowed by a Black Hole): thin straws spraying out, tumbling and fluttering down, and bits of twine
    emit(fx, { x: ev.x, y: ev.y, n: 26, colors: FX.straw.straws, speed: [2, 7], life: [0.6, 1.1], size: [0.07, 0.095], shape: 'stick', lift: 2, gravity: 0.5, drag: 2, sway: 0.6, spin: 12 })
    emit(fx, { x: ev.x, y: ev.y, n: 3, colors: [FX.straw.twine], speed: [2, 5], life: [0.6, 0.9], size: [0.12, 0.15], shape: 'stick', lift: 2, gravity: 0.8, spin: 10 })
  },
  burn: (fx, ev) => {
    if (ev.small) return burst(fx, ev.x, ev.y, 4, FX.burn.small, [1, 3], [0.2, 0.4], [0.03, 0.05], 3)   // a player in a bonfire
    // a hay bale burning up: a burst of flames licking upward, embers rising, charred bits of straw falling
    const B = FX.burn, x = ev.x, y = ev.y
    emit(fx, { x, y, n: 16, colors: B.flames, speed: [1, 3.5], life: [0.35, 0.6], size: [0.1, 0.16], heading: Math.PI / 2, spread: 0.8, gravity: -0.4, drag: 2 })
    emit(fx, { x, y, n: 10, colors: B.embers, speed: [1, 3], life: [0.8, 1.3], size: [0.025, 0.04], heading: Math.PI / 2, spread: 1, gravity: -0.12, drag: 1.5, sway: 0.6 })
    emit(fx, { x, y, n: 10, colors: B.char, speed: [2, 5], life: [0.6, 0.9], size: [0.06, 0.085], shape: 'stick', lift: 1.5, gravity: 0.8, spin: 10 })
  },
  dust: (fx, ev) => burst(fx, ev.x, ev.y, 2, FX.dust, [0.3, 1.2], [0.25, 0.45], [0.03, 0.06], 0.8),   // sliding down a wall
  yank: (fx, ev) => burst(fx, ev.x, ev.y, 10, FX.yank, [2, 5], [0.25, 0.45], [0.03, 0.06]),
  damage: (fx, ev) => {
    fx.popups.push({ damage: true, x: ev.x + (Math.random() - 0.5) * 0.3, y: ev.y, text: `-${ev.amount}`, size: 0.34 + Math.min(ev.amount, 30) * 0.008, look: 'damage', age: 0, life: 0.8 })
  },
  ko: (fx, ev) => {
    fx.popups.push({ x: ev.x, y: ev.y, text: 'KO!', size: 0.7, look: 'ko', age: 0, life: 1.2 })
  },
  hit: (fx, ev) => {   // punch impact: a quick burst of sparks
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 3 + Math.random() * 4
      particle(fx, ev.x, ev.y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + Math.random() * 0.15,
        0.035 + Math.random() * 0.04, i % 3 ? FX.hit.spark : FX.hit.dark)
    }
  },
  spit: (fx, ev) => {   // a Seed Spitter firing a seed: a little puff out of its mouth, the way the seed goes
    const c = pumpkinColors(PUMPKIN_TYPES[ev.typeName], ev.ripeness ?? 1, 0)
    emit(fx, { x: ev.x, y: ev.y, n: 3, colors: [mixHex(c.color, FX.spit.pale, 0.35), c.color], speed: [1.5, 3.5], life: [0.12, 0.22], size: [0.035, 0.055], heading: Math.atan2(ev.dy, ev.dx), spread: 0.5, gravity: 0, drag: 8 })
  },
  splat: (fx, ev) => {   // a pumpkin breaking: its own look (BREAKS), or tumbling chunks in its colors, plus seeds
    const t = PUMPKIN_TYPES[ev.typeName]
    const type = pumpkinColors(t, ev.ripeness ?? 1, ev.rot ?? 0)
    if (BREAKS[ev.typeName]) return BREAKS[ev.typeName](fx, ev, type, (ev.r ?? t.radius) / t.radius)
    const radius = ev.r ?? t.radius
    const size = radius / 0.22   // splats scale with the pumpkin (a seed vs. a Big Gourd)
    const n = Math.round(6 + 45 * radius)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (2 + Math.random() * 6) * Math.sqrt(size)
      const seed = i % 4 === 0
      particle(fx, ev.x, ev.y, Math.cos(a) * s, Math.sin(a) * s + 2, 0.5 + Math.random() * 0.4,
        (seed ? 0.04 : 0.05 + Math.random() * 0.07) * Math.max(0.5, Math.sqrt(size)),
        seed ? FX.seed : (Math.random() < 0.5 ? type.color : type.rib), seed ? 'seed' : 'chunk')
    }
  },
}

// How some gourds break, by type name, instead of the usual chunks and seeds: made of what they're made
// of (picked in the effects lab, lab.html). colors: the gourd's { color, rib } right now (ripeness);
// k: its size, against its type's usual size (1, unless it's grown).
const BREAKS = {
  boom: (fx, { x, y }, c) => {   // (under its blast) pieces of shell with sparks streaking out ahead of them
    emit(fx, { x, y, n: 14, colors: FX.boom.sparks, speed: [9, 15], life: [0.15, 0.3], size: [0.025, 0.035], shape: 'streak', gravity: 0.3 })
    emit(fx, { x, y, n: 10, colors: [c.color, darker(c.rib)], speed: [5, 10], life: [0.45, 0.7], size: [0.06, 0.1], shape: 'chunk', gravity: 1, lift: 2 })
  },
  bouncebomb: (...args) => BREAKS.boom(...args),   // (the same: shell and sparks under its blast)
  biggourd: (fx, { x, y }, c, k) => {   // big chunks dropping hard, a puff of dust and lots of seeds
    const big = ([a, b]) => [a * k, b * k], fast = ([a, b]) => [a * Math.sqrt(k), b * Math.sqrt(k)]
    emit(fx, { x, y, n: 12, colors: [c.color, c.rib], speed: fast([3, 8]), life: [0.6, 0.9], size: big([0.1, 0.17]), shape: 'chunk', gravity: 1.3, lift: 3, spin: 8 })
    emit(fx, { x, y, n: 14, colors: [FX.seed], speed: fast([2, 7]), life: [0.5, 0.8], size: big([0.045, 0.05]), shape: 'seed', lift: 2 })
    emit(fx, { x, y, n: 10, colors: FX.dust, speed: fast([1, 3]), life: [0.5, 0.8], size: big([0.08, 0.14]), gravity: -0.03, drag: 3 })
  },
  seed: (fx, { x, y }, c) => {   // (a Seed Spitter's seed hitting) it splits in two and the halves fly apart
    emit(fx, { x, y, n: 2, colors: [c.color, c.rib], speed: [1.5, 3], life: [0.25, 0.35], size: [0.035, 0.04], shape: 'seed', gravity: 1, spin: 20 })
  },
  blackhole: (fx, { x, y }) => {   // (as its hole opens) purple and white sparkles and stars drifting off slowly
    emit(fx, { x, y, n: 8, colors: FX.blackhole.dust, speed: [1, 3], life: [0.6, 1], size: [0.05, 0.08], shape: 'sparkle', gravity: 0, drag: 2, spin: 6 })
    emit(fx, { x, y, n: 5, colors: [FX.blackhole.dust[1], FX.blackhole.dust[0]], speed: [1, 2.5], life: [0.6, 0.9], size: [0.05, 0.07], shape: 'star', gravity: 0, drag: 2, spin: 8 })
  },
  airstrike: (fx, { x, y }, c) => {   // (calling it in) a plume of red-orange smoke rising, and chunks
    emit(fx, { x, y, n: 14, colors: FX.airstrike.smoke, speed: [0.5, 2], life: [0.8, 1.3], size: [0.07, 0.12], heading: Math.PI / 2, spread: 0.6, gravity: -0.12, drag: 1.5, sway: 0.4 })
    emit(fx, { x, y, n: 8, colors: [c.color, c.rib], speed: [2, 6], life: [0.4, 0.6], size: [0.05, 0.08], shape: 'chunk' })
  },
  homing: (fx, { x, y }, c) => {   // a tiny hot puff, and its fins flying off
    emit(fx, { x, y, n: 7, colors: [FX.boom.puff.hot, FX.boom.puff.warm, FX.boom.puff.cool], speed: [0.5, 2], life: [0.2, 0.35], size: [0.1, 0.16], drag: 4, gravity: 0 })
    emit(fx, { x, y, n: 4, colors: [c.rib, FX.homing.nozzle], speed: [4, 8], life: [0.5, 0.75], size: [0.07, 0.09], shape: 'shard', gravity: 1, spin: 16 })
    emit(fx, { x, y, n: 5, colors: [c.color], speed: [2, 5], life: [0.35, 0.5], size: [0.04, 0.06], shape: 'chunk' })
  },
  icebomb: (...args) => BREAKS.frost(...args),   // (shattering like Frost, under its burst)
  frost: (fx, { x, y }, c) => {   // ice shards spinning out, a few glints hanging in the air
    emit(fx, { x, y, n: 14, colors: [FX.frost.ice, c.color, FX.frost.pale, c.rib], speed: [3, 8], life: [0.35, 0.6], size: [0.06, 0.11], shape: 'shard', gravity: 0.8, spin: 14 })
    emit(fx, { x, y, n: 5, colors: [FX.frost.ice], speed: [0.5, 2], life: [0.3, 0.5], size: [0.06, 0.09], shape: 'sparkle', gravity: 0, drag: 3, spin: 4 })
  },
  pie: (fx, { x, y }, c) => {   // drops of filling with tails streaming behind them, and crumbs of crust
    emit(fx, { x, y, n: 16, colors: [c.color, FX.pie.cream], speed: [3, 7], life: [0.4, 0.6], size: [0.04, 0.07], shape: 'drop', gravity: 1.1, lift: 1 })
    emit(fx, { x, y, n: 10, colors: [c.rib], speed: [2, 5], life: [0.3, 0.5], size: [0.03, 0.05], shape: 'chunk' })
  },
  balloon: (fx, { x, y }, c) => {   // a pop: a quick ring, rubber scraps flying off and slowing, its string dropping
    ring(fx, x, y, 0.8, c.rib, 0.18)
    emit(fx, { x, y, n: 8, colors: [c.color, c.rib], speed: [5, 10], life: [0.5, 0.8], size: [0.07, 0.11], shape: 'scrap', gravity: 0.4, drag: 5, spin: 18 })
    emit(fx, { x, y: y - 0.25, n: 1, colors: [FX.balloon.string], speed: [0.3, 0.8], life: [0.8, 0.8], size: [0.12, 0.12], shape: 'stick', gravity: 0.8, spin: 3 })
  },
  vine: (fx, { x, y }, c) => {   // leaves fluttering down
    emit(fx, { x, y, n: 10, colors: [FX.vine.leaf, c.color, c.rib], speed: [2, 5], life: [0.7, 1.1], size: [0.07, 0.1], shape: 'leaf', gravity: 0.3, drag: 2.5, sway: 1.2, spin: 6 })
  },
  buzzsaw: (fx, { x, y }, c) => {   // curled shavings spinning off, and some chips
    emit(fx, { x, y, n: 10, colors: [c.color, c.rib, FX.buzzsaw.pale], speed: [3, 7], life: [0.5, 0.8], size: [0.05, 0.08], shape: 'curl', gravity: 0.5, drag: 2, spin: 14 })
    emit(fx, { x, y, n: 6, colors: [c.color, c.rib], speed: [2, 5], life: [0.35, 0.55], size: [0.04, 0.06], shape: 'chunk' })
  },
}

export function spawnEffect(effects, ev) {
  EFFECTS[ev.type]?.(effects, ev)
}

export function updateEffects(effects, dt) {
  for (const q of effects.particles) {
    q.age += dt
    q.vy -= CONFIG.gravity * q.gravity * dt
    if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k }
    q.x += (q.vx + (q.sway && q.sway * Math.cos(q.age * 7 + q.seed * 20))) * dt
    q.y += q.vy * dt
  }
  effects.particles = effects.particles.filter(s => s.age < s.life)
  for (const t of effects.popups) {
    t.age += dt
    t.y += 1.2 * dt
  }
  effects.popups = effects.popups.filter(t => t.age < t.life)
  for (const c of effects.clouds) c.age += dt
  effects.clouds = effects.clouds.filter(c => c.age < c.life)
  for (const ring of effects.rings) ring.age += dt
  if (effects.shake && (effects.shake.age += dt) >= effects.shake.life) effects.shake = null
  effects.rings = effects.rings.filter(ring => ring.age < ring.life)
}

// --- drawing ---

export function drawEffects(ctx, effects, theme, X, Y, s) {
  for (const c of effects.clouds) drawCloud(ctx, c, theme, X, Y, s)
  for (const q of effects.particles) {
    const r = q.r * (1 - q.age / q.life) ** 0.6 * s   // (they shrink away)
    if (r < 0.3) continue
    ctx.fillStyle = q.color
    PARTICLE_SHAPES[q.shape](ctx, X(q.x), Y(q.y), r, q.spin * q.age, q, s)
  }
  for (const ring of effects.rings) {
    const t = ring.age / ring.life
    ctx.globalAlpha = 1 - t
    ctx.strokeStyle = ring.color
    ctx.lineWidth = 0.12 * s * (1 - t)
    ctx.beginPath()
    ctx.arc(X(ring.x), Y(ring.y), lerp(0.3, ring.r, Math.sqrt(t)) * s, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// Particle shapes, by name: each draws one at (x, y) px, about r px across (half), turned by `turn`, in
// the fill color already set. q: the particle (for its seed or which way it's moving); s: px per m.
const hash = (seed, k) => { const v = Math.sin(seed * 1000 + k * 12.9898) * 43758.5453; return v - Math.floor(v) }
const heading = q => Math.atan2(-q.vy, q.vx)   // (on screen: y points down)
const turned = (ctx, x, y, turn, path) => { ctx.save(); ctx.translate(x, y); ctx.rotate(turn); ctx.beginPath(); path(); ctx.restore() }
const PARTICLE_SHAPES = {
  dot: (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill() },
  mote: (ctx, x, y, r, turn, q) => {   // a dot that flickers lighter now and then, at its own rate (a Teleport's specks)
    if (Math.floor(q.age * (10 + q.seed * 8) + q.seed * 3) % 3 === 0) ctx.fillStyle = mixHex(q.color, '#ffffff', 0.35)
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  },
  chunk: (ctx, x, y, r, turn, q) => {   // a bit of rind (its outline is the same every frame: from its seed)
    ctx.beginPath()
    for (let k = 0; k < 5; k++) { const a = turn + k / 5 * TAU, d = r * (0.65 + hash(q.seed, k) * 0.5); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) }
    ctx.closePath()
    ctx.fill()
  },
  seed: (ctx, x, y, r, turn) => { ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.7, turn, 0, TAU); ctx.fill() },
  shard: (ctx, x, y, r, turn) => {   // a long thin diamond (ice, a saw tooth)
    turned(ctx, x, y, turn, () => { ctx.moveTo(-r * 1.6, 0); ctx.lineTo(0, -r * 0.45); ctx.lineTo(r * 1.6, 0); ctx.lineTo(0, r * 0.45); ctx.fill() })
  },
  leaf: (ctx, x, y, r, turn) => {
    turned(ctx, x, y, turn, () => { ctx.moveTo(-r * 1.3, 0); ctx.quadraticCurveTo(0, -r * 1.1, r * 1.3, 0); ctx.quadraticCurveTo(0, r * 1.1, -r * 1.3, 0); ctx.fill() })
  },
  scrap: (ctx, x, y, r, turn) => {   // a curved strip of rubber (a popped balloon)
    turned(ctx, x, y, turn, () => { ctx.arc(0, 0, r, -1.2, 1.2); ctx.arc(0, 0, r * 0.5, 1.2, -1.2, true); ctx.fill() })
  },
  curl: (ctx, x, y, r, turn) => {   // a curled shaving
    turned(ctx, x, y, turn, () => { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r * 0.4); ctx.lineCap = 'round'; ctx.arc(0, 0, r * 0.8, 0, 4.2); ctx.stroke() })
  },
  stick: (ctx, x, y, r, turn) => {   // a short length of stem or string
    turned(ctx, x, y, turn, () => { ctx.roundRect(-r * 1.3, -r * 0.28, r * 2.6, r * 0.56, r * 0.28); ctx.fill() })
  },
  drop: (ctx, x, y, r, turn, q) => {   // a drop of goo, its tail streaming behind it
    turned(ctx, x, y, heading(q), () => { ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-r * 2.4, 0); ctx.closePath(); ctx.fill() })
  },
  streak: (ctx, x, y, r, turn, q, s) => {   // a spark: a short line along its path, longer the faster it goes
    const len = Math.hypot(q.vx, q.vy) * 0.03 * s
    turned(ctx, x, y, heading(q), () => { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r); ctx.lineCap = 'round'; ctx.moveTo(0, 0); ctx.lineTo(-len, 0); ctx.stroke() })
  },
  sparkle: (ctx, x, y, r, turn) => {   // a 4-pointed glint
    turned(ctx, x, y, turn * 0.3, () => { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, d = k % 2 ? r * 0.3 : r; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) } ctx.fill() })
  },
  star: (ctx, x, y, r, turn) => {   // a 5-pointed star (seeing stars)
    turned(ctx, x, y, turn * 0.5, () => { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k / 10 * TAU, d = k % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) } ctx.fill() })
  },
  confetti: (ctx, x, y, r, turn) => {   // a little paper square, flipping as it tumbles
    turned(ctx, x, y, turn * 0.5, () => { ctx.scale(1, Math.cos(turn) || 0.05); ctx.rect(-r * 0.8, -r * 0.5, r * 1.6, r); ctx.fill() })
  },
}

// A blast: the white flash for its first moment, then the puffs (coolest first, so the hot ones sit on top).
function drawCloud(ctx, c, theme, X, Y, s) {
  const a = c.age, k = c.k
  if (a < CLOUD.flash) {
    const u = a / CLOUD.flash
    ctx.globalAlpha = (1 - u) * 0.8
    ctx.fillStyle = c.look.flash
    ctx.beginPath()
    ctx.arc(X(c.x), Y(c.y), lerp(0.15 * k, 1.15 * k, Math.sqrt(u)) * s, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  const grow = easeOutBack(Math.min(1, a / 0.22)), fade = 1 - smooth((a - 0.6) / 0.9)
  const puffs = c.puffs.map(p => ({
    x: c.x + Math.cos(p.ang) * p.d * k * (1 + a * 0.8),
    y: c.y + Math.sin(p.ang) * p.d * k * (0.8 + a * 0.6) * 0.8 + a * 0.45 * k,   // (spreading out, drifting up)
    r: p.r * k * grow * fade * (1 + a * 0.3), heat: Math.max(0, p.hot - a * 1.3),
  })).filter(q => q.r > 0.01).sort((q, w) => q.heat - w.heat)
  for (const q of puffs) {
    ctx.fillStyle = heatColor(q.heat, theme, c.look)
    ctx.beginPath()
    ctx.arc(X(q.x), Y(q.y), q.r * s, 0, TAU)
    ctx.fill()
  }
}
const heatColor = (h, theme, look) => h > 0.66 ? look.puff.hot : h > 0.33 ? look.puff.warm : h > 0.12 || look !== FX.boom ? look.puff.cool : theme.smoke   // (a cold cloud stays pale blue)

const TAU = Math.PI * 2
const darker = c => mixHex(c, '#000000', 0.3)
const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
const easeOutBack = x => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
