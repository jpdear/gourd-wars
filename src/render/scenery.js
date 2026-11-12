// Drawing the map itself: its backdrop (a flat sky or flat sky bands, and the scenery behind the
// action), platforms with their tops, moving platforms and their rails, pitchforks and bonfire logs.
// Colors: the map's theme (maps/themes.js).
//
//   drawMapBase(ctx, map, X, Y, s, moverPos)   moverPos: [{ x, y }, ...] (a snapshot's movers), or
//                                              nothing for their starting spots
//   drawWeather(ctx, theme, X, Y, s)           the theme's weather (Winter's snow, Lava's embers), over
//                                              everything in the world: render.js draws it last, before the HUD
//
// The backdrop doesn't move, so it's drawn once into an offscreen canvas (a cache for each theme, kept
// for the last two drawn: the map and, during a pan, the one before it) and copied in through X and Y
// every frame; it's redrawn when the size changes. Scenery that moves (ANIMATED: the volcano's smoke,
// the synth grid floor) is drawn live on top.
//
// The scenery drawings are the style guide's (docs/restyle/mockups/style-guide.html), drawn in its
// units through `mock` (docs/RESTYLE_PLAN.md section 6): its world is 6 m wide with the ground at
// y = 0.6, scaled up to the game's 32 m with the ground at y = 0. Shaded pieces (hills sideways, props)
// get the two-tone shadow side in theme.shade.

import { CONFIG } from '../config.js'
import { drawBonfire, drawPitchforks } from './level.js'
import { drawShaded } from './shading.js'
import { hexA, mixHex } from '../util/color.js'

const W = CONFIG.view.w, H = CONFIG.view.h
const TAU = Math.PI * 2

export function drawMapBase(ctx, map, X, Y, s, moverPos) {
  drawBackdrop(ctx, map.theme, X, Y, s)
  drawMapFront(ctx, map, X, Y, s, moverPos, Date.now() / 1000)
}

// What's drawn over the backdrop every frame: its moving parts, then the map's pieces. t: s, for the
// moving parts. (Exported for the effects lab, which draws the backdrop uncached: paintBackdrop.)
export function drawMapFront(ctx, map, X, Y, s, moverPos, t) {
  const theme = map.theme
  ANIMATED[theme.scenery]?.(ctx, theme, X, Y, s, t)
  for (const p of map.platforms) drawPlatform(ctx, theme, p, X, Y, s)
  map.movers.forEach((m, i) => {
    drawMoverTrack(ctx, theme, m, X, Y, s)
    const at = moverPos && moverPos[i]
    drawPlatform(ctx, theme, at ? { ...m, x: at.x, y: at.y } : m, X, Y, s)
  })
  for (const sp of map.spikes) drawPitchforks(ctx, sp, X, Y, s, theme.shade)
  for (const f of map.fires) drawBonfire(ctx, f, X, Y, s, false, theme.shade)
}

// --- the backdrop (cached) ---

const caches = new Map()   // theme → { key, canvas } (the most recently used last)
function drawBackdrop(ctx, theme, X, Y, s) {
  const T = ctx.getTransform(), scale = Math.hypot(T.a, T.b)   // (device px per px: the screen's pixel ratio)
  const w = Math.max(1, Math.round(W * s * scale)), h = Math.max(1, Math.round(H * s * scale)), key = `${w}x${h}`
  let cache = caches.get(theme)
  if (!cache || cache.key !== key) {
    const canvas = cache ? cache.canvas : document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const c = canvas.getContext('2d')
    c.setTransform(w / (W * s), 0, 0, h / (H * s), 0, 0)
    paintBackdrop(c, theme, x => x * s, y => (H - y) * s, s)   // (the arena, with its top left corner at 0, 0)
    cache = { key, canvas }
  }
  caches.delete(theme)
  caches.set(theme, cache)
  while (caches.size > 2) caches.delete(caches.keys().next().value)
  ctx.drawImage(cache.canvas, X(0), Y(H), W * s, H * s)
}

// The sky and scenery, drawn now (no cache): what the cache holds. (Exported for the effects lab.)
export function paintBackdrop(c, theme, X, Y, s) {
  if (theme.bands) PARTS.bandedSky(c, theme, X, Y, s)
  else { c.fillStyle = theme.sky; c.fillRect(X(0), Y(H), W * s, H * s) }
  SCENERY[theme.scenery]?.(c, theme, X, Y, s)
}

const BAND_CUTS = [0, 0.2, 0.42, 0.66, 1]   // (of the view's height, from the top)

