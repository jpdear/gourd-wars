// PUMPKINS
// quality: { power, ripeness } of the harvested pumpkin (full power if left out), and size: its
//   radius as a share of the type's (an Airstrike's airdrop picked green is smaller); fuseLeft: a
//   fused one (type.fuse) that was already ticking when it was caught (else its fuse starts now)
// group: collision group for the first 0.25 s (default: the thrower's, so it doesn't hit them on the way out;
//   for good if it missesThrower)

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { damageBale, inFire, shoveBale } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { pumpkinBroke } from './traps.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { clamp, r3 } from '../util/math.js'

export function spawnPumpkin(game, typeName, pos, vel, owner, quality, group) {
  const type = PUMPKIN_TYPES[typeName]
  const radius = type.radius * (quality?.size ?? 1)
  const body = game.world.createBody({ type: 'dynamic', position: pos, bullet: true, gravityScale: type.gravityScale ?? 1 })
  const fixture = body.createFixture(new planck.Circle(radius), {
    density: type.density, friction: type.friction ?? 0.4, restitution: type.restitution,
    filterGroupIndex: group ?? (owner ? owner.group : 0),
  })
  body.setLinearVelocity(vel)
  body.setAngularVelocity(owner ? -owner.facing * (type.spin ?? 8) : 0)
  const pumpkin = {
    id: game.nextPumpkinId++, typeName, type, radius, body, fixture, owner, hits: 0, age: 0, broken: false,
    pierced: new Set(),                          // (pierces: who and what it's gone through)
    power: quality ? quality.power : 1,          // from how ripe it was when picked
    ripeness: quality ? quality.ripeness : 1,
    launch: { x: vel.x, y: vel.y },              // how it was thrown (a Boomerang curves back from this)
    fuseLeft: type.fuse ? quality?.fuseLeft ?? type.fuse : undefined,   // s until it goes off (a fused type)
    reboundTimer: 0,                             // just bounced off someone: they can't be hit again for a moment
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

// What a piercing gourd (type.pierces) goes right through instead of breaking on, by kind: the thing
// itself (so it hits each only once, however many of its parts it touches).
const PIERCES = { player: ud => ud.player, bale: ud => ud.bale }
export const piercesThrough = (pumpkin, ud) => !!(pumpkin.type.pierces && ud && PIERCES[ud.kind])

// A fused gourd (type.fuse) only breaks when it goes off: people and shields bounce it back instead.
const fused = p => p.fuseLeft !== undefined
const REBOUND_TIME = 0.25   // s after bouncing off someone before it can hit anyone again

// Bounce a pumpkin off someone (or their shield): straight back the way it came, as bouncy as it is.
// (Pumpkins pass through people physically, so this does it by hand.)
export function rebound(p) {
  const v = p.body.getLinearVelocity(), k = -p.type.restitution
  p.body.setLinearVelocity(new Vec2(v.x * k, v.y * k))
  p.reboundTimer = REBOUND_TIME
}

// Stopped by `player`'s shield: a fused one bounces back off it, one with onBlocked does that (a Sticky
// Bomb sticks to them), anything else breaks.
function stopped(game, p, player) {
  if (fused(p)) rebound(p)
  else if (p.type.onBlocked) p.type.onBlocked(game, p, player)
  else breakPumpkin(game, p)
}

export function handlePumpkinContacts(game) {
  for (const c of game.contacts) {
    const p = c.pumpkin
    if (p.broken) continue
    const ud = c.other.getUserData()
    const pierced = piercesThrough(p, ud)
    if (pierced) {
      const target = PIERCES[ud.kind](ud)
      if (p.pierced.has(target)) continue
      p.pierced.add(target)
      const pos = p.body.getPosition(), d = unit(c.velocity)   // (chips fly off it as it cuts through)
      game.events.push({ type: 'pierce', x: r3(pos.x), y: r3(pos.y), dx: r3(d.x), dy: r3(d.y), typeName: p.typeName })
    }
    p.impactVel = c.velocity   // (how it was going when it hit: a Teleport gourd lands you on the side it came from)
    const hitPlayer = ud && ud.kind === 'player'
    if (hitPlayer) {
      const player = ud.player
      const pos = p.body.getPosition()
      if (p.reboundTimer > 0) continue
      if (!p.type.unblockable && player.tryBlock(game, pos, p.radius + 0.3, unit(c.velocity))) { stopped(game, p, player); continue }
      if (p.type.onHitPlayer) p.type.onHitPlayer(game, p, player, c.other, c.velocity)
      else knockback(game, player, c.other, p, c.velocity)
    } else {
      if (!pierced) p.hits++
      if (ud && ud.kind === 'bale') {
        const power = hitPower(p, c.velocity)
        damageBale(game, ud.bale, p.type.damage * power)
        shoveBale(ud.bale, unit(c.velocity), p.type.knockback * power)
        if (p.type.onHitBale) p.type.onHitBale(game, p, ud.bale, c.velocity)
      } else if (p.type.onHitWorld) p.type.onHitWorld(game, p, c.other)
    }
    if (!pierced && ((hitPlayer && !fused(p)) || p.hits >= p.type.breakAfterHits)) breakPumpkin(game, p)
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

// Just a push, no damage (a Bouncing Bomb bonking someone): the small shove a hit too weak to stagger gives.
export function shove(player, hitBody, pumpkin, vel) {
  const speed = Math.hypot(vel.x, vel.y)
  if (speed < 0.5) return
  launch(player, hitBody, vel.x / speed, vel.y / speed, pumpkin.type.knockback * hitPower(pumpkin, vel) * CONFIG.damage.shoveScale)
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
  splat(game, p)
  if (p.type.onBreak) p.type.onBreak(game, p)
  pumpkinBroke(game, p)   // (right at a Landmine: it goes off)
}

function splat(game, p) {
  p.broken = true
  const pos = p.body.getPosition(), type = p.type.breakEvent === undefined ? 'splat' : p.type.breakEvent
  if (type) game.events.push({ type, x: r3(pos.x), y: r3(pos.y), typeName: p.typeName, ripeness: p.ripeness, rot: 0, ...(p.radius !== p.type.radius && { r: r3(p.radius) }) })
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
    if (p.age > 0.25 && !p.type.missesThrower && p.fixture.getFilterGroupIndex() !== 0) p.fixture.setFilterGroupIndex(0)
    if (p.body.getPosition().y < CONFIG.killY) p.broken = true
    if (p.broken) continue
    p.reboundTimer = Math.max(0, p.reboundTimer - dt)
    if (fused(p) && (p.fuseLeft -= dt) <= 0) {
      breakPumpkin(game, p)
      continue
    }
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
    if (inFire(game, pos, p.radius)) {
      breakPumpkin(game, p)
      continue
    }
    // a carried Big Gourd blocks it (not the thrower's own, if it missesThrower)
    const blocks = pl => p.reboundTimer <= 0 && !(p.type.missesThrower && pl === p.owner) && pl.tryBlock(game, pos, p.radius, unit(p.body.getLinearVelocity()))
    const blocker = p.type.unblockable ? null : game.players.find(blocks)
    if (blocker) {
      stopped(game, p, blocker)
      if (p.broken) continue
    }
    // hitting a pumpkin still on the vine knocks it off (both splat; a fused or sticky one flies on)
    for (const patch of game.patches) {
      if (patch.state === 'empty') continue
      const target = patchPumpkin(patch)
      if (Math.hypot(pos.x - target.x, pos.y - target.y) < p.radius + target.r) {
        if (!fused(p) && !p.type.sticks) breakPumpkin(game, p)
        splatPatch(game, patch)
        break
      }
    }
  }
  for (const p of game.pumpkins) if (p.broken) game.world.destroyBody(p.body)
  game.pumpkins = game.pumpkins.filter(p => !p.broken)
}

// Fused gourds ticking in the air or on the ground, as pickups (see pickups.js): anyone with empty
// hands can grab one, even flying past at head height, and it keeps ticking in their hand.
const CATCH = { time: 0.05, above: 1.4 }   // s holding the key (just a press, really); m above your hips it can be
export function fusePickups(game) {
  return game.pumpkins.filter(p => fused(p) && !p.broken).map(p => {
    const pos = p.body.getPosition()
    return {
      key: p, x: pos.x, y: pos.y - p.radius, at: { x: pos.x, y: pos.y, r: p.radius }, time: CATCH.time, above: CATCH.above,
      take: player => {
        player.holdPumpkin(p.typeName, p.power, p.ripeness, p.fuseLeft)
        p.broken = true   // (gone from the air: it's in their hand now)
      },
    }
  })
}
