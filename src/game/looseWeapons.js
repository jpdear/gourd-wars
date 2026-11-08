// LOOSE WEAPONS — weapons nobody's holding (game.looseWeapons): falling in, flying (thrown), or stuck
// in something. Anyone with empty hands can pull a stuck one out with the harvest key (weaponPickups).
//
// Falling (a crow let go of it, or its holder was knocked out), a weapon isn't a physics body: it drops
// straight down point first (see fallAngle) and sticks into the first thing under it.
//
// Thrown (Throw Weapon: see HeldWeapon in weapons.js), it's a real body flying point first, or spinning
// (see FLIGHT). What its head runs into:
//   a player        hit (less on a weak throw), each once; one that impales (the Pitchfork's javelin)
//                   carries them along on it; one that goes through (the Scythe's buzzsaw) flies on;
//                   one that dazes (the Shovel's bonk) knocks them limp and bounces back off them
//   a hay bale      damaged and shoved, and it sticks in it (or goes through)
//   a crow          knocked down (see crows.js); it flies on
//   the level       it sticks in (platforms, walls, hazards). In the side of something (a wall), one that
//                   makes a peg is a solid peg there to stand on, until someone pulls it out. Someone
//                   impaled on it is pinned there a moment. (A spinning one sticks only in a wall, or
//                   once it's slowed right down: off floors and ceilings it bounces on.)
//   a Big Gourd     the shield blocks it: it drops
// A throw that hits anything (a player, a bale, a crow) costs its cost in uses (once a throw); a miss is
// free. With none left, it snaps on the hit.
//
// Come to rest without sticking in anything (lying on its handle, say), it stays lying there.
// A trap (the Rake's) thrown tumbles to rest however it lands; if that's tines up it's armed: any part of
// anyone (its thrower too) touching its tines sets it off, once: its handle swings up and smacks them
// (see trap in weaponTypes.js). Then it's an ordinary rake lying there. Pulled out armed, it's disarmed.
// A haul (the Rake's Long Pull) can hook one lying about: it's dragged along (hauled), then let go to
// fall where it is.
// Stuck, it rides along with whatever it's stuck in (a moving platform, a bale), and falls again if
// that breaks.
//
// Each: { id, typeName, uses, x, y (its grip), angle (butt → head), side (see A WEAPON'S SHAPE),
//   state: 'falling' | 'flying' | 'stuck' | 'hauled', heading (flying: the way it's going, rad), hit (flying: who
//   and what it's hit), wore (flying: paid for hitting something),
//   vy (falling: m/s), body (flying: its body; stuck in a wall: its peg), ground (stuck: what it's in:
//   { body, local (the grip in that body's frame), angle (relative to it) }),
//   head (flying: its head fixture), thrower, power (0..1), age (flying), victim (flying: impaled on it;
//   stuck: pinned to it), pinTime, armed (a trap, set), smack (a trap going off: { t (s in) }),
//   vel (flying: how it was going last step), bounced (a ricochet: it's bounced off a wall) }

import { Vec2 } from 'planck'
import { COLLIDE, CONFIG } from '../config.js'
import { knockDownCrow } from './crows.js'
import { damageBale, shoveBale, skyDrop } from './level.js'
import { launch } from './pumpkins.js'
import { WEAPON_TYPES, addWeaponFixtures, fallAngle, headOf, pointOf, toWorld } from './weaponTypes.js'
import { HeldWeapon } from './weapons.js'
import { distToSegment, r3 } from '../util/math.js'

const SINK = 0.12        // a stuck weapon's tip is this far into whatever it's in (m)
const MAX_FALL = 25      // m/s
const GRACE = 0.25       // a thrown weapon can't hit its thrower for this long (s)
const SLOW = 5           // a spinning one slower than this (m/s) sticks in whatever it hits
const REST = { speed: 1, time: 0.3 }   // a thrown one this slow (m/s) for this long (s) has come to rest
const FOLLOW = 15        // someone impaled or pinned is pulled to its tip this hard (1/s)
const BOUNCE = 0.85      // a ricochet keeps this share of its speed off the wall
const PAIR_GAP = 0.2     // a new pair falls in this far either side of where it's dropped (m)

