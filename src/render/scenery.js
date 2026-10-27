// Drawing the map itself: sky and scenery, platforms, moving-platform rails, wheat.
// A map's backdrop and fixed pieces: sky, scenery, platforms, moving platforms (at moverPos
// [[x, y], ...], or their starting spots), pitchforks, bonfire logs.

import { CONFIG } from '../config.js'
import { drawBonfire, drawPitchforks } from './level.js'
import { hexA } from '../util/color.js'

export function drawMapBase(ctx, map, X, Y, s, moverPos) {
  const theme = map.theme
  drawScenery(ctx, theme, X, Y, s)
  for (const p of map.platforms) drawPlatform(ctx, theme, p, X, Y, s)
  map.movers.forEach((m, i) => {
    drawMoverTrack(ctx, theme, m, X, Y, s)
    const at = moverPos && moverPos[i]
    drawPlatform(ctx, theme, at ? { ...m, x: at[0], y: at[1] } : m, X, Y, s)
  })
  for (const sp of map.spikes) drawPitchforks(ctx, sp, X, Y, s)
  for (const f of map.fires) drawBonfire(ctx, f, X, Y, s, false)
}

function drawPlatform(ctx, theme, p, X, Y, s) {
  ctx.fillStyle = p.wall ? theme.wall : theme.platform
  ctx.fillRect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * s, p.h * s)
  if (p.wall) return
  ctx.fillStyle = theme.platformTop
  ctx.fillRect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * s, 0.12 * s)
  if (theme.scenery === 'sunset') drawWheat(ctx, p, X, Y, s)
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
    ctx.arc(X(x), Y(y), 0.1 * s, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Each map's backdrop: a sky gradient plus simple scenery (no physics).
function drawScenery(ctx, theme, X, Y, s) {
  const W = CONFIG.view.w, H = CONFIG.view.h
  const sky = ctx.createLinearGradient(0, Y(H), 0, Y(0))
  sky.addColorStop(0, theme.sky[0])
  sky.addColorStop(1, theme.sky[1])
  ctx.fillStyle = sky
  ctx.fillRect(X(0), Y(H), W * s, H * s)
  const fillPoly = (color, pts) => {
    ctx.fillStyle = color
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
    ctx.fill()
  }
  if (theme.scenery === 'hills') {
    ctx.fillStyle = 'rgba(90, 143, 60, 0.12)'
    for (const [cx, rx, ry] of [[6, 10, 3.5], [24, 12, 4.5], [15, 8, 2.5]]) {
      ctx.beginPath()
      ctx.ellipse(X(cx), Y(0), rx * s, ry * s, 0, Math.PI, 2 * Math.PI)
      ctx.fill()
    }
  } else if (theme.scenery === 'barn') {
    ctx.strokeStyle = 'rgba(94, 59, 31, 0.18)'   // wall planks
    ctx.lineWidth = Math.max(1, 0.04 * s)
    ctx.beginPath()
    for (let x = 1.6; x < W; x += 1.6) { ctx.moveTo(X(x), Y(H)); ctx.lineTo(X(x), Y(0)) }
    ctx.stroke()
    ctx.strokeStyle = 'rgba(94, 59, 31, 0.45)'   // crossed rafters + a tie beam
    ctx.lineWidth = 0.3 * s
    ctx.beginPath()
    for (const x0 of [1, 11, 21]) {
      ctx.moveTo(X(x0), Y(17.3)); ctx.lineTo(X(x0 + 10), Y(13.3))
      ctx.moveTo(X(x0 + 10), Y(17.3)); ctx.lineTo(X(x0), Y(13.3))
    }
    ctx.stroke()
    ctx.fillStyle = 'rgba(94, 59, 31, 0.45)'
    ctx.fillRect(X(0.8), Y(13.45), (W - 1.6) * s, 0.3 * s)
  } else if (theme.scenery === 'sunset') {
    ctx.fillStyle = 'rgba(255, 236, 170, 0.85)'   // low sun
    ctx.beginPath()
    ctx.arc(X(16), Y(7.5), 3.2 * s, 0, Math.PI * 2)
    ctx.fill()
    const hills = [[0, 0]]
    for (let x = 0; x <= W; x += 2) hills.push([x, 5.4 + Math.sin(x * 0.5) * 0.4])
    fillPoly('rgba(160, 110, 50, 0.35)', [...hills, [W, 0]])
  } else if (theme.scenery === 'rocks') {
    fillPoly('rgba(70, 78, 92, 0.35)', [[0, 0], [0, 7], [3, 10], [6, 8], [9, 12], [13, 9], [17, 11.5], [21, 8.5], [25, 11], [28, 8], [32, 10], [32, 0]])
  } else if (theme.scenery === 'night') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'   // stars (always in the same places)
    for (let i = 0; i < 60; i++) {
      ctx.beginPath()
      ctx.arc(X((i * 7.31) % W), Y(6 + ((i * 3.77) % 11.5)), (i % 3 ? 0.035 : 0.06) * s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#f3ecd2'   // crescent moon
    ctx.beginPath()
    ctx.arc(X(26), Y(14.5), 1.1 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = theme.sky[0]
    ctx.beginPath()
    ctx.arc(X(26.5), Y(14.8), 0.95 * s, 0, Math.PI * 2)
    ctx.fill()
    for (const [tx, th] of [[1.5, 6], [4, 4.5], [28, 5], [30.5, 6.5]]) fillPoly('rgba(8, 12, 22, 0.75)', [[tx - 1, 3.5], [tx, 3.5 + th], [tx + 1, 3.5]])   // pines
  }
}

// Scarecrow Field: a row of wheat stalks along a platform's top.
function drawWheat(ctx, p, X, Y, s) {
  const top = p.y + p.h / 2
  ctx.strokeStyle = '#b8942c'
  ctx.fillStyle = '#e0bb45'
  ctx.lineWidth = Math.max(1, 0.025 * s)
  for (let x = p.x - p.w / 2 + 0.15; x < p.x + p.w / 2; x += 0.35) {
    const h = 0.28 + ((x * 7.7) % 1) * 0.15
    ctx.beginPath()
    ctx.moveTo(X(x), Y(top))
    ctx.lineTo(X(x + 0.03), Y(top + h))
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(X(x + 0.03), Y(top + h + 0.06), 0.035 * s, 0.08 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}
