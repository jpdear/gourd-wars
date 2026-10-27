// Drawing the level pieces: hay bales, pitchforks, bonfires, scarecrows.
// Hay bale: golden straw box with twine bands; gaps show up as it takes damage.
// flags: 1 frozen (icy), 2 sticky (goo), 4 floating (a balloon on top)

import { BALE, TINE, pitchforkTines, scytheBladeShape } from '../game/level.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { drawPumpkin } from './pumpkins.js'

export function drawBale(ctx, x, y, angle, hp, flags, X, Y, s) {
  if (flags & 4) {   // the balloon carrying it, drawn upright above it
    ctx.strokeStyle = '#6b6358'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(x), Y(y + BALE.h / 2))
    ctx.lineTo(X(x), Y(y + BALE.h / 2 + 0.55))
    ctx.stroke()
    drawPumpkin(ctx, X(x), Y(y + BALE.h / 2 + 0.75), 0.22 * s, 0, PUMPKIN_TYPES.balloon)
  }
  const w = BALE.w * s, h = BALE.h * s
  ctx.save()
  ctx.translate(X(x), Y(y))
  ctx.rotate(-angle)
  ctx.fillStyle = '#e2b84a'
  ctx.strokeStyle = '#a87b26'
  ctx.lineWidth = Math.max(1, 0.04 * s)
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = '#c9982f'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const fy of [-0.25, 0, 0.25]) { ctx.moveTo(-w / 2 + 2, fy * h); ctx.lineTo(w / 2 - 2, fy * h) }   // straw
  ctx.stroke()
  ctx.strokeStyle = '#8a5a2b'
  ctx.lineWidth = Math.max(1.5, 0.05 * s)
  ctx.beginPath()
  for (const fx of [-0.25, 0.25]) { ctx.moveTo(fx * w, -h / 2); ctx.lineTo(fx * w, h / 2) }   // twine
  ctx.stroke()
  if (hp < 0.67) {   // damage
    ctx.strokeStyle = '#6b4a1f'
    ctx.lineWidth = Math.max(1, 0.03 * s)
    ctx.beginPath()
    ctx.moveTo(-0.1 * w, -h / 2); ctx.lineTo(0.05 * w, -0.1 * h); ctx.lineTo(-0.05 * w, 0.15 * h)
    if (hp < 0.34) { ctx.moveTo(0.4 * w, h / 2); ctx.lineTo(0.2 * w, 0.1 * h); ctx.lineTo(0.35 * w, -0.2 * h) }
    ctx.stroke()
  }
  if (flags & 1) {   // frozen: icy coat
    ctx.fillStyle = 'rgba(190, 232, 250, 0.6)'
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = Math.max(1.5, 0.04 * s)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
  }
  if (flags & 2) {   // sticky: goo drips
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
  ctx.fillStyle = '#6b4a2b'
  ctx.fillRect(X(x0), Y(sp.y + 0.12), sp.w * s, 0.12 * s)
  ctx.fillStyle = '#a3a9ae'
  ctx.strokeStyle = '#5f656a'
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
    ctx.fillStyle = '#5b3a1e'
    for (const a of [0.35, -0.35]) {
      ctx.save()
      ctx.translate(X(f.x), Y(f.y + 0.1))
      ctx.rotate(a)
      ctx.fillRect(-f.w * 0.5 * s, -0.08 * s, f.w * s, 0.16 * s)
      ctx.restore()
    }
    const g = ctx.createRadialGradient(X(f.x), Y(f.y + 0.4), 0, X(f.x), Y(f.y + 0.4), 1.6 * s)
    g.addColorStop(0, 'rgba(255, 160, 60, 0.35)')
    g.addColorStop(1, 'rgba(255, 160, 60, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(X(f.x), Y(f.y + 0.4), 1.6 * s, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const t = Date.now() / 1000
  const n = 4
  for (const [color, scale] of [['#e2481b', 1], ['#ff8a1f', 0.75], ['#ffd23f', 0.45]]) {
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
  ctx.strokeStyle = '#6b4a2b'
  ctx.lineWidth = 0.12 * s
  ctx.beginPath()
  ctx.moveTo(X(sc.x), Y(sc.y - (sc.pole ?? 2.6)))
  ctx.lineTo(X(sc.x), Y(sc.y + 1.1))
  ctx.stroke()
  ctx.fillStyle = '#b5894d'   // burlap body
  ctx.fillRect(X(sc.x - 0.3), Y(sc.y + 0.6), 0.6 * s, 0.8 * s)
  ctx.beginPath()            // head
  ctx.arc(X(sc.x), Y(sc.y + 0.95), 0.28 * s, 0, Math.PI * 2)
  ctx.fillStyle = '#d9b77a'
  ctx.fill()
  ctx.fillStyle = '#3b3631'  // hat
  ctx.fillRect(X(sc.x - 0.42), Y(sc.y + 1.2), 0.84 * s, 0.07 * s)
  ctx.fillRect(X(sc.x - 0.22), Y(sc.y + 1.45), 0.44 * s, 0.26 * s)
  // spinning arm with the blade at the end
  const dx = Math.cos(angle), dy = Math.sin(angle)
  ctx.strokeStyle = '#7a5530'
  ctx.lineWidth = 0.09 * s
  ctx.beginPath()
  ctx.moveTo(X(sc.x), Y(sc.y))
  ctx.lineTo(X(sc.x + dx * sc.length), Y(sc.y + dy * sc.length))
  ctx.stroke()
  // the blade: exactly the physics shape, rotated into place
  const toWorld = ([lx, ly]) => [sc.x + lx * dx - ly * dy, sc.y + lx * dy + ly * dx]
  ctx.fillStyle = '#c9ced2'
  ctx.strokeStyle = '#5f656a'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const poly of scytheBladeShape(sc)) {
    poly.map(toWorld).forEach(([wx, wy], i) => (i ? ctx.lineTo(X(wx), Y(wy)) : ctx.moveTo(X(wx), Y(wy))))
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#3b3631'
  ctx.beginPath()
  ctx.arc(X(sc.x), Y(sc.y), 0.08 * s, 0, Math.PI * 2)
  ctx.fill()
}
