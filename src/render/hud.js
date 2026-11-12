// Drawing the text over the game: match info, scores, the winner banner, popups (damage numbers, KO!),
// the message in the middle, the crosshair and debug info.
// Match info at the top. No score numbers during a round (the leader wears a crown); the
// scores show during the pan to the next map and at the end of the match. Health bars only in
// debug mode: it's more fun when nobody knows exactly how much health is left.
// It all stands out on every map: chips and score tiles are shapes on a ledge, in ink on light maps and
// paper on dark ones (see hudSurface); small text gets a paper outline; banners get a dark outline and
// drop like the logo. Colors: UI (palette.js) and the players' own (the map's only picks ink or paper,
// and colors the debug lines). Fonts: the display font
// for everything but the banner's sub-line (the text font) and the debug lines (monospace).

import { CONFIG, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../config.js'
import { matchInfoText } from '../game/match.js'
import { skyColor } from '../maps/themes.js'
import { UI, font } from './palette.js'
import { mixHex } from '../util/color.js'
import { clamp } from '../util/math.js'

// What chips, score tiles and the harvest bubble and ring are made of: { face, ledge, text } colors.
// Ink on a map with a light sky and paper on a dark one, so they always stand out. During the pan to
// the next map they fade from one map's look to the other's, along with the camera (t: 0 → 1); the text
// flips between ink and paper halfway (to whichever stands out more on the face right then), so it
// never fades into the face.
const PAPER = { face: UI.paper, ledge: UI.paperEdge, text: UI.ink }
const INK = { face: UI.ink, ledge: UI.inkEdge, text: UI.paper }
const brightness = hex => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) }
const surfaceOf = theme => (brightness(skyColor(theme)) > 140 ? INK : PAPER)
export function hudSurface(theme, fromTheme = null, t = 1) {
  const to = surfaceOf(theme), from = fromTheme ? surfaceOf(fromTheme) : to
  if (from === to || t >= 1) return to
  const face = mixHex(from.face, to.face, t)
  return { face, ledge: mixHex(from.ledge, to.ledge, t), text: brightness(face) > brightness(mixHex(UI.ink, UI.paper, 0.5)) ? UI.ink : UI.paper }
}

export function drawHud(ctx, snap, ui, X, Y, s) {
  const W = CONFIG.view.w, barW = 5, barH = 0.24
  if (ui.debug) snap.players.forEach((p, i) => {   // one small bar per player, along the top
    const x0 = 0.6 + i * (barW + 1.2), y0 = 16.7
    ctx.font = font('text', 0.3 * s, 600)
    ctx.fillStyle = p.color
    ctx.textAlign = 'left'
    ctx.fillText(`${PLAYER_COLOR_NAMES[p.slot]}${p.slot === ui.localIndex ? ' (you)' : ''} ${p.health}`, X(x0), Y(y0 + barH + 0.14))
    ctx.fillStyle = UI.healthTrack
    ctx.fillRect(X(x0), Y(y0 + barH), barW * s, barH * s)
    ctx.fillStyle = p.color
    ctx.fillRect(X(x0), Y(y0 + barH), barW * clamp(p.health / CONFIG.player.maxHealth, 0, 1) * s, barH * s)
  })

  const m = snap.match, st = ui.surface
  if (m) {
    chip(ctx, matchInfoText(m), X(W / 2), Y(16.25), s, st)
    if (m.phase === 'transition') drawScores(ctx, snap, X, Y, s, 15.3, st)
  } else if (ui.hud) chip(ctx, ui.hud, X(W / 2), Y(16.75), s, st)
}

// Floating text over the game (effects.popups), by its look: damage numbers in red with a paper
// outline, KO! as a banner, anything else in ink (or its own color) with a paper outline.
const POPUP_LOOKS = {
  damage: (ctx, t, x, y, px) => outlinedText(ctx, t.text, x, y, UI.hit, px),
  ko: (ctx, t, x, y, px) => bannerText(ctx, t.text, x, y, UI.pumpkin, px),
  plain: (ctx, t, x, y, px) => outlinedText(ctx, t.text, x, y, t.color || UI.ink, px),
}
export function drawPopups(ctx, effects, ui, X, Y, s) {
  for (const t of effects.popups) {
    if (t.damage && !ui.debug && !ui.damageNumbers) continue   // damage numbers: only if you turned them on (or with the tuning panel)
    const look = POPUP_LOOKS[t.look || 'plain'], x = X(t.x), y = Y(t.y), px = t.size * s
    const alpha = 1 - Math.pow(t.age / t.life, 2)   // (fading out at the end)
    if (alpha >= 1) { look(ctx, t, x, y, px); continue }
    ctx.font = font('display', px)
    const w = ctx.measureText(t.text).width + px
    faded(ctx, alpha, x, y - 0.3 * px, w, 2 * px, c => look(c, t, x, y, px))
  }
}

