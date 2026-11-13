// Drawing pumpkins and their patches, in the flat look: solid shapes (a pumpkin's side lobes are a
// darker shape behind its middle, not lines), two-tone shaded in the map's shade tint (see shading.js),
// with marks (a fuse, bands, a crosshair, ...) drawn on top, unshaded.
// Green when unripe, the type's own color when ripe, brown as it rots.
// Everything about how a particular type looks is here, in tables by its mark or name: its shape
// (BODIES), decoration (MARKS), extras while it flies (IN_FLIGHT) and how it's held (HELD).
// drawPumpkinSilhouette draws just the shape in one color (for outlines).
// What moves on its own (a blinking aerial, the glow under a patch, ...) is drawn through anims.js.
// Colors: each type's own (game/pumpkinTypes.js: `rib` is its darker color, for lobes and details) and
// GOURD (palette.js).

import { CONFIG } from '../config.js'
import { patchPumpkin, patchRipeness } from '../game/patches.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { patchView, snapPlayer } from '../game/snapshot.js'
import { ANIM, clock } from './anims.js'
import { GOURD, STATUS } from './palette.js'
import { gourdColors, motionTime, recolor } from './gfx.js'
import { fillGoo, strokeGoo } from './statusLooks.js'
import { handOf } from './players.js'
import { drawShaded } from './shading.js'
import { hexA, mixHex } from '../util/color.js'
import { clamp, lerp } from '../util/math.js'

const GREEN = GOURD.unripe, BROWN = GOURD.rotten
const TAU = Math.PI * 2

export function pumpkinColors(type, ripeness, rot) {
  const t = clamp(ripeness, 0, 1), r = clamp(rot, 0, 1), GREEN = gourdColors(GOURD.unripe)   // (as Colorblind Mode draws them)
  type = gourdColors(type)
  return {
    color: mixHex(mixHex(GREEN.color, type.color, t), BROWN.color, r),
    rib: mixHex(mixHex(GREEN.rib, type.rib, t), BROWN.rib, r),
  }
}

// (Picking them: see render/pickups.js.) shade: the map's shade tint.
export function drawPatches(ctx, snap, X, Y, s, shade) {
  snap.patches.forEach((_, i) => {
    const patch = patchView(snap, i)
    // leaves on the ground
    ctx.fillStyle = GOURD.patchLeaf
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(X(patch.x + side * 0.28), Y(patch.y + 0.06), 0.2 * s, 0.07 * s, side * 0.4, 0, TAU)
      ctx.fill()
    }
    if (patch.state === 'empty') return

    const pk = patchPumpkin(patch)
    const type = PUMPKIN_TYPES[patch.typeName]
    // specials glow so both players see them coming (Super Rare ones in gold): see anims.js
    if (patch.superRare) ANIM.superRareGlow(ctx, X(pk.x), Y(pk.y), pk.r * s, s, recolor(type.color), motionTime(clock.now()))
    else if (patch.typeName !== 'classic') ANIM.patchGlow(ctx, X(pk.x), Y(pk.y), pk.r * s, s, recolor(type.color), motionTime(clock.now()))
    drawPumpkin(ctx, X(pk.x), Y(pk.y), pk.r * s, 0, pumpkinColors(type, patchRipeness(patch), patch.rot), type.mark, shade)
    if (patch.frozen) {   // an Ice Bomb froze it: in a block of ice, with a white strip along its top
      const half = Math.max(0.3, pk.r * 1.45), top = pk.y + pk.r + 0.12
      ctx.fillStyle = GOURD.iceCube.body; ctx.beginPath(); ctx.roundRect(X(pk.x - half), Y(top), half * 2 * s, (top - patch.y) * s, 0.06 * s); ctx.fill()
      ctx.fillStyle = GOURD.iceCube.top; ctx.fillRect(X(pk.x - half) + 0.05 * s, Y(top) + 0.05 * s, (half * 2 - 0.1) * s, 0.05 * s)
    }
  })
}

// --- shapes (in the pumpkin's own frame: radius r, canvas y pointing down, so negative y is the top) ---
// A body is body(c, r, colors, f, one): it sets each fill with f(color) (which paints everything in
// one color instead when drawing its silhouette, `one`) and draws only filled shapes (a stroke uses
// one || its color). Marks are drawn on top, after the shading.

const lobeColor = colors => mixHex(colors.color, colors.rib, 0.45)   // (a pumpkin's darker side lobes)

// A path of an n-pointed star around (x, y): points r out, the dips inner × r, turned by `turn`.
function starPath(c, x, y, r, turn, n, inner) {
  c.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const a = turn - Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r * inner : r
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  c.closePath()
}

// The usual pumpkin: two darker side lobes behind a lighter middle, about 1.08 × 1 r, and a stem with a
// leaf on top. w, h: stretch it; wide: four lobes (a Big Gourd); stem: false for none.
function lobed(c, r, colors, f, { w = 1, h = 1, wide = false, stem = true } = {}) {
  if (stem) {
    f(GOURD.stem); c.beginPath(); c.roundRect(-r * 0.1, -r * 1.32 * h, r * 0.2, r * 0.5, r * 0.08); c.fill()
    f(GOURD.leaf); c.beginPath(); c.ellipse(r * 0.3, -r * 1.1 * h, r * 0.24, r * 0.1, -0.5, 0, TAU); c.fill()
  }
  f(lobeColor(colors))
  if (wide) {
    for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * r * 0.62 * w, 0, r * 0.5 * w, r * 0.92 * h, 0, 0, TAU); c.fill() }
    f(mixHex(colors.color, colors.rib, 0.22))
    for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * r * 0.32 * w, 0, r * 0.55 * w, r * 0.97 * h, 0, 0, TAU); c.fill() }
    f(colors.color); c.beginPath(); c.ellipse(0, 0, r * 0.42 * w, r * h, 0, 0, TAU); c.fill()
    return
  }
  for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * r * 0.42 * w, 0, r * 0.66 * w, r * 0.95 * h, 0, 0, TAU); c.fill() }
  f(colors.color); c.beginPath(); c.ellipse(0, 0, r * 0.58 * w, r * h, 0, 0, TAU); c.fill()
}

