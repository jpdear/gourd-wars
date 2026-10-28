// Drawing pumpkins and their patches.
// Green when unripe, the type's own color when ripe, brown as it rots.

import { CONFIG } from '../config.js'
import { canHarvest, patchPumpkin, patchRipeness } from '../game/patches.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { patchView, snapPlayer } from '../game/snapshot.js'
import { PART_HALF_LEN, partEnds } from './players.js'
import { hexA, mixHex } from '../util/color.js'
import { clamp } from '../util/math.js'

const GREEN = { color: '#76a83f', rib: '#557d2a' }
const BROWN = { color: '#7a5a32', rib: '#56401f' }

export function pumpkinColors(type, ripeness, rot) {
  const t = clamp(ripeness, 0, 1), r = clamp(rot, 0, 1)
  return {
    color: mixHex(mixHex(GREEN.color, type.color, t), BROWN.color, r),
    rib: mixHex(mixHex(GREEN.rib, type.rib, t), BROWN.rib, r),
  }
}

export function drawPatches(ctx, snap, localIndex, X, Y, s) {
  const me = snapPlayer(snap, localIndex)   // (none in the map editor, or before you've jumped in)
  // pelvis = bottom end of the torso
  const [, , pelvisX, pelvisY] = me ? partEnds(me.parts[0], PART_HALF_LEN.torso) : []

  snap.patches.forEach((_, i) => {
    const patch = patchView(snap, i)
    // leaves on the ground
    ctx.fillStyle = '#4c7a2a'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(X(patch.x + side * 0.28), Y(patch.y + 0.06), 0.2 * s, 0.07 * s, side * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    if (patch.state === 'empty') return

    const pk = patchPumpkin(patch)
    const type = PUMPKIN_TYPES[patch.typeName]
    if (patch.superRare) drawSuperRareGlow(ctx, X(pk.x), Y(pk.y), pk.r * s, s, type)
    else if (patch.typeName !== 'classic') {   // specials glow so both players see them coming
      const pulse = 0.6 + 0.25 * Math.sin(Date.now() / 220)
      const g = ctx.createRadialGradient(X(pk.x), Y(pk.y), pk.r * 0.5 * s, X(pk.x), Y(pk.y), (pk.r + 0.6) * s)
      g.addColorStop(0, hexA(type.color, 0.75 * pulse))
      g.addColorStop(1, hexA(type.color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(X(pk.x), Y(pk.y), (pk.r + 0.6) * s, 0, Math.PI * 2)
      ctx.fill()
    }
    drawPumpkin(ctx, X(pk.x), Y(pk.y), pk.r * s, 0, pumpkinColors(type, patchRipeness(patch), patch.rot), type.mark)

    // harvest progress ring (whoever is pulling on it)
    const progress = Math.max(0, ...snap.players.map(p => (p.harvestPatch === i ? p.harvest : 0)))
    if (progress > 0) {
      ctx.strokeStyle = '#3b3631'
      ctx.lineWidth = 0.06 * s
      ctx.beginPath()
      ctx.arc(X(pk.x), Y(pk.y), (pk.r + 0.15) * s, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
      ctx.stroke()
      return
    }

    // "E" hint when you could pick this one from where you stand
    const dx = Math.abs(pelvisX - patch.x), dy = pelvisY - patch.y
    if (me && !me.dead && !me.held && canHarvest(patch) && dx < CONFIG.patch.reach && dy > 0 && dy < 1.6) {
      const bx = X(pk.x), by = Y(pk.y + pk.r + 0.45)
      ctx.fillStyle = '#3b3631'
      ctx.beginPath()
      ctx.arc(bx, by, 0.24 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f4efe6'
      ctx.font = `bold ${Math.round(0.3 * s)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('E', bx, by + 0.01 * s)
      ctx.textBaseline = 'alphabetic'
    }
  })
}

// A Super Rare pumpkin on its patch: a bigger, faster-pulsing gold glow (the type's color at the
// heart) with sparkles circling it. (x, y, r in pixels; s = pixels per meter)
const GOLD = '#ffd54a'
function drawSuperRareGlow(ctx, x, y, r, s, type) {
  const now = Date.now()
  const pulse = 0.6 + 0.2 * Math.sin(now / 150)
  const outer = r + 0.8 * s
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, outer)
  g.addColorStop(0, hexA(type.color, 0.55 * pulse))
  g.addColorStop(0.35, hexA(GOLD, 0.4 * pulse))
  g.addColorStop(1, hexA(GOLD, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, outer, 0, Math.PI * 2)
  ctx.fill()
  // 4 twinkling four-point stars going round
  ctx.fillStyle = '#fff6c8'
  for (let i = 0; i < 4; i++) {
    const a = now / 900 + (i * Math.PI) / 2
    const d = r + 0.45 * s, size = 0.09 * s * (0.6 + 0.4 * Math.sin(now / 120 + i * 1.7))
    const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d
    ctx.beginPath()
    ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size * 0.3, sy); ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size * 0.3, sy); ctx.closePath()
    ctx.moveTo(sx - size, sy); ctx.lineTo(sx, sy + size * 0.3); ctx.lineTo(sx + size, sy); ctx.lineTo(sx, sy - size * 0.3); ctx.closePath()
    ctx.fill()
  }
}

// Decorations drawn over a pumpkin's body, by its type's mark (in the pumpkin's own frame: radius r,
// canvas y pointing down, so negative y is the top).
const MARKS = {
  bands: (ctx, r, colors) => {
    ctx.strokeStyle = colors.rib
    ctx.beginPath()
    for (const oy of [-0.4, 0.4]) { ctx.moveTo(-r, oy * r); ctx.lineTo(r, oy * r) }
    ctx.stroke()
  },
  fuse: (ctx, r) => {
    ctx.strokeStyle = '#3b3631'
    ctx.beginPath()
    ctx.moveTo(r * 0.1, -r * 1.1)
    ctx.quadraticCurveTo(r * 0.5, -r * 1.6, r * 0.7, -r * 1.4)
    ctx.stroke()
    ctx.fillStyle = Math.sin(Date.now() / 60) > 0 ? '#ffd36b' : '#ff7a1a'   // spark
    ctx.beginPath()
    ctx.arc(r * 0.72, -r * 1.42, Math.max(1.5, r * 0.16), 0, Math.PI * 2)
    ctx.fill()
  },
  ice: (ctx, r) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    for (const [ox, oy] of [[-0.5, -0.3], [0.35, 0.1], [-0.1, 0.5]]) {
      ctx.beginPath()
      ctx.moveTo(ox * r, (oy - 0.18) * r); ctx.lineTo((ox + 0.1) * r, oy * r)
      ctx.lineTo(ox * r, (oy + 0.18) * r); ctx.lineTo((ox - 0.1) * r, oy * r)
      ctx.fill()
    }
  },
  vine: (ctx, r) => {
    ctx.strokeStyle = '#3c7a22'
    ctx.beginPath()
    ctx.moveTo(0, -r * 1.2)
    ctx.bezierCurveTo(r * 0.8, -r * 1.8, r * 1.2, -r * 0.8, r * 0.7, -r * 0.9)
    ctx.stroke()
  },
  speckle: (ctx, r) => {
    ctx.fillStyle = '#3b3631'
    for (const [ox, oy] of [[-0.5, -0.2], [0.3, -0.45], [0.55, 0.25], [-0.2, 0.45], [0.05, 0]]) {
      ctx.beginPath()
      ctx.arc(ox * r, oy * r, Math.max(1, r * 0.09), 0, Math.PI * 2)
      ctx.fill()
    }
  },
  stars: (ctx, r) => {   // little four-point sparkles
    ctx.fillStyle = '#f4efe6'
    for (const [ox, oy, k] of [[-0.45, -0.35, 0.3], [0.4, -0.15, 0.22], [0.05, 0.45, 0.26], [-0.5, 0.3, 0.16], [0.55, 0.5, 0.14]]) {
      const x = ox * r, y = oy * r, a = Math.max(1.5, k * r), b = a * 0.25
      ctx.beginPath()
      ctx.moveTo(x, y - a); ctx.lineTo(x + b, y - b); ctx.lineTo(x + a, y); ctx.lineTo(x + b, y + b)
      ctx.lineTo(x, y + a); ctx.lineTo(x - b, y + b); ctx.lineTo(x - a, y); ctx.lineTo(x - b, y - b)
      ctx.fill()
    }
  },
  string: (ctx, r) => {
    ctx.strokeStyle = '#6b6358'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, r)
    ctx.quadraticCurveTo(r * 0.3, r * 1.6, 0, r * 2.2)
    ctx.stroke()
  },
}

// colors: { color, rib } (a pumpkin type, or pumpkinColors(...)); mark: the type's decoration
// (canvas y points down here, so negative y is the top of the pumpkin)
export function drawPumpkin(ctx, x, y, r, angle, colors, mark) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-angle)
  if (mark === 'seed') {   // dark seed with a light outline, so it shows on the light background
    ctx.fillStyle = colors.color
    ctx.strokeStyle = colors.rib
    ctx.lineWidth = Math.max(1.5, r * 0.35)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.35, r * 0.9, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
    ctx.restore()
    return
  }
  if (mark === 'cluster') {   // three little gourds stuck together
    for (const [ox, oy] of [[-0.45, 0.2], [0.45, 0.2], [0, -0.38]]) drawPumpkin(ctx, ox * r, oy * r, r * 0.58, 0, colors)
    ctx.restore()
    return
  }
  ctx.fillStyle = colors.color
  ctx.strokeStyle = colors.rib
  ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.beginPath()
  if (mark === 'pie') ctx.ellipse(0, 0, r * 1.15, r * 0.7, 0, 0, Math.PI * 2)        // a flat pie
  else if (mark === 'gourd') ctx.ellipse(0, 0, r * 1.15, r * 0.95, 0, 0, Math.PI * 2) // squat and wide
  else ctx.ellipse(0, 0, r * 1.08, r, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  if (mark === 'pie') {
    ctx.lineWidth = Math.max(1, r * 0.2)
    ctx.ellipse(0, 0, r * 1.05, r * 0.6, 0, 0, Math.PI * 2)   // crust
    ctx.stroke()
    ctx.fillStyle = colors.rib
    for (const ox of [-0.4, 0, 0.4]) ctx.fillRect(ox * r - r * 0.05, -r * 0.2, r * 0.1, r * 0.4)   // slits
  } else {
    ctx.ellipse(0, 0, r * 0.45, r * 0.98, 0, 0, Math.PI * 2)
    if (mark === 'gourd') { ctx.moveTo(r * 0.85, 0); ctx.ellipse(0, 0, r * 0.85, r * 0.94, 0, 0, Math.PI * 2) }   // (moveTo: no joining line)
    ctx.stroke()
    ctx.fillStyle = '#4c7a2a'
    ctx.fillRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.4)   // stem
  }
  ctx.lineWidth = Math.max(1, r * 0.1)
  MARKS[mark]?.(ctx, r, colors)
  ctx.restore()
}

// A Black Hole (r: its core's radius): a black core with a tight white halo, and white specks
// streaking in from all around it.
export function drawBlackHole(ctx, x, y, r, X, Y, s) {
  const cx = X(x), cy = Y(y), t = Date.now() / 1000
  // each speck falls in from 3.5 r, speeding up as it goes, then starts over from a new direction
  // (u: 0 = far out, 1 = at the core)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = Math.max(1.5, 0.05 * s)
  ctx.lineCap = 'round'
  for (let i = 0; i < 24; i++) {
    const cycle = t * 0.8 + i * 0.618, u = cycle % 1
    const a = i * 2.4 + Math.floor(cycle) * 1.7 + u * 0.8   // (a slight swirl)
    const at = v => {
      const d = r * (1 + 2.5 * (1 - v) ** 2)
      return [cx + Math.cos(a + (v - u)) * d * s, cy - Math.sin(a + (v - u)) * d * s]
    }
    ctx.globalAlpha = Math.min(1, u * 3)
    ctx.beginPath()
    ctx.moveTo(...at(Math.max(0, u - 0.08)))
    ctx.lineTo(...at(u))
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const halo = ctx.createRadialGradient(cx, cy, r * s, cx, cy, r * 1.4 * s)
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.4 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(cx, cy, r * s, 0, Math.PI * 2)
  ctx.fill()
}
