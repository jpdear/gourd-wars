// RENDER
// Draws one frame from a snapshot (snap can be null while the guest waits for the first one).
//   ui: { debug, fps, localIndex, hud (center text outside a match), debugLines,
//         game (host only, for debug rays), message, aim (where the mouse points, for the aim line),
//         overlay (map editor: draws its markers instead of the HUD),
//         crosshair (the mouse is locked to the game: draw where it points),
//         damageNumbers (show them: the player's setting), harvestKey (its name, for the harvest bubble) }
// Every color and font the drawing uses is in palette.js (plus each map's theme and each pumpkin type's own).

import { CONFIG } from '../config.js'
import { leaders } from '../game/match.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { snapPlayer } from '../game/snapshot.js'
import { MAP_SHIFT, ease, transitionCamera } from '../game/transition.js'
import { MAPS, mapDef } from '../maps/builtin.js'
import { drawBanner, drawCrosshair, drawDebug, drawHud, drawMessage, drawPopups, hudSurface } from './hud.js'
import { drawBale, drawBonfire, drawCannon, drawIce } from './level.js'
import { drawContactShadows, drawGrappleVine, drawPlayer, drawSight } from './players.js'
import { drawAirstrikeTarget, drawBlackHole, drawFlyingPumpkin, drawLockOn, drawPatches, drawTrap } from './pumpkins.js'
import { drawEffects } from './effects.js'
import { drawPickupHints } from './pickups.js'
import { drawMapBase, drawWeather } from './scenery.js'

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
  // the world shakes while a Black Hole is open (harder as it grows) and when an airdrop lands;
  // the HUD and text stay put
  const H = PUMPKIN_TYPES.blackhole.hole
  const holeShake = snap ? H.shake * Math.min(1, Math.max(0, ...snap.holes.map(h => h.r)) / H.maxRadius) : 0
  const shake = Math.max(holeShake, effects.shake ? effects.shake.amount * (1 - effects.shake.age / effects.shake.life) : 0)
  ctx.save()
  if (shake) ctx.translate((Math.random() * 2 - 1) * shake * s, (Math.random() * 2 - 1) * shake * s)

  const map = snap ? mapDef(snap.map) : MAPS.patch
  ui.theme = map.theme   // (the debug lines read their color from it)
  // ink or paper for the HUD's chips, fading from the old map's to the new one's during a pan
  ui.surface = hudSurface(map.theme, tr ? mapDef(tr.from).theme : null, tr ? ease(tr.t) : 1)
  if (tr) {   // the map we're leaving, one screen to the left
    const old = mapDef(tr.from), XO = x => X(x - MAP_SHIFT)
    drawMapBase(ctx, old, XO, Y, s, null)
    for (const c of old.cannons || []) drawCannon(ctx, c, null, XO, Y, s, old.theme.shade)
    for (const f of old.fires) drawBonfire(ctx, f, XO, Y, s, true)
  }
  drawMapBase(ctx, map, X, Y, s, snap && snap.movers)
  const cannons = map.cannons || []
  for (let i = 0; i < cannons.length; i++) drawCannon(ctx, cannons[i], snap?.cannons?.[i] ?? null, X, Y, s, map.theme.shade, !!snap?.frozenCannons?.includes(i))   // (timer: seconds to its next shot)

  if (snap) {
    const shade = map.theme.shade   // (the map's tint for two-tone shading)
    if (snap.ice) drawIce(ctx, snap.ice, X, Y, s)   // (an Ice Bomb's icy floor)
    for (const bale of snap.bales) drawBale(ctx, bale, X, Y, s, shade)
    drawPatches(ctx, snap, X, Y, s, shade)
    drawPickupHints(ctx, snap, ui.localIndex, ui.harvestKey, ui.surface, X, Y, s)
    for (const st of snap.strikes) drawAirstrikeTarget(ctx, st.x, st.y, st.t, st.r, X, Y, s)   // (under the airdrop)
    for (const t of snap.traps) if (!t.bite) drawTrap(ctx, t, X, Y, s, shade)   // (on the floor: under whoever steps on it)
    for (const pk of snap.pumpkins) drawFlyingPumpkin(ctx, pk, snap, X, Y, s, shade)
    const crowned = snap.match ? leaders(snap.match.scores) : []   // whoever's in the lead wears a crown
    for (const p of snap.players) if (p.grapple && !p.dead) drawGrappleVine(ctx, p, X, Y, s)
    drawContactShadows(ctx, snap, map, map.theme, X, Y, s)
    for (const p of snap.players) if (!p.dead) drawPlayer(ctx, p, crowned.includes(p.slot), map.theme, X, Y, s)
    for (const t of snap.traps) if (t.bite) drawTrap(ctx, t, X, Y, s, shade)   // (clamped on someone)
    for (const p of snap.players) if (p.lockedOn && !p.dead) drawLockOn(ctx, X(p.parts[0][0]), Y(p.parts[0][1]), s)
    for (const h of snap.holes) drawBlackHole(ctx, h.x, h.y, h.r, X, Y, s)   // (over whatever it's swallowing)
    const me = !tr && ui.aim && snapPlayer(snap, ui.localIndex)
    if (me && snap.sights && !me.dead && !me.stunned && !me.frozen) drawSight(ctx, me, ui.aim, map, snap, X, Y, s)   // (if there's something to throw)
  }
  for (const f of map.fires) drawBonfire(ctx, f, X, Y, s, true)   // flames in front of players

  drawEffects(ctx, effects, map.theme, X, Y, s)   // (blast clouds, particles, rings)
  drawWeather(ctx, map.theme, X, Y, s)   // (snow, embers: over everything in the world)
  drawPopups(ctx, effects, ui, X, Y, s)   // (in the world: they shake with it)
  ctx.restore()   // (the shake)

  if (ui.overlay) { ui.overlay(ctx, X, Y, s); ctx.restore(); return }
  if (ui.debug) drawDebug(ctx, X, Y, s, ui, XS)
  if (snap) {
    drawHud(ctx, snap, ui, XS, Y, s)
    drawBanner(ctx, snap, ui, XS, Y, s)
  }

  drawMessage(ctx, ui.message, ui.surface, XS, Y, s)
  if (ui.crosshair && ui.aim) drawCrosshair(ctx, XS(ui.aim.x), Y(ui.aim.y))
  ctx.restore()
}