// A weapon falls from (x, y) (where its grip is), point first, with `uses` left (default: brand new).
export function dropWeapon(game, typeName, x, y, uses = WEAPON_TYPES[typeName].uses, side = 1) {
  const angle = fallAngle(WEAPON_TYPES[typeName], side)
  game.looseWeapons.push({ id: game.nextWeaponId++, typeName, uses, x, y, angle, side, state: 'falling', vy: 0, body: null, ground: null })
}

// A brand new one falls from (x, y) (a pair: two, side by side).
export function dropNew(game, typeName, x, y, side = 1) {
  if (!WEAPON_TYPES[typeName].pair) return dropWeapon(game, typeName, x, y, undefined, side)
  for (const dx of [-PAIR_GAP, PAIR_GAP]) dropWeapon(game, typeName, x + dx, y, undefined, side)
}

// A brand new one falls in from the sky at x (see skyDrop).
export function dropFromSky(game, typeName, x) {
  dropNew(game, typeName, x, skyDrop(game, x, WEAPON_TYPES[typeName].grip))   // (pointing down: the butt end is above the grip)
}

// Thrown by `thrower`: its grip at `at`, flying at `vel` (point first, or spinning: see FLIGHT), with
// `uses` left, its head on `side`; power 0..1 (how hard: a weak throw hits softer).
export function throwWeapon(game, thrower, typeName, uses, at, vel, power, side = 1) {
  const type = WEAPON_TYPES[typeName], angle = Math.atan2(vel.y, vel.x)
  const body = game.world.createBody({ type: 'dynamic', position: new Vec2(at.x, at.y), angle, bullet: true, gravityScale: type.throw.gravityScale })
  const head = addWeaponFixtures(body, type, type.heft.mass, { filterGroupIndex: thrower.group, filterCategoryBits: COLLIDE.weapon, filterMaskBits: 0xFFFF & ~COLLIDE.pumpkin }, side)
  body.setLinearVelocity(new Vec2(vel.x, vel.y))
  if (type.throw.spin) body.setAngularVelocity(-Math.sign(vel.x || 1) * type.throw.spin)   // (over the top, the way it's going)
  const w = {
    id: game.nextWeaponId++, typeName, uses, x: at.x, y: at.y, angle, side, heading: angle, state: 'flying', body, head, ground: null,
    thrower, power, age: 0, still: 0, victim: null, pinTime: 0, hit: new Set(), wore: false, vel: { x: vel.x, y: vel.y },
  }
  body.setUserData({ kind: 'thrown', weapon: w })
  game.looseWeapons.push(w)
  return w
}