// Bodies by the type's mark (round if it isn't here).
const BODIES = {
  round: (c, r, colors, f) => lobed(c, r, colors, f),
  gourd: (c, r, colors, f) => lobed(c, r, colors, f, { w: 1.12, h: 0.95, wide: true }),   // squat and wide
  cluster: (c, r, colors, f) => {   // three little gourds stuck together
    for (const [ox, oy] of [[-0.45, 0.2], [0.45, 0.2], [0, -0.38]]) { c.save(); c.translate(ox * r, oy * r); lobed(c, r * 0.58, colors, f); c.restore() }
  },
  pie: (c, r, colors, f) => {   // a flat pie: a crust with a fluted edge, the filling, three slits
    f(colors.rib)
    c.beginPath(); c.ellipse(0, 0, r * 1.08, r * 0.64, 0, 0, TAU); c.fill()
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; c.beginPath(); c.arc(Math.cos(a) * r * 1.08, Math.sin(a) * r * 0.64, r * 0.13, 0, TAU); c.fill() }
    f(colors.color); c.beginPath(); c.ellipse(0, -r * 0.03, r * 0.86, r * 0.46, 0, 0, TAU); c.fill()
    f(mixHex(colors.rib, '#000000', 0.1))
    for (const ox of [-0.4, 0, 0.4]) { c.beginPath(); c.roundRect(ox * r - r * 0.05, -r * 0.22, r * 0.1, r * 0.32, r * 0.05); c.fill() }
  },
  antenna: (c, r, colors, f) => {   // a Homing gourd: a little rocket (two tail fins, a nozzle) with an antenna for a stem
    f(colors.rib)
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * r * 0.6, r * 0.3); c.lineTo(side * r * 1.12, r * 1.02); c.lineTo(side * r * 0.4, r * 0.82); c.closePath(); c.fill() }
    f(GOURD.dark); c.beginPath(); c.roundRect(-r * 0.24, r * 0.82, r * 0.48, r * 0.24, r * 0.06); c.fill()
    lobed(c, r, colors, f, { stem: false })
  },
  boomerang: (c, r, colors, f, one) => drawBoomerangGourd(c, r, colors, f, one),
  saw: (c, r, colors, f) => drawSawSquash(c, r, colors, f),
  bottle: (c, r, colors, f) => drawBottleGourd(c, r, colors, f),
  mine: (c, r, colors, f) => mineGourd(c, r, colors, f),
  chomper: (c, r, colors, f) => shutChomper(c, r, colors, f),   // (thrown or held: shut, lying on its side)
  icefuse: (c, r, colors, f) => lobed(c, r, colors, f, { stem: false }),   // an Ice Bomb (its fuse and snow cap: MARKS)
  slime: (c, r, colors, f) => slimeGlob(c, r, colors, f),       // a Sticky Bomb (its fuse: MARKS)
  slimeStuck: (c, r, colors, f) => slimeGlob(c, r, colors, f),  // (stuck: drawSticky draws its fuse burning down)
  rubberball: (c, r, colors, f) => {   // a Bouncing Bomb: a round ball squash (no lobes sticking out, no stem)
    f(lobeColor(colors)); c.beginPath(); c.ellipse(0, 0, r * 1.02, r, 0, 0, TAU); c.fill()
    f(colors.color); c.beginPath(); c.ellipse(0, 0, r * 0.6, r * 0.99, 0, 0, TAU); c.fill()
  },
}

// Ones that draw themselves, flat and unshaded: a seed (tiny, and fired by the dozen).
const OWN_LOOK = {
  seed: (c, r, colors) => {   // dark, on a slightly bigger cream oval so it shows up on any map
    c.fillStyle = colors.rib; c.beginPath(); c.ellipse(0, 0, r * 1.52, r * 1.07, 0, 0, TAU); c.fill()
    c.fillStyle = colors.color; c.beginPath(); c.ellipse(0, 0, r * 1.35, r * 0.9, 0, 0, TAU); c.fill()
  },
}

// A spark burst at (x, y) (sized for a gourd r across; t: s): two spinning, flickering stars, spark lines
// flickering on and off, and dots flying out. A Jack-o'-Boom's fuse throws it, and so does a cannon's.
export function drawSparkBurst(c, x, y, r, t) {
  const flick = 1 + 0.15 * Math.sin(t * TAU * 12), odd = Math.floor(t * 12) % 2, [outer, inner, lines, dots] = GOURD.spark
  c.fillStyle = outer; starPath(c, x, y, r * 0.42 * flick, 0.2 + t * 6, 7, 0.38); c.fill()
  c.fillStyle = inner; starPath(c, x, y, r * 0.24 * flick, -0.1 - t * 6, 7, 0.42); c.fill()
  c.strokeStyle = lines; c.lineWidth = Math.max(1, r * 0.06); c.lineCap = 'round'
  c.beginPath()
  SPARK_LINES.forEach(([a, d0, d1], i) => {
    if (i % 2 !== odd) return   // (they flicker: every other one on each beat)
    c.moveTo(x + Math.cos(a) * d0 * r, y + Math.sin(a) * d0 * r); c.lineTo(x + Math.cos(a) * d1 * r, y + Math.sin(a) * d1 * r)
  })
  c.stroke(); c.lineCap = 'butt'
  c.fillStyle = dots
  for (const [a, rr, phase] of FUSE_DOTS) {   // each flies out from the spark, drops a little and shrinks away, then starts again
    const p = (t / FUSE_DOT_TIME + phase) % 1, d = (0.3 + 0.75 * p) * r, size = rr * r * (1 - p) ** 0.6
    if (size < 0.4) continue
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d + 0.35 * p * p * r, size, 0, TAU); c.fill()
  }
}
// The Fire Gourd's carved face (of r, canvas y down): slanted glaring eyes and a jagged zig-zag mouth.
const JACK_MOUTH = [-0.55, -0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.55]
const JACK_FACE = [
  (c, r) => { c.moveTo(-0.55 * r, -0.38 * r); c.lineTo(-0.12 * r, -0.18 * r); c.lineTo(-0.42 * r, -0.08 * r); c.closePath() },
  (c, r) => { c.moveTo(0.55 * r, -0.38 * r); c.lineTo(0.12 * r, -0.18 * r); c.lineTo(0.42 * r, -0.08 * r); c.closePath() },
  (c, r) => {
    c.moveTo(-0.55 * r, 0.2 * r); JACK_MOUTH.forEach((x, i) => c.lineTo(x * r, (i % 2 ? 0.32 : 0.2) * r)); c.lineTo(0.48 * r, 0.55 * r)
    ;[...JACK_MOUTH].reverse().forEach((x, i) => c.lineTo(x * 0.9 * r, (i % 2 ? 0.48 : 0.6) * r)); c.closePath()
  },
]
const SNOW_DRIPS = [[0.85, -0.12], [0.5, -0.38], [0.2, 0.02], [-0.15, -0.36], [-0.5, -0.05], [-0.85, -0.34], [-1.3, -0.3]]   // [x, y] (of r): the bottom edge of an Ice Bomb's snow cap, right to left
const SPARK_LINES = [[-1.2, 0.5, 0.75], [-0.3, 0.5, 0.82], [0.6, 0.5, 0.7], [-2.1, 0.5, 0.68], [2.6, 0.48, 0.62], [-0.75, 0.5, 0.7], [0.15, 0.48, 0.66], [-1.65, 0.5, 0.78]]   // [angle, from, to (of r)]
// The fuse's flying dots: [direction (radians, from the spark), radius (of r), where in its flight it starts (0..1)].
const FUSE_DOTS = [[0.55, 0.06, 0], [-1.75, 0.05, 0.25], [-0.25, 0.045, 0.5], [-2.6, 0.05, 0.75]]
const FUSE_DOT_TIME = 0.55   // s: one dot's flight