// Draws something see-through as one piece (so its outline doesn't show through its fill): at full
// strength on a scratch canvas, then onto ctx at `alpha`. (x, y, w, h: the box it fits in, in ctx's
// coordinates; draw(c) draws it in those same coordinates.)
const fadeLayer = typeof document === 'undefined' ? null : document.createElement('canvas')
function faded(ctx, alpha, x, y, w, h, draw) {
  if (!fadeLayer) return draw(ctx)
  const k = ctx.getTransform().a, W = Math.ceil(w * k), H = Math.ceil(h * k)   // (k: device pixels per pixel)
  if (fadeLayer.width < W) fadeLayer.width = W
  if (fadeLayer.height < H) fadeLayer.height = H
  const c = fadeLayer.getContext('2d')
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, W, H)
  c.setTransform(k, 0, 0, k, -(x - w / 2) * k, -(y - h / 2) * k)
  draw(c)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(fadeLayer, 0, 0, W, H, x - w / 2, y - h / 2, w, h)
  ctx.restore()
}

// The message in the middle of the screen (ui.message), on a chip.
export function drawMessage(ctx, text, st, X, Y, s) {
  if (text) chip(ctx, text, X(CONFIG.view.w / 2), Y(12.8), s, st)
}

// Where you're aiming, while the mouse is locked to the game (the real cursor is hidden then):
// a white crosshair with a dark edge, so it shows up on anything (pixels: the same size at any zoom).
export function drawCrosshair(ctx, x, y) {
  const arm = (d0, d1) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(x + dx * d0, y + dy * d0)
      ctx.lineTo(x + dx * d1, y + dy * d1)
    }
  }
  ctx.lineCap = 'round'
  for (const [color, width] of [[UI.crosshair.edge, 3], [UI.crosshair.line, 1.5]]) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    arm(3, 7.5)
    ctx.stroke()
  }
}

// Everyone's score on a paper tile in a row, each in their color, centered at height y.
function drawScores(ctx, snap, X, Y, s, y, st) {
  const gap = 0.25 * s
  const tiles = snap.players.map(p => ({ text: String(snap.match.scores[p.slot]), color: p.color }))
  const widths = tiles.map(t => tileWidth(ctx, t.text, s))
  let x = X(CONFIG.view.w / 2) - (widths.reduce((a, b) => a + b, 0) + gap * (tiles.length - 1)) / 2
  tiles.forEach((t, i) => {
    tile(ctx, t.text, x + widths[i] / 2, Y(y), t.color, s, st)
    x += widths[i] + gap
  })
}

// Big text in the middle: who won the round (during the slow motion) or the match.
export function drawBanner(ctx, snap, ui, X, Y, s) {
  const m = snap.match
  if (!m) return
  let text = null, sub = null, color = UI.pumpkin
  if (m.phase === 'roundOver' && m.decided) {   // (shown once the last blow is confirmed, in slow motion)
    if (m.roundWinner === null) text = 'Draw!'
    else { text = `${PLAYER_COLOR_NAMES[m.roundWinner]} wins!`; color = PLAYER_COLORS[m.roundWinner] }
  } else if (m.phase === 'matchOver') {
    text = `${PLAYER_COLOR_NAMES[m.matchWinner]} wins the match!`
    color = PLAYER_COLORS[m.matchWinner]
    sub = `new match in ${Math.max(1, Math.ceil(m.timer))}…`
    drawScores(ctx, snap, X, Y, s, 12.7, ui.surface)
  }
  if (!text) return
  bannerText(ctx, text, X(CONFIG.view.w / 2), Y(14.3), color, 1.1 * s)
  if (sub) outlinedText(ctx, sub, X(CONFIG.view.w / 2), Y(13.5), UI.paper, 0.45 * s, UI.ink, 'text', 600)
}