// How a thrown weapon flies, what it lands on (sticks), and how it ends up when it does (lands); and,
// come to rest without landing, how it lies there (rests):
//   point     point first: it turns to face the way it's going, sticks into whatever its head hits,
//             and goes in point first where it hit
//   spinning  end over end (spun once, as it's thrown: over the top toward the way it's going); it
//             sticks into a wall, or anything once it's slow, and goes in as it is, toward what it hit
//   trap      lobbed, turning over slowly; it sticks into nothing (it bounces and tumbles), and comes to
//             rest however it lands: armed if that's tines up
//   ricochet  spinning flat and fast: it bounces back off the first wall it hits (and can hit people
//             again on the way back), then sticks in whatever it hits next, like a spinning one
const flightOf = type => FLIGHT[type.throw.flight]
const FLIGHT = {
  point: {
    steer: (w, body, v, p) => { if (Math.hypot(v.x, v.y) > 1) body.setTransform(p, Math.atan2(v.y, v.x)); body.setAngularVelocity(0) },
    sticks: () => true,
    lands: (game, w, hit) => {
      const dir = flightDir(w), tip = { x: hit.point.x + dir.x * SINK, y: hit.point.y + dir.y * SINK }
      const out = toWorld({ x: 0, y: 0 }, w.angle, w.side, headOf(WEAPON_TYPES[w.typeName]).point)   // (grip → point)
      stick(game, w, hit, { x: tip.x - out.x, y: tip.y - out.y, angle: w.angle })
    },
    rests: (game, w) => liesThere(game, w),
  },
  spinning: {
    steer: () => {},
    sticks: (w, hit) => Math.abs(hit.normal.x) > 0.7 || w.body.getLinearVelocity().length() < SLOW,
    lands: (game, w, hit) => {
      const p = w.body.getPosition(), c = w.body.getWorldCenter()
      const dx = hit.point.x - c.x, dy = hit.point.y - c.y, d = Math.hypot(dx, dy) || 1
      stick(game, w, hit, { x: p.x + dx / d * SINK, y: p.y + dy / d * SINK, angle: w.body.getAngle() })
    },
    rests: (game, w) => liesThere(game, w),
  },
  ricochet: {
    whole: true,   // (any of it hitting counts, not just its head: it bounces off the handle too)
    steer: () => {},
    sticks: w => !w.justBounced,   // (not off the wall it's just bounced off)
    lands: (game, w, hit) => {
      if (w.bounced || Math.abs(hit.normal.x) < 0.7) return FLIGHT.spinning.lands(game, w, hit)
      // back off the wall, the way it came in (from how it was going before it hit), a little slower
      const v = w.vel, n = hit.normal, d = v.x * n.x + v.y * n.y
      w.body.setLinearVelocity(new Vec2((v.x - 2 * d * n.x) * BOUNCE, (v.y - 2 * d * n.y) * BOUNCE))
      w.bounced = w.justBounced = true
      w.hit = new Set()   // (it can hit them again on the way back)
    },
    rests: (game, w) => liesThere(game, w),
  },
  trap: {
    steer: () => {},
    sticks: () => false,
    lands: () => {},
    rests: (game, w) => restsAsTrap(game, w),
  },
}

export function clearLooseWeapons(game) {
  for (const w of game.looseWeapons) if (w.body) game.world.destroyBody(w.body)
  game.looseWeapons = []
  game.weaponHits = []
}

// (begin-contact) A thrown weapon's head (or any of it, for a flight that's `whole`) ran into something:
// dealt with after the physics step.
export function recordThrownContact(game, contact) {
  for (const [mine, other] of [[contact.getFixtureA(), contact.getFixtureB()], [contact.getFixtureB(), contact.getFixtureA()]]) {
    const ud = mine.getBody().getUserData()
    if (!ud || ud.kind !== 'thrown' || ud.weapon.state !== 'flying') continue
    if (mine !== ud.weapon.head && !flightOf(WEAPON_TYPES[ud.weapon.typeName]).whole) continue   // (its head, or any of it)
    const m = contact.getWorldManifold(null)
    const p = m && m.points.length ? m.points[0] : mine.getBody().getWorldCenter()
    game.weaponHits.push({ w: ud.weapon, other: other.getBody(), point: { x: p.x, y: p.y }, normal: m ? { x: m.normal.x, y: m.normal.y } : { x: 0, y: 1 } })
  }
}

// (pre-solve) A thrown weapon passes through people and crows (we handle hitting them), one that goes
// through passes through bales too, and nobody bumps against the peg they're pinned to.
export function looseContactEnabled(a, b) {
  for (const [ud, other] of [[a, b], [b, a]]) {
    if (!ud || !other) continue
    if (ud.kind === 'thrown' && (other.kind === 'player' || other.kind === 'crow')) return false
    if (ud.kind === 'thrown' && other.kind === 'bale' && WEAPON_TYPES[ud.weapon.typeName].throw.through) return false
    if (ud.kind === 'peg' && other.kind === 'player' && other.player === ud.weapon.victim) return false
  }
  return true
}

