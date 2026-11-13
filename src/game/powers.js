// PUMPKIN POWERS — what the special pumpkins do

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { breakBale, coatFloor, damageBale, freezeBale, skyDrop } from './level.js'
import { freezePatch, patchPumpkin, splatPatch } from './patches.js'
import { breakPumpkin, popPumpkin, spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { blastTraps, freeVictim } from './traps.js'
import { cannonDistance, freezeCannon } from './cannons.js'
import { blastStickies } from './stickies.js'
import { douse } from './fire.js'
import { clamp, lerp, r3, wrapAngle } from '../util/math.js'

// Jack-o'-Boom: damage falls off from the center; everything in range (thrower too) gets blown
// straight outward, harder the closer it was; splats pumpkins still on their patches; sets off a
// fused gourd (a Bouncing Bomb) a moment later.
export function explode(game, x, y, blast, power) {
  game.events.push({ type: 'boom', x: r3(x), y: r3(y), r: blast.radius })
  blastTraps(game, x, y, blast.radius)   // (a Landmine it reaches goes off too)
  blastStickies(game, x, y, blast.radius)   // (and a stuck Sticky Bomb, a moment later)
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
    if (a.f <= 0) continue
    pushAway([pk.body], a, blast.knockback * a.f * power)
    if (pk.fuseLeft !== undefined) pk.fuseLeft = Math.min(pk.fuseLeft, pk.type.chainDelay)   // (a Bouncing Bomb goes off too, a moment later)
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

// Ice Bomb: everything within chill.radius freezes, with no damage and no push: players (longer the
// closer their nearest part was), hay bales, pumpkins still on their patches, and the tops of the
// platforms in reach ice over, and gourd cannons stop firing. (See the icebomb type for the numbers.)
export function freezeBlast(game, x, y, chill, power) {
  game.events.push({ type: 'iceburst', x: r3(x), y: r3(y), r: chill.radius })
  const reach = pos => Math.hypot(pos.x - x, pos.y - y) / chill.radius   // 0 at the center, 1 at the edge
  for (const pl of game.players) {
    if (pl.dead) continue
    const d = Math.min(...pl.parts.map(part => reach(part.body.getPosition())))
    if (d > 1) continue
    pl.freeze(lerp(chill.center, chill.edge, d) * power)
    const c = pl.torso.getPosition()
    game.events.push({ type: 'freeze', x: r3(c.x), y: r3(c.y) })
  }
  for (const bale of game.bales) if (reach(bale.body.getPosition()) <= 1) freezeBale(bale, chill.objects * power)
  for (const patch of game.patches) if (patch.state !== 'empty' && reach(patchPumpkin(patch)) <= 1) freezePatch(patch, chill.objects * power)
  for (const c of game.cannons) if (cannonDistance(c.def, { x, y }) <= chill.radius) freezeCannon(c, chill.cannon * power)
  coatFloor(game, 'ice', x, y, chill.radius, chill.floor * power)
  douse(game, x, y, chill.radius)   // (fire patches and burning bales in reach go out; players: freezing puts them out)
}

// STICKY BOMB's burst: everything within glue.radius is glued, with no push: players (longer the closer
// their nearest part was; in the air, when they land) take a little damage too, hay bales go gooey, and the
// platform tops in reach are sticky till they dry. (See the sticky type for the numbers.)
export function glueBurst(game, x, y, glue, power) {
  game.events.push({ type: 'glueburst', x: r3(x), y: r3(y), r: glue.radius })
  const reach = pos => Math.hypot(pos.x - x, pos.y - y) / glue.radius   // 0 at the center, 1 at the edge
  for (const pl of game.players) {
    if (pl.dead) continue
    const d = Math.min(...pl.parts.map(part => reach(part.body.getPosition())))
    if (d > 1) continue
    const c = pl.torso.getPosition()
    pl.takeHit(game, glue.damage * (1 - d) * power, 0, c)
    pl.glue(lerp(glue.center, glue.edge, d) * power, 'sticky')
  }
  for (const bale of game.bales) {
    if (reach(bale.body.getPosition()) > 1) continue
    bale.stickyTimer = Math.max(bale.stickyTimer, glue.bale * power)
    bale.gooKind = 'sticky'
  }
  coatFloor(game, 'goo', x, y, glue.radius, glue.floor * power)
}

// TELEPORT: wherever the gourd breaks (landing, hitting a wall, a bale, a shield, a bonfire, pitchforks...),
// its thrower is there in an instant, at the nearest open spot: standing on what it landed on, just off a
// wall, hanging under a ceiling (whichever side it came from), keeping their own speed. Hitting someone,
// the two swap places instead (swapPlaces). Teleporting frees you from glue and a Chomper. Nothing happens
// if its thrower is out (fallen, knocked out, gone), if it fell off the map, or if a Black Hole swallowed it.
// Events: `warp` { x, y (the torso's middle), how: 'leave' (where you were) | 'arrive' (both ends of a swap too) }.
const canWarp = pl => !!pl && !pl.dead && !pl.ko && !pl.removed
export function teleportOwner(game, pk) {
  const pl = pk.owner
  if (pk.used || pk.swallowed || !canWarp(pl)) return
  const p = pk.body.getPosition(), to = openSpot(game, p, pk.impactVel || pk.body.getLinearVelocity(), pk.radius)
  const from = pl.torso.getPosition()
  game.events.push({ type: 'warp', x: r3(from.x), y: r3(from.y), how: 'leave' })
  warp(game, pl, to.x, to.y)
}
export function swapPlaces(game, pk, other) {
  const pl = pk.owner
  pk.used = true   // (so breaking doesn't teleport them again)
  if (!canWarp(pl) || other === pl || other.dead || other.removed) return
  const a = pl.torso.getPosition(), b = other.torso.getPosition()
  const ax = a.x, ay = a.y, bx = b.x, by = b.y
  warp(game, pl, bx, by)
  warp(game, other, ax, ay)
}
function warp(game, pl, x, y) {
  pl.warpTo(x, y)
  freeVictim(game, pl)
  game.events.push({ type: 'warp', x: r3(x), y: r3(y), how: 'arrive' })
}

// Where a teleported player's torso goes for a gourd (radius r) that hit something at p going v: standing
// on it, under it, or beside it, whichever side it came from first, then the others, then the nearest
// open spot round about (or p itself if there's none). See bodyFits.
const BODY_BOX = { down: 1.2, up: 0.78, half: 0.28 }   // m from the torso's middle to the feet, to the top of the head; half the width
function openSpot(game, p, v, r) {
  const gap = 0.03, B = BODY_BOX
  const floor = { x: p.x, y: p.y - r + B.down + gap }, ceiling = { x: p.x, y: p.y + r - B.up - gap }
  const wall = { x: p.x + Math.sign(v.x || 1) * (r - B.half - gap), y: p.y }
  const sides = Math.abs(v.y) >= Math.abs(v.x) ? (v.y <= 0 ? [floor, ceiling, wall] : [ceiling, floor, wall]) : [wall, floor, ceiling]
  for (const q of sides) if (bodyFits(game, q.x, q.y)) return q
  for (let d = 0.25; d <= 1.5; d += 0.25) {
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, q = { x: floor.x + Math.cos(a) * d, y: floor.y + Math.sin(a) * d }
      if (bodyFits(game, q.x, q.y)) return q
    }
  }
  return { x: p.x, y: p.y }
}
// Would a standing player's body, torso's middle at (x, y), be clear of anything solid (platforms, walls,
// moving platforms, cannons, hay bales)? Players, pumpkins and hazards (pitchforks) don't count.
const PASSABLE = new Set(['player', 'pumpkin', 'hazard'])
function bodyFits(game, x, y) {
  const B = BODY_BOX, x0 = x - B.half, x1 = x + B.half, y0 = y - B.down, y1 = y + B.up
  const points = []
  for (const px of [x0, x, x1]) for (let k = 0; k <= 5; k++) points.push(new Vec2(px, lerp(y0, y1, k / 5)))
  let fits = true
  game.world.queryAABB({ lowerBound: new Vec2(x0, y0), upperBound: new Vec2(x1, y1) }, fixture => {
    const ud = fixture.getBody().getUserData()
    if (fixture.isSensor() || (ud && PASSABLE.has(ud.kind))) return true
    if (points.some(q => fixture.testPoint(q))) { fits = false; return false }
    return true
  })
  return fits
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
  player.setVelocity(dx / d * speed, dy / d * speed + PUMPKIN_TYPES.vine.yankLift)
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
      if (pullAt(pk.body.getPosition()).d < h.r + pk.radius) { pk.swallowed = true; breakPumpkin(game, pk) }   // (a Jack-o'-Boom goes off; a Teleport gourd doesn't take you in)
      else pull(pk.body)
    }
    for (const bale of game.bales) {
      if (bale.broken) continue
      if (pullAt(bale.body.getPosition()).d < h.r) breakBale(game, bale, 'straw')   // (it bursts into straw like any broken bale)
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
  pl.moveBy(0, CONFIG.killY - 5 - c.y)
  pl.setVelocity(0, 0)
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

// Every step: each target waits until an airdrop dropped from the sky (see skyDrop; at entrySpeed,
// or faster if it has to) would land on it right on time, then drops one. The target is gone once
// the airdrop breaks (wherever that is: something in the way takes the hit).
export function updateAirstrikes(game, dt) {
  const A = PUMPKIN_TYPES.airstrike, g = CONFIG.gravity
  for (const st of game.strikes) {
    st.age += dt
    if (st.airdrop) { st.gone = st.airdrop.broken; continue }
    const r = PUMPKIN_TYPES.airdrop.radius * st.power, top = skyDrop(game, st.x, r)
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

// Boomerang: for the first 2 × turnTime after it leaves your hand (turnTime = 2 × reach / a
// full-charge throw's speed) its spin holds it up (no gravity) and two pulls bend it around:
//   - a steady one straight back against the throw: it slows, stops `reach` m out (a tap: closer), and
//     comes back as fast as it left
//   - a sideways one toward the underside of the throw: none at first
//     (it leaves straight), swinging it out as it turns (`width` m at the widest, just after the turn)
//     and back in, so it comes home along the line it left on, right through your hand
// After that it flies on straight past you, with its light gravity. launch: how it was thrown
// ({ x, y } m/s); t: seconds since. Returns the pull (m/s²), or null once it's done curving.
// (The sight uses this too, to draw its path.)
export function boomerangPull(C, launch, t) {
  const turnTime = 2 * C.reach / CONFIG.throw.maxSpeed
  const u = t / turnTime   // (0 → 2)
  if (u >= 2) return null
  const speed = Math.hypot(launch.x, launch.y) || 1
  const dx = launch.x / speed, dy = launch.y / speed
  const sign = dx > 0 ? -1 : 1   // which way to turn (1 = counter-clockwise) to bend underneath
  const nx = -dy * sign, ny = dx * sign
  const back = speed / turnTime
  // sideways it's at width × (4u³ - 4u⁴ + u⁵) / 1.106 (0 at both ends, widest at u = 1.2): this is its second derivative
  const side = C.width / 1.106 * (speed / CONFIG.throw.maxSpeed) * (24 * u - 48 * u * u + 20 * u * u * u) / (turnTime * turnTime)
  return { x: -dx * back + nx * side, y: -dy * back + ny * side, sign }
}

export function updateBoomerang(game, pk, dt) {
  const C = pk.type.curve
  const pull = boomerangPull(C, pk.launch, pk.age)
  if (!pull) {   // done curving: on it flies, with its light gravity
    if (pk.body.getGravityScale() === 0) pk.body.setGravityScale(pk.type.gravityScale)
    return
  }
  if (pk.age === dt) {
    pk.body.setGravityScale(0)
    pk.body.setAngularVelocity(pull.sign * C.spin)   // (spins the way it's turning)
  }
  const v = pk.body.getLinearVelocity()
  pk.body.setLinearVelocity(new Vec2(v.x + pull.x * dt, v.y + pull.y * dt))
}
