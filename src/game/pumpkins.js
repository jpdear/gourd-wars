// PUMPKINS
// quality: { power, ripeness } of the harvested pumpkin (full power if left out)
// group: collision group for the first 0.25 s (default: the thrower's, so it doesn't hit them on the way out)

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { damageBale, inFire, shoveBale } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { tryBlock } from './powers.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { clamp, r3 } from '../util/math.js'

export function spawnPumpkin(game, typeName, pos, vel, owner, quality, group) {
  const type = PUMPKIN_TYPES[typeName]
  const body = game.world.createBody({ type: 'dynamic', position: pos, bullet: true, gravityScale: type.gravityScale ?? 1 })
  const fixture = body.createFixture(new planck.Circle(type.radius), {
    density: type.density, friction: type.friction ?? 0.4, restitution: type.restitution,
    filterGroupIndex: group ?? (owner ? owner.group : 0),
  })
  body.setLinearVelocity(vel)
  body.setAngularVelocity(owner ? -owner.facing * 8 : 0)
  const pumpkin = {
    id: game.nextPumpkinId++, typeName, type, body, fixture, owner, hits: 0, age: 0, broken: false,
    power: quality ? quality.power : 1,          // from how ripe it was when picked
    ripeness: quality ? quality.ripeness : 1,
    lastHit: {},                                 // player index → age of last hit (pass-through types)
  }
  body.setUserData({ kind: 'pumpkin', pumpkin })
  game.pumpkins.push(pumpkin)
  return pumpkin
}

export function recordPumpkinContact(game, fixture, other) {
  const ud = fixture.getBody().getUserData()
  if (!ud || ud.kind !== 'pumpkin' || ud.pumpkin.broken) return
  const v = fixture.getBody().getLinearVelocity()   // still the velocity before impact
  game.contacts.push({ pumpkin: ud.pumpkin, other: other.getBody(), velocity: { x: v.x, y: v.y } })
}

export function handlePumpkinContacts(game) {
  for (const c of game.contacts) {
    const p = c.pumpkin
    if (p.broken) continue
    const ud = c.other.getUserData()
    const hitPlayer = ud && ud.kind === 'player'
    if (hitPlayer) {
      const player = ud.player
      const pos = p.body.getPosition()
      if (tryBlock(game, player, pos, p.type.radius + 0.3, unit(c.velocity))) { breakPumpkin(game, p); continue }
      if (!p.type.breakOnPlayer) {   // passes through: don't hit the same player again right away
        const last = p.lastHit[player.index]
        if (last !== undefined && p.age - last < 0.4) continue
        p.lastHit[player.index] = p.age
      }
      if (p.type.onHitPlayer) p.type.onHitPlayer(game, p, player, c.other, c.velocity)
      else knockback(game, player, c.other, p, c.velocity)
    } else {
      p.hits++
      if (ud && ud.kind === 'bale') {
        const power = hitPower(p, c.velocity)
        damageBale(game, ud.bale, p.type.damage * power)
        shoveBale(ud.bale, unit(c.velocity), p.type.knockback * power)
        if (p.type.onHitBale) p.type.onHitBale(game, p, ud.bale, c.velocity)
      } else if (p.type.onHitWorld) p.type.onHitWorld(game, p, c.other)
    }
    if (p.hits >= p.type.breakAfterHits || (hitPlayer && p.type.breakOnPlayer)) breakPumpkin(game, p)
  }
  game.contacts.length = 0
}

// 0..1: how hard a pumpkin hits, from its impact speed and how ripe it was when picked.
function hitPower(pumpkin, vel) {
  const speed = Math.hypot(vel.x, vel.y)
  return clamp(speed / (pumpkin.type.refSpeed || CONFIG.throw.maxSpeed), 0.3, 1) * pumpkin.power
}

export function knockback(game, player, hitBody, pumpkin, vel) {
  const speed = Math.hypot(vel.x, vel.y)
  if (speed < 0.5) return
  const t = pumpkin.type
  const power = hitPower(pumpkin, vel)
  applyHit(game, player, hitBody, vel.x / speed, vel.y / speed, t.knockback * power, t.damage * power, t.stun * power)
}

// Deal `damage` (which may stagger them for `stun` seconds) and push the player at `speed` m/s
// along (dx, dy). Hits too small to stagger only give a small shove.
export function applyHit(game, player, hitBody, dx, dy, speed, damage, stun) {
  const staggered = player.takeHit(game, damage, stun, hitBody.getPosition())
  launch(player, hitBody, dx, dy, staggered ? speed : speed * CONFIG.damage.shoveScale)
}

// Push every part of a player (the part that got hit flies a bit more), tilted a bit upward
// so people get launched.
export function launch(player, hitBody, dx, dy, speed) {
  dy += 0.35
  const d = Math.hypot(dx, dy) || 1
  dx /= d; dy /= d
  for (const part of player.parts) {
    const m = part.body.getMass() * (part.body === hitBody ? 1.6 : 1)
    part.body.applyLinearImpulse(new Vec2(dx * speed * m, dy * speed * m), part.body.getWorldCenter(), true)
  }
}

const unit = v => { const d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d } }

export function breakPumpkin(game, p) {
  if (p.broken) return
  p.broken = true
  const pos = p.body.getPosition()
  game.events.push({ type: 'splat', x: r3(pos.x), y: r3(pos.y), typeName: p.typeName, ripeness: p.ripeness, rot: 0 })
  if (p.type.onBreak) p.type.onBreak(game, p)
}

// Gone without a splat (a fizzled vine, a cluster that split): just a small puff.
export function popPumpkin(game, p) {
  p.broken = true
  const pos = p.body.getPosition()
  game.events.push({ type: 'pop', x: r3(pos.x), y: r3(pos.y), color: p.type.color })
}

export function updatePumpkins(game, dt) {
  for (const p of game.pumpkins) {   // (split clusters add pieces while we loop; that's fine)
    p.age += dt
    if (p.age > 0.25 && p.fixture.getFilterGroupIndex() !== 0) p.fixture.setFilterGroupIndex(0)
    if (p.body.getPosition().y < CONFIG.killY) p.broken = true
    if (p.broken) continue
    if (p.type.lifetime && p.age >= p.type.lifetime) {
      if (p.type.fizzle) popPumpkin(game, p)
      else breakPumpkin(game, p)
      continue
    }
    if (p.type.update) {
      p.type.update(game, p, dt)
      if (p.broken) continue
    }
    const pos = p.body.getPosition()
    // bonfires burn pumpkins (pitchforks and blades break them by touch; a Jack-o'-Boom goes off)
    if (inFire(game, pos, p.type.radius)) {
      breakPumpkin(game, p)
      continue
    }
    // a carried Big Gourd blocks it
    if (game.players.some(pl => tryBlock(game, pl, pos, p.type.radius, unit(p.body.getLinearVelocity())))) {
      breakPumpkin(game, p)
      continue
    }
    // hitting a pumpkin still on the vine knocks it off (both splat)
    for (const patch of game.patches) {
      if (patch.state === 'empty') continue
      const target = patchPumpkin(patch)
      if (Math.hypot(pos.x - target.x, pos.y - target.y) < p.type.radius + target.r) {
        breakPumpkin(game, p)
        splatPatch(game, patch)
        break
      }
    }
  }
  for (const p of game.pumpkins) if (p.broken) game.world.destroyBody(p.body)
  game.pumpkins = game.pumpkins.filter(p => !p.broken)
}
