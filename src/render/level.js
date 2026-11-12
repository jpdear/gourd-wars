// Drawing the level pieces: hay bales, pitchforks, bonfires, gourd cannons. Flat shapes, no
// outlines; the objects get the two-tone shadow side in the map's shade tint (see shading.js; no tint:
// drawn flat, as the map editor's ghosts are).
// Hay bale ({ x, y, angle, health 0..1, frozen, sticky, floating }, as in a snapshot): a golden straw
// box, damaged, frozen or sticky as statusLooks.js draws it; floating: a balloon on top.
// Colors: LEVEL (palette.js).

import { CANNON, cannonParts } from '../game/cannons.js'
import { BALE, TINE, pitchforkTines } from '../game/level.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { clock } from './anims.js'
import { LEVEL, STATUS } from './palette.js'
import { DRAIN, gooLeft } from './endings.js'
import { drawPumpkin, drawSparkBurst } from './pumpkins.js'
import { drawShaded } from './shading.js'
import { fillGoo, LOOKS } from './statusLooks.js'

const TAU = Math.PI * 2

// Draws a piece with its shadow side: paint(c, f) draws its shapes, setting each fill with f(color)
// (which paints them all in one color for its silhouette); box: [x0, y0, x1, y1] px round it; shift: m.
function shaded(ctx, paint, box, shift, s, shade) {
  drawShaded(ctx, {
    draw: c => paint(c, color => { c.fillStyle = color }),
    silhouette: (c, one) => paint(c, () => { c.fillStyle = one }),
    box, shift: shift * s, tint: shade,
  })
}
const around = (cx, cy, r) => [cx - r, cy - r, cx + r, cy + r]

export function drawBale(ctx, { id, x, y, angle, health: hp, frozen, sticky, floating, goo }, X, Y, s, shade) {
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
  const local = (c, fn) => { c.save(); c.translate(X(x), Y(y)); c.rotate(-angle); fn(); c.restore() }   // (in the bale's own frame)
  shaded(ctx, (c, f) => local(c, () => LOOKS.baleBody(c, w, h, hp, s, f)), around(X(x), Y(y), Math.hypot(w, h) / 2 + 4), 0.05, s, shade)
  if (frozen) local(ctx, () => LOOKS.baleFrozen(ctx, w, h, s, clock.now()))
  const drain = sticky ? null : gooLeft('b' + id)   // (just worn off: its goo draining away)
  if (sticky) local(ctx, () => LOOKS.baleGlued(ctx, w, h, s, clock.now(), STATUS.goos[goo || 'pie']))
  else if (drain) local(ctx, () => LOOKS.baleGlued(ctx, w, h, s, clock.now(), STATUS.goos[drain.goo], drain.k))
}

// A Sticky Bomb's sticky floor (zones: the snapshot's goo): a flat strip of slime along each stretch of
// platform top with a darker lower edge, like a glued player's puddle; over its last moment it drains away,
// narrowing in from both ends (and thinning), like the goo on players and bales (see endings.js).
export function drawGoo(ctx, zones, X, Y, s) {
  const G = STATUS.goos.sticky
  for (const z of zones) {
    const k = Math.min(1, z.t / DRAIN), k2 = 1 - (1 - k) * (1 - k), mid = (z.x0 + z.x1) / 2, half = (z.x1 - z.x0) / 2 * k2
    if (half <= 0.01) continue
    const x0 = X(mid - half), w = half * 2 * s
    ctx.save(); ctx.translate(0, Y(z.y) * (1 - (0.4 + 0.6 * k2))); ctx.scale(1, 0.4 + 0.6 * k2)
    fillGoo(ctx, [c => c.roundRect(x0, Y(z.y + 0.06), w, 0.09 * s, 0.045 * s)], G, s)   // (two-tone: see fillGoo)
    ctx.restore()
  }
}

