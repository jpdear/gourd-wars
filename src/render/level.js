// Drawing the level pieces: hay bales, pitchforks, bonfires, scarecrows, gourd cannons.
// Hay bale ({ x, y, angle, health 0..1, frozen, sticky, floating }, as in a snapshot): golden straw
// box with twine bands; gaps show up as it takes damage. Frozen: icy; sticky: goo; floating: a balloon on top.
// Colors: LEVEL (palette.js).

import { CANNON, cannonParts } from '../game/cannons.js'
import { BALE, TINE, pitchforkTines, scytheBladeShape } from '../game/level.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { LEVEL } from './palette.js'
import { drawPumpkin } from './pumpkins.js'

export function drawBale(ctx, { x, y, angle, health: hp, frozen, sticky, floating }, X, Y, s, shade) {
  if (floating) {   // the balloon carrying it, drawn upright above it
    ctx.strokeStyle = LEVEL.bale.balloonString
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(x), Y(y + BALE.h / 2))
    ctx.lineTo(X(x), Y(y + BALE.h / 2 + 0.55))
    ctx.stroke()
    drawPumpkin(ctx, X(x), Y(y + BALE.h / 2 + 0.75), 0.22 * s, 0, PUMPKIN_TYPES.balloon, null, shade)
  }
  const w = BALE.w * s, h = BALE.h * s
  ctx.save()
  ctx.translate(X(x), Y(y))
  ctx.rotate(-angle)
  ctx.fillStyle = LEVEL.bale.straw
  ctx.strokeStyle = LEVEL.bale.edge
  ctx.lineWidth = Math.max(1, 0.04 * s)
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = LEVEL.bale.lines
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const fy of [-0.25, 0, 0.25]) { ctx.moveTo(-w / 2 + 2, fy * h); ctx.lineTo(w / 2 - 2, fy * h) }   // straw
  ctx.stroke()
  ctx.strokeStyle = LEVEL.bale.twine
  ctx.lineWidth = Math.max(1.5, 0.05 * s)
  ctx.beginPath()
  for (const fx of [-0.25, 0.25]) { ctx.moveTo(fx * w, -h / 2); ctx.lineTo(fx * w, h / 2) }   // twine
  ctx.stroke()
  if (hp < 0.67) {   // damage
    ctx.strokeStyle = LEVEL.bale.crack
    ctx.lineWidth = Math.max(1, 0.03 * s)
    ctx.beginPath()
    ctx.moveTo(-0.1 * w, -h / 2); ctx.lineTo(0.05 * w, -0.1 * h); ctx.lineTo(-0.05 * w, 0.15 * h)
    if (hp < 0.34) { ctx.moveTo(0.4 * w, h / 2); ctx.lineTo(0.2 * w, 0.1 * h); ctx.lineTo(0.35 * w, -0.2 * h) }
    ctx.stroke()
  }
  if (frozen) {   // icy coat
    ctx.fillStyle = LEVEL.bale.ice
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeStyle = LEVEL.bale.iceEdge
    ctx.lineWidth = Math.max(1.5, 0.04 * s)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
  }
  if (sticky) {   // goo drips
    ctx.fillStyle = PUMPKIN_TYPES.pie.color
    for (const [fx, fy, r] of [[-0.3, -0.5, 0.16], [0.05, -0.5, 0.2], [0.35, -0.5, 0.14], [-0.15, 0.5, 0.13], [0.3, 0.5, 0.15]]) {
      ctx.beginPath()
      ctx.ellipse(fx * w, fy * h, r * s, r * 0.6 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

// A row of upturned pitchfork tines on a wooden bar.
export function drawPitchforks(ctx, sp, X, Y, s) {
  const x0 = sp.x - sp.w / 2
  ctx.fillStyle = LEVEL.pitchfork.bar
  ctx.fillRect(X(x0), Y(sp.y + 0.12), sp.w * s, 0.12 * s)
  ctx.fillStyle = LEVEL.pitchfork.tine
  ctx.strokeStyle = LEVEL.pitchfork.tineEdge
  ctx.lineWidth = 1
  for (const x of pitchforkTines(sp)) {   // same shapes as the physics tines
    ctx.beginPath()
    ctx.moveTo(X(x - TINE.halfW), Y(sp.y + TINE.base))
    ctx.lineTo(X(x), Y(sp.y + TINE.tip))
    ctx.lineTo(X(x + TINE.halfW), Y(sp.y + TINE.base))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

// Bonfire: logs behind the players, flickering flames in front of them.
export function drawBonfire(ctx, f, X, Y, s, flames) {
  if (!flames) {
    ctx.fillStyle = LEVEL.bonfire.log
    for (const a of [0.35, -0.35]) {
      ctx.save()
      ctx.translate(X(f.x), Y(f.y + 0.1))
      ctx.rotate(a)
      ctx.fillRect(-f.w * 0.5 * s, -0.08 * s, f.w * s, 0.16 * s)
      ctx.restore()
    }
    LEVEL.bonfire.glow.forEach((color, i) => {   // the glow: three see-through discs, one inside the next
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(X(f.x), Y(f.y + 0.4), [1.6, 1.1, 0.7][i] * s, 0, Math.PI * 2)
      ctx.fill()
    })
    return
  }
  const t = Date.now() / 1000
  const n = 4
  for (const [color, scale] of [[LEVEL.bonfire.flames[0], 1], [LEVEL.bonfire.flames[1], 0.75], [LEVEL.bonfire.flames[2], 0.45]]) {
    ctx.fillStyle = color
    for (let i = 0; i < n; i++) {
      const fx = f.x + (i / (n - 1) - 0.5) * f.w * 0.7
      const hgt = (0.55 + 0.3 * Math.sin(t * 9 + i * 1.7)) * scale
      const wid = f.w / n * 0.9 * scale
      ctx.beginPath()
      ctx.moveTo(X(fx - wid), Y(f.y + 0.1))
      ctx.quadraticCurveTo(X(fx - wid * 0.6), Y(f.y + hgt * 0.7), X(fx + 0.05 * Math.sin(t * 7 + i)), Y(f.y + 0.1 + hgt))
      ctx.quadraticCurveTo(X(fx + wid * 0.6), Y(f.y + hgt * 0.7), X(fx + wid), Y(f.y + 0.1))
      ctx.fill()
    }
  }
}

// Scarecrow on a pole, swinging a scythe around its pivot.
export function drawScarecrow(ctx, sc, angle, X, Y, s) {
  // pole (down to the ground) + body
  ctx.strokeStyle = LEVEL.scarecrow.pole
  ctx.lineWidth = 0.12 * s
  ctx.beginPath()
  ctx.moveTo(X(sc.x), Y(sc.y - (sc.pole ?? 2.6)))
  ctx.lineTo(X(sc.x), Y(sc.y + 1.1))
  ctx.stroke()
  ctx.fillStyle = LEVEL.scarecrow.body   // burlap body
  ctx.fillRect(X(sc.x - 0.3), Y(sc.y + 0.6), 0.6 * s, 0.8 * s)
  ctx.beginPath()            // head
  ctx.arc(X(sc.x), Y(sc.y + 0.95), 0.28 * s, 0, Math.PI * 2)
  ctx.fillStyle = LEVEL.scarecrow.head
  ctx.fill()
  ctx.fillStyle = LEVEL.scarecrow.hat  // hat
  ctx.fillRect(X(sc.x - 0.42), Y(sc.y + 1.2), 0.84 * s, 0.07 * s)
  ctx.fillRect(X(sc.x - 0.22), Y(sc.y + 1.45), 0.44 * s, 0.26 * s)
  // spinning arm with the blade at the end
  const dx = Math.cos(angle), dy = Math.sin(angle)
  ctx.strokeStyle = LEVEL.scarecrow.arm
  ctx.lineWidth = 0.09 * s
  ctx.beginPath()
  ctx.moveTo(X(sc.x), Y(sc.y))
  ctx.lineTo(X(sc.x + dx * sc.length), Y(sc.y + dy * sc.length))
  ctx.stroke()
  // the blade: exactly the physics shape, rotated into place
  const toWorld = ([lx, ly]) => [sc.x + lx * dx - ly * dy, sc.y + lx * dy + ly * dx]
  ctx.fillStyle = LEVEL.scarecrow.blade
  ctx.strokeStyle = LEVEL.scarecrow.bladeEdge
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const poly of scytheBladeShape(sc)) {
    poly.map(toWorld).forEach(([wx, wy], i) => (i ? ctx.lineTo(X(wx), Y(wy)) : ctx.moveTo(X(wx), Y(wy))))
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = LEVEL.scarecrow.hub
  ctx.beginPath()
  ctx.arc(X(sc.x), Y(sc.y), 0.08 * s, 0, Math.PI * 2)
  ctx.fill()
}

// A gourd cannon (see game/cannons.js): its mount on the surface and an iron barrel along its aim.
// timer: seconds until it fires (the fuse sparks just before; the barrel kicks back just after), or
// null (not counting down: the editor, a map being left).
export function drawCannon(ctx, c, timer, X, Y, s) {
  const { base, angle, pivot, aim } = cannonParts(c), B = CANNON.base
  // the mount: a wooden block on the surface, an iron strap across it
  ctx.save()
  ctx.translate(X(base.x), Y(base.y))
  ctx.rotate(-angle)
  ctx.fillStyle = LEVEL.cannon.mount
  ctx.beginPath()
  ctx.moveTo(-B.w / 2 * s, B.h / 2 * s)
  ctx.lineTo(B.w / 2 * s, B.h / 2 * s)
  ctx.lineTo(B.w * 0.32 * s, -B.h / 2 * s)
  ctx.lineTo(-B.w * 0.32 * s, -B.h / 2 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = LEVEL.cannon.strap
  ctx.fillRect(-B.w * 0.42 * s, 0.02 * s, B.w * 0.84 * s, 0.07 * s)
  ctx.restore()
  // the barrel, from its pivot (kicked back a little right after a shot)
  const every = Math.max(0.5, c.every ?? 3), since = timer === null ? 9 : every - timer
  const kick = since >= 0 && since < 0.2 ? 0.14 * (1 - since / 0.2) : 0
  const L = CANNON.barrel
  ctx.save()
  ctx.translate(X(pivot.x), Y(pivot.y))
  ctx.rotate(-aim)
  ctx.translate(-kick * s, 0)
  ctx.fillStyle = LEVEL.cannon.barrel
  ctx.beginPath()
  ctx.moveTo(-0.22 * s, -0.15 * s)
  ctx.lineTo(L * s, -0.11 * s)
  ctx.lineTo(L * s, 0.11 * s)
  ctx.lineTo(-0.22 * s, 0.15 * s)
  ctx.arc(-0.22 * s, 0, 0.15 * s, Math.PI / 2, -Math.PI / 2)
  ctx.fill()
  ctx.fillStyle = LEVEL.cannon.band   // bands
  ctx.fillRect(0.1 * s, -0.14 * s, 0.07 * s, 0.28 * s)
  ctx.fillStyle = LEVEL.cannon.muzzle   // a pumpkin-orange ring round the muzzle
  ctx.fillRect((L - 0.08) * s, -0.13 * s, 0.08 * s, 0.26 * s)
  ctx.restore()
  // the pivot pin
  ctx.fillStyle = LEVEL.cannon.pin
  ctx.beginPath()
  ctx.arc(X(pivot.x), Y(pivot.y), 0.06 * s, 0, Math.PI * 2)
  ctx.fill()
  // the fuse sparking at the back, just before it fires
  if (timer !== null && timer < 0.6) {
    const back = { x: pivot.x - Math.cos(aim) * 0.36, y: pivot.y - Math.sin(aim) * 0.36 }
    const flick = 0.05 + 0.03 * Math.sin(Date.now() / 25)
    ctx.fillStyle = LEVEL.cannon.spark
    ctx.beginPath()
    ctx.arc(X(back.x), Y(back.y), flick * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = LEVEL.cannon.sparkCore
    ctx.beginPath()
    ctx.arc(X(back.x), Y(back.y), flick * 0.5 * s, 0, Math.PI * 2)
    ctx.fill()
  }
}
