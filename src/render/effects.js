// EFFECTS — purely visual stuff (particles). Not part of the physics, so
// each computer makes its own from the game's events.

import { CONFIG } from '../config.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { pumpkinColors } from './pumpkins.js'
import { lerp } from '../util/math.js'

export function createEffects() {
  // popups: floating text (damage numbers, KO!); rings: expanding circles (blasts, a Black Hole closing)
  // shake: { amount (m), age, life } fading screen shake (an airdrop landing), or null
  // birds: crows flying off { x, y, vx, vy, dir, age, life }; feathers: drifting down { x, y, vx, vy, turn, spin, sway, age, life }
  return { particles: [], popups: [], rings: [], birds: [], feathers: [], shake: null }
}

// A burst of n particles flying out from (x, y).
function burst(effects, x, y, n, colors, speed, life, size, lift = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = lerp(speed[0], speed[1], Math.random())
    effects.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + lift,
      life: lerp(life[0], life[1], Math.random()), age: 0,
      r: lerp(size[0], size[1], Math.random()), color: colors[i % colors.length],
    })
  }
}

// n particles sprayed from (x, y) along (dx, dy) (a unit vector), up to `spread` radians either side of it.
function spray(effects, x, y, n, colors, [dx, dy], spread, speed, life, size, lift = 0) {
  const heading = Math.atan2(dy, dx)
  for (let i = 0; i < n; i++) {
    const a = heading + (Math.random() * 2 - 1) * spread
    const v = lerp(speed[0], speed[1], Math.random())
    effects.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + lift,
      life: lerp(life[0], life[1], Math.random()), age: 0,
      r: lerp(size[0], size[1], Math.random()), color: colors[i % colors.length],
    })
  }
}

// n black feathers popping out of (x, y), then drifting down, rocking side to side.
function feathers(effects, x, y, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6)
    effects.feathers.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, turn: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 8,
      sway: Math.random() * Math.PI * 2, age: 0, life: 1 + Math.random() * 0.8,
    })
  }
}