// What a thrown weapon does to what its head runs into, by what that is. (Anything else: nothing.)
const HIT = {
  player: (game, w, ud, hit) => hitPlayer(game, w, ud.player, hit),
  bale: (game, w, ud, hit) => {
    const T = WEAPON_TYPES[w.typeName].throw, dir = flightDir(w)
    if (w.hit.has(ud.bale)) return
    w.hit.add(ud.bale)
    damageBale(game, ud.bale, T.damage * w.power * CONFIG.weapon.baleMultiplier)
    shoveBale(ud.bale, dir, 8 * w.power)
    game.events.push({ type: 'hit', x: r3(hit.point.x), y: r3(hit.point.y) })
    if (!wear(game, w, hit.point) && !T.through) FLIGHT.spinning.lands(game, w, hit)   // (stuck in it, as it is)
  },
  crow: (game, w, ud, hit) => {   // (a crow flying over; one already knocked down it just passes)
    if (ud.crow.state !== 'flying') return
    knockDownCrow(game, ud.crow)
    wear(game, w, hit.point)
  },
  platform: (game, w, ud, hit) => land(game, w, hit),
  hazard: (game, w, ud, hit) => land(game, w, hit),
}

function hitPlayer(game, w, victim, hit) {
  if (victim.dead || w.hit.has(victim) || (victim === w.thrower && w.age < GRACE)) return
  w.hit.add(victim)
  const T = WEAPON_TYPES[w.typeName].throw, dir = flightDir(w)
  victim.takeHit(game, T.damage * w.power, T.stun, hit.point)
  game.events.push({ type: 'hit', x: r3(hit.point.x), y: r3(hit.point.y) })
  if (T.daze) victim.daze(T.daze)
  if (wear(game, w, hit.point)) { launch(victim, victim.torso, dir.x, dir.y, 10 * w.power); return }
  if (T.knockback) launch(victim, victim.torso, dir.x, dir.y, T.knockback * w.power)
  if (T.rebound) {   // (bonk: back the way it came, and up)
    const v = w.body.getLinearVelocity()
    w.body.setLinearVelocity(new Vec2(-v.x * 0.3, Math.abs(v.x) * 0.25 + 3))
  }
  if (!T.impale || w.victim) return
  w.victim = victim   // impaled: carried along on it
  victim.stun(10)     // (limp until it lets go of them)
  const v = w.body.getLinearVelocity()
  w.body.setLinearVelocity(new Vec2(v.x * T.impale.carrySlow, v.y * T.impale.carrySlow))
}

const flightDir = w => ({ x: Math.cos(w.heading), y: Math.sin(w.heading) })

// A throw that hits something costs its uses (once a throw). Returns true if that snapped it.
function wear(game, w, p) {
  if (w.wore) return false
  w.wore = true
  if ((w.uses -= WEAPON_TYPES[w.typeName].throw.cost) > 0) return false
  game.events.push({ type: 'weaponBreak', x: r3(p.x), y: r3(p.y), typeName: w.typeName })
  remove(game, w)
  return true
}

// It sticks in what it hit, its tip a little way in. In the side of something solid that doesn't
// It ran into the level: it lands on it, if it lands on that (see FLIGHT).
function land(game, w, hit) {
  const flight = flightOf(WEAPON_TYPES[w.typeName])
  if (flight.sticks(w, hit)) flight.lands(game, w, hit)
}

// It sticks in what it hit, `at` (its grip and angle: its tip a little way in). In the side of something
// solid that doesn't move, one that makes a peg is a solid peg; someone on it is pinned there a moment
// (else they drop off).
function stick(game, w, hit, at) {
  const type = WEAPON_TYPES[w.typeName]
  game.world.destroyBody(w.body)
  w.body = w.head = null
  w.state = 'stuck'
  w.x = at.x; w.y = at.y; w.angle = at.angle
  w.ground = { body: hit.other, local: hit.other.getLocalPoint(new Vec2(w.x, w.y)), angle: w.angle - hit.other.getAngle() }
  const wall = Math.abs(hit.normal.x) > 0.7 && hit.other.isStatic()
  if (type.throw.peg && wall) w.body = makePeg(game, w)
  if (w.victim && w.body) w.pinTime = type.throw.impale.pin
  else letGo(w)
}