export function drawDebug(ctx, X, Y, s, ui, XS) {
  // ground rays only exist where the physics runs (practice / host)
  if (ui.game) {
    ctx.lineWidth = 1
    for (const p of ui.game.players) {
      for (const r of p.debugRays) {
        ctx.strokeStyle = r.hit ? UI.debugRay.hit : UI.debugRay.miss
        ctx.beginPath()
        ctx.moveTo(X(r.from.x), Y(r.from.y))
        ctx.lineTo(X(r.to.x), Y(r.to.y))
        ctx.stroke()
      }
    }
  }
  ctx.fillStyle = ui.theme.ink
  ctx.font = font('mono', 0.36 * s)
  ctx.textAlign = 'left'
  ui.debugLines.forEach((t, i) => ctx.fillText(t, XS(0.5), Y(15.4 - i * 0.5)))
}

// --- text on paper (x, y in pixels; sizes in meters, times s, unless they say px) ---

// Sets up centered text; returns the font's cap height in px (to center a line of it on a point).
function textStyle(ctx, role, px, spacing = 0, weight) {
  ctx.font = font(role, px, weight)
  ctx.letterSpacing = `${spacing * px}px`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  return ctx.measureText('H').actualBoundingBoxAscent
}

// A rounded rectangle path, w × h around (x, y), corners r.
function roundedBox(ctx, x, y, w, h, r) {
  const x0 = x - w / 2, y0 = y - h / 2
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0)
  ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r)
  ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r)
  ctx.arcTo(x0, y0 + h, x0, y0, r)
  ctx.arcTo(x0, y0, x0 + w, y0, r)
  ctx.closePath()
}

// A shape w × h around (x, y) in st.face, sitting on a ledge `ledge` px deep in st.ledge (see hudSurface).
export function onLedge(ctx, x, y, w, h, r, ledge, st) {
  ctx.fillStyle = st.ledge
  roundedBox(ctx, x, y + ledge, w, h, r)
  ctx.fill()
  ctx.fillStyle = st.face
  roundedBox(ctx, x, y, w, h, r)
  ctx.fill()
}

// A pill with text (0.4 m), centered on (x, y), made of st (see hudSurface).
function chip(ctx, text, x, y, s, st) {
  ctx.save()
  const cap = textStyle(ctx, 'display', 0.4 * s, 0.04)
  const w = ctx.measureText(text).width + 2 * 0.28 * s, h = (0.4 + 2 * 0.12) * s
  onLedge(ctx, x, y, w, h, h / 2, 0.07 * s, st)
  ctx.fillStyle = st.text
  ctx.fillText(text, x, y + cap / 2)
  ctx.restore()
}

// A score tile: a paper rounded square with a big number (0.7 m) in `color`, centered on (x, y).
const TILE = { size: 0.7, minW: 1.05, padX: 0.21, h: 0.98, r: 0.2, ledge: 0.08 }
function tileWidth(ctx, text, s) {
  ctx.save()
  textStyle(ctx, 'display', TILE.size * s)
  const w = Math.max(TILE.minW * s, ctx.measureText(text).width + 2 * TILE.padX * s)
  ctx.restore()
  return w
}
function tile(ctx, text, x, y, color, s, st) {
  const w = tileWidth(ctx, text, s)
  ctx.save()
  const cap = textStyle(ctx, 'display', TILE.size * s)
  onLedge(ctx, x, y, w, TILE.h * s, TILE.r * s, TILE.ledge * s, st)
  ctx.fillStyle = color
  ctx.fillText(text, x, y + cap / 2)
  ctx.restore()
}

// Text with an outline 0.14em wide around it (paper unless said), its baseline at y.
function outlinedText(ctx, text, x, y, fill, px, outline = UI.paper, role = 'display', weight) {
  ctx.save()
  textStyle(ctx, role, px, role === 'display' ? 0.04 : 0, weight)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 0.14 * px
  ctx.strokeStyle = outline
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
  ctx.restore()
}

// Banner text, like the logo: a dark drop under it, a dark outline 0.16em wide, then the fill; baseline at y.
function bannerText(ctx, text, x, y, fill, px) {
  ctx.save()
  textStyle(ctx, 'display', px, 0.03)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 0.16 * px
  ctx.strokeStyle = ctx.fillStyle = UI.logoEdge
  ctx.strokeText(text, x, y + 0.07 * px)   // the drop
  ctx.fillText(text, x, y + 0.07 * px)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
  ctx.restore()
}
