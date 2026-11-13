// TITLE LOGO (the main menu's "Gourd Wars", drawn on the title art's canvas)
// The intro, played the first time the main menu shows and again after a game or the map editor (titleArt.js): the letters drop in one after another and bounce, a Classic
// pumpkin is lobbed up from the bottom of the screen, spinning, and splats into the gap between the two words (a quick screen
// shake), and the letters near it get shoved away and tilted. Then it all freezes that way: the pumpkin
// sits in the gap on a splat, with puffs round it and seeds stuck mid-air, and the whole logo sways gently.
//
// The intro is a pure function of time: drawTitleLogo(ctx, w, h, t) draws the logo as it is t seconds in
// (any t, in any order), so the title art just passes the clock, and LOGO_SETTLED (the moment it freezes,
// before the sway starts) is the finished logo standing still (for reduced motion).
//
//   drawTitleLogo(ctx, w, h, t, shade)  w, h: the screen (CSS px); shade: the pumpkin's two-tone tint
//   titleShake(t)                        [dx, dy] px: the screen shake at t (the title art shakes everything)
//   LOGO_SETTLED                         seconds
//
// Sizes are in em (the logo's font size: 9% of the screen width, from 44 to 124 px, smaller if the
// finished logo wouldn't fit). Colors: the logo's from palette.js (UI), the blast's puffs and seeds from
// TITLE there too.

import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { drawPumpkin, drawPumpkinSilhouette } from '../render/pumpkins.js'
import { TITLE, UI, font } from '../render/palette.js'
import { clamp, lerp } from '../util/math.js'

const TEXT = 'Gourd Wars'
const SPACING = 0.03, GAP = 0.3        // em: after each letter; the gap between the words before the hit
const TOP = 0.07                       // of the screen's height: the logo's top
const SIZE = { vw: 0.09, min: 44, max: 124, fit: 0.94 }   // (fit: the most of the screen's width the finished logo takes)

// --- the timeline (seconds) ---
const dropAt = i => 0.1 + i * 0.06, DROP_TIME = 0.8
const LANDED = dropAt(TEXT.length - 1) + DROP_TIME
const LAUNCH = LANDED, FLIGHT = 0.45, IMPACT = LAUNCH + FLIGHT
const SHOVE_TIME = 0.4, SPLAT_TIME = 0.14, PUFF_TIME = 0.24, SEED_TIME = 0.45, SHAKE_TIME = 0.22
export const LOGO_SETTLED = IMPACT + SHOVE_TIME
const SWAY_IN = 0.9, SWAY = 1.8, SWAY_DEG = 2

// A letter's drop (the old CSS logo-drop): [time 0..1, y in screen heights, y in em, tilt in degrees],
// eased in between each pair like CSS's ease-in.
const DROP_KEYS = [[0, -0.8, 0, -8], [0.55, 0, 0, 0], [0.7, 0, -0.22, 0], [0.85, 0, 0, 0], [0.93, 0, -0.05, 0], [1, 0, 0, 0]]

// The pumpkin (r: em), how it ends up, and the room it makes between the words.
const PUMPKIN = { r: 0.41, tilt: 0.16, spin: 18, wobble: 0.22, room: 1.16 }   // (spin: rad/s in flight; room: em, edge to edge)
// The lob: it starts just below the bottom of the screen, this far left of the gap (of the screen's width),
// and flies like a real throw (steady across, gravity up and down). It would top out at `peak` of the way
// along, so it's still rising (slowing) as it hits: it comes up into the gap from below, not across the
// letters. (from: far enough left to stay clear of the menu's buttons on a wide screen.)
const LOB = { from: 0.3, peak: 1.6 }
// Its outline: its shape stamped in the dark edge color all round it, 0.035em out (thinner than the
// letters', and no drop: just enough to keep it apart from the puffs). [dx, dy] em.
const OUTLINE = Array.from({ length: 12 }, (_, i) => [0.035 * Math.cos(i / 12 * Math.PI * 2), 0.035 * Math.sin(i / 12 * Math.PI * 2)])

