// PUMPKIN POWERS — what the special pumpkins do

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { damageBale } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { launch, popPumpkin, spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { r3 } from '../util/math.js'

// Jack-o'-Boom: damage falls off from the center; everything in range (thrower too) gets blown
// straight outward, harder the closer it was; splats pumpkins still on their patches.
export function explode(game, x, y, blast, power) {
  game.events.push({ type: 'boom', x: r3(x), y: r3(y), r: blast.radius })
  const away = pos => {
    const dx = pos.x - x, dy = pos.y - y, d = Math.hypot(dx, dy)
    return { d, f: 1 - d / blast.radius, dx: d > 0.01 ? dx / d : 0, dy: d > 0.01 ? dy / d : 1 }
  }
  for (const pl of game.players) {
    if (pl.dead) continue
    const c = pl.torso.getPosition()
    const a = away(c)
    if (a.f <= 0) continue
    pl.takeHit(game, blast.damage * a.f * power, blast.stun, c)
    pl.stun(blast.stun)   // a blast always knocks you into a ragdoll
    pushAway(pl.parts.map(part => part.body), a, blast.knockback * (0.15 + 0.85 * a.f) * power)
  }
  for (const pk of game.pumpkins) {
    if (pk.broken) continue
    const a = away(pk.body.getPosition())
    if (a.f > 0) pushAway([pk.body], a, blast.knockback * a.f * power)
  }
  for (const patch of game.patches) {
    if (patch.state !== 'empty' && away(patchPumpkin(patch)).f > 0) splatPatch(game, patch)
  }
  for (const bale of game.bales) {
    const a = away(bale.body.getPosition())
    if (a.f <= 0) continue
    damageBale(game, bale, blast.damage * a.f * power * CONFIG.level.baleBlastMultiplier)
    pushAway([bale.body], a, blast.knockback * 0.8 * a.f * power)
  }
}

// Send bodies flying straight out from a blast (a = direction away from the center) at `speed` m/s.
function pushAway(bodies, a, speed) {
  for (const body of bodies) {
    const m = body.getMass() * speed
    body.applyLinearImpulse(new Vec2(a.dx * m, a.dy * m), body.getWorldCenter(), true)
  }
}

// Gourd Cluster: at the top of its arc it breaks into 3 minis fanning out.
export function splitCluster(game, pk) {
  popPumpkin(game, pk)
  const p = pk.body.getPosition(), v = pk.body.getLinearVelocity()
  const group = pk.owner ? pk.owner.group : -100   // the pieces mustn't hit each other at first
  for (const k of [-1, 0, 1]) {
    const a = k * 0.3, cos = Math.cos(a), sin = Math.sin(a)
    spawnPumpkin(game, 'mini', new Vec2(p.x + k * 0.05, p.y), new Vec2(v.x * cos - v.y * sin, v.x * sin + v.y * cos), pk.owner, pk, group)
  }
}

// Set every part's velocity toward a point (plus a little lift).
function yankToward(player, target, speed) {
  const c = player.torso.getPosition()
  const dx = target.x - c.x, dy = target.y - c.y
  const d = Math.hypot(dx, dy) || 1
  const v = new Vec2(dx / d * speed, dy / d * speed + PUMPKIN_TYPES.vine.yankLift)
  for (const part of player.parts) part.body.setLinearVelocity(v)
}

// Vine hits a player: they get yanked toward the thrower (and flop for a moment).
export function vineYankPlayer(game, pk, player, part) {
  const pos = part.getPosition()
  player.takeHit(game, pk.type.damage * pk.power, pk.type.stun, pos)
  player.stun(pk.type.stun)
  if (pk.owner && pk.owner !== player && !pk.owner.dead) yankToward(player, pk.owner.torso.getPosition(), pk.type.yankSpeed)
  game.events.push({ type: 'yank', x: r3(pos.x), y: r3(pos.y) })
}

// Vine hits a hay bale: the bale gets yanked toward the thrower.
export function vineYankBale(game, pk, bale) {
  if (!pk.owner || pk.owner.dead) return
  const p = bale.body.getPosition(), t = pk.owner.torso.getPosition()
  const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1
  bale.body.setLinearVelocity(new Vec2(dx / d * pk.type.yankSpeed, dy / d * pk.type.yankSpeed + pk.type.yankLift))
  game.events.push({ type: 'yank', x: r3(p.x), y: r3(p.y) })
}

// Vine hits the level: the thrower gets reeled in to that spot (grappling hook).
export function vineYankOwner(game, pk, body) {
  const ud = body.getUserData()
  const owner = pk.owner
  if ((ud && ud.kind === 'pumpkin') || !owner || owner.out || owner.stunned) return
  const p = pk.body.getPosition()
  owner.startGrapple(body, p)
  game.events.push({ type: 'yank', x: r3(p.x), y: r3(p.y) })
}

// A carried Big Gourd is a shield (not while ragdolled or frozen).
function shieldOf(player) {
  if (!player.held || player.held.typeName !== 'biggourd' || player.dead || player.stunned || player.frozenTimer > 0) return null
  const h = player.handPosition()
  return { x: h.x, y: h.y, r: PUMPKIN_TYPES.biggourd.radius }
}

// Something at `pos` (radius r, moving along dir) reaches `player`'s shield? The gourd takes the
// hit: a small shove, and after a few blocks it cracks apart.
export function tryBlock(game, player, pos, r, dir) {
  const sh = shieldOf(player)
  if (!sh || Math.hypot(pos.x - sh.x, pos.y - sh.y) > sh.r + r) return false
  player.held.blocks = (player.held.blocks || 0) + 1
  launch(player, player.torso, dir.x, dir.y, 2)
  game.events.push({ type: 'block', x: r3(sh.x), y: r3(sh.y) })
  if (player.held.blocks >= PUMPKIN_TYPES.biggourd.shieldBlocks) {
    game.events.push({ type: 'splat', x: r3(sh.x), y: r3(sh.y), typeName: 'biggourd', ripeness: player.held.ripeness, rot: 0 })
    player.held = null
    player.charging = false   // (it may have cracked mid-throw: nothing left to throw)
  }
  return true
}