// An Ice Bomb's icy floor (zones: the snapshot's ice): a pale sheet over each stretch of platform top with a
// darker lower edge, white glints, and little icicles hanging under it; when it's gone it shatters (endings.js).
export function drawIce(ctx, zones, X, Y, s) {
  for (const z of zones) {
    const x0 = X(z.x0), w = (z.x1 - z.x0) * s
    ctx.fillStyle = LEVEL.ice.edge; ctx.fillRect(x0, Y(z.y + 0.04), w, 0.16 * s)
    ctx.fillStyle = LEVEL.ice.top; ctx.fillRect(x0, Y(z.y + 0.04), w, 0.1 * s)
    ctx.strokeStyle = LEVEL.ice.glint; ctx.lineWidth = Math.max(1, 0.025 * s)
    ctx.beginPath()
    for (let x = z.x0 + 0.3; x < z.x1 - 0.2; x += 0.9) { ctx.moveTo(X(x), Y(z.y - 0.04)); ctx.lineTo(X(x + 0.18), Y(z.y + 0.03)) }
    ctx.stroke()
    ctx.fillStyle = LEVEL.ice.top
    for (let x = z.x0 + 0.2; x < z.x1 - 0.05; x += 0.55) {
      const len = 0.18 + ((x * 7) % 1) * 0.1
      ctx.beginPath(); ctx.moveTo(X(x - 0.06), Y(z.y - 0.12)); ctx.lineTo(X(x + 0.06), Y(z.y - 0.12)); ctx.lineTo(X(x), Y(z.y - 0.12 - len)); ctx.fill()
    }
  }
}