// How far each letter gets shoved, beyond the words moving apart to make room: [dx away from the hit (em),
// dy (em, + is down), tilt away from the hit (degrees)], from the nearest letter out.
const SHOVES = {
  left: [[0.14, -0.1, 20], [0.06, 0.04, 8], [0.03, -0.02, 4], [0.01, 0.01, 2], [0, 0, 1]],   // d r u o G
  right: [[0.14, -0.07, 18], [0.06, 0.04, 7], [0.03, -0.02, 3], [0, 0.01, 1]],              // W a r s
}

// The splat behind the hit: a disc with a bumpy edge, tapered spikes and loose drops, squashed flat (so
// it doesn't run off the top of the screen). All em; angles in turns.
const SPLAT = {
  r: 0.56, squash: 0.78,
  bumps: [[0.03, 0.2], [0.13, 0.16], [0.25, 0.22], [0.37, 0.15], [0.49, 0.21], [0.6, 0.17], [0.72, 0.2], [0.84, 0.15], [0.94, 0.18]],   // [angle, radius]
  spikes: [[0.08, 1.05, 0.12], [0.31, 0.95, 0.1], [0.55, 1.1, 0.12], [0.68, 0.9, 0.09], [0.89, 1.0, 0.1]],   // [angle, length, half-width at the base]
  drops: [[0.0, 1.2, 0.07], [0.19, 1.05, 0.05], [0.43, 1.18, 0.06], [0.62, 1.25, 0.05], [0.79, 1.12, 0.06]],   // [angle, distance, radius]
}
// The frozen puffs round the pumpkin, peeking out from behind it: [angle (turns), distance (em), radius (em), heat 0..1].
const PUFFS = [
  [0.02, 0.56, 0.2, 0.5], [0.16, 0.6, 0.17, 0.75], [0.3, 0.55, 0.21, 0.4], [0.44, 0.58, 0.18, 0.8],
  [0.57, 0.56, 0.2, 0.45], [0.7, 0.6, 0.17, 0.85], [0.84, 0.56, 0.19, 0.6], [0.94, 0.62, 0.16, 0.3],
]
// Seeds and rind chunks, stuck mid-air where they flew: [angle (turns), distance (em), size (em), kind, final turn (rad)].
const BITS = [
  [0.06, 1.1, 0.07, 'seed', 0.4], [0.2, 1.3, 0.06, 'chunk', 1.2], [0.33, 1.05, 0.07, 'seed', -0.6],
  [0.42, 1.4, 0.06, 'seed', 0.9], [0.66, 1.15, 0.065, 'seed', 1.8],
  [0.78, 1.35, 0.07, 'seed', -0.3], [0.9, 1.15, 0.07, 'chunk', 0.5],
]

const TAU = Math.PI * 2, DEG = Math.PI / 180
const CLASSIC = PUMPKIN_TYPES.classic

export function drawTitleLogo(ctx, w, h, t, shade) {
  const L = layout(ctx, w, h), em = L.px
  ctx.save()
  // the sway, round the logo's middle (it starts once everything has frozen)
  ctx.translate(w / 2, L.y)
  ctx.rotate(swayAt(t - LOGO_SETTLED) * DEG)
  ctx.translate(-w / 2, -L.y)
  const hit = [L.gapX, L.y + L.capMid], since = t - IMPACT
  if (since >= 0) {
    drawSplat(ctx, hit, em, easeOutBack(clamp(since / SPLAT_TIME, 0, 1)))
    drawPuffs(ctx, hit, em, easeOutBack(clamp(since / PUFF_TIME, 0, 1)))
  }
  const shove = since >= 0 ? easeOutBack(clamp(since / SHOVE_TIME, 0, 1)) : 0
  L.letters.forEach((l, i) => drawLetter(ctx, l, i, t, shove, L, h))
  if (t >= LAUNCH) drawFlyingPumpkin(ctx, hit, em, t, w, h, shade)
  if (since >= 0) drawBits(ctx, hit, em, clamp(since / SEED_TIME, 0, 1))
  ctx.restore()
}

export function titleShake(t) {
  const u = (t - IMPACT) / SHAKE_TIME
  if (u < 0 || u > 1) return [0, 0]
  const a = 7 * (1 - u) ** 2
  return [a * Math.sin(t * 95), a * Math.cos(t * 77)]
}

// --- layout: where every letter goes (the words before they're shoved apart), at this screen size ---