// Decorations drawn over a pumpkin's body, after its shading, by the type's mark.
const MARKS = {
  bands: (c, r, colors) => {   // two bands round it
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 1.08, r, 0, 0, TAU); c.clip()
    c.fillStyle = colors.rib
    for (const oy of [-0.42, 0.42]) c.fillRect(-r * 1.2, (oy - 0.08) * r, r * 2.4, r * 0.16)
    c.restore()
  },
  fuse: (c, r) => {   // a curved fuse throwing sparks: two spinning, flickering stars, spark lines and flying dots
    const t = Date.now() / 1000
    c.strokeStyle = GOURD.dark; c.lineWidth = Math.max(1, r * 0.1); c.lineCap = 'round'
    c.beginPath(); c.moveTo(r * 0.1, -r * 1.1); c.quadraticCurveTo(r * 0.45, -r * 1.55, r * 0.66, -r * 1.36); c.stroke()
    drawSparkBurst(c, r * 0.7, -r * 1.42, r, t)
    c.lineCap = 'butt'
  },
  ice: (c, r) => {   // frost diamonds
    c.fillStyle = GOURD.ice
    for (const [ox, oy] of [[-0.5, -0.3], [0.35, 0.1], [-0.1, 0.5]]) {
      c.beginPath(); c.moveTo(ox * r, (oy - 0.2) * r); c.lineTo((ox + 0.11) * r, oy * r); c.lineTo(ox * r, (oy + 0.2) * r); c.lineTo((ox - 0.11) * r, oy * r); c.fill()
    }
  },
  vine: (c, r) => {   // a curling tendril and a leaf
    c.strokeStyle = GOURD.vine; c.lineWidth = Math.max(1, r * 0.1); c.lineCap = 'round'
    c.beginPath(); c.moveTo(0, -r * 1.2); c.bezierCurveTo(r * 0.8, -r * 1.8, r * 1.2, -r * 0.8, r * 0.7, -r * 0.9); c.stroke(); c.lineCap = 'butt'
    c.fillStyle = GOURD.leaf; c.beginPath(); c.ellipse(-r * 0.32, -r * 1.12, r * 0.24, r * 0.1, 0.5, 0, TAU); c.fill()
  },
  speckle: (c, r, colors) => {
    c.fillStyle = mixHex(colors.rib, '#000000', 0.45)
    for (const [ox, oy] of [[-0.5, -0.2], [0.3, -0.45], [0.55, 0.25], [-0.2, 0.45], [0.05, 0]]) { c.beginPath(); c.arc(ox * r, oy * r, Math.max(1, r * 0.09), 0, TAU); c.fill() }
  },
  stars: (c, r) => {   // little four-point sparkles
    c.fillStyle = GOURD.stars
    for (const [ox, oy, k] of [[-0.45, -0.35, 0.3], [0.4, -0.15, 0.22], [0.05, 0.45, 0.26], [-0.5, 0.3, 0.16], [0.55, 0.5, 0.14]]) {
      const x = ox * r, y = oy * r, a = Math.max(1.5, k * r), b = a * 0.25
      c.beginPath()
      c.moveTo(x, y - a); c.lineTo(x + b, y - b); c.lineTo(x + a, y); c.lineTo(x + b, y + b)
      c.lineTo(x, y + a); c.lineTo(x - b, y + b); c.lineTo(x - a, y); c.lineTo(x - b, y - b)
      c.fill()
    }
  },
  crosshair: (c, r) => {   // a red target
    c.strokeStyle = GOURD.crosshair; c.lineWidth = Math.max(1, r * 0.12)
    c.beginPath(); c.arc(0, 0, r * 0.45, 0, TAU); c.moveTo(-r * 0.75, 0); c.lineTo(r * 0.75, 0); c.moveTo(0, -r * 0.75); c.lineTo(0, r * 0.75); c.stroke()
  },
  antenna: (c, r) => {   // a thin aerial with a blinking tip, where the stem would be
    c.strokeStyle = GOURD.dark; c.lineWidth = Math.max(1, r * 0.08)
    c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(r * 0.15, -r * 1.75); c.stroke()
    ANIM.antennaTip(c, r * 0.15, -r * 1.8, r, clock.now())
  },
  icefuse: (c, r) => {   // a cap of snow dripping down over its top, and a fuse throwing a spinning snowflake spark
    c.save()
    c.beginPath(); for (const side of [-1, 1]) c.ellipse(side * r * 0.42, 0, r * 0.66, r * 0.95, 0, 0, TAU); c.clip()
    c.fillStyle = GOURD.snowCap; c.beginPath()
    c.moveTo(-r * 1.3, -r * 1.3); c.lineTo(r * 1.3, -r * 1.3); c.lineTo(r * 1.3, -r * 0.35)
    let px = 1.3
    for (const [x, y] of SNOW_DRIPS) { c.quadraticCurveTo((px + x) / 2 * r, (y + 0.12) * r, x * r, y * r); px = x }
    c.closePath(); c.fill()
    c.restore()
    c.strokeStyle = GOURD.dark; c.lineWidth = Math.max(1, r * 0.1); c.lineCap = 'round'
    c.beginPath(); c.moveTo(r * 0.1, -r * 1.0); c.quadraticCurveTo(r * 0.45, -r * 1.5, r * 0.66, -r * 1.32); c.stroke(); c.lineCap = 'butt'
    const t = clock.now(), R = r * 0.34 * (1 + 0.12 * Math.sin(t * TAU * 6)), x = r * 0.7, y = -r * 1.4
    c.fillStyle = GOURD.snowSpark.star; starPath(c, x, y, R, t * 3, 6, 0.45); c.fill()
    c.strokeStyle = GOURD.snowSpark.flake; c.lineWidth = Math.max(1, r * 0.07); c.lineCap = 'round'
    c.beginPath()
    for (let i = 0; i < 6; i++) {   // six arms, each with a pair of twigs
      const a = -t * 3 + i * TAU / 6, bx = x + Math.cos(a) * R * 0.55, by = y + Math.sin(a) * R * 0.55
      c.moveTo(x, y); c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R)
      for (const k of [-0.7, 0.7]) { c.moveTo(bx, by); c.lineTo(bx + Math.cos(a + k) * R * 0.32, by + Math.sin(a + k) * R * 0.32) }
    }
    c.stroke(); c.lineCap = 'butt'
  },
  slime: (c, r) => stickyFuse(c, r, 1, false),   // its fuse, not lit yet
  jack: (c, r) => {   // a Fire Gourd: an angry jack-o'-lantern face, its holes glowing from the fire flickering inside
    const t = clock.now(), glow = mixHex(GOURD.jack.dim, GOURD.jack.bright, 0.55 + 0.45 * Math.sin(t * 11) * Math.sin(t * 4.3))
    for (const [dy, color] of [[0, GOURD.jack.cut], [r * 0.05, glow]]) {   // (the cut's dark top edge, then the glow just below it)
      c.save(); c.translate(0, dy); c.fillStyle = color
      for (const hole of JACK_FACE) { c.beginPath(); hole(c, r); c.fill() }
      c.restore()
    }
  },
  swirl: (c, r) => {   // a pale spiral on its face, slowly turning (a Teleport gourd)
    c.save(); c.rotate(motionTime(clock.now()) * 2)   // (still with Reduced Motion on)
    c.strokeStyle = GOURD.swirl; c.lineWidth = Math.max(1, r * 0.11); c.lineCap = 'round'
    c.beginPath()
    for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 1.7, d = r * (0.06 + i / 40 * 0.5); c.lineTo(Math.cos(a) * d, Math.sin(a) * d) }
    c.stroke(); c.lineCap = 'butt'; c.restore()
  },
  rubberball: (c, r) => {   // a wide rubber band round its middle and a stubby fuse for a stem (it sparks once it's ticking: see fusedLook)
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 1.02, r, 0, 0, TAU); c.clip()
    c.fillStyle = GOURD.rubberBand; c.fillRect(-r * 1.2, -r * 0.19, r * 2.4, r * 0.38)
    c.restore()
    c.strokeStyle = GOURD.dark; c.lineWidth = Math.max(1, r * 0.12); c.lineCap = 'round'
    c.beginPath(); c.moveTo(0, -r * 0.92); c.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.26, -r * 1.3); c.stroke(); c.lineCap = 'butt'
  },
  string: (c, r, colors) => {   // a balloon's string, and the knot at its bottom
    c.strokeStyle = GOURD.string; c.lineWidth = Math.max(1, r * 0.05)
    c.beginPath(); c.moveTo(0, r); c.quadraticCurveTo(r * 0.3, r * 1.6, 0, r * 2.2); c.stroke()
    c.fillStyle = lobeColor(colors); c.beginPath(); c.moveTo(-r * 0.1, r * 1.12); c.lineTo(r * 0.1, r * 1.12); c.lineTo(0, r * 0.95); c.fill()
  },
}

