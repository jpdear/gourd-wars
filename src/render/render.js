// RENDER
// Draws one frame from a snapshot (snap can be null while the guest waits for the first one).
//   ui: { debug, fps, localIndex, hud (center text outside a match), debugLines,
//         game (host only, for debug rays), message, aim (where the mouse points, for the aim line),
//         overlay (map editor: draws its markers instead of the HUD) }

import { CONFIG } from '../config.js'
import { SCYTHE_START } from '../game/level.js'
import { leaders } from '../game/match.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { snapPlayer } from '../game/snapshot.js'
import { MAP_SHIFT, transitionCamera } from '../game/transition.js'
import { MAPS, mapDef } from '../maps/builtin.js'
import { drawBanner, drawDebug, drawHud } from './hud.js'
import { drawBale, drawBonfire, drawScarecrow } from './level.js'
import { drawAimLine, drawGrappleVine, drawPlayer, handOf } from './players.js'
import { drawPatches, drawPumpkin, pumpkinColors } from './pumpkins.js'
import { drawMapBase } from './scenery.js'
import { lerp } from '../util/math.js'

export function render(ctx, view, snap, effects, ui) {
  const { s, ox, oy, w, h } = view
  // During a map pan the world slides under a moving camera; the HUD and text stay put.
  const tr = snap && snap.transition
  const camX = tr ? transitionCamera(tr.t) : 0
  const X = x => ox + (x - camX) * s    // world
  const XS = x => ox + x * s            // screen (HUD, text)
  const Y = y => oy + (CONFIG.view.h - y) * s

  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox, oy, CONFIG.view.w * s, CONFIG.view.h * s)
  ctx.clip()

  const map = snap ? mapDef(snap.map) : MAPS.patch
  const theme = ui.theme = map.theme   // (the HUD and banner read their text colors from it)
  if (tr) {   // the map we're leaving, one screen to the left
    const old = mapDef(tr.from), XO = x => X(x - MAP_SHIFT)
    drawMapBase(ctx, old, XO, Y, s, null)
    old.scythes.forEach(sc => drawScarecrow(ctx, sc, SCYTHE_START, XO, Y, s))
    for (const f of old.fires) drawBonfire(ctx, f, XO, Y, s, true)
  }
  drawMapBase(ctx, map, X, Y, s, snap && snap.movers)

  if (snap) {
    for (const [, x, y, angle, hp, flags] of snap.bales) drawBale(ctx, x, y, angle, hp, flags, X, Y, s)
    drawPatches(ctx, snap, ui.localIndex, X, Y, s)
    for (const [, x, y, angle, typeName, ripeness, owner] of snap.pumpkins) {
      const type = PUMPKIN_TYPES[typeName]
      if (typeName === 'vine' && snapPlayer(snap, owner)) {   // the vine trails back to the thrower's hand
        const [hx, hy] = handOf(snapPlayer(snap, owner))
        ctx.strokeStyle = '#3c7a22'
        ctx.lineWidth = 0.05 * s
        ctx.beginPath()
        ctx.moveTo(X(hx), Y(hy))
        ctx.quadraticCurveTo(X((hx + x) / 2), Y((hy + y) / 2 - 0.4), X(x), Y(y))
        ctx.stroke()
      }
      drawPumpkin(ctx, X(x), Y(y), type.radius * s, angle, pumpkinColors(type, ripeness, 0), type.mark)
    }
    const crowned = snap.match ? leaders(snap.match.scores) : []   // whoever's in the lead wears a crown
    for (const p of snap.players) if (p.grapple && !p.dead) drawGrappleVine(ctx, p, X, Y, s)
    for (const p of snap.players) if (!p.dead) drawPlayer(ctx, p, crowned.includes(p.slot), X, Y, s)
    const me = !tr && ui.aim && snapPlayer(snap, ui.localIndex)
    if (me && me.held && PUMPKIN_TYPES[me.held].aimLine && !me.dead && !me.stunned && !me.frozen) drawAimLine(ctx, me, ui.aim, X, Y, s)
    map.scythes.forEach((sc, i) => drawScarecrow(ctx, sc, snap.scythes[i] ?? Math.PI / 2, X, Y, s))
  }
  for (const f of map.fires) drawBonfire(ctx, f, X, Y, s, true)   // flames in front of players

  for (const q of effects.particles) {
    ctx.globalAlpha = 1 - q.age / q.life
    ctx.fillStyle = q.color
    ctx.beginPath()
    ctx.arc(X(q.x), Y(q.y), q.r * s, 0, Math.PI * 2)
    ctx.fill()
  }
  for (const ring of effects.rings) {
    const t = ring.age / ring.life
    ctx.globalAlpha = 1 - t
    ctx.strokeStyle = '#e2571b'
    ctx.lineWidth = 0.12 * s * (1 - t) + 1
    ctx.beginPath()
    ctx.arc(X(ring.x), Y(ring.y), lerp(0.3, ring.r, Math.sqrt(t)) * s, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  for (const t of effects.popups) {
    if (t.debugOnly && !ui.debug) continue   // damage numbers are a debug/tuning aid only
    ctx.globalAlpha = 1 - Math.pow(t.age / t.life, 2)
    ctx.fillStyle = t.color || theme.ink
    ctx.font = `bold ${Math.round(t.size * s)}px system-ui, sans-serif`
    ctx.fillText(t.text, X(t.x), Y(t.y))
  }
  ctx.globalAlpha = 1

  if (ui.overlay) { ui.overlay(ctx, X, Y, s); ctx.restore(); return }
  if (ui.debug) drawDebug(ctx, X, Y, s, ui, XS)
  if (snap) {
    drawHud(ctx, snap, ui, XS, Y, s)
    drawBanner(ctx, snap, ui, XS, Y, s)
  }

  if (ui.message) {
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(0.5 * s)}px system-ui, sans-serif`
    ctx.fillStyle = theme.ink
    ctx.fillText(ui.message, XS(CONFIG.view.w / 2), Y(12.6))
  }
  ctx.restore()
}
