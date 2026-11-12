// STATUS LOOKS: how hay bales and players look in their states (damaged, frozen, glued), by name, in
// one table, so each can be tried out in the effects lab (lab.html) and swapped for another version.
// level.js and players.js draw them through this table. t: the time in seconds (anims.js's clock), for
// the ones that move. Colors: STATUS (palette.js), plus LEVEL.bale for the straw.
//
//   baleBody(c, w, h, hp, s, f)       a hay bale's straw box, bands, twine and damage (hp 0..1), in the
//                                     bale's own frame (center at 0, 0; w, h px; canvas y down). It sets
//                                     each fill with f(color), so it doubles as the bale's silhouette for
//                                     its two-tone shading.
//   baleFrozen(c, w, h, s, t)         a frozen bale's ice, drawn over it (same frame, after the shading)
//   baleGlued(c, w, h, s, t, goo, k)  a sticky bale's goo, the same (goo: its colors, STATUS.goos: a Splat Pie's by default;
//                                     k: how much is left, 1 → 0 as it drains away once it's worn off: see endings.js)
//   playerFrozen: { tint(color), over(ctx, g, X, Y, s, t) }   a frozen player: the color their body turns,
//                                     and what's drawn over them after (g: their shape, below)
//   playerGlued(ctx, g, X, Y, s, t, goo, k)   goo on a glued player's feet (goo, k: the same)
// g: a player's shape, in meters: { head: [x, y], facing (1 right, -1 left), limbs: [[x1, y1, x2, y2,
// width], ...], feet: [[x, y], [x, y]] (the ends of the shins) }.
//
// Picked in the effects lab: thin zigzag cracks on a damaged bale (like its first look), frozen bales and
// players turned pale icy blue with frost spots, glue as a puddle with drips whose drops break off and
// fall into it. The lab swaps entries while it draws a tile, then puts them back; the game never does.

import { LEVEL, STATUS } from './palette.js'
import { mixHex } from '../util/color.js'

const TAU = Math.PI * 2
const frac = v => v - Math.floor(v)
const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.3, r), 0, TAU); c.fill() }
const rounded = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill() }

// GOO, filled: `shapes` (each adds its own subpath to the path) as one, in goo's colors. Goo with a lip (a
// Sticky Bomb's: goo.lip) is two-tone like everything else: a darker underside showing just below it and a
// pale lip along its top edges, so it reads as a thick blob even on green floors. (Its "down" is the frame's.)
export function fillGoo(c, shapes, goo, s) {
  const path = () => { c.beginPath(); for (const shape of shapes) shape(c) }
  if (goo.lip) { c.save(); c.translate(0, GOO_EDGE.under * s); c.fillStyle = goo.dark; path(); c.fill(); c.restore() }
  c.fillStyle = goo.goo; path(); c.fill()
  if (!goo.lip) return
  c.save(); path(); c.clip()   // (the lip: the pale shape, with the goo shape pushed down over it)
  c.fillStyle = goo.lip; path(); c.fill()
  c.translate(0, Math.max(1.5, GOO_EDGE.lip * s)); c.fillStyle = goo.goo; path(); c.fill()
  c.restore()
}
// Strands of goo: [{ w (px), path (begins its own) }], with a lip a darker copy just behind each.
export function strokeGoo(c, strands, goo, s) {
  c.lineCap = 'round'
  if (goo.lip) { c.save(); c.translate(GOO_EDGE.under * s * 0.6, GOO_EDGE.under * s * 0.6); c.strokeStyle = goo.dark; for (const st of strands) { c.lineWidth = st.w; st.path(c); c.stroke() } c.restore() }
  c.strokeStyle = goo.goo
  for (const st of strands) { c.lineWidth = st.w; st.path(c); c.stroke() }
  c.lineCap = 'butt'
}
const GOO_EDGE = { under: 0.025, lip: 0.02 }   // m: how far the underside shows below, how thick the lip is
const oval = (x, y, rx, ry) => c => { c.moveTo(x + rx, y); c.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, TAU) }
const pill = (x, y, w, h, r) => c => { if (w > 0 && h > 0) c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) }

