// Drawing pumpkins and their patches.
// Green when unripe, the type's own color when ripe, brown as it rots.

import { CONFIG } from '../config.js'
import { canHarvest, patchPumpkin, patchRipeness } from '../game/patches.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { patchView, snapPlayer } from '../game/snapshot.js'
import { PART_HALF_LEN, partEnds } from './players.js'
import { hexA, mixHex } from '../util/color.js'
import { clamp, lerp } from '../util/math.js'

const GREEN = { color: '#76a83f', rib: '#557d2a' }
const BROWN = { color: '#7a5a32', rib: '#56401f' }

export function pumpkinColors(type, ripeness, rot) {
  const t = clamp(ripeness, 0, 1), r = clamp(rot, 0, 1)
  return {
    color: mixHex(mixHex(GREEN.color, type.color, t), BROWN.color, r),
    rib: mixHex(mixHex(GREEN.rib, type.rib, t), BROWN.rib, r),
  }
}

// harvestKey: the name of your harvest key, shown in a bubble over a patch you could pick
export function drawPatches(ctx, snap, localIndex, harvestKey, X, Y, s) {
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

    // your harvest key's bubble when you could pick this one from where you stand (round for one
    // letter, stretched to fit a longer name)
    const dx = Math.abs(pelvisX - patch.x), dy = pelvisY - patch.y
    if (me && !me.dead && !me.held && canHarvest(patch) && dx < CONFIG.patch.reach && dy > 0 && dy < 1.6) {
      const bx = X(pk.x), by = Y(pk.y + pk.r + 0.45), r = 0.24 * s
      ctx.font = `bold ${Math.round((harvestKey.length > 1 ? 0.24 : 0.3) * s)}px system-ui, sans-serif`
      const half = Math.max(0, ctx.measureText(harvestKey).width / 2 - r * 0.6)
      ctx.fillStyle = '#3b3631'
      ctx.beginPath()
      ctx.arc(bx - half, by, r, Math.PI / 2, Math.PI * 3 / 2)
      ctx.arc(bx + half, by, r, -Math.PI / 2, Math.PI / 2)
      ctx.fill()
      ctx.fillStyle = '#f4efe6'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(harvestKey, bx, by + 0.01 * s)
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
  crosshair: (ctx, r) => {   // a red target
    ctx.strokeStyle = '#d6332a'
    ctx.lineWidth = Math.max(1, r * 0.12)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2)
    ctx.moveTo(-r * 0.75, 0); ctx.lineTo(r * 0.75, 0)
    ctx.moveTo(0, -r * 0.75); ctx.lineTo(0, r * 0.75)
    ctx.stroke()
  },
  antenna: (ctx, r) => {   // a thin aerial with a blinking tip, where the stem would be
    ctx.strokeStyle = '#3b3631'
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.95)
    ctx.lineTo(r * 0.15, -r * 1.75)
    ctx.stroke()
    ctx.fillStyle = Math.sin(Date.now() / 90) > 0 ? '#fff3b0' : '#ff3b2a'
    ctx.beginPath()
    ctx.arc(r * 0.15, -r * 1.8, Math.max(1.5, r * 0.18), 0, Math.PI * 2)
    ctx.fill()
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
  if (mark === 'boomerang') {
    drawBoomerangGourd(ctx, r, colors)
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
    if (mark !== 'antenna') ctx.fillRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.4)   // stem (a Homing gourd has an antenna instead)
  }
  ctx.lineWidth = Math.max(1, r * 0.1)
  MARKS[mark]?.(ctx, r, colors)
  ctx.restore()
}