// Pieces of the backdrop the effects lab can swap for tries (it puts them back; the game never does):
//   bandedSky(c, theme, X, Y, s)            a sky in theme.bands (picked: wavy edges)
//   forest(c, v, theme, hill, row)          Bonfire Camp's trees (picked: moonlit pines) along a hill (a HILLS entry): row 'far'
//                                           (on the far hill, against the sky) or 'mid' (on the near one)
//   scarecrow(c, v, x, base, h, color)      Scarecrow Field's scarecrow (picked: tattered), far off: standing at x on
//                                           `base`, h tall (all in style guide meters, through v)
//   graves(c, v, theme)                     Graveyard's far hill and what stands on it (picked: a row of small faded
//                                           graves and a fence along its crest)
//   graveTree(c, v, theme)                  Graveyard's tree, on its near hill (picked: forked, with spiked twigs)
//   lavaLand(c, v, theme, X, Y, s)          Lava's ranges and volcano (picked: hazy far range, dark ridge and volcano)
//   lavaFlow(ctx, v, theme, t)              Lava's lava in the crater and down the volcano (moving: drawn every frame)
//   graveClouds(c, v, theme)                Graveyard's clouds (picked: storm clouds)
//   lavaTop(ctx, theme, p, X, Y, s)         Lava's platform tops (TOPS.lava: a platform p's top and face; picked:
//                                           webs of cracks, black on floating ones, glowing on the floor)
export const PARTS = {
  lavaLand: (c, v, theme) => {   // a hazy far range lighter than the smoky sky, a dark ridge, the dark volcano; each with lit faces (picked: ash sky)
    const a = theme.art, [far, ridge, volcano] = a.hills, [farLit, ridgeLit, volcanoLit] = a.lit
    shadedPoly(c, v, theme, far, [LAVA_RANGES.far], 0.12); litFaces(c, v, LAVA_RANGES.far, farLit)
    shadedPoly(c, v, theme, ridge, [LAVA_RANGES.ridge], 0.14); litFaces(c, v, LAVA_RANGES.ridge, ridgeLit)
    shadedPoly(c, v, theme, volcano, [LAVA_RANGES.volcano], 0.2)
    c.fillStyle = volcanoLit   // (its lit faces: the left slope, and a gully down the right)
    path(c, v, [[[3.3, 0.6], [4.45, 2.35], [4.6, 2.35], [4.05, 0.6]], [[5.05, 2.35], [5.2, 1.6], [5.6, 0.6], [5.95, 0.6]]]); c.fill()
  },
  lavaFlow: (c, v, theme, t = 0) => {   // the crater seen a little from above (an oval opening, its back wall lit by the glow, a pool of lava glowing yellow in the middle, shimmering and bubbling); smooth rounded streams pouring out of the pool over the rim and down, each orange with a lighter streak along it, yellow-hot dashes sliding down them
    const a = theme.art, { x, y, rx, ry } = LAVA_CRATER, opening = oval(x, y, rx, ry), pool = y - ry * 0.45
    const rim = at => y - ry * Math.sqrt(Math.max(0, 1 - ((at - x) / rx) ** 2))   // (the bottom of the opening at x: its near rim)
    c.fillStyle = mixHex(mixHex(a.hills[2], '#000000', 0.3), a.lava, 0.25); path(c, v, [opening]); c.fill()
    c.save(); path(c, v, [opening]); c.clip()
    c.fillStyle = a.lava; path(c, v, [oval(x, pool, rx * 0.92, ry * 0.6)]); c.fill()
    c.fillStyle = a.ember; path(c, v, [oval(x + Math.sin(t * 1.1) * 0.05, pool, rx * 0.5, ry * 0.25)]); c.fill()   // (the glow, shimmering)
    c.fillStyle = a.hot; path(c, v, [oval(x + Math.sin(t * 1.1) * 0.03, pool, rx * 0.22, ry * 0.12)]); c.fill()
    for (let k = 0; k < LAVA_POOL.bubbles; k++) {   // (each swells and pops, then comes up somewhere else)
      const q = t * 0.7 + k / LAVA_POOL.bubbles, round = Math.floor(q)
      disc(c, v.X(x + (rnd(round * 7 + k) - 0.5) * rx * 1.2), v.Y(pool), LAVA_POOL.bubble * Math.sin((q - round) * Math.PI) * v.s)
    }
    c.restore()
    for (const st of LAVA_STREAMS) {   // (each pours over the near rim: its orange body tucked up into the pool, the same color, so no seam or notch shows; its streak starts right at the rim)
      const along = (u, side, tuck = 0) => {   // a point along it at u (0..1), shifted across it by `side` of its width there (tuck: its top that far up into the pool)
        const [x0, y0] = st.from[1] === 'pool' ? [st.from[0], rim(st.from[0]) + tuck] : st.from, [x1, y1] = st.to
        const w = (st.w[0] + (st.w[1] - st.w[0]) * u) * (1 + st.bulge * Math.sin(u * 9 + st.phase)) * Math.sqrt(Math.max(0, 1 - Math.max(0, (u - 0.85) / 0.15) ** 2))
        return [x0 + (x1 - x0) * u + Math.sin(u * st.freq + st.phase) * st.amp * u + side * w, y0 + (y1 - y0) * u, w]
      }
      c.fillStyle = a.lava; blob(c, v, (u, side) => along(u, side, LAVA_POOL.tuck), 1, 0, 1)
      c.fillStyle = a.ember; blob(c, v, along, 0.85, -0.22, 0.4)   // (a lighter streak down its sunny side)
      c.save()   // (yellow-hot dashes sliding down the streak: the only yellow on it, so they stand out)
      c.strokeStyle = a.hot; c.lineWidth = LAVA_POOL.streak * v.s; c.lineCap = 'round'
      c.setLineDash([0.04 * v.s, 0.1 * v.s]); c.lineDashOffset = -t * 0.1 * v.s
      c.beginPath()
      for (let i = 0; i <= 16; i++) { const [px, py] = along(0.03 + i / 16 * 0.67, -0.22); i ? c.lineTo(v.X(px), v.Y(py)) : c.moveTo(v.X(px), v.Y(py)) }   // (from just below the rim, so a dash's round end never pokes above it)
      c.stroke(); c.restore()
    }
  },

  graveClouds: (c, v, theme) => {   // a few puffy storm clouds, dark with a moonlit rim along their tops, one across the moon's lower half (picked: storm clouds)
    const [dark, lit] = theme.art.cloud
    for (const [x, y, w] of GRAVE_CLOUDS) {
      const balls = [[-0.32, 0.1, 0.18], [-0.1, 0.2, 0.26], [0.16, 0.16, 0.22], [0.36, 0.08, 0.15]].map(([dx, dy, r]) => [x + dx * w, y + dy * w, r * w])
      c.fillStyle = lit
      for (const [bx, by, r] of balls) disc(c, v.X(bx - 0.015), v.Y(by + 0.025), r * v.s)
      c.fillStyle = dark
      for (const [bx, by, r] of balls) disc(c, v.X(bx), v.Y(by), r * v.s)
      c.beginPath(); c.roundRect(v.X(x - 0.45 * w), v.Y(y + 0.12 * w), 0.9 * w * v.s, 0.14 * w * v.s, 0.07 * w * v.s); c.fill()   // (its flat base)
    }
  },
  graves: (c, v, theme) => {   // the far hill, and on it (set into the ground: cut off at its surface) a faded iron fence and a row of small stones and crosses along the crest
    const a = theme.art, far = GRAVE_HILLS[0], on = x => hillTop(far, x), [x0, x1] = GRAVE_SPAN
    hill(c, v, theme, far, a.hills[0])
    c.save()
    c.beginPath(); c.moveTo(v.X(x0), v.Y(5))
    for (let x = x0; x <= x1 + 0.001; x += 0.05) c.lineTo(v.X(x), v.Y(on(x)))
    c.lineTo(v.X(x1), v.Y(5)); c.closePath(); c.clip()
    fence(c, v, mixHex(a.fence, a.hills[0], 0.3), GRAVE_FENCE, x => on(x) - 0.04)
    const color = mixHex(a.stone, a.hills[0], 0.4)   // (faded: far off)
    for (const g of GRAVES) grave(c, v, theme, g, on(g[0]) - 0.06, Math.atan(slopeAt(far, g[0])) * 0.3, color)
    c.restore()
  },
  graveTree: (c, v, theme) => {   // a bare tree on the near hill, all straight limbs and sharp kinks: a trunk forking into three, each ending in spiked twigs
    const x = 0.95, y = hillTop(GRAVE_HILLS[1], x) - 0.04
    const foot = [[x - 0.13, y - 0.04], [x + 0.13, y - 0.04], [x + 0.05, y + 0.14], [x - 0.05, y + 0.14]]   // (a flared foot)
    const grow = pts => pts.map(([px, py]) => [x + (px - x) * GRAVE_TREE.size, y + (py - y) * GRAVE_TREE.size])
    shadedPoly(c, v, theme, theme.art.tree, [ccw(foot), ...limbs(GRAVE_TREE.trunk, x, y, true)].map(grow), 0.04)
  },
  lavaTop: (ctx, theme, p, X, Y, s) => {   // a web of cracks over the rock: floating platforms cooled dark rock with thin black cracks; the floor (1 m thick or more) dark red rock whose cracks glow (a soft halo, the crack, its hot core). An edge along the top. (In game meters.)
    const a = theme.art, floor = p.h >= LAVA_ROCK.floor, look = floor ? LAVA_ROCK.molten : LAVA_ROCK.cooled
    const x0 = p.x - p.w / 2, top = p.y + p.h / 2
    ctx.save()
    ctx.beginPath(); ctx.rect(X(x0), Y(top), p.w * s, p.h * s); ctx.clip()
    if (floor) { ctx.fillStyle = a.molten; ctx.fillRect(X(x0), Y(top), p.w * s, p.h * s) }   // (floating ones: the platform's own color)
    const web = crackWeb(p, X, Y, look)
    ctx.lineJoin = 'miter'; ctx.lineCap = 'round'
    if (floor) {
      const [halo, line, core] = a.vein
      ctx.globalAlpha = 0.3; ctx.strokeStyle = halo; ctx.lineWidth = look.width * 4 * s; ctx.stroke(web)
      ctx.globalAlpha = 1; ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, look.width * s); ctx.stroke(web)
      ctx.strokeStyle = core; ctx.lineWidth = Math.max(0.5, look.width * 0.4 * s); ctx.stroke(web)
    } else {
      ctx.strokeStyle = a.crack; ctx.lineWidth = Math.max(1, look.width * s); ctx.stroke(web)
    }
    ctx.restore()
    ctx.fillStyle = floor ? a.vein[1] : theme.platformTop
    ctx.fillRect(X(x0), Y(top), p.w * s, 0.05 * s)
  },

  forest: (c, v, theme, hill, row) => {   // moonlit pines: three tiers, each with a lighter moonlit half
    const a = theme.art, far = row === 'far'
    const body = far ? mixHex(a.hills[0], a.moon, 0.1) : mixHex(a.pine, a.hills[1], 0.35)   // (far: a little lighter than its hill, so it stands out from the sky; middle: darker than its hill)
    const lit = far ? mixHex(a.hills[0], a.moon, 0.2) : mixHex(a.hills[1], a.moon, 0.08)
    for (const { x, base, h } of forestSpots(hill, FOREST[row])) litPine(c, v, x, base, h, body, lit)
  },
  bandedSky: (c, theme, X, Y, s) => {   // flat bands, each one's lower edge rolling in a gentle wave, like layers of haze
    c.fillStyle = theme.bands.at(-1)
    c.fillRect(X(0), Y(H), W * s, H * s)
    for (let i = theme.bands.length - 2, k = 0; i >= 0; i--, k++) {   // (from the bottom up: each band covers everything above its wavy lower edge)
      const edge = H * (1 - BAND_CUTS[i + 1])
      c.fillStyle = theme.bands[i]
      c.beginPath()
      c.moveTo(X(0), Y(H))
      for (let x = 0; x <= W + 0.01; x += 0.5) c.lineTo(X(x), Y(edge + 0.35 * Math.sin(x * 0.45 + k * 1.7)))
      c.lineTo(X(W), Y(H))
      c.closePath()
      c.fill()
    }
  },
  scarecrow: (c, v, x, base, h, color) => {   // tattered, on a crossbar: a sack head, a crooked hat, a ragged coat with a jagged hem and torn sleeves
    const u = h / 10, at = (dx, dy) => [x + dx * u, base + dy * u]   // (in tenths of its height)
    c.fillStyle = color
    ;[
      [at(-0.25, 0), at(0.25, 0), at(0.25, 6.2), at(-0.25, 6.2)],                                                   // pole
      [at(-3.4, 6.3), at(3.4, 6.3), at(3.4, 6.75), at(-3.4, 6.75)],                                                 // crossbar
      [at(-1.4, 3.2), at(-0.9, 3.8), at(-0.5, 3.1), at(0, 3.7), at(0.5, 3.0), at(0.9, 3.8), at(1.4, 3.3), at(1.1, 6.9), at(-1.1, 6.9)],   // coat, its hem jagged
      [at(1.0, 5.95), at(3.2, 5.9), at(2.9, 6.3), at(3.4, 6.5), at(3.0, 6.95), at(1.0, 6.9)],                       // torn sleeves
      [at(-1.0, 5.95), at(-3.2, 5.8), at(-2.8, 6.25), at(-3.4, 6.5), at(-3.0, 6.95), at(-1.0, 6.9)],
      [at(-1.6, 8.6), at(2.2, 8.1), at(2.25, 8.45), at(-1.55, 8.95)],                                               // hat brim, knocked crooked
      [at(-0.6, 8.55), at(1.1, 8.3), at(1.1, 9.8), at(-0.25, 9.95)],                                                // hat crown
    ].forEach(shape => { path(c, v, [shape]); c.fill() })   // (each on its own: overlapping shapes in one path can cancel out)
    disc(c, v.X(x), v.Y(base + 7.6 * u), 1.0 * u * v.s)   // head
  },
}