// A drip at u (0..1 through its cycle): it stretches down for the first 60%, then its drop breaks off and
// falls while the drip springs back up (in the first 40% of the fall), so each cycle runs smoothly into
// the next. Returns { len (0..1: how far it's stretched), drop (null while it's still hanging, else 0..1:
// how far it's fallen) }.
function drip(u) {
  if (u < 0.6) return { len: u / 0.6, drop: null }
  const k = (u - 0.6) / 0.4
  return { len: Math.max(0, 1 - k / 0.4) ** 2, drop: k * k }   // (springing back, then the drop falling faster and faster)
}

// Thin dark cracks zigzagging in from the edges (two more once it's badly hurt): strokes, the way
// a crack is a line. hp: 0..1.
const CRACKS = [   // [x, y] of the bale's width and height (0, 0: its middle; y down)
  {
    below: 0.67,
    path: [[-0.12, -0.5], [-0.04, -0.4], [-0.1, -0.31], [0.0, -0.2], [-0.06, -0.1], [0.04, 0.0], [-0.03, 0.1], [0.02, 0.2]],
    branch: [[0.0, -0.2], [0.07, -0.24], [0.1, -0.15], [0.17, -0.18]],
  },
  {
    below: 0.34,
    path: [[0.42, 0.5], [0.33, 0.4], [0.38, 0.29], [0.27, 0.2], [0.32, 0.08], [0.22, -0.02], [0.28, -0.12], [0.24, -0.22]],
    branch: [[0.27, 0.2], [0.18, 0.24], [0.15, 0.15], [0.07, 0.19]],
  },
  {
    below: 0.34,   // (from the bottom left corner)
    path: [[-0.48, 0.5], [-0.39, 0.42], [-0.44, 0.31], [-0.33, 0.24], [-0.38, 0.13], [-0.27, 0.06], [-0.31, -0.04], [-0.22, -0.1]],
    branch: [[-0.33, 0.24], [-0.24, 0.29], [-0.2, 0.2], [-0.12, 0.25]],
  },
]

