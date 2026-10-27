// ---------------------------------------------------------------------
// MAP TRANSITION — the camera pans left onto the next map while each player is
// picked up (dangling) and carried from where they were to their new spawn.
// ---------------------------------------------------------------------

import { Vec2 } from 'planck'
import { BODY, CONFIG } from '../config.js'
import { addPlayer, resetRound, spawnFor } from './game.js'
import { mapDef } from '../maps/builtin.js'
import { lerp, wrapAngle } from '../util/math.js'

export const MAP_SHIFT = CONFIG.view.w   // during a pan, the old map sits one screen to the left
export const ease = t => t * t * (3 - 2 * t)
export const transitionCamera = t => -MAP_SHIFT * (1 - ease(t))   // camera x (0 = the new map fills the screen)

export function startTransition(game, nextMap) {
  const from = game.map
  const oldMap = from ? mapDef(from) : null
  // anyone waiting to join comes in now (standing at their spawn in the old map)
  for (const slot of game.joining) addPlayer(game, slot)
  game.joining = []
  // where each player gets picked up (by slot): where they are (in the old map's frame), or above
  // their old spawn if they fell off
  const starts = {}
  for (const p of game.players) {
    const c = p.torso.getPosition(), old = oldMap ? spawnFor(oldMap, p.index) : p.spawn
    const onScreen = !p.dead && c.x > -1 && c.x < MAP_SHIFT + 1 && c.y > -1 && c.y < CONFIG.view.h + 1
    starts[p.index] = onScreen ? { x: c.x, y: c.y } : { x: old.x, y: old.y + 3 }
  }
  game.mapChoice = nextMap
  resetRound(game)
  game.timeScale = 1
  if (!from) return   // nothing to pan from
  game.transition = { from, elapsed: 0, duration: CONFIG.match.transitionTime, starts }
  game.players.forEach(p => {
    const c = p.torso.getPosition(), dx = starts[p.index].x - MAP_SHIFT - c.x, dy = starts[p.index].y - c.y
    for (const part of p.parts) {
      const q = part.body.getPosition()
      part.body.setTransform(new Vec2(q.x + dx, q.y + dy), part.body.getAngle())
    }
    p.stun(game.transition.duration + 0.05)   // limp: dangling while carried
    p.setGhost(true)                          // passes through platforms, scythes... on the way
  })
}

export function updateTransition(game, dt) {
  const tr = game.transition
  if (!tr) return
  tr.elapsed += dt
  const t = Math.min(1, tr.elapsed / tr.duration), e = ease(t)
  game.players.forEach(p => {
    // carried by the torso along an arc; moving with the camera, so on screen they travel from
    // where they were straight to their spawn
    const from = tr.starts[p.index]
    if (!from) return   // (arrived during the pan)
    const to = { x: p.spawn.x, y: p.spawn.y + CONFIG.player.hoverHeight + BODY.torsoLen / 2 }
    const tx = lerp(from.x - MAP_SHIFT, to.x, e), ty = lerp(from.y, to.y, e) + Math.sin(Math.PI * t) * 3
    const c = p.torso.getPosition()
    p.torso.setLinearVelocity(new Vec2((tx - c.x) * 12, (ty - c.y) * 12))
    p.torso.setAngularVelocity(-wrapAngle(p.torso.getAngle()) * 8)
  })
  if (t >= 1) {   // set down: the round has started
    game.transition = null
    for (const p of game.players) {
      p.stunTimer = 0
      p.setGhost(false)
    }
  }
}