// --- drawing in the style guide's units ---

const K = W / 6   // style guide meters → game meters
export const mock = (X, Y, s) => ({ s: s * K, X: mx => X(mx * K), Y: my => Y((my - 0.6) * K) })
const rnd = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }   // (the style guide's: the same every time)
const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill() }
const path = (c, v, groups) => {
  c.beginPath()
  for (const pts of groups) { pts.forEach(([x, y], i) => (i ? c.lineTo(v.X(x), v.Y(y)) : c.moveTo(v.X(x), v.Y(y)))); c.closePath() }
}
// A flat shape with the shadow side: groups of [x, y] points; shift: style guide meters. Points on the
// view's edges or the ground are pushed a little past them, so the shadow side along those edges falls
// outside the view instead of showing as a stripe.
const bleed = ([x, y]) => [x <= 0 ? x - 0.3 : x >= 6 ? x + 0.3 : x, y <= 0.6 ? y - 0.3 : y]
function shadedPoly(c, v, theme, color, rawGroups, shift, dir) {
  const groups = rawGroups.map(pts => pts.map(bleed))
  const all = groups.flat(), xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const fill = (g, col) => { g.fillStyle = col; path(g, v, groups); g.fill() }
  drawShaded(c, {
    draw: g => fill(g, color), silhouette: fill,
    box: [v.X(Math.min(...xs)) - 6, v.Y(Math.max(...ys)) - 6, v.X(Math.max(...xs)) + 6, v.Y(Math.min(...ys)) + 6],
    shift: shift * v.s, tint: theme.shade, ...(dir && { dir }),
  })
}
const HILLS = [[1.2, 2.2, 1.1], [4.6, 2.6, 1.5]]   // [center x, x radius, height], on the ground
const FIELD_SUN = [3.9, 1.05, 1.05]               // Scarecrow Field's sun: [x, y, radius]
// The wheat along the top of each of Scarecrow Field's fields, in game meters: { every (m), height (m),
// fade (how far its colors fade toward the field's, with distance) }.
const FIELD_WHEAT = { far: { every: 0.3, h: 0.22, fade: 0.5 }, near: { every: 0.36, h: 0.3, fade: 0.25 } }
const FIELD_SCARECROW = { x: 2.12, h: 0.2, fade: 0.55 }    // and its scarecrow: where it stands (in the gap between the left field and the mound, so it doesn't read as a game piece), how tall, how faded into the far field
function hill(c, v, theme, [cx, rx, ry], color) {   // a rounded hill, its shadow side to the right
  const fill = (g, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(v.X(cx), v.Y(0.6), rx * v.s, ry * v.s, 0, Math.PI, TAU); g.closePath(); g.fill() }
  drawShaded(c, {
    draw: g => fill(g, color), silhouette: fill,
    box: [v.X(cx - rx) - 4, v.Y(0.6 + ry) - 4, v.X(cx + rx) + 4, v.Y(0.6) + 1], shift: 0.16 * v.s, tint: theme.shade, dir: [1, 0],
  })
}
function cloud(c, v, x, y, w, color) {
  const h = w * 0.26
  c.fillStyle = color
  c.beginPath(); c.roundRect(v.X(x - w / 2), v.Y(y + h), w * v.s, h * v.s, h * v.s / 2); c.fill()
  disc(c, v.X(x - w * 0.12), v.Y(y + h), w * 0.22 * v.s)
  disc(c, v.X(x + w * 0.14), v.Y(y + h * 0.9), w * 0.17 * v.s)
}
function moon(c, v, x, y, r, color, sky) {   // (sky: cut a crescent out of it, in the sky's color)
  c.fillStyle = color; disc(c, v.X(x), v.Y(y), r * v.s)
  if (sky) { c.fillStyle = sky; disc(c, v.X(x + r * 0.38), v.Y(y + r * 0.22), r * 0.85 * v.s) }
}
const waveAt = ([y, amp, freq, ph], x) => y + Math.sin(x * freq + ph) * amp   // (a wave's height at x)
const wave = (y, amp, freq, ph, x0 = 0, x1 = 6) => {   // a gently rolling hill line, closed down to the ground
  const pts = [[x0, 0.6]]
  for (let x = x0; x <= x1 + 0.001; x += 0.2) pts.push([x, y + Math.sin(x * freq + ph) * amp])
  pts.push([x1, 0.6])
  return pts
}
// Lit faces on a mountain range (points as for shadedPoly): on each peak, a lighter face from the peak
// down its slope on the light's side ('left', the default, or 'right'), split from the rest by a ridge
// running down from the peak.
function litFaces(c, v, pts, color, side = 'left') {
  c.fillStyle = color
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i], near = pts[side === 'left' ? i - 1 : i + 1], far = pts[side === 'left' ? i + 1 : i - 1]
    if (!(py > near[1] && py > far[1]) || near[0] <= 0 || near[0] >= 6) continue   // (peaks only, not ones cut by the view's edge)
    const foot = Math.max(near[1], far[1]) - (py - Math.max(near[1], far[1])) * 0.15
    path(c, v, [[[px, py], [near[0] + (px - near[0]) * 0.08, near[1] + (py - near[1]) * 0.08], [px + (far[0] - px) * 0.18, foot]]])
    c.fill()
  }
}
// An oval's outline (style guide meters).
const oval = (cx, cy, rx, ry, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * rx, cy + Math.sin(i / n * TAU) * ry])
// A smooth, rounded shape along a stream (along(u, side) gives [x, y, width] at u, 0..1 from its top,
// shifted across by side of its width): for its first `to` of its length, `side` across it, `share` of
// its width; its outline drawn as a smooth curve, so its ends come out round.
function blob(c, v, along, to, side, share, n = 60) {
  const L = [], R = []
  for (let i = 0; i <= n; i++) {
    const u = i / n * to, [x, y, w] = along(u, side), end = to < 1 ? Math.sqrt(Math.max(0, 1 - Math.max(0, (u - to * 0.75) / (to * 0.25)) ** 2)) : 1, h = w * share * end / 2
    L.push([x - h, y]); R.push([x + h, y])
  }
  const pts = [...L, ...R.reverse()], mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  let m = mid(pts.at(-1), pts[0])
  c.beginPath(); c.moveTo(v.X(m[0]), v.Y(m[1]))
  pts.forEach((p, i) => { m = mid(p, pts[(i + 1) % pts.length]); c.quadraticCurveTo(v.X(p[0]), v.Y(p[1]), v.X(m[0]), v.Y(m[1])) })
  c.fill()
}
// Snow caps on a mountain range's peaks (points as for shadedPoly): the top third of each, with a
// jagged lower edge; its left half in lit, its right in shade.
function snowCaps(c, v, pts, lit, shade) {
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i], [lx, ly] = pts[i - 1], [rx, ry] = pts[i + 1]
    if (!(py > ly && py > ry)) continue
    const L = [px + (lx - px) * 0.32, py + (ly - py) * 0.32], R = [px + (rx - px) * 0.32, py + (ry - py) * 0.32], base = (L[1] + R[1]) / 2
    const mid = [px, base + 0.04], z1 = [L[0] + (px - L[0]) * 0.5, base - 0.07], z2 = [px + (R[0] - px) * 0.5, base - 0.06]
    c.fillStyle = lit; path(c, v, [[[px, py], L, z1, mid]]); c.fill()
    c.fillStyle = shade; path(c, v, [[[px, py], mid, z2, R]]); c.fill()
  }
}
// A pine of three tiers, each with a lighter (lit) left half, on a short trunk; snow: snow lying along
// each tier's branch tips and a cap on top, in that color on the lit half and a little shaded on the
// other (or no snow).
function litPine(c, v, x, base, h, body, lit, snow) {
  c.fillStyle = body
  path(c, v, [[[x - 0.03, base], [x - 0.03, base + h * 0.2], [x + 0.03, base + h * 0.2], [x + 0.03, base]]]); c.fill()   // trunk
  const shaded = snow && mixHex(snow, body, 0.3)
  for (let k = 0; k < 3; k++) {
    const w = h * 0.36 * (1 - k * 0.24), y0 = base + h * (0.15 + k * 0.24), top = [x, y0 + h * 0.4]
    c.fillStyle = body; path(c, v, [[[x - w, y0], top, [x + w, y0]]]); c.fill()
    c.fillStyle = lit; path(c, v, [[[x - w, y0], top, [x, y0]]]); c.fill()
    if (!snow) continue
    const b = h * 0.06   // (the snow along its branch tips: bumpy, each half in its own light)
    for (const [d, color] of [[-1, snow], [1, shaded]]) {
      c.fillStyle = color
      path(c, v, [[[x, y0], [x + d * w, y0], [x + d * w * 0.8, y0 + b], [x + d * w * 0.55, y0 + b * 0.45], [x + d * w * 0.3, y0 + b * 1.1], [x, y0 + b * 0.6]]]); c.fill()
    }
    if (k < 2) continue
    const cap = top[1] - h * 0.14   // (and a cap on top, its lower edge jagged)
    c.fillStyle = snow; path(c, v, [[top, [x - w * 0.35, cap], [x - w * 0.17, cap - h * 0.03], [x, cap + h * 0.01]]]); c.fill()
    c.fillStyle = shaded; path(c, v, [[top, [x, cap + h * 0.01], [x + w * 0.17, cap - h * 0.03], [x + w * 0.35, cap]]]); c.fill()
  }
}
// A hill's (HILLS entry) top at x (style guide meters): the ground off its ends.
const hillTop = ([cx, rx, ry], x) => (Math.abs(x - cx) < rx ? 0.6 + ry * Math.sqrt(1 - ((x - cx) / rx) ** 2) : 0.6)
// How steep a hill (a HILLS entry) is at x: its rise per unit across.
const slopeAt = ([cx, rx, ry], x) => { const d = (x - cx) / rx; return -ry * d / (rx * Math.sqrt(Math.max(0.05, 1 - d * d))) }
// Points turned by ang (radians, + counterclockwise) round o.
const turn = (pts, [ox, oy], ang) => pts.map(([x, y]) => [ox + (x - ox) * Math.cos(ang) - (y - oy) * Math.sin(ang), oy + (x - ox) * Math.sin(ang) + (y - oy) * Math.cos(ang)])
// The same points, wound counterclockwise (so shapes filled together as one path never cancel out).
function ccw(pts) {
  let area = 0
  pts.forEach(([x1, y1], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1 })
  return area < 0 ? [...pts].reverse() : pts
}
// A tree's polygons, from a limb standing at x, y: { a (degrees from straight up, + to the right), len,
// w (its width at its base), end (its width at the tip; by default as wide as the widest limb going on
// from its tip, or 0: a spike), kids: [{ at (0..1 along it), ...a limb }] }. Every limb but the root
// starts a little back inside the one it grows from, so no joint shows a gap.
function limbs(l, x, y, root, out = []) {
  const a = l.a * Math.PI / 180, dx = Math.sin(a), dy = Math.cos(a)
  const ends = (l.kids || []).filter(k => k.at === 1).map(k => k.w)
  const w1 = l.end ?? (ends.length ? Math.max(...ends) : 0)
  const sx = root ? x : x - dx * l.w * 0.6, sy = root ? y : y - dy * l.w * 0.6, ex = x + dx * l.len, ey = y + dy * l.len
  out.push(ccw([[sx - dy * l.w / 2, sy + dx * l.w / 2], [sx + dy * l.w / 2, sy - dx * l.w / 2], [ex + dy * w1 / 2, ey - dx * w1 / 2], [ex - dy * w1 / 2, ey + dx * w1 / 2]]))
  for (const k of l.kids || []) limbs(k, x + dx * l.len * k.at, y + dy * l.len * k.at, false, out)
  return out
}
// One grave with its foot at x, y, turned by tilt (radians): a round-topped stone or a cross, w wide, h tall.
function grave(c, v, theme, [x, w, h, kind], y, tilt, color) {
  const shape = kind === 'cross'
    ? [[[x - w / 2, y], [x - w / 2, y + h], [x + w / 2, y + h], [x + w / 2, y]], [[x - w * 2, y + h * 0.62], [x - w * 2, y + h * 0.62 + w], [x + w * 2, y + h * 0.62 + w], [x + w * 2, y + h * 0.62]]]
    : [[[x - w / 2, y], ...Array.from({ length: 9 }, (_, i) => { const t = Math.PI - i / 8 * Math.PI; return [x + Math.cos(t) * w / 2, y + h - w / 2 + Math.sin(t) * w / 2] }), [x + w / 2, y]]]
  const groups = shape.map(g => ccw(turn(g, [x, y], tilt)))
  if (kind === 'cross') { c.fillStyle = color; path(c, v, groups); c.fill(); return }   // (crosses flat: they're too thin for a shadow side, which only blends them into the sky)
  shadedPoly(c, v, theme, color, groups, 0.025, [1, 0])   // (shaded sideways only)
}
// An iron fence ({ from, to, every, h }) whose pickets (spear-tipped) stand on footAt(x), with two rails.
function fence(c, v, color, { from, to, every, h }, footAt) {
  c.fillStyle = color
  for (let x = from; x <= to; x += every) {
    const y = footAt(x)
    c.fillRect(v.X(x - 0.014), v.Y(y + h), 0.028 * v.s, h * v.s)
    path(c, v, [[[x - 0.033, y + h], [x, y + h + 0.065], [x + 0.033, y + h]]]); c.fill()
  }
  c.strokeStyle = color; c.lineWidth = 0.022 * v.s
  for (const dy of [h * 0.5, h * 0.9]) {
    c.beginPath()
    for (let x = from; x <= to + 0.001; x += 0.1) c.lineTo(v.X(x), v.Y(footAt(x) + dy))
    c.stroke()
  }
}
// Where a forest's trees stand across a hill, only on the hill (so none stand in the foreground):
// [count, smallest height, how much taller they get] (style guide meters), placed the same every time.
// Gives [{ x, base, h, i }].
const FOREST = { far: [26, 0.16, 0.12], mid: [16, 0.24, 0.14] }
function forestSpots(hill, [n, h0, dh]) {
  const [cx, rx] = hill
  return Array.from({ length: n }, (_, i) => {
    const x = cx - rx * 0.92 + (i + 0.2 + rnd(i * 3 + n) * 0.6) / n * rx * 1.84
    return { x, base: hillTop(hill, x) - 0.03, h: h0 + rnd(i * 7 + n) * dh, i }
  })
}
// The stars, in game meters (tiny at any scale, unlike the rest of the scenery): over the upper sky.
// Graveyard (style guide meters): its hills (far: tall, so plenty of it shows over the arena floor;
// near), where things on the far hill stand (cut off at its surface), its fence, its graves along the
// crest ([x, width, height, kind]) and its tree (a limb, as limbs() takes, drawn `size` times bigger).
const GRAVE_HILLS = [[4.5, 2.2, 1.35], [1.0, 2.0, 0.75]]
const GRAVE_SPAN = [2.2, 6.8]
const GRAVE_FENCE = { from: 3.4, to: 5.6, every: 0.16, h: 0.22 }
const GRAVES = [[3.6, 0.15, 0.2, 'stone'], [3.95, 0.04, 0.26, 'cross'], [4.3, 0.16, 0.22, 'stone'], [4.7, 0.15, 0.2, 'stone'], [5.05, 0.04, 0.24, 'cross'], [5.4, 0.15, 0.2, 'stone']]
const GRAVE_TREE = {
  size: 1.3,
  trunk: { a: -3, len: 0.6, w: 0.13, kids: [
    { at: 0.3, a: 62, len: 0.2, w: 0.035 },
    { at: 0.5, a: -55, len: 0.42, w: 0.06, kids: [{ at: 0.3, a: -100, len: 0.12, w: 0.02 }, { at: 0.55, a: -15, len: 0.24, w: 0.03 }, { at: 1, a: -80, len: 0.16, w: 0.025 }] },
    { at: 0.75, a: 50, len: 0.48, w: 0.055, kids: [{ at: 0.5, a: 8, len: 0.26, w: 0.028, kids: [{ at: 0.6, a: 45, len: 0.1, w: 0.014 }] }, { at: 1, a: 78, len: 0.15, w: 0.022 }, { at: 1, a: 30, len: 0.14, w: 0.02 }] },
    { at: 1, a: -18, len: 0.42, w: 0.075, kids: [
      { at: 0.45, a: 28, len: 0.26, w: 0.03, kids: [{ at: 0.5, a: -10, len: 0.1, w: 0.014 }] }, { at: 0.7, a: -70, len: 0.16, w: 0.022 },
      { at: 1, a: -42, len: 0.2, w: 0.028 }, { at: 1, a: 10, len: 0.24, w: 0.028 },
    ] },
  ] },
}
const LAVA_RANGES = {   // Lava's mountains (style guide meters, as shadedPoly takes them): a far range, a ridge (its end tucked behind the volcano), the volcano
  far: [[0, 0.6], [0, 1.9], [0.7, 2.25], [1.4, 1.95], [2.1, 2.3], [2.9, 1.9], [3.7, 2.1], [4.3, 1.8], [4.3, 0.6]],
  ridge: [[0, 0.6], [0, 1.45], [0.8, 1.75], [1.5, 1.4], [2.2, 1.65], [3.0, 1.35], [3.6, 1.5], [4.3, 1.2], [4.3, 0.6]],
  volcano: [[3.3, 0.6], [4.45, 2.35], [5.05, 2.35], [6.3, 0.6]],
}
// Lava's crater (an oval: its middle, x and y radii), its pool (how many bubbles, how big; the width of
// the dashes sliding down the streams) and its streams of lava: where each starts ([x, 'pool']: in the
// pool: its top at the near rim, the bottom of the opening) and ends (behind the arena floor, mostly), its width at the top and bottom, how much it bulges
// and narrows along the way, how it wanders (amp, freq, phase).
const LAVA_CRATER = { x: 4.75, y: 2.35, rx: 0.3, ry: 0.09 }
const LAVA_POOL = { bubbles: 4, bubble: 0.032, streak: 0.016, tuck: 0.025 }   // (tuck: how far up into the pool a stream's orange body reaches, hidden there: below its shimmer)
const LAVA_STREAMS = [   // (drawn in this order: a branch first, so the stream it leaves covers where it starts)
  { from: [4.6, 'pool'], to: [4.3, 1.6], w: [0.07, 0.06], bulge: 0.25, amp: 0.03, freq: 4, phase: 2 },   // (a smaller one down the left)
  { from: [4.77, 1.95], to: [5.08, 1.3], w: [0.07, 0.08], bulge: 0.25, amp: 0.04, freq: 4, phase: 1 },   // (a branch off the main one, to the right)
  { from: [4.8, 'pool'], to: [4.68, 1.1], w: [0.13, 0.2], bulge: 0.2, amp: 0.06, freq: 5, phase: 0.3 },   // (the main one, down the front)
]
const GRAVE_CLOUDS = [[1.0, 3.25, 1.6], [2.95, 3.55, 1.2], [4.45, 2.42, 1.4], [5.85, 3.25, 1.2]]   // Graveyard's clouds: [x, y (its base), width]
const SYNTH_SUN = [3, 1.55, 1.05]   // Synthwave's sun: [x, y, radius]
const STARS = Array.from({ length: 60 }, (_, i) => ({ x: rnd(i + 90) * W, y: 6.5 + rnd(i + 91) * (H - 6.8), r: i % 4 ? 0.035 : 0.06 }))