export const LOOKS = {
  baleBody: (c, w, h, hp, s, f) => {   // straw, darker straw bands, twine; thin cracks as it's damaged
    const B = LEVEL.bale
    f(B.straw); rounded(c, -w / 2, -h / 2, w, h, 0.04 * s)
    f(B.bands)
    for (const fy of [-0.25, 0, 0.25]) c.fillRect(-w / 2 + 0.05 * s, fy * h - 0.015 * s, w - 0.1 * s, 0.03 * s)
    f(B.twine)
    for (const fx of [-0.25, 0.25]) c.fillRect(fx * w - 0.025 * s, -h / 2, 0.05 * s, h)
    const cracks = CRACKS.filter(k => hp < k.below)
    if (!cracks.length) return
    f(B.crack)
    c.strokeStyle = c.fillStyle   // (whatever f just set: the crack's color, or the silhouette's)
    c.lineWidth = Math.max(1, 0.03 * s)
    c.lineJoin = c.lineCap = 'round'
    c.beginPath()
    for (const { path, branch } of cracks) {
      for (const line of [path, branch]) line.forEach(([fx, fy], i) => (i ? c.lineTo(fx * w, fy * h) : c.moveTo(fx * w, fy * h)))
    }
    c.stroke()
    c.lineJoin = 'miter'; c.lineCap = 'butt'
  },

  baleFrozen: (c, w, h, s) => {   // the straw itself turned pale icy blue (its bands still show), with frost spots
    c.save()
    c.globalCompositeOperation = 'color'   // (its hue: icy blue; its light and dark: the straw's)
    c.fillStyle = STATUS.ice
    rounded(c, -w / 2, -h / 2, w, h, 0.04 * s)
    c.restore()
    c.fillStyle = STATUS.iceWash
    rounded(c, -w / 2, -h / 2, w, h, 0.04 * s)
    c.fillStyle = STATUS.frost
    for (const [fx, fy, r] of [[-0.35, -0.3, 0.03], [-0.1, 0.2, 0.022], [0.2, -0.15, 0.035], [0.38, 0.3, 0.025], [0.05, -0.38, 0.02]]) disc(c, fx * w, fy * h, r * s)
  },

  baleGlued: (c, w, h, s, t, goo = STATUS.goos.pie, k = 1) => {   // a goo cap on top, drips down its front whose drops fall into a puddle at its foot
    const shapes = [oval(0, h / 2, w * 0.62 * k, 0.05 * s * k), pill(-w / 2 - 0.02 * s, -h / 2 - 0.03 * s, w + 0.04 * s, 0.1 * s * k, 0.05 * s * k)]
    if (k >= 1) BALE_DRIPS.forEach(([fx, phase]) => {   // (draining away (k < 1): the drips have stopped)
      const { len, drop } = drip(frac(t * 0.4 + phase)), top = -h / 2 + 0.07 * s, end = top + (0.06 + 0.18 * len) * s
      shapes.push(pill(fx * w - 0.025 * s, -h / 2, 0.05 * s, end - -h / 2, 0.025 * s))
      if (drop === null) shapes.push(oval(fx * w, end, (0.025 + 0.015 * len) * s, (0.025 + 0.015 * len) * s))   // (the drop swelling at its end)
      else shapes.push(oval(fx * w, top + 0.24 * s + (h / 2 - top - 0.24 * s) * drop, 0.035 * s, 0.035 * s))   // (falling from where it let go)
    })
    fillGoo(c, shapes, goo, s)
  },

  playerFrozen: {
    tint: color => mixHex(color, STATUS.frozen, 0.82),   // pale icy blue all over
    over: (ctx, g, X, Y, s) => {   // white frost spots on the head and body
      const [hx, hy] = g.head
      ctx.fillStyle = STATUS.frost
      for (const [dx, dy, r] of [[-0.06, 0.05, 0.025], [0.05, -0.04, 0.018], [0.0, -0.3, 0.02], [0.03, -0.55, 0.024], [-0.02, -0.75, 0.016]]) disc(ctx, X(hx + dx * g.facing), Y(hy + dy), r * s)
    },
  },

  playerGlued: (ctx, g, X, Y, s, t, goo = STATUS.goos.pie, k = 1) => {   // standing in a puddle of filling, goo on the feet, drips sliding down the shins
    const floor = Math.min(...g.feet.map(f => f[1])) - 0.06, cx = (g.feet[0][0] + g.feet[1][0]) / 2
    if (!goo.lip) {   // (a pie's puddle: a darker lower edge; goo with a lip gets its own underside)
      ctx.fillStyle = goo.dark
      ctx.beginPath(); ctx.ellipse(X(cx), Y(floor) + 0.015 * s, 0.5 * s * k, 0.07 * s * k, 0, 0, TAU); ctx.fill()
    }
    const shapes = [oval(X(cx), Y(floor), 0.48 * s * k, 0.06 * s * k)]
    g.feet.forEach(([x, y], i) => {
      shapes.push(oval(X(x), Y(y), 0.11 * s * k, 0.07 * s * k))
      if (k < 1) return   // (draining away: the drips have stopped)
      const { len, drop } = drip(frac(t * 0.6 + i * 0.4)), top = y + 0.18, end = top - 0.04 - 0.08 * len
      shapes.push(pill(X(x) - 0.025 * s, Y(top), 0.05 * s, (top - end) * s, 0.025 * s))
      if (drop === null) shapes.push(oval(X(x), Y(end), (0.025 + 0.012 * len) * s, (0.025 + 0.012 * len) * s))
      else shapes.push(oval(X(x), Y(top - 0.12 - (top - 0.12 - floor) * drop), 0.03 * s, 0.03 * s))
    })
    fillGoo(ctx, shapes, goo, s)
  },
}
const BALE_DRIPS = [[-0.32, 0], [-0.05, 0.55], [0.2, 0.25], [0.38, 0.8]]   // [where across it (of w), where in its cycle it starts]

