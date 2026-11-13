// FLAMES — fire drawn in the flat look, three layers (outer red-orange, orange, pale core) like the bonfires
// (LEVEL.bonfire.flames), flickering with the wall clock. Used by everything on fire from a Fire Gourd
// (players, hay bales, fire patches).
//   tongue(c, x, y, w, h, t, ph)     a flame standing on a flat base at (x, y) px, w wide (half), h tall
//   lick(c, a, b, h, t, ph)          a flame rooted along a line from a to b (px: on whatever's burning), its
//                                    tip rising h above it (up is always up), swaying
//   embers(c, x, y, s, t, n, spread, rise, seed)   sparks floating up from (x, y) px and shrinking away
//   drawBurningPlayer(ctx, limbs, X, Y, s, t, k)  flames growing out of a player's torso, thighs and upper
//                                    arms (limbs: their ends [x1, y1, x2, y2], m), each rooted on the limb with
//                                    its base across it; k: 1 → 0 as it goes out
//   drawFirePatches(ctx, zones, X, Y, s, t)        a row of small flames along each (the snapshot's fire),
//                                    shrinking away over its last half second
//   drawBaleFire(c, w, h, s, t, u)   a burning hay bale, in its own frame: flames growing out of its top edge
//                                    and its front face; u: 0 → 1 as it burns down (they grow)

import { FX, LEVEL } from './palette.js'

const TAU = Math.PI * 2
const frac = v => v - Math.floor(v)
const rnd = (i, k = 0) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453)
const LAYERS = [1, 0.72, 0.42]   // (each layer's size, outside in)

export function tongue(c, x, y, w, h, t, ph = 0) {
  if (w <= 0 || h <= 0) return
  LEVEL.bonfire.flames.forEach((col, i) => {
    const k = LAYERS[i], hh = h * k * (0.8 + 0.25 * Math.sin(t * 9 + ph + i)), ww = w * k
    c.fillStyle = col
    c.beginPath(); c.moveTo(x - ww, y)
    c.quadraticCurveTo(x - ww * 0.7, y - hh * 0.6, x + Math.sin(t * 7 + ph) * w * 0.25, y - hh)
    c.quadraticCurveTo(x + ww * 0.7, y - hh * 0.6, x + ww, y); c.closePath(); c.fill()
  })
}

export function lick(c, a, b, h, t, ph = 0) {
  if (h <= 0) return
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  LEVEL.bonfire.flames.forEach((col, i) => {
    const k = LAYERS[i], hh = h * k * (0.8 + 0.25 * Math.sin(t * 9 + ph + i))
    const ax = mx + (a.x - mx) * k, ay = my + (a.y - my) * k, bx = mx + (b.x - mx) * k, by = my + (b.y - my) * k
    const tipX = mx + Math.sin(t * 7 + ph) * h * 0.18, tipY = Math.min(ay, by) - hh
    c.fillStyle = col
    c.beginPath(); c.moveTo(ax, ay)
    c.quadraticCurveTo(ax, (ay + tipY) / 2, tipX, tipY)
    c.quadraticCurveTo(bx, (by + tipY) / 2, bx, by)
    c.quadraticCurveTo(mx, my + Math.abs(b.x - a.x) * 0.15, ax, ay)   // (its base bulging a little over what it's on)
    c.closePath(); c.fill()
  })
}

export function embers(c, x, y, s, t, n, spread, rise, seed) {
  for (let i = 0; i < n; i++) {
    const u = frac(t * 0.8 + rnd(i, seed)), r = 0.025 * s * (1 - u)
    if (r < 0.3) continue
    c.fillStyle = FX.boom.sparks[i % 2]
    c.beginPath(); c.arc(x + (rnd(i, seed + 1) - 0.5) * spread * s + Math.sin(t * 3 + i) * 0.04 * s, y - u * rise * s, r, 0, TAU); c.fill()
  }
}

// Where along each burning limb a flame roots (0: one end, 1: the other) and how tall it is (of 0.33 m).
const BODY_FLAMES = { torso: [[0.15, 1.1], [0.5, 1.15], [0.82, 1.1]], thighL: [[0.35, 0.9], [0.8, 0.85]], thighR: [[0.4, 0.85]], armL: [[0.5, 0.85]], armR: [[0.45, 0.85]] }
export function drawBurningPlayer(ctx, limbs, X, Y, s, t, k = 1) {
  let i = 0
  for (const [name, spots] of Object.entries(BODY_FLAMES)) {
    const ends = limbs[name]
    if (!ends) continue
    const [x1, y1, x2, y2] = ends, dx = X(x2) - X(x1), dy = Y(y2) - Y(y1), half = 0.1 * s * Math.max(0.3, k)   // (each flame's base: 0.2 m across the limb)
    for (const [u, tall] of spots) {
      const mx = X(x1) + dx * u, my = Y(y1) + dy * u
      lick(ctx, { x: mx - half, y: my + 0.02 * s }, { x: mx + half, y: my - 0.02 * s }, 0.33 * s * tall * k, t, i++ * 1.7)
    }
  }
  const torso = limbs.torso
  if (torso && k > 0.3) embers(ctx, X(Math.max(torso[0], torso[2])), Y(Math.max(torso[1], torso[3])), s, t, 5, 0.4, 0.8 * k, 3)
}

export function drawFirePatches(ctx, zones, X, Y, s, t) {
  for (const z of zones) {
    const k = Math.min(1, z.t / 0.5), w = (z.x1 - z.x0) * s, n = Math.max(1, Math.round(w / (0.24 * s)))
    for (let i = 0; i < n; i++) tongue(ctx, X(z.x0) + (i + 0.5) * w / n, Y(z.y), 0.09 * s * k, 0.32 * s * k * (0.7 + 0.3 * rnd(i, z.id)), t, i * 1.7 + z.id)
  }
}

export function drawBaleFire(c, w, h, s, t, u) {
  const grow = 0.7 + 0.4 * u
  for (let i = 0; i < 5; i++) {   // the top edge: an overlapping row
    const x = -w / 2 + w * (i + 0.5) / 5
    lick(c, { x: x - 0.13 * s, y: -h / 2 + 0.04 * s }, { x: x + 0.13 * s, y: -h / 2 + 0.04 * s }, 0.5 * s * grow * (0.7 + 0.3 * rnd(i)), t, i * 1.6)
  }
  for (const [fx, fy, ph] of [[-0.25, 0.1, 0.4], [0.2, 0.25, 2.2], [0.02, -0.05, 3.7]]) {   // and out of its front face
    const x = fx * w, y = fy * h
    lick(c, { x: x - 0.1 * s, y: y + 0.03 * s }, { x: x + 0.1 * s, y: y - 0.03 * s }, 0.32 * s * grow, t, ph)
  }
  embers(c, 0, -h / 2 - 0.3 * s, s, t, 7, 0.8, 1.2, 6)
}
