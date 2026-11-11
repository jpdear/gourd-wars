// ANIMATED BITS: the parts of the gourds' drawing that move on their own, by name, in one table, so
// each can be tried out in the effects lab (lab.html) and swapped for another version. pumpkins.js
// draws them through this table; each takes t, the time in seconds (clock.now(): the wall clock, the
// same on every computer, since none of this is game state).
//
//   antennaTip(c, x, y, r, t)            Homing's aerial light at (x, y) px, on a gourd r px across
//   flameTrail(ctx, x, y, r, heading, t)  Homing's exhaust behind a gourd at (x, y) px flying `heading` (world radians)
//   lockOn(ctx, x, y, s, t)              the reticle on whoever a Homing gourd is after (torso at x, y px; s px per m)
//   patchGlow(ctx, x, y, r, s, color, t) the glow under a special gourd growing on its patch
//   superRareGlow(ctx, x, y, r, s, color, t)  the same for a Super Rare one: gold, with sparkles going round
//   holeSpecks(ctx, x, y, r, s, t)       the specks streaking into a Black Hole (r: its core, m)
//   spinBlur(ctx, x, y, r, angle, colors, draw, t)  a fast-spinning gourd's blur (at x, y px, r px across,
//                                        turned `angle`; draw(angle) draws it at another angle)
//   mineLight(c, x, y, r, t)             a set Landmine's blinking light at (x, y) px (r: the mine's size, px)
//
// Picked in the effects lab: the antenna's radar ping, the flat flame tongues, the Black Hole's spiral
// arms and the spin blur's ghost trail. The lab swaps entries of ANIM (and clock.now) while it draws a
// tile, then puts them back; the game never changes them.

import { GOURD } from './palette.js'
import { hexA } from '../util/color.js'

const TAU = Math.PI * 2
const FLAMES = [[GOURD.flameTrail[4], 2.6, 0.62], [GOURD.flameTrail[2], 2, 0.48], [GOURD.flameTrail[0], 1.3, 0.32]]   // [color, length, half-width (of r)], back to front

export const clock = { now: () => Date.now() / 1000 }

export const ANIM = {
  antennaTip: (c, x, y, r, t) => {   // a steady red light sending out a ring, like radar
    const u = (t % 0.7) / 0.7
    c.strokeStyle = hexA(GOURD.antenna, 1 - u); c.lineWidth = Math.max(1, r * 0.06)
    c.beginPath(); c.arc(x, y, r * (0.18 + 0.6 * u), 0, TAU); c.stroke()
    c.fillStyle = GOURD.antenna
    c.beginPath(); c.arc(x, y, Math.max(1.5, r * 0.16), 0, TAU); c.fill()
  },

  flameTrail: (ctx, x, y, r, heading, t) => {   // three solid flame tongues (red, orange, yellow) flickering out behind
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-heading)   // (now backward is -x)
    FLAMES.forEach(([color, len, w], i) => {
      const L = r * len * (1 + 0.18 * Math.sin(t * 50 + i * 2)), W = r * w, b = -r * 0.5
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(b, -W)
      ctx.quadraticCurveTo(b - L * 0.6, -W * 0.9, b - L, 0)
      ctx.quadraticCurveTo(b - L * 0.6, W * 0.9, b, W)
      ctx.closePath()
      ctx.fill()
    })
    ctx.restore()
  },

  lockOn: (ctx, x, y, s, t) => {   // red corner brackets turning slowly around them, pulsing a little
    const R = 0.75 * s * (1 + 0.08 * Math.sin(t * 1000 / 80)), arm = 0.25 * s
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(t * 1000 / 600)
    ctx.strokeStyle = GOURD.lockOn
    ctx.lineWidth = Math.max(1.5, 0.06 * s)
    ctx.beginPath()
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2)
      ctx.moveTo(R - arm, -R); ctx.lineTo(R, -R); ctx.lineTo(R, -R + arm)
    }
    ctx.stroke()
    ctx.restore()
  },

  patchGlow: (ctx, x, y, r, s, color, t) => {   // two see-through discs in its color, pulsing
    const pulse = 0.6 + 0.25 * Math.sin(t * 1000 / 220)
    for (const [grow, a] of [[0.6, 0.18], [0.3, 0.28]]) {
      ctx.fillStyle = hexA(color, a * pulse)
      ctx.beginPath()
      ctx.arc(x, y, r + grow * s, 0, TAU)
      ctx.fill()
    }
  },

  superRareGlow: (ctx, x, y, r, s, color, t) => {   // bigger, faster-pulsing gold discs (its color at the heart), 4 sparkles going round
    const pulse = 0.6 + 0.2 * Math.sin(t * 1000 / 150)
    for (const [c, grow, a] of [[GOURD.superRare.gold, 0.8, 0.18], [GOURD.superRare.gold, 0.45, 0.28], [color, 0.2, 0.3]]) {
      ctx.fillStyle = hexA(c, a * pulse)
      ctx.beginPath()
      ctx.arc(x, y, r + grow * s, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = GOURD.superRare.sparkle
    for (let i = 0; i < 4; i++) {
      const a = t * 1000 / 900 + (i * Math.PI) / 2
      const d = r + 0.45 * s, size = 0.09 * s * (0.6 + 0.4 * Math.sin(t * 1000 / 120 + i * 1.7))
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d
      ctx.beginPath()
      ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size * 0.3, sy); ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size * 0.3, sy); ctx.closePath()
      ctx.moveTo(sx - size, sy); ctx.lineTo(sx, sy + size * 0.3); ctx.lineTo(sx + size, sy); ctx.lineTo(sx, sy - size * 0.3); ctx.closePath()
      ctx.fill()
    }
  },

  holeSpecks: (ctx, cx, cy, r, s, t) => {   // each speck curls in on a spiral from 3.5 r, speeding up, then starts over from a new direction
    ctx.lineWidth = Math.max(1.5, 0.05 * s)
    ctx.lineCap = 'round'
    for (let i = 0; i < 24; i++) {
      const cycle = t * 0.8 + i * 0.618, u = cycle % 1   // (u: 0 = far out, 1 = at the core)
      const a = i * 2.4 + Math.floor(cycle) * 1.7
      const at = v => {
        const d = r * (1 + 2.5 * (1 - v) ** 2)
        return [cx + Math.cos(a + v * 2.5) * d * s, cy - Math.sin(a + v * 2.5) * d * s]
      }
      ctx.strokeStyle = GOURD.blackHole.specks[i % 3 ? 0 : 1]   // (white, every third purple)
      ctx.beginPath()
      ctx.moveTo(...at(Math.max(0, u - 0.1)))
      ctx.lineTo(...at(u))
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  },

  spinBlur: (ctx, x, y, r, angle, colors, draw) => {   // four fading copies trailing behind the way it spins (flat: not shaded)
    for (const [behind, alpha] of [[1.2, 0.06], [0.9, 0.12], [0.6, 0.18], [0.3, 0.25]]) {
      ctx.globalAlpha = alpha
      draw(angle - behind)
    }
    ctx.globalAlpha = 1
  },

  mineLight: (c, x, y, r, t) => {   // blinks red (on a third of the time, 2.5 times a second), with a see-through glow
    if ((t * 2.5) % 1 >= 0.35) return
    c.fillStyle = GOURD.mine.glow; c.beginPath(); c.arc(x, y, r * 0.32, 0, TAU); c.fill()
    c.fillStyle = GOURD.mine.lit; c.beginPath(); c.arc(x, y, r * 0.14, 0, TAU); c.fill()
  },
}