// colors: { color, rib } (a pumpkin type, or pumpkinColors(...)); mark: the type's shape (BODIES; round
// if it isn't there) and decoration (MARKS); shade: the map's shade tint (two-tone shaded with it), or
// nothing for flat. (x, y, r in pixels; canvas y points down here, so negative y is the top of the pumpkin)
export function drawPumpkin(ctx, x, y, r, angle, colors, mark, shade) {
  colors = gourdColors(colors)   // (Colorblind Mode's, if it recolors this one)
  const inFrame = fn => c => { c.save(); c.translate(x, y); c.rotate(-angle); fn(c); c.restore() }
  if (OWN_LOOK[mark]) return inFrame(c => OWN_LOOK[mark](c, r, colors))(ctx)
  const body = BODIES[mark] || BODIES.round, decorate = MARKS[mark]
  const paint = one => inFrame(c => body(c, r, colors, color => { c.fillStyle = one || color }, one))
  drawShaded(ctx, {
    draw: paint(null),
    silhouette: (c, one) => paint(one)(c),
    details: decorate && inFrame(c => decorate(c, r, colors)),
    box: [x - r * 2.2, y - r * 2.4, x + r * 2.2, y + r * 2.4],
    shift: 0.2 * r,
    tint: shade,
  })
}

// Just a pumpkin's shape, all in one color (no shading, no marks; not seeds, which draw their
// own look): e.g. stamped in a ring round it for an outline (the title logo's pumpkin).
export function drawPumpkinSilhouette(ctx, x, y, r, angle, colors, mark, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-angle)
  ;(BODIES[mark] || BODIES.round)(ctx, r, colors, () => { ctx.fillStyle = color }, color)
  ctx.restore()
}

// Extras drawn under some types while they fly, by type name. pk: a pumpkin from the snapshot
// { x, y, angle, typeName, ripeness, owner (slot), radius, heading }; colors: its colors right now.
const IN_FLIGHT = {
  vine: (ctx, pk, colors, snap, X, Y, s) => {   // it trails back to the thrower's hand
    const owner = snapPlayer(snap, pk.owner)
    if (!owner) return
    const [hx, hy] = handOf(owner)
    ctx.strokeStyle = GOURD.vine
    ctx.lineWidth = 0.05 * s
    ctx.beginPath()
    ctx.moveTo(X(hx), Y(hy))
    ctx.quadraticCurveTo(X((hx + pk.x) / 2), Y((hy + pk.y) / 2 - 0.4), X(pk.x), Y(pk.y))
    ctx.stroke()
  },
  homing: (ctx, pk, colors, snap, X, Y, s) => {   // on the hunt (it has a heading): flames out the back
    if (pk.heading !== null && pk.heading !== undefined) ANIM.flameTrail(ctx, X(pk.x), Y(pk.y), pk.radius * s, pk.heading, clock.now())
  },
  teleport: (ctx, pk, colors, snap, X, Y, s) => afterimages(ctx, pk, colors, X, Y, s),
  boomerang: (ctx, pk, colors, snap, X, Y, s) => spinBlur(ctx, X(pk.x), Y(pk.y), pk.radius * s, pk.angle, colors, 'boomerang'),
  buzzsaw: (ctx, pk, colors, snap, X, Y, s) => spinBlur(ctx, X(pk.x), Y(pk.y), pk.radius * s, pk.angle, colors, 'saw'),
}

