// Drawing the stick figures (from snapshot data), plus what they hold and wear.

import { BODY, CONFIG } from '../config.js'
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

// Where your held pumpkin will go (only you see it): faint dots along its path, as fast as the
// throw would be right now (so it grows while you charge), with its drop, out to where it fizzles.
export function drawAimLine(ctx, p, aim, X, Y, s) {
  const type = PUMPKIN_TYPES[p.held], T = CONFIG.throw
  const [hx, hy] = handOf(p)
  const [sx, sy] = partEnds(p.parts[PART_NAMES.indexOf('torso')], PART_HALF_LEN.torso)   // (the shoulders: aimed from there)
  const d = Math.hypot(aim.x - sx, aim.y - sy) || 1, dx = (aim.x - sx) / d, dy = (aim.y - sy) / d
  const { min, max } = type.throwSpeed || { min: T.minSpeed, max: T.maxSpeed }
  const speed = lerp(min, max, p.charge), g = CONFIG.gravity * (type.gravityScale ?? 1)
  const life = type.lifetime || 1, dots = Math.max(2, Math.round(speed * life / 0.45))
  ctx.fillStyle = type.color
  for (let i = 1; i <= dots; i++) {
    const t = life * i / dots
    ctx.globalAlpha = 0.55 * (1 - 0.6 * i / dots)   // fading toward the end of its range
    ctx.beginPath()
    ctx.arc(X(hx + dx * (0.15 + speed * t)), Y(hy + dy * (0.15 + speed * t) - 0.5 * g * t * t), 0.04 * s, 0, Math.PI * 2)
    ctx.fill()
  }
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
