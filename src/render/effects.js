// EFFECTS — purely visual stuff (particles). Not part of the physics, so
// each computer makes its own from the game's events.

import { CONFIG } from '../config.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { pumpkinColors } from './pumpkins.js'
import { lerp } from '../util/math.js'

export function createEffects() {
  // popups: floating text (damage numbers, KO!); rings: expanding blast circles
  return { particles: [], popups: [], rings: [] }
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

export function spawnEffect(effects, ev) {
  if (ev.type === 'boom') {
    burst(effects, ev.x, ev.y, 40, ['#ff9a2e', '#e2571b', '#3b3631', '#ffd36b'], [4, 13], [0.35, 0.8], [0.05, 0.14], 2)
    effects.rings.push({ x: ev.x, y: ev.y, r: ev.r, age: 0, life: 0.35 })
    return
  }
  if (ev.type === 'pop') return burst(effects, ev.x, ev.y, 8, [ev.color, '#f6e7c1'], [1.5, 4], [0.2, 0.35], [0.03, 0.06])
  if (ev.type === 'block') return burst(effects, ev.x, ev.y, 12, ['#d9b25c', '#9c7a2e', '#3b3631'], [2, 6], [0.2, 0.4], [0.03, 0.07], 1)
  if (ev.type === 'freeze') return burst(effects, ev.x, ev.y, 16, ['#ffffff', '#dff4fc', '#9fd8f0'], [1.5, 5], [0.3, 0.6], [0.03, 0.07])
  if (ev.type === 'straw') return burst(effects, ev.x, ev.y, 26, ['#e2b84a', '#c9982f', '#f3d77a', '#8a5a2b'], [2, 7], [0.4, 0.8], [0.04, 0.09], 2)
  if (ev.type === 'burn') {
    if (ev.small) return burst(effects, ev.x, ev.y, 4, ['#ff8a1f', '#ffd23f'], [1, 3], [0.2, 0.4], [0.03, 0.05], 3)
    return burst(effects, ev.x, ev.y, 26, ['#ff8a1f', '#ffd23f', '#e2481b', '#3b3631'], [2, 6], [0.4, 0.9], [0.04, 0.09], 4)
  }
  if (ev.type === 'dust') return burst(effects, ev.x, ev.y, 2, ['#c9bfb2', '#9a8f80'], [0.3, 1.2], [0.25, 0.45], [0.03, 0.06], 0.8)   // sliding down a wall
  if (ev.type === 'yank') return burst(effects, ev.x, ev.y, 10, ['#5fae3c', '#3c7a22'], [2, 5], [0.25, 0.45], [0.03, 0.06])
  if (ev.type === 'damage') {
    effects.popups.push({ debugOnly: true, x: ev.x + (Math.random() - 0.5) * 0.3, y: ev.y, text: `-${ev.amount}`, size: 0.34 + Math.min(ev.amount, 30) * 0.008, color: '#c8323a', age: 0, life: 0.8 })
    return
  }
  if (ev.type === 'ko') {
    effects.popups.push({ x: ev.x, y: ev.y, text: 'KO!', size: 0.7, color: null, age: 0, life: 1.2 })   // (map's text color)
    return
  }
  if (ev.type === 'hit') {   // punch impact: a quick burst of sparks
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 3 + Math.random() * 4
      effects.particles.push({
        x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.15 + Math.random() * 0.15, age: 0,
        r: 0.035 + Math.random() * 0.04, color: i % 3 ? '#f08a1c' : '#3b3631',
      })
    }
    return
  }
  if (ev.type !== 'splat') return
  const t = PUMPKIN_TYPES[ev.typeName]
  const type = pumpkinColors(t, ev.ripeness ?? 1, ev.rot ?? 0)
  const size = t.radius / 0.22   // splats scale with the pumpkin (a seed vs. a Big Gourd)
  const n = Math.round(6 + 45 * t.radius)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = (2 + Math.random() * 6) * Math.sqrt(size)
    const seed = i % 4 === 0
    effects.particles.push({
      x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 2,
      life: 0.5 + Math.random() * 0.4, age: 0,
      r: (seed ? 0.04 : 0.05 + Math.random() * 0.07) * Math.max(0.5, Math.sqrt(size)),
      color: seed ? '#f6e7c1' : (Math.random() < 0.5 ? type.color : type.rib),
    })
  }
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
  for (const ring of effects.rings) ring.age += dt
  effects.rings = effects.rings.filter(ring => ring.age < ring.life)
}