// A fused gourd ticking (a Bouncing Bomb: `left` s to go): it blinks, faster and faster (2 → 12 a
// second over its whole fuse, then stays lit for the last moment), and each blink it flashes bright
// yellow and puffs up 20% bigger, shrinking back. Its fuse sparks the whole time.
const FLASH = { from: 2, to: 12, on: 0.45, swell: 0.2, solid: 0.15 }   // blinks/s at the start, at the end; share of each blink lit; how much bigger; s lit at the end
const FUSE_TIP = [0.3, -1.34]   // where its spark is (of r, in its frame)
function fusedLook(type, colors, r, left) {
  const T = type.fuse, e = clamp(T - left, 0, T)
  const cyc = left < FLASH.solid ? 0 : (FLASH.from * e + (FLASH.to - FLASH.from) * e ** 3 / (3 * T * T)) % 1
  if (cyc >= FLASH.on) return { colors, r }
  return { colors: GOURD.fuseFlash, r: r * (1 + FLASH.swell * (1 - cyc / FLASH.on)) }
}
// Draw a pumpkin that may be ticking (left: s left on its fuse, or null/undefined if it isn't).
function drawMaybeTicking(ctx, x, y, r, angle, colors, type, left, shade) {
  if (left === undefined || left === null) return drawPumpkin(ctx, x, y, r, angle, colors, type.mark, shade)
  const look = fusedLook(type, colors, r, left)
  drawPumpkin(ctx, x, y, look.r, angle, look.colors, type.mark, shade)
  ctx.save(); ctx.translate(x, y); ctx.rotate(-angle)
  drawSparkBurst(ctx, FUSE_TIP[0] * look.r, FUSE_TIP[1] * look.r, look.r * 0.8, clock.now())
  ctx.restore()
}

// A Sticky Bomb: a gourd inside a glob of slime, whose big soft lumps creep slowly round its outline (and it
// sags a little heavier at the bottom). Two layers: the darker outer goo, the lighter inner glob.
function slimeGlob(c, r, colors, f) {
  const turn = clock.now() * 0.7
  f(colors.rib); blobPath(c, r * 1.04, 3, 0.1, 1, 1.03, turn); c.fill()
  f(colors.color); c.save(); c.translate(-r * 0.06, -r * 0.04); blobPath(c, r * 0.86, 3, 0.09, 1, 1.03, turn + 0.4); c.fill(); c.restore()
}
// A lumpy blob outline round (0, 0): radius r, n lumps `bump` high (of r), stretched sx × sy, the lumps turned `turn`.
function blobPath(c, r, n, bump, sx, sy, turn) {
  c.beginPath()
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * TAU, k = 1 + bump * Math.sin((a - turn) * n + 0.7) + bump * 0.6 * Math.sin(a * (n + 2))
    c.lineTo(Math.cos(a) * r * k * sx, Math.sin(a) * r * k * sy)
  }
  c.closePath()
}
// Its fuse, out of the top of the glob: `left` (0..1) of it still there; lit, a spark burst on its end.
function stickyFuse(c, r, left, lit) {
  const L = 0.15 + 0.5 * left, x = r * 0.12, y = -r * (0.85 + L)
  c.strokeStyle = GOURD.dark; c.lineWidth = Math.max(1, r * 0.1); c.lineCap = 'round'
  c.beginPath(); c.moveTo(0, -r * 0.85); c.lineTo(x, y); c.stroke(); c.lineCap = 'butt'
  if (lit) drawSparkBurst(c, x, y, r * 0.85, clock.now())
}
// A stuck Sticky Bomb (st: from the snapshot; see game/stickies.js). On a surface: a splat of goo on it and three
// stretchy strands holding the gourd on, wobbling (stopping where the surface ends, with goo draping over the
// edge there: st.span); on someone: squashed flat against them, nothing else. Its fuse burns down to the burst.
export function drawSticky(ctx, st, X, Y, s, shade) {
  const type = PUMPKIN_TYPES.sticky, r = type.radius * s, colors = pumpkinColors(type, 1, 0)
  ctx.save()
  ctx.translate(X(st.x), Y(st.y))
  ctx.rotate(Math.PI / 2 - st.angle)   // (now +y points at what it's on)
  if (st.onPlayer) { ctx.translate(0, r * STICKY.squash.shift); ctx.scale(STICKY.squash.wide, STICKY.squash.flat) }
  else stickyGoo(ctx, r, STATUS.goos.sticky, motionTime(clock.now()), (st.span || [-9, 9]).map(v => v * s))
  drawPumpkin(ctx, 0, 0, r, 0, colors, 'slimeStuck', shade)
  stickyFuse(ctx, r, Math.min(1, st.fuse / type.stuckFuse), true)
  ctx.restore()
}
const STICKY = { squash: { flat: 0.72, wide: 1.17, shift: 0.28 }, gap: 1.32 }   // squashed on someone: this flat, this wide, moved in this far (of r); gap: see stickies.js
// (In the gourd's frame, +y toward the surface, +x along it.) span: [from, to] px either side the surface runs.
// (It's two-tone like all of the Sticky Bomb's goo: see fillGoo. Here "down" is toward the surface, so the
// lip runs along the splat's side away from it.)
function stickyGoo(c, r, goo, t, [from, to]) {
  const surf = r * STICKY.gap, wob = Math.sin(t * 6), splat = r * 0.95 * 1.25 * 1.12   // (half the splat's width, at its widest)
  c.save()
  c.beginPath(); c.rect(from, surf - r, to - from, r * 2); c.clip()   // (the splat stops where the surface does)
  fillGoo(c, [cc => blobShape(cc, 0, surf, r * 0.95, 7, 0.12, 1.25, 0.28)], goo, r / PUMPKIN_TYPES.sticky.radius)
  c.restore()
  const drapes = []
  for (const [edge, side] of [[from, -1], [to, 1]]) {   // cut short by an edge: goo draping over it, down the side
    if (Math.abs(edge) >= splat) continue
    const w = r * 0.22, hang = r * (0.35 + 0.12 * Math.sin(t * 2.5 + side))
    drapes.push(cc => {
      cc.moveTo(edge - side * w * 1.4, surf - r * 0.08); cc.lineTo(edge + side * w * 0.5, surf - r * 0.08)
      cc.quadraticCurveTo(edge + side * w * 0.6, surf + hang * 0.6, edge + side * w * 0.15, surf + hang)
      cc.arc(edge + side * w * 0.15 - side * w * 0.3, surf + hang, w * 0.3, 0, Math.PI, side > 0)
      cc.closePath()
    })
  }
  if (drapes.length) fillGoo(c, drapes, goo, r / PUMPKIN_TYPES.sticky.radius)
  strokeGoo(c, [[-0.55, -0.85, 0.16], [0.05, 0.1, 0.2], [0.55, 0.8, 0.14]].map(([x0, x1, w]) => {
    const foot = Math.max(from + r * 0.08, Math.min(to - r * 0.08, x1 * r))   // (its foot on the surface, not past its edge)
    return { w: Math.max(1, r * w), path: cc => { cc.beginPath(); cc.moveTo(x0 * r, r * 0.7); cc.quadraticCurveTo((x0 * r + foot) * 0.5 + wob * r * 0.08, r * 1.05, foot, surf) } }
  }), goo, r / PUMPKIN_TYPES.sticky.radius)
}
// blobPath's outline as a subpath (for fillGoo), around (x, y).
function blobShape(c, x, y, r, n, bump, sx, sy) {
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * TAU, k = 1 + bump * Math.sin(a * n + 0.7) + bump * 0.6 * Math.sin(a * (n + 2))
    const px = x + Math.cos(a) * r * k * sx, py = y + Math.sin(a) * r * k * sy
    if (i) c.lineTo(px, py); else c.moveTo(px, py)
  }
  c.closePath()
}