// A solid peg sticking out of a wall: stand on it.
function makePeg(game, w) {
  const type = WEAPON_TYPES[w.typeName]
  const body = game.world.createBody({ type: 'static', position: new Vec2(w.x, w.y), angle: w.angle })
  addWeaponFixtures(body, type, 1, { friction: 0.8 }, w.side)
  body.setUserData({ kind: 'peg', weapon: w })
  return body
}

// Let go of whoever's impaled on it or pinned to it (still limp a moment).
function letGo(w) {
  if (!w.victim) return
  w.victim.stunTimer = Math.min(w.victim.stunTimer, 0.6)
  w.victim = null
  w.pinTime = 0
}

function remove(game, w) {
  letGo(w)
  if (w.body) game.world.destroyBody(w.body)
  w.body = null
  w.gone = true
}

// What it can stick into, falling: anything solid but people, pumpkins, crows and other weapons.
function sticksTo(body) {
  const ud = body.getUserData()
  return !ud || !['player', 'pumpkin', 'crow', 'weapon', 'thrown', 'peg'].includes(ud.kind)
}
// (a bale it was stuck in broke: its body is gone)
const gone = body => { const ud = body.getUserData(); return !!(ud && ud.bale && ud.bale.broken) }

// A trap come to rest: it lies there (see liesThere), armed if it's lying tines up (within 45° of straight
// up); tines down, it's just a rake lying there.
function restsAsTrap(game, w) {
  liesThere(game, w)
  w.armed = w.state === 'stuck' && -Math.cos(w.angle) * w.side > Math.SQRT1_2   // (which way its teeth point: its -y, on its side)
}

// An armed trap: anyone touching its tines sets it off (its handle smacks them; see trap in weaponTypes.js).
function checkTrap(game, w) {
  const type = WEAPON_TYPES[w.typeName], T = type.throw.trap
  const teeth = headOf(type).edge.flatMap(([x, y]) => [toWorld(w, w.angle, w.side, [x, y]), toWorld(w, w.angle, w.side, [x, 0])])
  const victim = game.players.find(p => !p.out && !p.removed && teeth.some(t => p.partAt(t, 0.04)))
  if (!victim) return
  w.armed = false
  const head = toWorld(w, w.angle, w.side, headOf(type).point), c = victim.torso.getPosition()
  victim.takeHit(game, T.damage, T.stun, c)
  victim.stun(T.stun)
  launch(victim, victim.torso, Math.sign(head.x - w.x) || 1, 0.6, T.knockback)   // (knocked back off the end, away from the handle)
  game.events.push({ type: 'hit', x: r3(c.x), y: r3(c.y) })
  if ((w.uses -= T.cost) <= 0) {
    game.events.push({ type: 'weaponBreak', x: r3(head.x), y: r3(head.y), typeName: w.typeName })
    remove(game, w)
    return
  }
  w.smack = { t: 0 }
}

// A trap going off: the handle swings up (round the head) and back down, over trap.time s.
function swingSmack(w, dt) {
  const type = WEAPON_TYPES[w.typeName], T = type.throw.trap
  if ((w.smack.t += dt) >= T.time) { w.smack = null; return }
  const pivot = toWorld(w, w.angle, w.side, headOf(type).point), rx = w.x - pivot.x, ry = w.y - pivot.y
  const lift = Math.sign(rx) * Math.sin(Math.PI * w.smack.t / T.time) * 1.3, c = Math.cos(lift), s = Math.sin(lift)
  w.x = pivot.x + rx * c - ry * s
  w.y = pivot.y + rx * s + ry * c
  w.angle += lift
}