// A crookneck gourd bent like a boomerang (around 0, 0; canvas y down): two arms meeting at a rounded
// elbow on top, a round bulb at the end of one, the neck tapering down the other to a curled stem.
function drawBoomerangGourd(ctx, r, colors) {
  const at = t => {   // along the bend (a curve from the bulb, up over the elbow, down to the tip): [x, y, normal x, normal y]
    const x = lerp(lerp(-0.85, 0, t), lerp(0, 0.85, t), t) * r, y = lerp(lerp(0.5, -1.6, t), lerp(-1.6, 0.5, t), t) * r
    const tx = 1.7, ty = 4.2 * (2 * t - 1), d = Math.hypot(tx, ty)
    return [x, y, ty / d, -tx / d]   // (the normal points out of the bend)
  }
  const [bx, by] = at(0.05), [tx, ty, tnx, tny] = at(1)
  const pieces = [
    () => {   // the neck: one edge out, the other back
      const N = 14, edge = []
      for (let i = 0; i <= N; i++) {
        const [x, y, nx, ny] = at(lerp(0.08, 1, i / N)), w = lerp(0.34, 0.19, i / N) * r
        edge.push([x + nx * w, y + ny * w, x - nx * w, y - ny * w])
      }
      edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      for (let i = N; i >= 0; i--) ctx.lineTo(edge[i][2], edge[i][3])
      ctx.closePath()
    },
    () => ctx.arc(bx, by, 0.44 * r, 0, Math.PI * 2),   // the bulb
    () => ctx.arc(tx, ty, 0.19 * r, 0, Math.PI * 2),   // (a rounded tip)
  ]
  ctx.fillStyle = colors.color
  ctx.strokeStyle = colors.rib
  ctx.lineWidth = Math.max(1, r * 0.14)
  for (const piece of pieces) { ctx.beginPath(); piece(); ctx.stroke() }
  for (const piece of pieces) { ctx.beginPath(); piece(); ctx.fill() }   // (covers the outline where they overlap)
  ctx.lineWidth = Math.max(1, r * 0.07)   // a ridge along the outside of the bend
  ctx.beginPath()
  for (let i = 0; i <= 12; i++) {
    const [x, y, nx, ny] = at(lerp(0.12, 0.85, i / 12)), w = lerp(0.18, 0.07, i / 12) * r
    if (i) ctx.lineTo(x + nx * w, y + ny * w); else ctx.moveTo(x + nx * w, y + ny * w)
  }
  ctx.stroke()
  const ux = -tny, uy = tnx   // (on along the neck, past the tip)
  ctx.strokeStyle = '#4c7a2a'
  ctx.lineWidth = Math.max(1.5, r * 0.13)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.quadraticCurveTo(tx + ux * 0.4 * r, ty + uy * 0.4 * r, tx + (ux * 0.3 + tnx * 0.35) * r, ty + (uy * 0.3 + tny * 0.35) * r)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// A Boomerang in flight (pixels): faint copies of it on either side of where it is, like a blur
// from how fast it's spinning.
export function drawSpinBlur(ctx, x, y, r, angle, colors) {
  ctx.globalAlpha = 0.18
  for (const off of [-0.5, 0.5]) drawPumpkin(ctx, x, y, r, angle + off, colors, 'boomerang')
  ctx.globalAlpha = 1
}

// A Homing gourd's exhaust (pixels; heading: the way it's flying, world radians): a flickering
// flame streaming out behind it, yellow at the gourd fading to red.
export function drawFlameTrail(ctx, x, y, r, heading) {
  const bx = -Math.cos(heading), by = Math.sin(heading)   // (backward, in canvas space: y points down)
  const now = Date.now()
  for (let i = 5; i >= 1; i--) {
    const flick = 0.85 + 0.3 * Math.sin(now / 40 + i * 2.1)
    const d = r * (0.6 + i * 0.55)
    ctx.fillStyle = ['#fff3b0', '#ffd23f', '#ff9a2e', '#ff6a1f', '#e2381b'][i - 1]
    ctx.globalAlpha = 0.9 - i * 0.12
    ctx.beginPath()
    ctx.arc(x + bx * d, y + by * d, r * (0.75 - i * 0.1) * flick, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// Locked on: red corner brackets turning slowly around a player's torso (x, y in pixels), so
// everyone can see who a Homing gourd is after.
export function drawLockOn(ctx, x, y, s) {
  const now = Date.now()
  const R = 0.75 * s * (1 + 0.08 * Math.sin(now / 80)), arm = 0.25 * s
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(now / 600)
  ctx.strokeStyle = '#e2381b'
  ctx.lineWidth = Math.max(1.5, 0.06 * s)
  ctx.beginPath()
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2)
    ctx.moveTo(R - arm, -R); ctx.lineTo(R, -R); ctx.lineTo(R, -R + arm)
  }
  ctx.stroke()
  ctx.restore()
}

// An Airstrike target (t: 0 when called in → 1 when the airdrop is due; r: the airdrop's radius):
// a dark shadow that spreads as the airdrop gets close, under a pulsing red crosshair.
export function drawAirstrikeTarget(ctx, x, y, t, r, X, Y, s) {
  const cx = X(x), cy = Y(y)
  const w = r * (0.3 + 0.9 * t) * s
  ctx.fillStyle = `rgba(20, 16, 12, ${0.15 + 0.35 * t})`
  ctx.beginPath()
  ctx.ellipse(cx, cy, w, w * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  const pulse = 1 + 0.12 * Math.sin(Date.now() / 70)
  const R = 0.45 * s * pulse
  ctx.strokeStyle = '#d6332a'
  ctx.lineWidth = Math.max(1.5, 0.06 * s)
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // ticks poking out past the ring
    ctx.moveTo(cx + dx * R * 0.5, cy + dy * R * 0.5)
    ctx.lineTo(cx + dx * R * 1.4, cy + dy * R * 1.4)
  }
  ctx.stroke()
  ctx.fillStyle = '#d6332a'
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(1.5, 0.06 * s), 0, Math.PI * 2)
  ctx.fill()
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