// A Teleport gourd's afterimages: two flat, see-through copies of it trailing behind the way it's going
// (which way that is: from where it was drawn last, per gourd; just for looks).
const lastSeen = new Map()   // pumpkin id → { x, y, dx, dy }
function afterimages(ctx, pk, colors, X, Y, s) {
  const prev = lastSeen.get(pk.id), mx = prev ? pk.x - prev.x : 0, my = prev ? pk.y - prev.y : 0, d = Math.hypot(mx, my)
  const dir = d > 0.002 ? { dx: mx / d, dy: my / d } : prev || { dx: 0, dy: 0 }
  if (lastSeen.size > 64) lastSeen.clear()   // (forget gourds long gone)
  lastSeen.set(pk.id, { x: pk.x, y: pk.y, ...dir })
  if (!dir.dx && !dir.dy) return
  for (const [back, alpha, k] of AFTERIMAGES) {
    ctx.globalAlpha = alpha
    drawPumpkin(ctx, X(pk.x - dir.dx * back * pk.radius), Y(pk.y - dir.dy * back * pk.radius), pk.radius * k * s, pk.angle, colors, null, null)
  }
  ctx.globalAlpha = 1
}
const AFTERIMAGES = [[2.9, 0.25, 0.8], [1.55, 0.45, 0.9]]   // [how far behind (of its radius), opacity, size], furthest first

// A thrown pumpkin (pk: as in IN_FLIGHT; shade: the map's shade tint).
export function drawFlyingPumpkin(ctx, pk, snap, X, Y, s, shade) {
  const type = PUMPKIN_TYPES[pk.typeName]
  const colors = pumpkinColors(type, pk.ripeness, 0)
  IN_FLIGHT[pk.typeName]?.(ctx, pk, colors, snap, X, Y, s)
  drawMaybeTicking(ctx, X(pk.x), Y(pk.y), pk.radius * s, pk.angle, colors, type, pk.fuse, shade)
}

// Types held some other way than in the hand, by type name. hand: [x, y] of the front hand.
const HELD = {
  balloon: (ctx, type, colors, [hx, hy], X, Y, s, shade) => {   // by its string, floating above the hand
    ctx.strokeStyle = GOURD.string
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(hx), Y(hy))
    ctx.lineTo(X(hx), Y(hy + 0.5))
    ctx.stroke()
    drawPumpkin(ctx, X(hx), Y(hy + 0.5 + type.radius), type.radius * s, 0, colors, null, shade)
  },
}

// The pumpkin a player (from the snapshot) is holding: in their front hand, growing a little while
// they charge a throw. A Big Gourd shield shows a crack for each hit it has blocked; a Bouncing Bomb
// caught ticking keeps blinking.
export function drawHeldPumpkin(ctx, p, X, Y, s, shade) {
  const hand = handOf(p), [hx, hy] = hand
  const type = PUMPKIN_TYPES[p.held]
  const colors = pumpkinColors(type, p.heldRipeness, 0)
  if (HELD[p.held]) HELD[p.held](ctx, type, colors, hand, X, Y, s, shade)
  else drawMaybeTicking(ctx, X(hx), Y(hy), type.radius * (1 + 0.25 * p.charge) * s, 0, colors, type, p.heldFuse, shade)
  if (p.heldCracks) {
    ctx.strokeStyle = mixHex(colors.rib, '#000000', 0.4)
    ctx.lineWidth = 0.025 * s
    for (let i = 0; i < p.heldCracks; i++) {
      const a = i * 2.1 + 0.4, r = type.radius
      ctx.beginPath()
      ctx.moveTo(X(hx), Y(hy))
      ctx.lineTo(X(hx + Math.cos(a) * r * 0.9), Y(hy + Math.sin(a) * r * 0.9))
      ctx.stroke()
    }
  }
}

// A crookneck gourd bent like a boomerang (around 0, 0; canvas y down): two arms meeting at a rounded
// elbow on top, a round bulb at the end of one, the neck tapering down the other to a curled stem.
// Flat: the neck, bulb and tip in its color, a darker band along the outside of the bend, the stem.
function boomerangAt(r, t) {   // along the bend (a curve from the bulb, up over the elbow, down to the tip): [x, y, normal x, normal y]
  const x = lerp(lerp(-0.85, 0, t), lerp(0, 0.85, t), t) * r, y = lerp(lerp(0.5, -1.6, t), lerp(-1.6, 0.5, t), t) * r
  const tx = 1.7, ty = 4.2 * (2 * t - 1), d = Math.hypot(tx, ty)
  return [x, y, ty / d, -tx / d]   // (the normal points out of the bend)
}
function drawBoomerangGourd(c, r, colors, f, one) {
  const [bx, by] = boomerangAt(r, 0.05), [tx, ty, tnx, tny] = boomerangAt(r, 1)
  f(colors.color)
  c.beginPath()   // the neck: one edge out, the other back
  const N = 14, edge = []
  for (let i = 0; i <= N; i++) {
    const [x, y, nx, ny] = boomerangAt(r, lerp(0.08, 1, i / N)), w = lerp(0.34, 0.19, i / N) * r
    edge.push([x + nx * w, y + ny * w, x - nx * w, y - ny * w])
  }
  edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
  for (let i = N; i >= 0; i--) c.lineTo(edge[i][2], edge[i][3])
  c.closePath(); c.fill()
  c.beginPath(); c.arc(bx, by, 0.44 * r, 0, TAU); c.fill()   // the bulb
  c.beginPath(); c.arc(tx, ty, 0.19 * r, 0, TAU); c.fill()   // (a rounded tip)
  f(lobeColor(colors))   // a darker ridge along the outside of the bend
  c.beginPath()
  for (let i = 0; i <= 12; i++) { const [x, y, nx, ny] = boomerangAt(r, lerp(0.12, 0.85, i / 12)), w = lerp(0.3, 0.18, i / 12) * r; i ? c.lineTo(x + nx * w, y + ny * w) : c.moveTo(x + nx * w, y + ny * w) }
  for (let i = 12; i >= 0; i--) { const [x, y, nx, ny] = boomerangAt(r, lerp(0.12, 0.85, i / 12)), w = lerp(0.12, 0.06, i / 12) * r; c.lineTo(x + nx * w, y + ny * w) }
  c.closePath(); c.fill()
  const ux = -tny, uy = tnx   // (on along the neck, past the tip)
  c.strokeStyle = one || GOURD.stem
  c.lineWidth = Math.max(1.5, r * 0.13)
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(tx, ty)
  c.quadraticCurveTo(tx + ux * 0.4 * r, ty + uy * 0.4 * r, tx + (ux * 0.3 + tnx * 0.35) * r, ty + (uy * 0.3 + tny * 0.35) * r)
  c.stroke()
  c.lineCap = 'butt'
}

