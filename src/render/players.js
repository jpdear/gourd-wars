// Drawing the stick figures (from snapshot data), plus what they hold and wear.

import { BODY, CONFIG } from '../config.js'
import { BALE, TINE } from '../game/level.js'
import { boomerangPull } from '../game/powers.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { PART_NAMES } from '../game/snapshot.js'
import { drawPumpkin, pumpkinColors } from './pumpkins.js'
import { mixHex } from '../util/color.js'
import { lerp } from '../util/math.js'

export const PART_HALF_LEN = {
  torso: BODY.torsoLen / 2, head: 0,
  thighL: BODY.legSeg / 2, thighR: BODY.legSeg / 2, shinL: BODY.legSeg / 2, shinR: BODY.legSeg / 2,
  armL: BODY.armSeg / 2, armR: BODY.armSeg / 2, forearmL: BODY.armSeg / 2, forearmR: BODY.armSeg / 2,
}

// Endpoints of a limb from its [x, y, angle]: [topX, topY, bottomX, bottomY]
export function partEnds(part, halfLen) {
  const [x, y, a] = part
  const dx = -Math.sin(a) * halfLen, dy = Math.cos(a) * halfLen
  return [x + dx, y + dy, x - dx, y - dy]
}

// Where a snapshot player's front hand is: [x, y]
export function handOf(p) {
  const forearm = PART_NAMES.indexOf(p.facing > 0 ? 'forearmR' : 'forearmL')
  const [, , x, y] = partEnds(p.parts[forearm], PART_HALF_LEN.forearmR)
  return [x, y]
}

// A Vine reeling a player in: pulled taut from their hand to where it stuck, with a knot there.
export function drawGrappleVine(ctx, p, X, Y, s) {
  const [hx, hy] = handOf(p), [ax, ay] = p.grapple
  ctx.strokeStyle = '#3c7a22'
  ctx.lineWidth = 0.05 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(X(hx), Y(hy))
  ctx.lineTo(X(ax), Y(ay))
  ctx.stroke()
  ctx.fillStyle = PUMPKIN_TYPES.vine.color
  ctx.beginPath()
  ctx.arc(X(ax), Y(ay), 0.1 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineCap = 'butt'
}

// How the held gourd leaves the hand right now: { speed, gravity, life (s), radius } (as in
// Player.throwPumpkin / fireSeed; a Seed Spitter's sight is its seeds')
function launchOf(type, charge) {
  const T = CONFIG.throw
  const flying = type.throwMode === 'spray' ? PUMPKIN_TYPES.seed : type
  const [lo, hi] = type.throwMode === 'spray' ? [type.seedSpeed, type.seedSpeed]
    : type.throwMode === 'lob' ? type.lobSpeed
    : type.throwSpeed ? [type.throwSpeed.min, type.throwSpeed.max] : [T.minSpeed, T.maxSpeed]
  const speed = lerp(lo, hi, charge)
  return { speed, gravity: CONFIG.gravity * (flying.gravityScale ?? 1), life: flying.lifetime || Infinity, radius: flying.radius }
}

// What a thrown gourd would stop at: boxes { x0, x1, y0, y1 } for platforms and walls, moving
// platforms and hay bales (where this snapshot has them; bales as if upright) and pitchfork rows.
function sightObstacles(map, snap) {
  const box = (x, y, w, h) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 })
  const boxes = map.platforms.map(p => box(p.x, p.y, p.w, p.h))
  map.movers.forEach((m, i) => { const [x, y] = (snap.movers && snap.movers[i]) || [m.x, m.y]; boxes.push(box(x, y, m.w, m.h)) })
  for (const [, x, y] of snap.bales) boxes.push(box(x, y, BALE.w, BALE.h))
  for (const sp of map.spikes) boxes.push({ x0: sp.x - sp.w / 2, x1: sp.x + sp.w / 2, y0: sp.y, y1: sp.y + TINE.tip })
  return boxes
}