// Hooked by a haul (the Rake's Long Pull): it's dragged along by its point, lying as it was (haulWeapon: its
// point to `at`), until let go (letGoWeapon: it falls point first from there). A trap hooked is disarmed.
export function hookWeapon(w) {
  letGo(w)
  if (w.body) w.body.getWorld().destroyBody(w.body)
  Object.assign(w, { state: 'hauled', body: null, ground: null, armed: false, smack: null })
}
export function haulWeapon(w, at) {
  const out = toWorld({ x: 0, y: 0 }, w.angle, w.side, headOf(WEAPON_TYPES[w.typeName]).point)   // (grip → point)
  w.x = at.x - out.x
  w.y = at.y - out.y
}
export function letGoWeapon(w) {
  if (w.state !== 'hauled') return
  const type = WEAPON_TYPES[w.typeName], tip = pointOf(type, w, w.angle, w.side), angle = fallAngle(type, w.side)
  const out = toWorld({ x: 0, y: 0 }, angle, w.side, headOf(type).point)
  Object.assign(w, { state: 'falling', angle, x: tip.x - out.x, y: tip.y + 0.2 - out.y, vy: 0 })   // (its point just above where it was)
}

// A weapon lying about (stuck in something, or falling) within `pad` of point p (anywhere along it), or null.
export function looseWeaponAt(game, p, pad) {
  return game.looseWeapons.find(w => {
    if (w.gone || (w.state !== 'stuck' && w.state !== 'falling')) return false
    return distToSegment(p, w, pointOf(WEAPON_TYPES[w.typeName], w, w.angle, w.side)) < pad + 0.1
  }) || null
}

// What a loose weapon does each step, by its state.
const STATES = {
  flying: (game, w, dt) => fly(game, w, dt),
  stuck: (game, w, dt) => stayStuck(game, w, dt),
  falling: (game, w, dt) => fall(game, w, dt),
  hauled: () => {},   // (it goes where it's dragged: see haulWeapon)
}

export function updateLooseWeapons(game, dt) {
  for (const hit of game.weaponHits) {
    if (hit.w.state !== 'flying' || hit.w.gone) continue
    const ud = hit.other.getUserData()
    HIT[ud && ud.kind]?.(game, hit.w, ud, hit)
  }
  game.weaponHits.length = 0
  for (const w of game.looseWeapons) {
    if (w.gone) continue
    STATES[w.state](game, w, dt)
    if (w.y < CONFIG.killY) remove(game, w)
  }
  game.looseWeapons = game.looseWeapons.filter(w => !w.gone)
}

// Thrown: point first or spinning (see FLIGHT), carrying whoever's on it.
function fly(game, w, dt) {
  const body = w.body, v = body.getLinearVelocity(), p = body.getPosition(), type = WEAPON_TYPES[w.typeName]
  if ((w.age += dt) >= GRACE && w.age - dt < GRACE) {   // (from now on it can hit its thrower too)
    for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: 0, categoryBits: COLLIDE.weapon, maskBits: 0xFFFF & ~COLLIDE.pumpkin })
  }
  flightOf(type).steer(w, body, v, p)
  w.vel = { x: v.x, y: v.y }   // (how it was going, before anything it hits next step)
  w.justBounced = false
  if (Math.hypot(v.x, v.y) > 1) w.heading = Math.atan2(v.y, v.x)
  w.x = p.x; w.y = p.y; w.angle = body.getAngle()
  const tip = pointOf(type, w, w.angle, w.side), dir = flightDir(w)
  // a Big Gourd shield in the way blocks it: it drops
  if (game.players.some(pl => !(pl === w.thrower && w.age < GRACE) && pl.tryBlock(game, tip, 0.1, dir))) {
    letGo(w)
    game.world.destroyBody(body)
    Object.assign(w, { state: 'falling', body: null, angle: fallAngle(type, w.side), vy: 0 })
    return
  }
  if (w.victim) {
    if (w.victim.out || w.victim.removed) letGo(w)
    else pullTo(w.victim, tip, v)
  }
  w.still = Math.hypot(v.x, v.y) < REST.speed ? w.still + dt : 0
  if (w.still >= REST.time) settle(game, w)
}

// Come to rest (without sticking into anything): it lies there (see FLIGHT).
const settle = (game, w) => flightOf(WEAPON_TYPES[w.typeName]).rests(game, w)

