// Drawing crows: flying over, knocked down and dazed, held or thrown
// (as the "crow" pumpkin type: see BODIES in render/pumpkins.js), clinging to someone's face pecking,
// and flying off (an effect: see render/effects.js).
//
// The crow itself is a classic black silhouette seen side-on, drawn in its own units: 1 = its length
// from beak tip to tail (x forward, y down, its middle at 0, 0).

import { BODY, CONFIG } from '../config.js'
import { PART_NAMES } from '../game/snapshot.js'

const INK = '#1a191f', FAR = '#34313c', EDGE = '#2a2830'
const time = () => Date.now() / 1000

// The head turns about the neck; the beak's tip, and the way it points (from the middle of the head).
const NECK = { x: 0.18, y: -0.1 }
const BEAK_TIP = { x: 0.54, y: -0.1 }
const BEAK_DIR = (() => { const dx = BEAK_TIP.x - 0.27, dy = BEAK_TIP.y + 0.15, d = Math.hypot(dx, dy); return { x: dx / d, y: dy / d } })()

// The crow at the canvas origin, facing +x, `size` px long.
//   pose       'fly' (wings beating), 'perch' (wing folded), 'dazed' (on its back, feet up, X eye),
//              'cling' (on someone's face: wings beating)
//   flap       -1 (wings down) … 1 (wings up)
//   headTurn   the head turned down (+) or up (-) at the neck (radians)
//   lunge      the head thrust forward along its beak (crow lengths: pecking)
export function crowShape(ctx, size, { pose = 'fly', flap = 0, headTurn = 0, lunge = 0, feet = pose !== 'fly' } = {}) {
  ctx.save()
  ctx.scale(size, size)
  const px = 1 / size   // (one pixel, in these units)
  const winged = pose === 'fly' || pose === 'cling'
  if (pose === 'dazed') ctx.scale(1, -1)
  if (winged) wing(ctx, flap, FAR, -0.02)   // (the far wing, behind)
  if (feet) legs(ctx, px, pose)
  ctx.fillStyle = INK
  body(ctx)
  head(ctx, headTurn, lunge, pose === 'dazed', px)
  if (winged) wing(ctx, flap, INK, 0)
  else foldedWing(ctx, px)
  ctx.restore()
}

function body(ctx) {
  ctx.beginPath()
  ctx.moveTo(0.18, -0.12)                            // nape
  ctx.quadraticCurveTo(0.0, -0.12, -0.17, -0.04)     // back
  ctx.quadraticCurveTo(-0.31, -0.05, -0.46, -0.08)   // tail: narrow where it starts, fanning out...
  ctx.quadraticCurveTo(-0.53, 0.0, -0.46, 0.1)       // ...to a rounded end
  ctx.quadraticCurveTo(-0.3, 0.07, -0.15, 0.06)      // under the tail
  ctx.quadraticCurveTo(0.0, 0.18, 0.15, 0.12)        // belly
  ctx.quadraticCurveTo(0.29, 0.06, 0.29, -0.04)      // chest, throat
  ctx.closePath()
  ctx.fill()
}

// Where the beak's tip is (crow units) with the head turned by `turn` and thrust forward by `lunge`
// (as crowShape draws it).
export function beakTip(turn = 0, lunge = 0) {
  const x = BEAK_TIP.x + lunge * BEAK_DIR.x - NECK.x, y = BEAK_TIP.y + lunge * BEAK_DIR.y - NECK.y
  return { x: NECK.x + x * Math.cos(turn) - y * Math.sin(turn), y: NECK.y + x * Math.sin(turn) + y * Math.cos(turn) }
}