// --- the scenery, by theme.scenery: c (the backdrop cache), theme, X, Y, s (game meters) ---

const SCENERY = {
  hills: (c, theme, X, Y, s) => {   // a sun, two clouds, two rolling hills
    const v = mock(X, Y, s), a = theme.art
    c.fillStyle = a.sun; disc(c, v.X(0.55), v.Y(3.0), 0.36 * v.s)
    cloud(c, v, 2.1, 3.05, 0.7, a.cloud); cloud(c, v, 4.35, 3.3, 0.5, a.cloud)
    hill(c, v, theme, HILLS[1], a.hills[0]); hill(c, v, theme, HILLS[0], a.hills[1])
  },
  barn: (c, theme, X, Y, s) => {   // plank walls, posts, a round window in the middle, a tie beam and crossed rafters, stacked hay
    const v = mock(X, Y, s), a = theme.art, top = Y(H), floor = v.Y(0.6)
    c.fillStyle = a.plank
    for (let x = 0.3; x < 6; x += 0.6) c.fillRect(v.X(x), top, 0.3 * v.s, floor - top)
    moon(c, v, 3, 2.2, 0.42, a.beam); moon(c, v, 3, 2.2, 0.34, a.light)   // (the round window, in the middle)
    c.fillStyle = a.beam
    c.fillRect(v.X(3) - 0.03 * v.s, v.Y(2.54), 0.06 * v.s, 0.68 * v.s)
    c.fillRect(v.X(2.66), v.Y(2.2) - 0.03 * v.s, 0.68 * v.s, 0.06 * v.s)
    for (const x of [0, 2, 4, 6]) c.fillRect(v.X(x - 0.08), top, 0.16 * v.s, floor - top)
    c.fillRect(X(0), v.Y(3.05), W * s, 0.14 * v.s)
    c.strokeStyle = a.beam; c.lineWidth = 0.1 * v.s; c.beginPath()   // (the rafters: a beam's width is its line)
    for (const x0 of [0, 2, 4]) { c.moveTo(v.X(x0), v.Y(3.6)); c.lineTo(v.X(x0 + 2), v.Y(3.0)); c.moveTo(v.X(x0 + 2), v.Y(3.6)); c.lineTo(v.X(x0), v.Y(3.0)) }
    c.stroke()
    for (const [x, w, h] of [[0.75, 0.8, 0.44], [1.5, 0.55, 0.3], [5.15, 0.8, 0.46]]) {
      shadedPoly(c, v, theme, a.hay, [[[x - w / 2, 0.6], [x - w / 2, 0.6 + h], [x + w / 2, 0.6 + h], [x + w / 2, 0.6]]], 0.04)
      c.fillStyle = mixHex(a.hay, a.beam, 0.3)
      for (const k of [0.33, 0.66]) c.fillRect(v.X(x - w / 2 + 0.06), v.Y(0.6 + h * k), (w - 0.12) * v.s, Math.max(1, 0.025 * v.s))
    }
  },
  field: (c, theme, X, Y, s) => {   // a big low sun, two rolling fields of wheat, a small scarecrow far off in the far one
    const v = mock(X, Y, s), a = theme.art
    c.fillStyle = a.sun; disc(c, v.X(FIELD_SUN[0]), v.Y(FIELD_SUN[1]), FIELD_SUN[2] * v.s)
    const far = [1.3, 0.13, 1.3, 0.5], near = [0.98, 0.1, 1.7, 1.2]   // (each field's wave: height, swell, how often, where it starts)
    shadedPoly(c, v, theme, a.hills[0], [wave(...far)], 0.12)
    const sx = FIELD_SCARECROW.x   // (standing in the far field's wheat, so the near field hides its feet; faded toward it with distance)
    PARTS.scarecrow(c, v, sx, waveAt(far, sx) - 0.03, FIELD_SCARECROW.h, mixHex(a.scarecrow, a.hills[0], FIELD_SCARECROW.fade))
    wheatRow(c, theme, X, Y, s, v, far, FIELD_WHEAT.far, a.hills[0])
    shadedPoly(c, v, theme, a.hills[1], [wave(...near)], 0.1)
    wheatRow(c, theme, X, Y, s, v, near, FIELD_WHEAT.near, a.hills[1])
  },
  rocks: (c, theme, X, Y, s) => {   // a pale sun, far peaks, nearer rocks, a few boulders; each with a lit face on its left (the sun's side)
    const v = mock(X, Y, s), a = theme.art
    c.fillStyle = a.sun; disc(c, v.X(4.55), v.Y(2.7), 0.3 * v.s)
    const far = [[0, 0.6], [0, 1.9], [0.6, 2.4], [1.2, 2.0], [1.9, 2.8], [2.7, 2.1], [3.4, 2.6], [4.2, 2.0], [4.9, 2.6], [5.6, 2.15], [6, 2.45], [6, 0.6]]
    const near = [[0, 0.6], [0, 1.2], [0.5, 1.5], [1.1, 1.15], [1.6, 1.45], [2.3, 1.0], [3.0, 1.3], [3.6, 0.95], [4.3, 1.4], [5.0, 1.05], [5.6, 1.35], [6, 1.1], [6, 0.6]]
    shadedPoly(c, v, theme, a.hills[0], [far], 0.14); litFaces(c, v, far, mixHex(a.hills[0], '#ffffff', 0.16))
    shadedPoly(c, v, theme, a.hills[1], [near], 0.1); litFaces(c, v, near, mixHex(a.hills[1], '#ffffff', 0.12))
    for (const [x, w, h] of [[1.0, 0.36, 0.26], [4.05, 0.3, 0.2], [5.45, 0.42, 0.3]]) {
      shadedPoly(c, v, theme, a.hills[2], [[[x - w, 0.6], [x - w * 0.6, 0.6 + h], [x + w * 0.3, 0.6 + h * 1.1], [x + w, 0.6]]], 0.05)
      c.fillStyle = mixHex(a.hills[2], '#ffffff', 0.12)   // (its lit left face)
      path(c, v, [[[x - w, 0.6], [x - w * 0.6, 0.6 + h], [x - w * 0.15, 0.6 + h * 1.05], [x - w * 0.3, 0.6]]]); c.fill()
    }
  },
  camp: (c, theme, X, Y, s) => {   // stars, a crescent moon, two hills with a forest of small pines on each
    const v = mock(X, Y, s), a = theme.art
    c.fillStyle = a.moon
    for (const st of STARS) disc(c, X(st.x), Y(st.y), st.r * s)
    moon(c, v, 4.9, 3.0, 0.32, a.moon, theme.sky)
    hill(c, v, theme, HILLS[1], a.hills[0])
    PARTS.forest(c, v, theme, HILLS[1], 'far')
    hill(c, v, theme, HILLS[0], a.hills[1])
    PARTS.forest(c, v, theme, HILLS[0], 'mid')
  },
  winter: (c, theme, X, Y, s) => {   // a low sun, snowy mountains, two snowy hills with snow-capped pines on them
    const v = mock(X, Y, s), a = theme.art
    c.fillStyle = a.sun; disc(c, v.X(0.6), v.Y(3.05), 0.3 * v.s)
    const peaks = [[0, 0.6], [0, 1.6], [0.9, 2.6], [1.7, 1.9], [2.6, 2.9], [3.6, 1.8], [4.5, 2.5], [5.3, 1.9], [6, 2.3], [6, 0.6]], rock = mixHex(a.hills[0], a.pine, 0.22)
    shadedPoly(c, v, theme, rock, [peaks], 0.18)   // (bare rock, its sunny faces lighter, snow on top)
    litFaces(c, v, peaks, mixHex(rock, a.snow, 0.45))
    snowCaps(c, v, peaks, a.snow, mixHex(a.snow, rock, 0.35))
    hill(c, v, theme, HILLS[1], a.hills[1])
    for (const { x, base, h } of forestSpots(HILLS[1], FOREST.far)) litPine(c, v, x, base, h, mixHex(a.pine, a.hills[1], 0.45), mixHex(a.pine, a.hills[1], 0.62), a.snow)
    hill(c, v, theme, HILLS[0], a.hills[2])
    for (const { x, base, h } of forestSpots(HILLS[0], FOREST.mid)) litPine(c, v, x, base, h, a.pine, mixHex(a.pine, a.hills[2], 0.25), a.snow)
  },
  lava: (c, theme, X, Y, s) => {   // ranges and a volcano (its lava and smoke move: ANIMATED)
    PARTS.lavaLand(c, mock(X, Y, s), theme, X, Y, s)
  },
  synth: (c, theme, X, Y, s) => {   // stars, a striped sun sinking behind purple peaks (the grid floor moves: ANIMATED)
    const v = mock(X, Y, s), a = theme.art, [cx, cy, r] = SYNTH_SUN
    c.fillStyle = a.star
    for (const st of STARS) disc(c, X(st.x), Y(st.y), st.r * s)
    c.save()   // the sun: solid on top, stripes with growing gaps below
    c.beginPath(); c.arc(v.X(cx), v.Y(cy), r * v.s, 0, TAU); c.clip()
    c.fillStyle = a.sun; c.fillRect(v.X(cx - r), v.Y(cy + r), 2 * r * v.s, (r - 0.1) * v.s)
    c.fillStyle = a.sunStripes
    for (let y = cy + 0.1, gap = 0.035, h = 0.17; y > cy - r; y -= h + gap, gap += 0.025, h = Math.max(0.05, h - 0.02)) c.fillRect(v.X(cx - r), v.Y(y), 2 * r * v.s, h * v.s)
    c.restore()
    const hz = 1.0
    const left = [[0, hz], [0, 1.55], [0.55, 2.05], [1.05, 1.6], [1.55, 1.95], [2.25, 1.25], [2.5, hz]], right = [[3.5, hz], [3.85, 1.3], [4.4, 1.85], [4.95, 1.5], [5.45, 2.1], [6, 1.6], [6, hz]]
    shadedPoly(c, v, theme, a.hills[0], [left, right], 0.14)
    const rim = mixHex(a.hills[0], a.sunStripes, 0.35)   // (each peak's face toward the sun lit pink)
    litFaces(c, v, left, rim, 'right'); litFaces(c, v, right, rim, 'left')
    const nearL = [[0, hz], [0, 1.2], [0.7, 1.45], [1.4, hz]], nearR = [[4.7, hz], [5.3, 1.4], [6, 1.15], [6, hz]]
    shadedPoly(c, v, theme, a.hills[1], [nearL, nearR], 0.1)
    const rim2 = mixHex(a.hills[1], a.sunStripes, 0.3)
    litFaces(c, v, nearL, rim2, 'right'); litFaces(c, v, nearR, rim2, 'left')
  },
  graveyard: (c, theme, X, Y, s) => {   // a big pale moon, clouds, an iron fence and graves on the far hill, a bare tree on the near one
    const v = mock(X, Y, s), a = theme.art
    moon(c, v, 4.85, 2.85, 0.48, a.moon)
    PARTS.graveClouds(c, v, theme)
    PARTS.graves(c, v, theme)
    hill(c, v, theme, GRAVE_HILLS[1], a.hills[1])
    PARTS.graveTree(c, v, theme)
  },
  grid: (c, theme, X, Y, s) => {   // graph paper, in game meters: thin lines every 1 m, thicker ones every 4 m
    c.strokeStyle = theme.art.grid
    for (const [step, width] of [[1, 0.03], [4, 0.08]]) {
      c.lineWidth = Math.max(1, width * s)
      c.beginPath()
      for (let x = 0; x <= W; x += step) { c.moveTo(X(x), Y(H)); c.lineTo(X(x), Y(0)) }
      for (let y = 0; y <= H; y += step) { c.moveTo(X(0), Y(y)); c.lineTo(X(W), Y(y)) }
      c.stroke()
    }
  },
}