// A Chomper shut, lying on its side (thrown or held): a long warty gourd with a toothy red seam and a stem.
function shutChomper(c, r, colors, f) {
  const { mouth, tooth, wart } = GOURD.chomper
  f(GOURD.stem); c.fillRect(r * 1.15, -r * 0.1, r * 0.32, r * 0.2)
  f(lobeColor(colors)); c.beginPath(); c.ellipse(0, 0, r * 1.25, r, 0, 0, TAU); c.fill()
  f(colors.color); c.beginPath(); c.ellipse(0, 0, r * 1.22, r * 0.55, 0, 0, TAU); c.fill()
  f(mouth); c.fillRect(-r * 1.05, -r * 0.04, r * 2.1, r * 0.08)
  f(tooth); c.beginPath()
  const n = 7, step = 2 * r / n
  for (let i = 0; i < n; i++) { const x0 = -r + i * step, d = i % 2 ? 1 : -1; c.moveTo(x0, 0); c.lineTo(x0 + step / 2, d * r * 0.22); c.lineTo(x0 + step, 0); c.closePath() }
  c.fill()
  f(wart)
  for (const [x, y] of [[-0.6, -0.62], [0.2, -0.75], [0.75, -0.45], [-0.3, 0.68], [0.5, 0.62]]) { c.beginPath(); c.arc(x * r, y * r, r * 0.09, 0, TAU); c.fill() }
}

// A planted Chomper: a warty gourd split lengthwise, carved teeth along the cut, standing on end on
// (0, 0) (canvas y down): `r` px across its middle, 1.2 × that to its middle the long way. Its two halves
// are hinged at the bottom: `open` from 0 (shut: standing whole, a zigzag of teeth up the seam) to 1
// (each half fallen out to its side, lying flat on the ground, red mouth and teeth facing up). Flat:
// each half is a darker rind with the lighter flesh-side lobe inside it, warts, the red mouth along the
// cut, cream teeth. (f, one: as for BODIES)
const WARTS = [[0.55, -0.5], [0.35, 0.45], [0.7, 0.1], [0.3, -0.1]]   // (across × r, along × the long way from the middle; mirrored on the left)
function chomperShape(c, r, open, colors, f) {
  const { mouth, tooth, wart } = GOURD.chomper
  const h = r * 1.2, tip = open * Math.PI / 2, lift = r * Math.sin(tip)   // (falling over, it ends up resting on its rind)
  for (const side of [-1, 1]) {
    c.save()
    c.translate(0, -lift)
    c.rotate(side * tip)
    const half = (rx, ry) => { c.beginPath(); c.ellipse(0, -h, rx, ry, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : Math.PI * 1.5); c.closePath(); c.fill() }
    f(lobeColor(colors)); half(r, h)            // the rind
    f(colors.color); half(r * 0.55, h * 0.97)    // the lighter lobe next to the cut
    f(wart)
    for (const [x, y] of WARTS) { c.beginPath(); c.arc(side * x * r, -h + y * h, r * 0.09, 0, TAU); c.fill() }
    if (open > 0.05) { f(mouth); half(r * 0.32 * Math.min(1, open * 2), h * 0.9) }   // the mouth: red along the cut
    f(tooth)   // carved teeth along the cut, poking across it (the two sides' in between each other)
    c.beginPath()
    const gap = h / 3
    for (let y = -2 * h + gap * (side > 0 ? 0.6 : 1.1); y < -gap * 0.4; y += gap) {
      c.moveTo(0, y - gap * 0.4)
      c.lineTo(-side * r * 0.32, y)
      c.lineTo(0, y + gap * 0.4)
      c.closePath()
    }
    c.fill()
    if (side > 0 && open < 0.3) { f(GOURD.stem); c.fillRect(r * 0.95, -h - r * 0.1, r * 0.34, r * 0.2) }   // the stem, out of the middle of one side (lying open, it's underneath)
    c.restore()
  }
}

// A planted gourd from the snapshot ({ kind, x, y, angle, open, bite }), by its kind (shade: the map's shade tint).
const TRAP_LOOKS = { chomper: drawChomper, landmine: drawLandmine }
export const drawTrap = (ctx, t, X, Y, s, shade) => TRAP_LOOKS[t.kind](ctx, t, X, Y, s, shade)

// A planted Chomper, standing on its spot: on the floor, its halves falling open to lie flat; biting
// someone, shut tight around their foot.
function drawChomper(ctx, t, X, Y, s, shade) {
  const r = PUMPKIN_TYPES.chomper.trap.size * s, x = X(t.x), y = Y(t.y)   // (lying open it's ~1 m end to end)
  const inFrame = fn => c => { c.save(); c.translate(x, y); c.rotate(-t.angle); fn(c); c.restore() }
  const paint = one => inFrame(c => chomperShape(c, r, t.open, PUMPKIN_TYPES.chomper, color => { c.fillStyle = one || color }))
  drawShaded(ctx, { draw: paint(null), silhouette: (c, one) => paint(one)(c), box: [x - r * 3, y - r * 3.2, x + r * 3, y + r * 1.2], shift: 0.2 * r, tint: shade })
}

// A Landmine's gourd (around 0, 0; canvas y down): squat and dark with lobes, a few knobs, and a stubby
// stem with an unlit light on the end. (f: as for BODIES)
function mineGourd(c, r, colors, f) {
  const w = r * 1.25
  f(GOURD.mine.stem); c.fillRect(-r * 0.09, -r * 1.3, r * 0.18, r * 0.36)
  f(GOURD.mine.unlit); c.beginPath(); c.arc(0, -r * 1.36, r * 0.14, 0, TAU); c.fill()
  f(lobeColor(colors)); c.beginPath(); c.ellipse(0, 0, w, r, 0, 0, TAU); c.fill()
  f(mixHex(colors.color, colors.rib, 0.2)); c.beginPath(); c.ellipse(0, 0, w * 0.78, r * 0.98, 0, 0, TAU); c.fill()
  f(colors.color); c.beginPath(); c.ellipse(0, 0, w * 0.4, r * 0.97, 0, 0, TAU); c.fill()
  f(colors.rib)   // knobs
  for (const [x, y] of [[-0.6, -0.45], [0.25, -0.65], [0.62, -0.2], [-0.2, -0.15]]) { c.beginPath(); c.arc(x * w, y * r, r * 0.08, 0, TAU); c.fill() }
}