let cache = null
function layout(ctx, w, h) {
  if (cache && cache.w === w && cache.h === h) return cache.L
  const measure = px => {
    ctx.save()
    ctx.font = font('display', px)
    const widths = [...TEXT].map(ch => ch === ' ' ? GAP * px : ctx.measureText(ch).width + SPACING * px)
    ctx.textBaseline = 'middle'
    const m = ctx.measureText('G')
    ctx.restore()
    const total = widths.reduce((a, b) => a + b, 0)
    return { widths, total, finished: total - GAP * px + PUMPKIN.room * px + 2 * SHOVES.left[0][0] * px, capMid: (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 }
  }
  let px = clamp(w * SIZE.vw, SIZE.min, SIZE.max), M = measure(px)
  if (M.finished > w * SIZE.fit) { px *= w * SIZE.fit / M.finished; M = measure(px) }
  const letters = []
  let x = (w - M.total) / 2, gapX = 0
  const space = TEXT.indexOf(' ')
  ;[...TEXT].forEach((ch, i) => {
    if (i === space) gapX = x + M.widths[i] / 2
    else {
      const side = i < space ? 'left' : 'right', k = i < space ? space - 1 - i : i - space - 1
      letters.push({ ch, i, x: x + (M.widths[i] - SPACING * px) / 2, side: side === 'left' ? -1 : 1, shove: SHOVES[side][k] })
    }
    x += M.widths[i]
  })
  const L = { px, y: h * TOP + px / 2, letters, gapX, capMid: M.capMid, spread: (PUMPKIN.room - GAP) / 2 * px }
  cache = { w, h, L }
  return L
}

// --- the pieces ---

// One letter: its drop, then its shove (the words moving apart, plus its own nudge and tilt). Drawn like
// the old CSS logo: a dark drop under it, a dark outline, the pumpkin-orange fill.
function drawLetter(ctx, l, i, t, shove, L, h) {
  const px = L.px, [dropY, tilt] = dropAt01((t - dropAt(i)) / DROP_TIME, h, px)
  const [sx, sy, sdeg] = l.shove
  const x = l.x + l.side * (L.spread + sx * px) * shove, y = L.y + dropY + sy * px * shove
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((tilt + l.side * sdeg * shove) * DEG)
  ctx.font = font('display', px)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 0.16 * px
  ctx.strokeStyle = ctx.fillStyle = UI.logoEdge
  ctx.strokeText(l.ch, 0, 0.07 * px)   // the drop
  ctx.fillText(l.ch, 0, 0.07 * px)
  ctx.strokeText(l.ch, 0, 0)
  ctx.fillStyle = UI.pumpkin
  ctx.fillText(l.ch, 0, 0)
  ctx.restore()
}

// The pumpkin: lobbed up from below the screen (spinning), then sitting in the gap (a little wobble as it
// stops). It gets a thin dark outline, so it stands out from the puffs.
function drawFlyingPumpkin(ctx, hit, em, t, w, h, shade) {
  const r = PUMPKIN.r * em, since = t - IMPACT
  let [x, y] = hit, angle = PUMPKIN.tilt
  if (since < 0) {
    const u = (t - LAUNCH) / FLIGHT, y0 = h + 1.5 * r
    const a = (hit[1] - y0) / (1 - 2 * LOB.peak)   // (y = y0 + a·u² − 2·peak·a·u: through y0 at the start, the gap at the end, highest at peak)
    x = lerp(hit[0] - LOB.from * w, hit[0], u)
    y = y0 + a * u * u - 2 * LOB.peak * a * u
    angle += PUMPKIN.spin * since
  } else angle += PUMPKIN.wobble * Math.exp(-since * 9) * Math.sin(since * 28)
  for (const [dx, dy] of OUTLINE) drawPumpkinSilhouette(ctx, x + dx * em, y + dy * em, r, angle, CLASSIC, CLASSIC.mark, UI.logoEdge)
  drawPumpkin(ctx, x, y, r, angle, CLASSIC, CLASSIC.mark, shade)
}

function drawSplat(ctx, [cx, cy], em, grow) {
  if (grow <= 0) return
  const s = em * grow, at = (turn, d) => [cx + Math.cos(turn * TAU) * d * s, cy + Math.sin(turn * TAU) * d * s * SPLAT.squash]
  const disc = ([x, y], r) => { ctx.beginPath(); ctx.arc(x, y, r * s, 0, TAU); ctx.fill() }
  ctx.fillStyle = TITLE.splat
  ctx.beginPath()
  ctx.ellipse(cx, cy, SPLAT.r * s, SPLAT.r * s * SPLAT.squash, 0, 0, TAU)
  ctx.fill()
  for (const [turn, r] of SPLAT.bumps) disc(at(turn, SPLAT.r), r)
  for (const [turn, len, half] of SPLAT.spikes) {
    const side = half / SPLAT.r / TAU, tip = at(turn, len)
    ctx.beginPath()
    ctx.moveTo(...at(turn - side, SPLAT.r * 0.85))
    ctx.lineTo(...tip)
    ctx.lineTo(...at(turn + side, SPLAT.r * 0.85))
    ctx.fill()
  }
  for (const [turn, d, r] of SPLAT.drops) disc(at(turn, d), r)
}

const heatColor = heat => heat > 0.66 ? TITLE.puff.hot : heat > 0.33 ? TITLE.puff.warm : TITLE.puff.cool
function drawPuffs(ctx, [cx, cy], em, grow) {
  if (grow <= 0) return
  for (const [turn, d, r, heat] of [...PUFFS].sort((a, b) => a[3] - b[3])) {   // (coolest first, so the hot ones sit on top)
    ctx.fillStyle = heatColor(heat)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(turn * TAU) * d * em * grow, cy + Math.sin(turn * TAU) * d * em * grow, Math.max(0.1, r * em * grow), 0, TAU)
    ctx.fill()
  }
}