// Scenery that moves, drawn live every frame over the cached backdrop and behind the platforms, by
// theme.scenery: (ctx, theme, X, Y, s, t). Ground-level pieces are placed in game meters (they have
// to sit right with the platforms: docs/RESTYLE_PLAN.md section 6).
const SMOKE = { puffs: 8, rise: 0.14, grow: 0.18, fade: 0.5 }   // the volcano's: how many puffs, how many times a second each rises its whole way, the share of its rise it takes to grow in, and where (of its rise) it starts fading out
const ease = u => u * u * (3 - 2 * u)   // (0..1, starting and ending gently)
const SYNTH_FLOOR = { horizon: 3, lines: 9, scroll: 0.8 }   // m, horizontal lines, lines per second toward you
const ANIMATED = {
  lava: (ctx, theme, X, Y, s, t) => {   // the lava in the volcano's crater and down it, smoke rising from it
    const v = mock(X, Y, s), a = theme.art
    PARTS.lavaFlow(ctx, v, theme, t)
    for (let k = 0; k < SMOKE.puffs; k++) {   // (each puff: growing out of the crater from nothing, lit orange by the lava, then ash, blown right as it rises and spreads, thinning out to nothing in the sky)
      const q = (t * SMOKE.rise + k / SMOKE.puffs) % 1
      const r = (0.07 + q * 0.13) * ease(Math.min(1, q / SMOKE.grow)) * v.s
      const x = v.X(4.75 + q * 0.75 + Math.sin(q * 6 + k * 2.1) * 0.05), y = v.Y(2.4 + q * 1.0)
      ctx.globalAlpha = 1 - ease(Math.max(0, (q - SMOKE.fade) / (1 - SMOKE.fade)))
      ctx.fillStyle = mixHex(mixHex(a.glow, a.ash, Math.min(1, q * 5)), theme.bands[1], q * 0.85)
      ctx.beginPath()   // (its three rounds as one shape, so they don't darken where they overlap as it fades)
      for (const [dx, dy, k2] of [[0, 0, 1], [-0.75, 0.25, 0.7], [0.7, 0.3, 0.6]]) { ctx.moveTo(x + dx * r + r * k2, y + dy * r); ctx.arc(x + dx * r, y + dy * r, Math.max(0.1, r * k2), 0, TAU) }
      ctx.fill()
    }
    ctx.globalAlpha = 1
  },
  synth: (ctx, theme, X, Y, s, t) => {   // a neon grid floor rolling toward you, up to the horizon
    const a = theme.art, hz = SYNTH_FLOOR.horizon
    ctx.fillStyle = a.floor
    ctx.fillRect(X(0), Y(hz), W * s, hz * s + 1)
    ctx.strokeStyle = a.grid
    ctx.lineWidth = Math.max(1, 0.06 * s)
    ctx.beginPath()
    for (let i = -14; i <= 14; i++) { ctx.moveTo(X(W / 2 + i * 0.85), Y(hz)); ctx.lineTo(X(W / 2 + i * 6.4), Y(0)) }
    for (let k = 0; k < SYNTH_FLOOR.lines; k++) { const d = (k + (t * SYNTH_FLOOR.scroll) % 1) / (SYNTH_FLOOR.lines - 1), y = hz - d * d * hz; ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(W), Y(y)) }
    ctx.stroke()
    ctx.fillStyle = a.grid
    ctx.fillRect(X(0), Y(hz) - Math.max(1, 0.065 * s), W * s, Math.max(2, 0.13 * s))   // (the horizon line)
  },
}