// What each game event looks like, by event type (events with no entry show nothing).
const EFFECTS = {
  boom: (fx, ev) => {
    burst(fx, ev.x, ev.y, 40, ['#ff9a2e', '#e2571b', '#3b3631', '#ffd36b'], [4, 13], [0.35, 0.8], [0.05, 0.14], 2)
    fx.rings.push({ x: ev.x, y: ev.y, r: ev.r, color: '#e2571b', age: 0, life: 0.35 })
  },
  pierce: (fx, ev) => {   // a Buzzsaw cutting through someone (or a bale, a crow): chips of squash spraying on ahead of it
    const t = PUMPKIN_TYPES[ev.typeName], chips = [t.rib, t.color, '#4f6a24', '#f6f1cf']   // (its ribs, its skin, dark rind, pale flesh)
    spray(fx, ev.x, ev.y, 24, chips, [ev.dx, ev.dy], 0.6, [5, 12], [0.35, 0.65], [0.045, 0.08], 1.5)
    burst(fx, ev.x, ev.y, 10, chips, [1.5, 4], [0.25, 0.45], [0.035, 0.06])   // (and some falling off where it cut)
  },
  snap: (fx, ev) => burst(fx, ev.x, ev.y, 14, ['#b9c24a', '#6b7524', '#c8383a', '#f3ecc4'], [2, 6], [0.25, 0.45], [0.03, 0.06], 1.5),   // a Chomper biting
  wilt: (fx, ev) => burst(fx, ev.x, ev.y, 10, ['#9a9a3e', '#6b6a2c', '#a07a3a'], [0.5, 2], [0.5, 0.9], [0.03, 0.06], 1),     // a Chomper shriveling away
  hole: (fx, ev) => burst(fx, ev.x, ev.y, 18, ['#4b2c84', '#a46bff', '#0b0614'], [1.5, 5], [0.3, 0.6], [0.03, 0.07]),
  swallow: (fx, ev) => burst(fx, ev.x, ev.y, 14, ['#a46bff', '#0b0614', '#f4efe6'], [0.5, 2], [0.2, 0.4], [0.03, 0.06]),
  collapse: (fx, ev) => {   // a hole closing: a last purple pulse
    burst(fx, ev.x, ev.y, 24, ['#a46bff', '#f4efe6', '#4b2c84'], [3, 9], [0.3, 0.6], [0.03, 0.07])
    fx.rings.push({ x: ev.x, y: ev.y, r: ev.r * 2.5, color: '#a46bff', age: 0, life: 0.45 })
  },
  shake: (fx, ev) => { fx.shake = { amount: Math.max(ev.amount, fx.shake ? fx.shake.amount : 0), age: 0, life: 0.45 } },
  pop: (fx, ev) => burst(fx, ev.x, ev.y, 8, [ev.color, '#f6e7c1'], [1.5, 4], [0.2, 0.35], [0.03, 0.06]),
  feathers: (fx, ev) => feathers(fx, ev.x, ev.y, 7, 2.5),   // a crow knocked down
  peck: (fx, ev) => feathers(fx, ev.x, ev.y, 2, 1.8),       // a crow pecking at someone's head
  crowAway: (fx, ev) => {   // a crow flying off: a few feathers, and up and away it goes
    feathers(fx, ev.x, ev.y, 4, 2)
    const dir = Math.random() < 0.5 ? -1 : 1
    fx.birds.push({ x: ev.x, y: ev.y, vx: dir * 5, vy: 4, dir, age: 0, life: 2 })
  },
  cannon: (fx, ev) => {   // a gourd cannon firing: a flash and a puff of smoke out of the muzzle
    burst(fx, ev.x, ev.y, 8, ['#ffd23f', '#ff8a1f'], [2, 6], [0.08, 0.18], [0.03, 0.06])
    burst(fx, ev.x, ev.y, 14, ['#d8d4cc', '#b9b4aa', '#8f8a80'], [0.5, 2.5], [0.4, 0.9], [0.08, 0.16], 1)
  },
  block: (fx, ev) => burst(fx, ev.x, ev.y, 12, ['#d9b25c', '#9c7a2e', '#3b3631'], [2, 6], [0.2, 0.4], [0.03, 0.07], 1),
  freeze: (fx, ev) => burst(fx, ev.x, ev.y, 16, ['#ffffff', '#dff4fc', '#9fd8f0'], [1.5, 5], [0.3, 0.6], [0.03, 0.07]),
  straw: (fx, ev) => burst(fx, ev.x, ev.y, 26, ['#e2b84a', '#c9982f', '#f3d77a', '#8a5a2b'], [2, 7], [0.4, 0.8], [0.04, 0.09], 2),
  burn: (fx, ev) => (ev.small
    ? burst(fx, ev.x, ev.y, 4, ['#ff8a1f', '#ffd23f'], [1, 3], [0.2, 0.4], [0.03, 0.05], 3)
    : burst(fx, ev.x, ev.y, 26, ['#ff8a1f', '#ffd23f', '#e2481b', '#3b3631'], [2, 6], [0.4, 0.9], [0.04, 0.09], 4)),
  dust: (fx, ev) => burst(fx, ev.x, ev.y, 2, ['#c9bfb2', '#9a8f80'], [0.3, 1.2], [0.25, 0.45], [0.03, 0.06], 0.8),   // sliding down a wall
  yank: (fx, ev) => burst(fx, ev.x, ev.y, 10, ['#5fae3c', '#3c7a22'], [2, 5], [0.25, 0.45], [0.03, 0.06]),
  damage: (fx, ev) => {
    fx.popups.push({ damage: true, x: ev.x + (Math.random() - 0.5) * 0.3, y: ev.y, text: `-${ev.amount}`, size: 0.34 + Math.min(ev.amount, 30) * 0.008, color: '#c8323a', age: 0, life: 0.8 })
  },
  ko: (fx, ev) => {
    fx.popups.push({ x: ev.x, y: ev.y, text: 'KO!', size: 0.7, color: null, age: 0, life: 1.2 })   // (map's text color)
  },
  hit: (fx, ev) => {   // punch impact: a quick burst of sparks
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 3 + Math.random() * 4
      fx.particles.push({
        x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.15 + Math.random() * 0.15, age: 0,
        r: 0.035 + Math.random() * 0.04, color: i % 3 ? '#f08a1c' : '#3b3631',
      })
    }
  },
  splat: (fx, ev) => {   // a pumpkin breaking: chunks in its colors, plus seeds
    const t = PUMPKIN_TYPES[ev.typeName]
    const type = pumpkinColors(t, ev.ripeness ?? 1, ev.rot ?? 0)
    const radius = ev.r ?? t.radius
    const size = radius / 0.22   // splats scale with the pumpkin (a seed vs. a Big Gourd)
    const n = Math.round(6 + 45 * radius)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (2 + Math.random() * 6) * Math.sqrt(size)
      const seed = i % 4 === 0
      fx.particles.push({
        x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 2,
        life: 0.5 + Math.random() * 0.4, age: 0,
        r: (seed ? 0.04 : 0.05 + Math.random() * 0.07) * Math.max(0.5, Math.sqrt(size)),
        color: seed ? '#f6e7c1' : (Math.random() < 0.5 ? type.color : type.rib),
      })
    }
  },
}

export function spawnEffect(effects, ev) {
  EFFECTS[ev.type]?.(effects, ev)
}

export function updateEffects(effects, dt) {
  for (const s of effects.particles) {
    s.age += dt
    s.vy -= CONFIG.gravity * 0.6 * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
  }
  effects.particles = effects.particles.filter(s => s.age < s.life)
  for (const t of effects.popups) {
    t.age += dt
    t.y += 1.2 * dt
  }
  effects.popups = effects.popups.filter(t => t.age < t.life)
  for (const b of effects.birds) {
    b.age += dt
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  effects.birds = effects.birds.filter(b => b.age < b.life)
  for (const f of effects.feathers) {   // (air drag: they soon just float down, rocking)
    f.age += dt
    f.vx *= Math.exp(-4 * dt)
    f.vy = f.vy * Math.exp(-4 * dt) - 0.9 * (1 - Math.exp(-4 * dt))
    f.sway += dt * 5
    f.x += (f.vx + Math.cos(f.sway) * 0.4) * dt
    f.y += f.vy * dt
    f.turn += f.spin * dt * Math.exp(-2 * f.age)
  }
  effects.feathers = effects.feathers.filter(f => f.age < f.life)
  for (const ring of effects.rings) ring.age += dt
  if (effects.shake && (effects.shake.age += dt) >= effects.shake.life) effects.shake = null
  effects.rings = effects.rings.filter(ring => ring.age < ring.life)
}