// A planted Landmine: a little mound of dirt, the gourd sinking into the floor as it sets (open 0 → 1:
// sitting on it → half buried); once it's set, its light blinks red (with a see-through glow).
function drawLandmine(ctx, t, X, Y, s, shade) {
  const r = PUMPKIN_TYPES.landmine.trap.size * s, colors = PUMPKIN_TYPES.landmine
  ctx.save()
  ctx.translate(X(t.x), Y(t.y))
  ctx.rotate(-t.angle)
  ctx.fillStyle = GOURD.mine.dirt   // the dirt it's dug into
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.7, r * 0.28, 0, Math.PI, TAU)
  ctx.fill()
  ctx.beginPath()   // (only what's above the floor shows)
  ctx.rect(-r * 3, -r * 4, r * 6, r * 4)
  ctx.clip()
  ctx.translate(0, -r + t.open * r * 0.85)
  const paint = one => c => mineGourd(c, r, colors, color => { c.fillStyle = one || color })
  drawShaded(ctx, {
    draw: paint(null),
    silhouette: (c, one) => paint(one)(c),
    details: t.open >= 1 && (c => ANIM.mineLight(c, 0, -r * 1.36, r, clock.now())),   // (once it's set)
    box: [-r * 1.5, -r * 1.7, r * 1.5, r * 1.2],
    shift: 0.2 * r,
    tint: shade,
  })
  ctx.restore()
}

// A bottle gourd (around 0, 0; canvas y down): a big bulb below (lighter down the middle), a smaller one
// on top, and a stem. (f: as for BODIES)
function drawBottleGourd(c, r, colors, f) {
  f(GOURD.stem); c.beginPath(); c.roundRect(-r * 0.08, -r * 1.12, r * 0.16, r * 0.3, r * 0.05); c.fill()
  f(lobeColor(colors)); c.beginPath(); c.arc(0, 0.3 * r, 0.68 * r, 0, TAU); c.fill()
  f(colors.color); c.beginPath(); c.ellipse(0, 0.3 * r, 0.38 * r, 0.67 * r, 0, 0, TAU); c.fill()
  c.beginPath(); c.arc(0, -0.48 * r, 0.42 * r, 0, TAU); c.fill()
}

// A pattypan squash seen face on, like a saw blade (around 0, 0): a disc whose rim is a ring of pointed
// teeth, a darker scalloped ring inside it, the middle, and a little stem nub. (f: as for BODIES)
const SAW_TEETH = 10
function drawSawSquash(c, r, colors, f) {
  f(colors.color)
  c.beginPath()   // the rim: each tooth leans the same way round, like a saw's
  for (let i = 0; i < SAW_TEETH; i++) {
    const a = i / SAW_TEETH * TAU, next = (i + 1) / SAW_TEETH * TAU
    c.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86)
    c.lineTo(Math.cos(next - 0.12) * r * 1.15, Math.sin(next - 0.12) * r * 1.15)
  }
  c.closePath(); c.fill()
  f(mixHex(colors.color, colors.rib, 0.4))
  c.beginPath()   // the scalloped ring
  for (let i = 0; i <= SAW_TEETH * 2; i++) { const a = i / (SAW_TEETH * 2) * TAU, rr = r * (i % 2 ? 0.5 : 0.62); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  c.closePath(); c.fill()
  f(colors.color); c.beginPath(); c.arc(0, 0, r * 0.42, 0, TAU); c.fill()
  f(GOURD.stem); c.beginPath(); c.arc(0, 0, r * 0.16, 0, TAU); c.fill()   // the stem nub
}

// A spinning gourd in flight (pixels; mark: its shape): a blur from how fast it's spinning (see anims.js;
// flat: the blur's copies of it aren't shaded).
const spinBlur = (ctx, x, y, r, angle, colors, mark) => ANIM.spinBlur(ctx, x, y, r, angle, colors, a => drawPumpkin(ctx, x, y, r, a, colors, mark), clock.now())

// Locked on: a reticle round a player's torso (x, y in pixels), so everyone can see who a Homing gourd is
// after (see anims.js).
export const drawLockOn = (ctx, x, y, s) => ANIM.lockOn(ctx, x, y, s, clock.now())

// An Airstrike target (t: 0 when called in → 1 when the airdrop is due; r: the airdrop's radius):
// a dark shadow that spreads as the airdrop gets close, under a pulsing red crosshair.
export function drawAirstrikeTarget(ctx, x, y, t, r, X, Y, s) {
  const cx = X(x), cy = Y(y)
  const w = r * (0.3 + 0.9 * t) * s
  ctx.fillStyle = hexA(GOURD.airstrike.shadow, 0.15 + 0.35 * t)
  ctx.beginPath()
  ctx.ellipse(cx, cy, w, w * 0.3, 0, 0, TAU)
  ctx.fill()
  const pulse = 1 + 0.12 * Math.sin(Date.now() / 70)
  const R = 0.45 * s * pulse
  ctx.strokeStyle = GOURD.airstrike.target
  ctx.lineWidth = Math.max(1.5, 0.06 * s)
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // ticks poking out past the ring
    ctx.moveTo(cx + dx * R * 0.5, cy + dy * R * 0.5)
    ctx.lineTo(cx + dx * R * 1.4, cy + dy * R * 1.4)
  }
  ctx.stroke()
  ctx.fillStyle = GOURD.airstrike.target
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(1.5, 0.06 * s), 0, TAU)
  ctx.fill()
}

// A Black Hole (r: its core's radius): a black core with a tight white halo, and white specks
// streaking in from all around it.
export function drawBlackHole(ctx, x, y, r, X, Y, s) {
  const cx = X(x), cy = Y(y)
  ANIM.holeSpecks(ctx, cx, cy, r, s, clock.now())   // (streaking in: see anims.js)
  GOURD.blackHole.halo.forEach((color, i) => {   // the halo: two flat white discs round the core
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy, r * [1.35, 1.15][i] * s, 0, TAU)
    ctx.fill()
  })
  ctx.fillStyle = GOURD.blackHole.core
  ctx.beginPath()
  ctx.arc(cx, cy, r * s, 0, TAU)
  ctx.fill()
}