// Weather, drawn over everything in the world (the players, gourds and effects too), by theme.scenery:
// (ctx, theme, X, Y, s, t). In game meters: little flakes and embers at any size of screen.
const WEATHER = {
  winter: (ctx, theme, X, Y, s, t) => {   // snow drifting down, swaying a little
    ctx.fillStyle = theme.art.flakes
    for (let i = 0; i < 140; i++) {
      const fall = 1.3 + rnd(i + 200) * 1.6, y = H + 1 - ((rnd(i + 201) * (H + 2) + t * fall) % (H + 2)), x = rnd(i + 202) * (W + 2) - 1 + Math.sin(t * 1.3 + i) * 0.4
      disc(ctx, X(x), Y(y), (0.04 + rnd(i + 203) * 0.04) * s)
    }
  },
  lava: (ctx, theme, X, Y, s, t) => {   // embers rising and shrinking away
    ctx.fillStyle = theme.art.ember
    for (let i = 0; i < 70; i++) {
      const rise = 1.6 + rnd(i + 300) * 2.1, y = (rnd(i + 301) * H + t * rise) % H, x = rnd(i + 302) * W + Math.sin(t * 2 + i) * 0.4
      const r = (0.05 + rnd(i + 303) * 0.05) * (1 - y / (H + 1)) * s, turn = t * 2 + i
      if (r < 0.4) continue
      ctx.beginPath()
      for (let k = 0; k < 4; k++) ctx.lineTo(X(x) + Math.cos(turn + k * Math.PI / 2) * r, Y(y) + Math.sin(turn + k * Math.PI / 2) * r)
      ctx.fill()
    }
  },
}
export const drawWeather = (ctx, theme, X, Y, s) => WEATHER[theme.scenery]?.(ctx, theme, X, Y, s, Date.now() / 1000)