// A frozen cannon's ice (pivot, aim: its barrel's): a bumpy strip of snow along the side of the barrel facing
// up (whichever way it's mounted or aimed), a plug of ice jammed in the muzzle with a glint, and three icicles
// hanging straight down from the side facing down.
function drawFrozenBarrel(ctx, pivot, aim, X, Y, s) {
  const I = LEVEL.cannon.ice, L = CANNON.barrel
  const up = Math.cos(aim) >= 0 ? 1 : -1   // (aimed leftward, the barrel's own "top" faces down: flip it)
  ctx.save()
  ctx.translate(X(pivot.x), Y(pivot.y))
  ctx.rotate(-aim)
  ctx.scale(1, up)
  ctx.fillStyle = I.snow
  ctx.beginPath()
  ctx.moveTo(-0.3 * s, -0.12 * s)
  for (let i = 0; i <= 8; i++) ctx.lineTo((-0.3 + i * (L + 0.3) / 8) * s, (-0.18 - (i % 2) * 0.03) * s)
  ctx.lineTo(L * s, -0.1 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = I.plug
  ctx.beginPath(); ctx.roundRect((L - 0.04) * s, -0.1 * s, 0.16 * s, 0.2 * s, 0.05 * s); ctx.fill()
  ctx.fillStyle = I.glint
  ctx.fillRect((L + 0.02) * s, -0.07 * s, 0.04 * s, 0.1 * s)
  ctx.restore()
  ctx.fillStyle = I.icicle
  const dx = Math.cos(aim), dy = Math.sin(aim)
  for (const k of [0.15, 0.4, 0.65]) {   // (from the barrel's underside, pointing straight down)
    const px = pivot.x + dx * k + up * dy * 0.11, py = pivot.y + dy * k - up * dx * 0.11, len = 0.12 + k * 0.1
    ctx.beginPath(); ctx.moveTo(X(px - 0.04), Y(py)); ctx.lineTo(X(px + 0.04), Y(py)); ctx.lineTo(X(px), Y(py - len)); ctx.fill()
  }
}

// A row of upturned pitchfork tines on a wooden bar (the tines: the same shapes as the physics ones).
export function drawPitchforks(ctx, sp, X, Y, s, shade) {
  const x0 = sp.x - sp.w / 2
  shaded(ctx, (c, f) => {
    f(LEVEL.pitchfork.bar)
    c.fillRect(X(x0), Y(sp.y + 0.12), sp.w * s, 0.12 * s)
    f(LEVEL.pitchfork.tine)
    for (const x of pitchforkTines(sp)) {
      c.beginPath()
      c.moveTo(X(x - TINE.halfW), Y(sp.y + TINE.base))
      c.lineTo(X(x), Y(sp.y + TINE.tip))
      c.lineTo(X(x + TINE.halfW), Y(sp.y + TINE.base))
      c.closePath()
      c.fill()
    }
  }, [X(x0) - 4, Y(sp.y + TINE.tip) - 4, X(x0 + sp.w) + 4, Y(sp.y) + 4], 0.04, s, shade)
}

// Bonfire: crossed logs and a glow behind the players (flames: false), flickering flames in front of
// them (flames: true).
export function drawBonfire(ctx, f, X, Y, s, flames, shade) {
  if (!flames) {
    shaded(ctx, (c, fill) => {
      fill(LEVEL.bonfire.log)
      for (const a of [0.35, -0.35]) {
        c.save()
        c.translate(X(f.x), Y(f.y + 0.1))
        c.rotate(a)
        c.beginPath(); c.roundRect(-f.w * 0.5 * s, -0.08 * s, f.w * s, 0.16 * s, 0.08 * s); c.fill()
        c.restore()
      }
    }, around(X(f.x), Y(f.y + 0.1), f.w * 0.6 * s + 4), 0.04, s, shade)
    LEVEL.bonfire.glow.forEach((color, i) => {   // the glow: three see-through discs, one inside the next
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(X(f.x), Y(f.y + 0.4), [1.6, 1.1, 0.7][i] * s, 0, TAU)
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

// A gourd cannon (see game/cannons.js): its mount on the surface and an iron barrel along its aim, each
// shaded. timer: seconds until it fires (the fuse throws sparks just before; the barrel kicks back just
// after), or null (not counting down: the editor, a map being left). frozen: iced over (snow along the
// top of the barrel, icicles hanging under it, a plug of ice in the muzzle; no sparks).
export function drawCannon(ctx, c, timer, X, Y, s, shade, frozen = false) {
  const { base, angle, pivot, aim } = cannonParts(c), B = CANNON.base, C = LEVEL.cannon
  // the mount: a wooden block on the surface, an iron strap across it
  shaded(ctx, (g, f) => {
    g.save()
    g.translate(X(base.x), Y(base.y))
    g.rotate(-angle)
    f(C.mount)
    g.beginPath()
    g.moveTo(-B.w / 2 * s, B.h / 2 * s)
    g.lineTo(B.w / 2 * s, B.h / 2 * s)
    g.lineTo(B.w * 0.32 * s, -B.h / 2 * s)
    g.lineTo(-B.w * 0.32 * s, -B.h / 2 * s)
    g.closePath()
    g.fill()
    f(C.strap)
    g.fillRect(-B.w * 0.42 * s, 0.02 * s, B.w * 0.84 * s, 0.07 * s)
    g.restore()
  }, around(X(base.x), Y(base.y), Math.max(B.w, B.h) * s), 0.04, s, shade)
  // the barrel, from its pivot (kicked back a little right after a shot)
  const every = Math.max(0.5, c.every ?? 3), since = timer === null ? 9 : every - timer
  const kick = !frozen && since >= 0 && since < 0.2 ? 0.14 * (1 - since / 0.2) : 0
  const L = CANNON.barrel
  shaded(ctx, (g, f) => {
    g.save()
    g.translate(X(pivot.x), Y(pivot.y))
    g.rotate(-aim)
    g.translate(-kick * s, 0)
    f(C.barrel)
    g.beginPath()
    g.moveTo(-0.22 * s, -0.15 * s)
    g.lineTo(L * s, -0.11 * s)
    g.lineTo(L * s, 0.11 * s)
    g.lineTo(-0.22 * s, 0.15 * s)
    g.arc(-0.22 * s, 0, 0.15 * s, Math.PI / 2, -Math.PI / 2)
    g.fill()
    f(C.band)   // bands
    g.fillRect(0.1 * s, -0.14 * s, 0.07 * s, 0.28 * s)
    f(C.muzzle)   // a pumpkin-orange ring round the muzzle
    g.fillRect((L - 0.08) * s, -0.13 * s, 0.08 * s, 0.26 * s)
    g.restore()
  }, around(X(pivot.x), Y(pivot.y), (L + 0.6) * s), 0.04, s, shade)
  // the pivot pin
  ctx.fillStyle = C.pin
  ctx.beginPath()
  ctx.arc(X(pivot.x), Y(pivot.y), 0.06 * s, 0, TAU)
  ctx.fill()
  if (frozen) drawFrozenBarrel(ctx, pivot, aim, X, Y, s)
  // the fuse throwing sparks at the back, just before it fires (like a Jack-o'-Boom's)
  else if (timer !== null && timer < 0.6) {
    const back = { x: pivot.x - Math.cos(aim) * 0.36, y: pivot.y - Math.sin(aim) * 0.36 }
    drawSparkBurst(ctx, X(back.x), Y(back.y), 0.2 * s, Date.now() / 1000)
  }
}