// It lies where it is, on what it's lying on (or, on nothing solid, it falls).
function liesThere(game, w) {
  let under = null
  for (let ce = w.body.getContactList(); ce && !under; ce = ce.next) if (ce.contact.isTouching() && sticksTo(ce.other)) under = ce.other
  letGo(w)
  game.world.destroyBody(w.body)
  w.body = w.head = null
  if (!under) { Object.assign(w, { state: 'falling', angle: fallAngle(WEAPON_TYPES[w.typeName], w.side), vy: 0 }); return }
  w.state = 'stuck'
  w.ground = { body: under, local: under.getLocalPoint(new Vec2(w.x, w.y)), angle: w.angle - under.getAngle() }
}

// Stuck: riding along with what it's in (falling again if that breaks), holding someone pinned a while.
function stayStuck(game, w, dt) {
  if (gone(w.ground.body)) {
    letGo(w)
    if (w.body) game.world.destroyBody(w.body)
    Object.assign(w, { state: 'falling', body: null, ground: null, angle: fallAngle(WEAPON_TYPES[w.typeName], w.side), vy: 0 })
    return
  }
  const { body, local, angle } = w.ground
  const p = body.getWorldPoint(local)
  w.x = p.x; w.y = p.y; w.angle = body.getAngle() + angle
  if (w.armed) checkTrap(game, w)
  if (w.smack) swingSmack(w, dt)
  if (w.gone || !w.victim) return
  if ((w.pinTime -= dt) <= 0 || w.victim.out || w.victim.removed) { letGo(w); return }
  w.victim.stun(0.3)
  pullTo(w.victim, pointOf(WEAPON_TYPES[w.typeName], w, w.angle, w.side), { x: 0, y: 0 })
}

// Someone on a weapon's tip goes where it goes (their middle on it).
function pullTo(victim, tip, vel) {
  const c = victim.torso.getPosition()
  victim.setVelocity(vel.x + (tip.x - c.x) * FOLLOW, vel.y + (tip.y - c.y) * FOLLOW)
}

// Falling: straight down, blade first, until it sticks into the first thing under it.
function fall(game, w, dt) {
  w.vy = Math.max(w.vy - CONFIG.gravity * dt, -MAX_FALL)
  const type = WEAPON_TYPES[w.typeName]
  const from = pointOf(type, w, w.angle, w.side), to = new Vec2(from.x, from.y + w.vy * dt)
  let hit = null
  game.world.rayCast(new Vec2(from.x, from.y), to, (fixture, point, normal, fraction) => {
    if (!sticksTo(fixture.getBody())) return -1
    hit = { body: fixture.getBody(), y: point.y }
    return fraction
  })
  if (!hit) { w.y += w.vy * dt; return }
  w.y += hit.y - SINK - from.y   // (the tip a little way in)
  w.state = 'stuck'
  w.ground = { body: hit.body, local: hit.body.getLocalPoint(new Vec2(w.x, w.y)), angle: w.angle - hit.body.getAngle() }
}

// Weapons stuck in something, as pickups (see pickups.js): you stand by (or on) it and pull it out by
// its grip. (Where it "sits": its lowest point, under the middle of it.)
export function weaponPickups(game) {
  return game.looseWeapons.filter(w => w.state === 'stuck').map(w => {
    const tip = pointOf(WEAPON_TYPES[w.typeName], w, w.angle, w.side)
    return {
      key: w, x: (w.x + tip.x) / 2, y: Math.min(w.y, tip.y), at: { x: w.x, y: w.y, r: 0.2 }, time: CONFIG.weapon.yankTime,
      take: player => {
        remove(game, w)
        game.looseWeapons = game.looseWeapons.filter(q => q !== w)
        if (player.weapon) player.weapon.addBlade(w.uses)   // (the other of a pair: see HeldWeapon.takes)
        else player.holdWeapon(new HeldWeapon(w.typeName, w.uses, 1))   // (its head goes on whichever side they face)
      },
    }
  })
}