// --- platforms ---

function drawPlatform(ctx, theme, p, X, Y, s) {
  ctx.fillStyle = p.wall ? theme.wall : theme.platform
  ctx.fillRect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * s, p.h * s)
  if (!p.wall) TOPS[theme.top](ctx, theme, p, X, Y, s)
}
const hash = n => rnd(n * 17.3 + 0.5)   // (a platform's own fixed randomness: from its position)
// Lava's platforms: how thick one has to be to count as the floor (m), and each look's crack web:
// cell (m across), width (m), drop (the share of cracks left out, so cells merge into odd shapes),
// twigs (the share of cells with a short dead-end crack into them).
const LAVA_ROCK = {
  floor: 1,
  cooled: { cell: 0.3, width: 0.022, drop: 0.2, twigs: 0.3 },
  molten: { cell: 0.45, width: 0.035, drop: 0.25, twigs: 0.35 },
}
const n2 = (i, j, k) => {   // (fixed randomness per grid spot: an integer hash, so no rows or columns come out alike)
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
// The crack web over a platform, as one path (screen px): the corners of a jittered grid of cells
// (fixed to the world, so it never shifts), each joined to its right and upper neighbours by a kinked
// line, except a share left out so cells merge into bigger, odd ones; plus short dead-end cracks into
// some cells.
function crackWeb(p, X, Y, { cell, drop, twigs }) {
  const x0 = p.x - p.w / 2, top = p.y + p.h / 2, bottom = top - p.h
  const at = (i, j) => [(i + 0.5 + (n2(i, j, 1) - 0.5) * 0.8) * cell, (j + 0.5 + (n2(i, j, 2) - 0.5) * 0.8) * cell]
  const web = new Path2D()
  for (let i = Math.floor(x0 / cell) - 1; i <= Math.ceil((x0 + p.w) / cell); i++) {
    for (let j = Math.floor(bottom / cell) - 1; j <= Math.ceil(top / cell); j++) {
      const a = at(i, j)
      for (const [di, dj, k] of [[1, 0, 3], [0, 1, 4]]) {
        if (n2(i, j, k) < drop) continue
        const b = at(i + di, j + dj), kink = (n2(i, j, k + 5) - 0.5) * cell * 0.35
        web.moveTo(X(a[0]), Y(a[1]))
        web.lineTo(X((a[0] + b[0]) / 2 - (b[1] - a[1]) / cell * kink), Y((a[1] + b[1]) / 2 + (b[0] - a[0]) / cell * kink))
        web.lineTo(X(b[0]), Y(b[1]))
      }
      if (n2(i, j, 9) < twigs) {
        const ang = n2(i, j, 10) * Math.PI * 2, len = cell * (0.25 + n2(i, j, 11) * 0.3)
        web.moveTo(X(a[0]), Y(a[1])); web.lineTo(X(a[0] + Math.cos(ang) * len), Y(a[1] + Math.sin(ang) * len))
      }
    }
  }
  return web
}
const strip = (ctx, theme, p, X, Y, s, h) => { ctx.fillStyle = theme.platformTop; ctx.fillRect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * s, Math.min(h, p.h) * s) }

