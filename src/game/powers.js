// PUMPKIN POWERS — what the special pumpkins do

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { breakBale, damageBale } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { breakPumpkin, launch, popPumpkin, spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { clamp, lerp, r3, wrapAngle } from '../util/math.js'

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

// Black Hole: opens where the pumpkin broke and stays put. Its core grows, then collapses.
export function openBlackHole(game, x, y, hole, power) {
  game.holes.push({ id: game.nextHoleId++, x, y, r: hole.startRadius, age: 0, maxR: hole.maxRadius * power, growTime: hole.growTime * power })
  game.events.push({ type: 'hole', x: r3(x), y: r3(y) })
}

// Every step: each hole pulls on everything anywhere on the map (players, flying pumpkins, bales),
// harder the closer it is and the bigger it's grown. Whatever reaches the core is swallowed, and
// pumpkins still on their patches get ripped off once the pull on them is strong enough.
export function updateBlackHoles(game, dt) {
  const H = PUMPKIN_TYPES.blackhole.hole
  for (const h of game.holes) {
    h.age += dt
    h.r = h.age < h.growTime ? lerp(H.startRadius, h.maxR, h.age / h.growTime) : h.maxR * (1 - (h.age - h.growTime) / H.collapseTime)
    if (h.r <= 0) {
      h.gone = true
      game.events.push({ type: 'collapse', x: r3(h.x), y: r3(h.y), r: r3(h.maxR) })
      continue
    }
    // the pull at pos: distance to the center and acceleration (m/s²) toward it
    const pullAt = pos => {
      const dx = h.x - pos.x, dy = h.y - pos.y, d = Math.hypot(dx, dy) || 0.01
      const a = Math.min(H.maxPull, H.pull * h.r / d)
      return { d, a, ax: dx / d * a, ay: dy / d * a }
    }
    const pull = body => {
      const p = pullAt(body.getPosition()), m = body.getMass()
      body.applyForceToCenter(new Vec2(p.ax * m, p.ay * m), true)
    }
    for (const pl of game.players) {
      if (pl.dead) continue
      if (pullAt(pl.torso.getPosition()).d < h.r) swallowPlayer(game, pl)
      else for (const part of pl.parts) pull(part.body)
    }
    for (const pk of game.pumpkins) {
      if (pk.broken) continue
      if (pullAt(pk.body.getPosition()).d < h.r + pk.radius) breakPumpkin(game, pk)   // (a Jack-o'-Boom goes off)
      else pull(pk.body)
    }
    for (const bale of game.bales) {
      if (bale.broken) continue
      if (pullAt(bale.body.getPosition()).d < h.r) breakBale(game, bale, 'swallow')
      else pull(bale.body)
    }
    for (const patch of game.patches) {
      if (patch.state !== 'empty' && pullAt(patchPumpkin(patch)).a >= H.patchRip) splatPatch(game, patch)
    }
  }
  game.holes = game.holes.filter(h => !h.gone)
}

// Swallowed: gone, as if they fell off the map (dropped below it; checkDeath takes it from there).
function swallowPlayer(game, pl) {
  const c = pl.torso.getPosition()
  game.events.push({ type: 'swallow', x: r3(c.x), y: r3(c.y) })
  const dy = CONFIG.killY - 5 - c.y
  for (const part of pl.parts) {
    const q = part.body.getPosition()
    part.body.setTransform(new Vec2(q.x, q.y + dy), part.body.getAngle())
    part.body.setLinearVelocity(new Vec2(0, 0))
  }
}

// Airstrike: a target where it broke. A direct hit on a player puts it on whatever's below them
// (ignoring players and pumpkins), or right where they were if that's the void.
export function callAirstrike(game, pk) {
  const p = pk.body.getPosition()
  let y = p.y
  if (pk.hitPlayer) {
    game.world.rayCast(p, new Vec2(p.x, CONFIG.killY), (fixture, point, normal, fraction) => {
      const ud = fixture.getBody().getUserData()
      if (ud && (ud.kind === 'player' || ud.kind === 'pumpkin')) return -1
      y = point.y
      return fraction
    })
  }
  game.strikes.push({ id: game.nextStrikeId++, x: p.x, y, power: pk.power, age: 0, airdrop: null })
}

// Every step: each target waits until an airdrop dropped from just above the screen (at entrySpeed,
// or faster if it has to) would land on it right on time, then drops one. The target is gone once
// the airdrop breaks (wherever that is: something in the way takes the hit).
export function updateAirstrikes(game, dt) {
  const A = PUMPKIN_TYPES.airstrike, g = CONFIG.gravity
  for (const st of game.strikes) {
    st.age += dt
    if (st.airdrop) { st.gone = st.airdrop.broken; continue }
    const r = PUMPKIN_TYPES.airdrop.radius * st.power, top = CONFIG.view.h + r + 0.5
    const left = A.delay - st.age, fall = top - (st.y + r)   // (lands when its bottom reaches the target)
    if (left > 0 && A.entrySpeed * left + g * left * left / 2 > fall) continue   // (too soon: it'd land early)
    const t = Math.max(left, dt), speed = (fall - g * t * t / 2) / t
    st.airdrop = spawnPumpkin(game, 'airdrop', new Vec2(st.x, top), new Vec2(0, -speed), null, { power: st.power, ripeness: 1, size: st.power }, 0)
  }
  game.strikes = game.strikes.filter(st => !st.gone)
}

// Homing: once its delay is up it locks onto the player nearest it who's still in the round (not
// the thrower) and flies at them. Each step it picks where to head:
//   - straight at them, if nothing solid is in the way
//   - else the smallest turn off that line (10° steps, never more than 60°, so it can't turn away from
//     them and circle) that's clear for lookAhead m and has a clear view of them from there
//   - else the smallest turn that's at least clear for lookAhead m
//   - else straight at them, smashing into whatever's there (they're hidden behind cover)
export function updateHoming(game, pk, dt) {
  const H = pk.type.homing
  if (pk.age < H.delay || pk.gaveUp) return
  if (!pk.target) {
    const pos = pk.body.getPosition()
    const dist = pl => { const c = pl.torso.getPosition(); return Math.hypot(c.x - pos.x, c.y - pos.y) }
    const options = game.players.filter(pl => pl !== pk.owner && !pl.out)
    if (!options.length) { pk.gaveUp = true; return }   // nobody to chase: flies on like a Classic
    pk.target = options.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    pk.chase = 0
    pk.body.setGravityScale(0)
    pk.body.setAngularVelocity(0)
    pk.body.setTransform(pos, 0)   // (upright: antenna on top, flames out the back)
  }
  const target = pk.target
  if (target.out || target.removed) {   // knocked out or fell off: it gives up (no new target)
    pk.target = null
    pk.gaveUp = true
    pk.body.setGravityScale(pk.type.gravityScale ?? 1)
    return
  }
  if ((pk.chase += dt) >= H.maxChase) { breakPumpkin(game, pk); return }
  const pos = pk.body.getPosition(), goal = target.torso.getPosition(), v = pk.body.getLinearVelocity()
  const r = pk.radius
  const direct = Math.atan2(goal.y - pos.y, goal.x - pos.x)
  const heading = Math.hypot(v.x, v.y) > 0.1 ? Math.atan2(v.y, v.x) : direct
  const speed = H.speed * pk.power, turnRate = H.turnRate * pk.power
  let want = direct
  if (!clearPath(game, pos, goal, r)) {
    const side = wrapAngle(heading - direct) >= 0 ? 1 : -1   // (on a tie, the side we're already turned to)
    let fallback = null
    search: for (let k = 1; k <= 6; k++) {
      for (const sign of [side, -side]) {
        const a = direct + sign * k * Math.PI / 18
        const ahead = { x: pos.x + Math.cos(a) * H.lookAhead, y: pos.y + Math.sin(a) * H.lookAhead }
        if (!clearPath(game, pos, ahead, r)) continue
        if (clearPath(game, ahead, goal, r)) { want = a; break search }
        fallback ??= a
      }
    }
    if (want === direct && fallback !== null) want = fallback
  }
  // it snaps onto its course when it locks on; close in (inside its turning circle) it aims right at
  // them, so it can't orbit them
  const d = Math.hypot(goal.x - pos.x, goal.y - pos.y)
  const sharp = pk.chase === dt || d < speed / turnRate
  const dir = sharp ? want : heading + clamp(wrapAngle(want - heading), -turnRate * dt, turnRate * dt)
  pk.body.setLinearVelocity(new Vec2(Math.cos(dir) * speed, Math.sin(dir) * speed))
  pk.heading = dir
}

// Could something r wide get from a to b without touching anything solid (players and pumpkins don't count)?
function clearPath(game, a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
  const nx = -dy / len * r, ny = dx / len * r   // (to either side)
  let hit = false
  for (const k of [-1, 0, 1]) {
    game.world.rayCast(new Vec2(a.x + nx * k, a.y + ny * k), new Vec2(b.x + nx * k, b.y + ny * k), fixture => {
      const ud = fixture.getBody().getUserData()
      if (ud && (ud.kind === 'player' || ud.kind === 'pumpkin')) return -1
      hit = true
      return 0
    })
    if (hit) return false
  }
  return true
}