// Seeds (pale ellipses) and rind chunks (5-sided bits), flying out from the hit and slowing to a stop.
function drawBits(ctx, [cx, cy], em, u) {
  const out = 1 - (1 - u) ** 3
  BITS.forEach(([turn, d, size, kind, rest], i) => {
    const a = turn * TAU, x = cx + Math.cos(a) * d * em * out, y = cy + Math.sin(a) * d * em * out
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rest + (1 - out) * 8)
    if (kind === 'seed') {
      ctx.fillStyle = TITLE.seed
      ctx.beginPath()
      ctx.ellipse(0, 0, size * em, size * em * 0.58, 0, 0, TAU)
      ctx.fill()
    } else {
      ctx.fillStyle = i % 2 ? CLASSIC.color : CLASSIC.rib
      ctx.beginPath()
      for (let k = 0; k < 5; k++) { const b = k / 5 * TAU, rr = size * em * (0.7 + 0.45 * ((i * 7 + k * 3) % 5) / 4); ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr) }
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  })
}

// --- motion ---

// A letter's drop at u (0..1 through it): [y offset px, tilt degrees]. Before it starts: still up top.
function dropAt01(u, h, px) {
  u = clamp(u, 0, 1)
  let k = 0
  while (k < DROP_KEYS.length - 2 && u > DROP_KEYS[k + 1][0]) k++
  const [a0, vh0, em0, d0] = DROP_KEYS[k], [a1, vh1, em1, d1] = DROP_KEYS[k + 1]
  const e = easeIn((u - a0) / (a1 - a0))
  return [lerp(vh0 * h + em0 * px, vh1 * h + em1 * px, e), lerp(d0, d1, e)]
}

// The sway (degrees) s seconds after the logo freezes: eases out to one side, then rocks side to side.
function swayAt(s) {
  if (s <= 0) return 0
  if (s < SWAY_IN) return -SWAY_DEG * easeInOut(s / SWAY_IN)
  const p = ((s - SWAY_IN) / SWAY) % 2, back = p > 1
  return lerp(-SWAY_DEG, SWAY_DEG, easeInOut(back ? 2 - p : p))
}

// CSS-style cubic-bézier easings (x1, y1, x2, y2), solved for x by bisection.
function bezier(x1, y1, x2, y2) {
  const at = (s, p1, p2) => 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s * s * p2 + s ** 3
  return t => {
    let lo = 0, hi = 1
    for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (at(m, x1, x2) < t) lo = m; else hi = m }
    return at((lo + hi) / 2, y1, y2)
  }
}
const easeIn = bezier(0.42, 0, 1, 1), easeInOut = bezier(0.42, 0, 0.58, 1)
const easeOutBack = u => { const c = 1.7; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2 }