// A platform's top, by theme.top (in game meters): (ctx, theme, p, X, Y, s).
const TOPS = {
  grass: (ctx, theme, p, X, Y, s) => strip(ctx, theme, p, X, Y, s, 0.14),
  snow: (ctx, theme, p, X, Y, s) => {   // a thick strip of snow with drips of it hanging off its lower edge
    strip(ctx, theme, p, X, Y, s, 0.16)
    const top = p.y + p.h / 2
    for (let x = p.x - p.w / 2 + 0.18, i = 0; x < p.x + p.w / 2 - 0.1; x += 0.35, i++) disc(ctx, X(x), Y(top - 0.16), (0.06 + hash(p.x + i) * 0.04) * s)
  },
  lava: (...args) => PARTS.lavaTop(...args),
  metal: (ctx, theme, p, X, Y, s) => {   // a glowing strip, a dark band under it, a dark frame round its sides and bottom
    const x0 = p.x - p.w / 2, top = p.y + p.h / 2, e = 0.035
    ctx.save()
    ctx.beginPath(); ctx.rect(X(x0), Y(top), p.w * s, p.h * s); ctx.clip()
    ctx.fillStyle = theme.art.seam
    ctx.fillRect(X(x0), Y(top - 0.07), p.w * s, 0.04 * s)
    ctx.fillStyle = theme.art.frame
    ctx.fillRect(X(x0), Y(top), e * s, p.h * s); ctx.fillRect(X(x0 + p.w - e), Y(top), e * s, p.h * s); ctx.fillRect(X(x0), Y(top - p.h + e), p.w * s, e * s)
    ctx.restore()
    strip(ctx, theme, p, X, Y, s, 0.07)
  },
  soil: (ctx, theme, p, X, Y, s) => {   // a strip with tufts of grass sticking up
    strip(ctx, theme, p, X, Y, s, 0.1)
    const top = p.y + p.h / 2
    ctx.fillStyle = theme.platformTop
    for (let x = p.x - p.w / 2 + 0.2, i = 0; x < p.x + p.w / 2 - 0.1; x += 0.45, i++) {
      const h = 0.08 + hash(p.x * 2 + i) * 0.06
      ctx.beginPath(); ctx.moveTo(X(x - 0.05), Y(top - 0.01)); ctx.lineTo(X(x - 0.01), Y(top + h)); ctx.lineTo(X(x + 0.05), Y(top - 0.01)); ctx.fill()
    }
  },
  wheat: (ctx, theme, p, X, Y, s) => strip(ctx, theme, p, X, Y, s, 0.12),   // (a golden strip; the wheat itself grows on the backdrop's fields, not where players stand)
  planks: (ctx, theme, p, X, Y, s) => {   // a strip, then plank seams across the face, with joints staggered between rows
    strip(ctx, theme, p, X, Y, s, 0.12)
    const x0 = p.x - p.w / 2, top = p.y + p.h / 2, bottom = p.y - p.h / 2, seam = 0.025
    ctx.save()
    ctx.beginPath(); ctx.rect(X(x0), Y(top), p.w * s, p.h * s); ctx.clip()
    ctx.fillStyle = theme.art.seam
    for (let row = 0, y = top - 0.12; y > bottom; row++, y -= 0.3) {
      ctx.fillRect(X(x0), Y(y), p.w * s, seam * s)
      for (let x = x0 + (row % 2 ? 0.6 : 1.2); x < x0 + p.w; x += 1.2) ctx.fillRect(X(x) - seam / 2 * s, Y(y), seam * s, 0.3 * s)
    }
    ctx.restore()
  },
}

// One wheat stalk (flat: a thin stem, an ellipse head) standing at (x, y) m, h tall (k: its thickness and head, scaled).
function wheatStalk(ctx, X, Y, s, x, y, h, k, stem, head) {
  ctx.fillStyle = stem
  ctx.beginPath()
  ctx.moveTo(X(x - 0.0125 * k), Y(y)); ctx.lineTo(X(x + 0.0125 * k), Y(y))
  ctx.lineTo(X(x + 0.0425 * k), Y(y + h)); ctx.lineTo(X(x + 0.0175 * k), Y(y + h))
  ctx.fill()
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.ellipse(X(x + 0.03 * k), Y(y + h + 0.06 * k), 0.035 * k * s, 0.08 * k * s, 0, 0, TAU)
  ctx.fill()
}
// A row of wheat along the top of one of the backdrop's fields (its wave, in style guide meters), a
// little smaller and faded toward the field's color with distance.
function wheatRow(c, theme, X, Y, s, v, field, { every, h, fade }, fieldColor) {
  const k = h / 0.35, stem = mixHex(theme.art.stem, fieldColor, fade), head = mixHex(theme.art.wheat, fieldColor, fade)
  for (let x = every / 2, i = 0; x < W; x += every, i++) {
    const y = (waveAt(field, x / K) - 0.6) * K - 0.04   // (just into the field's top)
    wheatStalk(c, X, Y, s, x + (rnd(i) - 0.5) * every * 0.5, y, h * (0.8 + rnd(i + 50) * 0.4), k, stem, head)
  }
}

// A moving platform's route: a faint dashed rail between the two ends, with a bolt at each.
function drawMoverTrack(ctx, theme, m, X, Y, s) {
  ctx.strokeStyle = hexA(theme.muted, 0.45)
  ctx.lineWidth = Math.max(1, 0.06 * s)
  ctx.setLineDash([0.2 * s, 0.15 * s])
  ctx.beginPath()
  ctx.moveTo(X(m.x), Y(m.y))
  ctx.lineTo(X(m.x2), Y(m.y2))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = hexA(theme.muted, 0.6)
  for (const [x, y] of [[m.x, m.y], [m.x2, m.y2]]) {
    ctx.beginPath()
    ctx.arc(X(x), Y(y), 0.1 * s, 0, TAU)
    ctx.fill()
  }
}

// The drawing helpers, for the effects lab's tries (src/lab/variants.js).
export const TOOLS = { rnd, disc, path, shadedPoly, hillTop, hill, litFaces, strip, hash, mock, ccw, limbs, grave, fence, slopeAt, GRAVE_HILLS }