// Your sight (only you see it, when the host has sights on): dots in your gourd's colour, with a
// dark edge so they show up on any map, along where your gourd would fly if thrown now (so it
// grows while you charge), fading a little toward the far end, up to the first thing it
// would hit, where it would fizzle (Vine) or split (Gourd Cluster), or off screen (a Boomerang: once
// it's done curving, since it can come back on).
export function drawSight(ctx, p, aim, map, snap, X, Y, s) {
  const type = PUMPKIN_TYPES[p.held]
  const { speed, gravity, life, radius } = launchOf(type, p.charge)
  const [hx, hy] = handOf(p)
  const [sx, sy] = partEnds(p.parts[PART_NAMES.indexOf('torso')], PART_HALF_LEN.torso)   // (the shoulders: aimed from there)
  const d = Math.hypot(aim.x - sx, aim.y - sy) || 1, dx = (aim.x - sx) / d, dy = (aim.y - sy) / d
  const x0 = hx + dx * 0.15, y0 = hy + dy * 0.15   // (where it leaves the hand)
  let end = Math.min(life, 4)
  if (type.splitAge) end = Math.min(end, Math.max(type.splitAge, dy * speed / gravity))   // (the top of its arc)
  const boxes = sightObstacles(map, snap)
  const hits = (x, y) => boxes.some(b => x > b.x0 - radius && x < b.x1 + radius && y > b.y0 - radius && y < b.y1 + radius)

  // walk the arc in small steps (~5 cm), keeping a dot every 0.45 m
  const dots = [], dt = 0.05 / Math.max(speed, 1), launch = { x: dx * speed, y: dy * speed }
  let travelled = 0, nextDot = 0.45, x = x0, y = y0, vx = launch.x, vy = launch.y
  for (let t = dt; t <= end; t += dt) {
    const pull = type.curve ? boomerangPull(type.curve, launch, t) : null
    vx += (pull ? pull.x : 0) * dt
    vy += (pull ? pull.y : -gravity) * dt   // (a Boomerang's spin holds it up while it curves)
    const px = x, py = y
    x += vx * dt; y += vy * dt
    if (y < -1) break
    const offScreen = x < -1 || x > CONFIG.view.w + 1
    if (offScreen && !pull) break
    if (hits(x, y)) break
    travelled += Math.hypot(x - px, y - py)
    if (travelled >= nextDot && !offScreen) dots.push([x, y])
    if (travelled >= nextDot) nextDot += 0.45
  }
  ctx.fillStyle = type.color
  ctx.strokeStyle = 'rgba(30, 24, 20, 0.85)'
  ctx.lineWidth = Math.max(1.5, 0.025 * s)
  dots.forEach(([x, y], i) => {
    ctx.globalAlpha = 0.6 * (1 - 0.35 * i / Math.max(dots.length, 1))   // fading a little along the way
    ctx.beginPath()
    ctx.arc(X(x), Y(y), 0.075 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })
  ctx.globalAlpha = 1
}

export function drawPlayer(ctx, p, crowned, X, Y, s) {
  const color = p.frozen ? mixHex(p.color, '#cdeefa', 0.7) : p.color   // frozen: icy
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  p.parts.forEach((part, i) => {
    const name = PART_NAMES[i]
    if (name === 'head') return
    const [x1, y1, x2, y2] = partEnds(part, PART_HALF_LEN[name])
    ctx.lineWidth = (name === 'torso' ? 0.16 : 0.11) * s
    ctx.beginPath()
    ctx.moveTo(X(x1), Y(y1))
    ctx.lineTo(X(x2), Y(y2))
    ctx.stroke()
  })

  const [hx, hy] = p.parts[PART_NAMES.indexOf('head')]
  ctx.beginPath()
  ctx.arc(X(hx), Y(hy), BODY.headR * s, 0, Math.PI * 2)
  ctx.fill()
  if (p.frozen) {   // ice outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 0.03 * s
    ctx.stroke()
  }
  if (p.glued) {   // goo blobs on the feet
    ctx.fillStyle = PUMPKIN_TYPES.pie.color
    for (const name of ['shinL', 'shinR']) {
      const [, , fx, fy] = partEnds(p.parts[PART_NAMES.indexOf(name)], PART_HALF_LEN[name])
      ctx.beginPath()
      ctx.ellipse(X(fx), Y(fy), 0.2 * s, 0.1 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (p.floating) {   // a balloon carrying them off
    ctx.strokeStyle = '#6b6358'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(hx), Y(hy + BODY.headR))
    ctx.lineTo(X(hx), Y(hy + 0.75))
    ctx.stroke()
    drawPumpkin(ctx, X(hx), Y(hy + 0.95), 0.2 * s, 0, PUMPKIN_TYPES.balloon)
  }
  ctx.fillStyle = color
  // eyes look the way you're facing; X eyes while ragdolled
  const ex = X(hx + p.facing * 0.07), ey = Y(hy + 0.03), er = 0.035 * s
  if (p.stunned) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 0.025 * s
    ctx.beginPath()
    ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er)
    ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(ex, ey, er, 0, Math.PI * 2)
    ctx.fill()
  }

  if (crowned) drawCrown(ctx, p.parts[PART_NAMES.indexOf('head')], X, Y, s)

  // pumpkin in the front hand, growing a little while charging
  if (p.held) {
    const [handX, handY] = handOf(p)
    const type = PUMPKIN_TYPES[p.held]
    const colors = pumpkinColors(type, p.heldRipeness, 0)
    if (p.held === 'balloon') {   // held by its string, floating above the hand
      ctx.strokeStyle = '#6b6358'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(handX), Y(handY))
      ctx.lineTo(X(handX), Y(handY + 0.5))
      ctx.stroke()
      drawPumpkin(ctx, X(handX), Y(handY + 0.5 + type.radius), type.radius * s, 0, colors)
    } else {
      drawPumpkin(ctx, X(handX), Y(handY), type.radius * (1 + 0.25 * p.charge) * s, 0, colors, type.mark)
    }
    if (p.heldCracks) {   // Big Gourd shield taking damage
      ctx.strokeStyle = '#3b3631'
      ctx.lineWidth = 0.025 * s
      for (let i = 0; i < p.heldCracks; i++) {
        const a = i * 2.1 + 0.4, r = type.radius
        ctx.beginPath()
        ctx.moveTo(X(handX), Y(handY))
        ctx.lineTo(X(handX + Math.cos(a) * r * 0.9), Y(handY + Math.sin(a) * r * 0.9))
        ctx.stroke()
      }
    }
  }
}

// A little gold crown sitting on a head ([x, y, angle]), tilting with it.
function drawCrown(ctx, head, X, Y, s) {
  const [hx, hy, a] = head
  const ux = -Math.sin(a), uy = Math.cos(a)   // the head's up direction
  const P = (along, up) => [X(hx + ux * up + uy * along), Y(hy + uy * up - ux * along)]
  const base = BODY.headR - 0.02, w = 0.2, h = 0.22
  const pts = [[-w, base], [-w, base + h], [-w / 2, base + h * 0.55], [0, base + h * 1.1], [w / 2, base + h * 0.55], [w, base + h], [w, base]]
  ctx.beginPath()
  pts.forEach(([al, up], i) => { const [x, y] = P(al, up); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
  ctx.closePath()
  ctx.fillStyle = '#f7c531'
  ctx.fill()
  ctx.strokeStyle = '#9a6b00'
  ctx.lineWidth = Math.max(1, 0.025 * s)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.fillStyle = '#d6303f'   // a jewel
  const [jx, jy] = P(0, base + h * 0.32)
  ctx.beginPath()
  ctx.arc(jx, jy, 0.035 * s, 0, Math.PI * 2)
  ctx.fill()
}