// Head and beak, turned at the neck by `turn` and thrust forward along the beak by `lunge`. Eye: a
// dark ring with a glint (an X if dazed).
function head(ctx, turn, lunge, dazed, px) {
  ctx.save()
  ctx.translate(NECK.x, NECK.y)
  ctx.rotate(turn)
  ctx.translate(-NECK.x + lunge * BEAK_DIR.x, -NECK.y + lunge * BEAK_DIR.y)
  ctx.beginPath()   // head, flat-crowned
  ctx.moveTo(0.14, -0.08)
  ctx.quadraticCurveTo(0.16, -0.22, 0.27, -0.21)
  ctx.quadraticCurveTo(0.35, -0.2, 0.36, -0.13)
  ctx.quadraticCurveTo(0.34, -0.04, 0.24, -0.02)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()   // the beak: thick at the base, the top curving down to a point
  ctx.moveTo(0.33, -0.18)
  ctx.quadraticCurveTo(0.45, -0.18, 0.54, -0.1)
  ctx.quadraticCurveTo(0.45, -0.09, 0.34, -0.08)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = EDGE   // (the line between the two halves of the beak)
  ctx.lineWidth = 1.2 * px
  ctx.beginPath()
  ctx.moveTo(0.35, -0.125); ctx.lineTo(0.5, -0.105)
  ctx.stroke()
  if (dazed) {
    ctx.strokeStyle = '#f4efe6'
    ctx.lineWidth = Math.max(1.2 * px, 0.012)
    const ex = 0.27, ey = -0.15, e = 0.022
    ctx.beginPath()
    ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e)
    ctx.moveTo(ex + e, ey - e); ctx.lineTo(ex - e, ey + e)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#4a4652'
    ctx.beginPath(); ctx.arc(0.275, -0.15, 0.026, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#060608'
    ctx.beginPath(); ctx.arc(0.278, -0.15, 0.017, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(0.283, -0.156, Math.max(0.006, 0.9 * px), 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = INK
  ctx.restore()
}

// A wing out, beating: from the shoulder up and back (flap 1) to down and back (flap -1), its long
// flight feathers spread like fingers at the tip.
function wing(ctx, flap, color, dx) {
  ctx.save()
  ctx.translate(0.04 + dx, -0.07)
  ctx.rotate(-0.35 - (1 - flap) * 1.05)   // (0 points straight up; more negative swings it back and down)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0.05, 0.02)
  ctx.quadraticCurveTo(0.09, -0.2, 0.04, -0.34)      // leading edge out to the wrist
  ctx.lineTo(-0.12, -0.33)
  ctx.quadraticCurveTo(-0.15, -0.12, -0.11, 0.04)    // trailing edge back to the body
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 5; i++) {   // the fingers
    ctx.save()
    ctx.translate(0.03 - i * 0.035, -0.32 + i * 0.012)
    ctx.rotate(0.28 - i * 0.14)
    ctx.beginPath()
    ctx.ellipse(0, -0.08, 0.021, 0.09, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

// Folded along its side, the flight feathers' tips reaching back over the tail.
function foldedWing(ctx, px) {
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.moveTo(0.14, -0.09)
  ctx.quadraticCurveTo(-0.05, -0.12, -0.36, -0.02)
  ctx.quadraticCurveTo(-0.2, 0.06, 0.1, 0.06)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.2 * px
  ctx.beginPath()
  for (const t of [0.25, 0.5, 0.75]) {   // feather edges
    ctx.moveTo(0.1 - t * 0.3, -0.06 + t * 0.03)
    ctx.quadraticCurveTo(-0.1 - t * 0.2, 0.0, -0.3 + t * 0.1, 0.0)
  }
  ctx.stroke()
}

// Legs: standing (or, dazed on its back, sticking up stiff), or clinging: reaching forward under its
// chest, toes curled to grab on.
function legs(ctx, px, pose) {
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(1.5 * px, 0.022)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const x of [0.0, 0.06]) {
    if (pose === 'cling') {
      ctx.moveTo(x, 0.1); ctx.lineTo(x + 0.17, 0.2)
      ctx.moveTo(x + 0.17, 0.2); ctx.quadraticCurveTo(x + 0.25, 0.17, x + 0.24, 0.12)   // (curled round, gripping)
      ctx.moveTo(x + 0.17, 0.2); ctx.quadraticCurveTo(x + 0.23, 0.25, x + 0.27, 0.21)
    } else {
      ctx.moveTo(x, 0.1); ctx.lineTo(x + 0.02, 0.27)
      ctx.moveTo(x + 0.02, 0.27); ctx.lineTo(x + 0.09, 0.28)   // toes
      ctx.moveTo(x + 0.02, 0.27); ctx.lineTo(x - 0.04, 0.29)
    }
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
}

const flapping = speed => Math.sin(time() * speed)

// A crow from the snapshot (snap.crows): flying over, or knocked down.
export function drawCrow(ctx, c, X, Y, s) {
  const size = CONFIG.crow.length * s
  if (c.down) {
    ctx.save()
    ctx.translate(X(c.x), Y(c.y))
    ctx.rotate(-c.angle)
    ctx.scale(c.dir, 1)
    crowShape(ctx, size, { pose: 'dazed' })
    ctx.restore()
    drawDizzyStars(ctx, X(c.x), Y(c.y + 0.6 * CONFIG.crow.length), s)
    return
  }
  const flap = flapping(16)
  const bob = flap * 0.03   // (rising a little on each downstroke)
  ctx.save()
  ctx.translate(X(c.x), Y(c.y + bob))
  ctx.scale(c.dir, 1)
  crowShape(ctx, size, { pose: 'fly', flap })
  ctx.restore()
}

// Little yellow stars circling over something dazed.
export function drawDizzyStars(ctx, x, y, s) {
  const t = time() * 3
  ctx.fillStyle = '#f7c531'
  ctx.strokeStyle = '#9a6b00'
  ctx.lineWidth = Math.max(1, 0.012 * s)
  for (let i = 0; i < 3; i++) {
    const a = t + i * 2.1, depth = Math.sin(a)   // (going round: smaller at the back)
    star(ctx, x + Math.cos(a) * 0.24 * s, y + depth * 0.06 * s, (0.06 + 0.015 * depth) * s, t * 2 + i)
  }
}

// A five-pointed star centered at (x, y), r px to its points, turned by `turn` radians.
export function star(ctx, x, y, r, turn = 0) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = turn - Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

// Clinging to a face: the body tipped up (tilt), the head bent down at the neck so the beak points at
// the face (headTurn), each peck driving the beak this far in (reach, crow lengths: ~9 cm), `rate` a second.
const CLING = { tilt: -0.6, headTurn: 0.8, reach: 0.12, rate: 8 }

// A crow on a player's face (from the snapshot): in front of it, turned toward them, wings beating
// hard, the tip of its beak on their face at eye level, jabbing into their head. (t: the time, in s)
export function drawPeckingCrow(ctx, p, X, Y, s, t = time()) {
  const [hx, hy] = p.parts[PART_NAMES.indexOf('head')]
  const f = p.facing, size = CONFIG.crow.length * s
  const peck = Math.max(0, Math.sin(t * 2 * Math.PI * CLING.rate)) ** 3   // (sharp jabs, back out between them)
  // Placed by the beak: where its tip ends up (at rest) after the tilt and the turn toward them (-f)...
  const tip = beakTip(CLING.headTurn), c = Math.cos(CLING.tilt), sn = Math.sin(CLING.tilt)
  const tipX = -f * (tip.x * c - tip.y * sn) * size, tipY = (tip.x * sn + tip.y * c) * size
  // ...and that's on their face
  ctx.save()
  ctx.translate(X(hx + f * BODY.headR * 0.9) - tipX, Y(hy + 0.03) - tipY)
  ctx.scale(-f, 1)
  ctx.rotate(CLING.tilt)
  crowShape(ctx, size, { pose: 'cling', flap: Math.sin(t * 45), headTurn: CLING.headTurn, lunge: peck * CLING.reach, feet: true })
  ctx.restore()
}

// A crow flying off (an effect: { x, y, vx, vy, age, life, dir }).
export function drawFlyingOff(ctx, b, X, Y, s) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, 2 * (1 - b.age / b.life))
  ctx.translate(X(b.x), Y(b.y))
  ctx.scale(b.dir, 1)
  ctx.rotate(-0.35)   // (climbing)
  crowShape(ctx, CONFIG.crow.length * s, { pose: 'fly', flap: flapping(20) })
  ctx.restore()
}

// A black feather drifting down (an effect: { x, y, turn, sway, age, life }), rocking as it falls.
export function drawFeather(ctx, f, X, Y, s) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, 3 * (1 - f.age / f.life))
  ctx.translate(X(f.x), Y(f.y))
  ctx.rotate(f.turn + Math.sin(f.sway) * 0.5)
  const L = 0.07 * s   // (half its length: 14 cm long, a big wing feather)
  ctx.fillStyle = INK
  ctx.beginPath()   // a vane, widest a little past the middle, the tip curling over
  ctx.moveTo(-L, 0)
  ctx.bezierCurveTo(-0.3 * L, -0.55 * L, 0.6 * L, -0.5 * L, L, -0.1 * L)
  ctx.bezierCurveTo(0.6 * L, 0.35 * L, -0.3 * L, 0.4 * L, -L, 0)
  ctx.fill()
  ctx.strokeStyle = '#5a5563'   // the quill
  ctx.lineWidth = Math.max(1, 0.06 * L)
  ctx.beginPath()
  ctx.moveTo(-1.25 * L, 0); ctx.lineTo(0.8 * L, 0)
  ctx.stroke()
  ctx.restore()
}
