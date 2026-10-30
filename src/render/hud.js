// Drawing the text over the game: match info, scores, the winner banner, debug info.
// Match info at the top. No score numbers during a round (the leader wears a crown); the
// scores show during the pan to the next map and at the end of the match. Health bars only in
// debug mode: it's more fun when nobody knows exactly how much health is left.

import { CONFIG, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../config.js'
import { matchInfoText } from '../game/match.js'
import { clamp } from '../util/math.js'

export function drawHud(ctx, snap, ui, X, Y, s) {
  const W = CONFIG.view.w, barW = 5, barH = 0.24
  if (ui.debug) snap.players.forEach((p, i) => {   // one small bar per player, along the top
    const x0 = 0.6 + i * (barW + 1.2), y0 = 16.7
    ctx.font = `bold ${Math.round(0.3 * s)}px system-ui, sans-serif`
    ctx.fillStyle = p.color
    ctx.textAlign = 'left'
    ctx.fillText(`${PLAYER_COLOR_NAMES[p.slot]}${p.slot === ui.localIndex ? ' (you)' : ''} ${p.health}`, X(x0), Y(y0 + barH + 0.14))
    ctx.fillStyle = 'rgba(59, 54, 49, 0.15)'
    ctx.fillRect(X(x0), Y(y0 + barH), barW * s, barH * s)
    ctx.fillStyle = p.color
    ctx.fillRect(X(x0), Y(y0 + barH), barW * clamp(p.health / CONFIG.player.maxHealth, 0, 1) * s, barH * s)
  })

  ctx.textAlign = 'center'
  const m = snap.match
  if (m) {
    ctx.fillStyle = ui.theme.muted
    ctx.font = `${Math.round(0.32 * s)}px system-ui, sans-serif`
    ctx.fillText(matchInfoText(m), X(W / 2), Y(16.1))
    if (m.phase === 'transition') drawScores(ctx, snap, ui, X, Y, s, 15)
  } else {
    ctx.fillStyle = ui.theme.muted
    ctx.font = `${Math.round(0.36 * s)}px system-ui, sans-serif`
    ctx.fillText(ui.hud, X(W / 2), Y(16.6))
  }
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
  for (const [color, width] of [['rgba(30, 24, 20, 0.85)', 3], ['#fff', 1.5]]) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    arm(3, 7.5)
    ctx.stroke()
  }
}

// Everyone's score in a row, each in their color, centered at height y.
function drawScores(ctx, snap, ui, X, Y, s, y) {
  const players = snap.players, gap = 1.6
  ctx.font = `900 ${Math.round(0.8 * s)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.lineWidth = 0.14 * s
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ui.theme.sky[1]
  players.forEach((p, i) => {
    const x = CONFIG.view.w / 2 + (i - (players.length - 1) / 2) * gap
    const text = String(snap.match.scores[p.slot])
    ctx.strokeText(text, X(x), Y(y))
    ctx.fillStyle = p.color
    ctx.fillText(text, X(x), Y(y))
  })
}

// Big text in the middle: who won the round (during the slow motion) or the match.
export function drawBanner(ctx, snap, ui, X, Y, s) {
  const m = snap.match
  if (!m) return
  let text = null, sub = null, color = ui.theme.ink
  if (m.phase === 'roundOver' && m.decided) {   // (shown once the last blow is confirmed, in slow motion)
    if (m.roundWinner === null) text = 'Draw!'
    else { text = `${PLAYER_COLOR_NAMES[m.roundWinner]} wins!`; color = PLAYER_COLORS[m.roundWinner] }
  } else if (m.phase === 'matchOver') {
    text = `${PLAYER_COLOR_NAMES[m.matchWinner]} wins the match!`
    color = PLAYER_COLORS[m.matchWinner]
    sub = `new match in ${Math.max(1, Math.ceil(m.timer))}…`
    drawScores(ctx, snap, ui, X, Y, s, 12.4)
  }
  if (!text) return
  ctx.textAlign = 'center'
  ctx.font = `900 ${Math.round(1.1 * s)}px system-ui, sans-serif`
  ctx.lineWidth = 0.18 * s
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ui.theme.sky[1]
  ctx.strokeText(text, X(CONFIG.view.w / 2), Y(14.3))
  ctx.fillStyle = color
  ctx.fillText(text, X(CONFIG.view.w / 2), Y(14.3))
  if (sub) {
    ctx.font = `600 ${Math.round(0.45 * s)}px system-ui, sans-serif`
    ctx.lineWidth = 0.08 * s
    ctx.fillStyle = ui.theme.muted
    ctx.strokeText(sub, X(CONFIG.view.w / 2), Y(13.5))
    ctx.fillText(sub, X(CONFIG.view.w / 2), Y(13.5))
  }
}

export function drawDebug(ctx, X, Y, s, ui, XS) {
  // ground rays only exist where the physics runs (practice / host)
  if (ui.game) {
    ctx.lineWidth = 1
    for (const p of ui.game.players) {
      for (const r of p.debugRays) {
        ctx.strokeStyle = r.hit ? '#1a9e3a' : '#c33'
        ctx.beginPath()
        ctx.moveTo(X(r.from.x), Y(r.from.y))
        ctx.lineTo(X(r.to.x), Y(r.to.y))
        ctx.stroke()
      }
    }
  }
  ctx.fillStyle = ui.theme.ink
  ctx.font = `${Math.round(0.36 * s)}px ui-monospace, monospace`
  ctx.textAlign = 'left'
  ui.debugLines.forEach((t, i) => ctx.fillText(t, XS(0.5), Y(15.4 - i * 0.5)))
}
