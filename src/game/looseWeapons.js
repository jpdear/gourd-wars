// LOOSE WEAPONS — weapons nobody's holding (game.looseWeapons): falling in, flying (thrown), or stuck
// in something. Anyone with empty hands can pull a stuck one out with the harvest key (weaponPickups).
//
// Falling (a crow let go of it, or its holder was knocked out), a weapon isn't a physics body: it drops
// straight down blade first and sticks into the first thing under it.
//
// Thrown (Throw Weapon: see HeldWeapon in weapons.js), it's a real body flying point first. What its
// head runs into:
//   a player        hit (less on a weak throw); one that impales (the Pitchfork's javelin) carries them
//                   along on it
//   a hay bale      damaged and shoved, and it sticks in it
//   a crow          knocked down (see crows.js); it flies on
//   the level       it sticks in (platforms, walls, hazards). In the side of something (a wall), one that
//                   makes a peg is a solid peg there to stand on, until someone pulls it out. Someone
//                   impaled on it is pinned there a moment
//   a Big Gourd     the shield blocks it: it drops
// A throw that hits anything (a player, a bale, a crow) costs its cost in uses; a miss is free. With
// none left, it snaps on the hit.
//
// Stuck, it rides along with whatever it's stuck in (a moving platform, a bale), and falls again if
// that breaks.
//
// Each: { id, typeName, uses, x, y (its grip), angle (butt → head),
//   state: 'falling' | 'flying' | 'stuck',
//   vy (falling: m/s), body (flying: its body; stuck in a wall: its peg), ground (stuck: what it's in:
//   { body, local (the grip in that body's frame), angle (relative to it) }),
//   head (flying: its head fixture), thrower, power (0..1), age (flying), victim (flying: impaled on it;
//   stuck: pinned to it), pinTime }

import { Vec2 } from 'planck'
import { COLLIDE, CONFIG } from '../config.js'
import { knockDownCrow } from './crows.js'
import { damageBale, shoveBale, skyDrop } from './level.js'
import { launch } from './pumpkins.js'
import { WEAPON_TYPES, addWeaponFixtures, alongTool, tipOf } from './weaponTypes.js'
import { HeldWeapon } from './weapons.js'
import { r3 } from '../util/math.js'

const DOWN = -Math.PI / 2
const SINK = 0.12        // a stuck weapon's tip is this far into whatever it's in (m)
const MAX_FALL = 25      // m/s
const GRACE = 0.25       // a thrown weapon can't hit its thrower for this long (s)
const FOLLOW = 15        // someone impaled or pinned is pulled to its tip this hard (1/s)

// A weapon falls from (x, y) (where its grip is), blade first, with `uses` left (default: brand new).
export function dropWeapon(game, typeName, x, y, uses = WEAPON_TYPES[typeName].uses) {
  game.looseWeapons.push({ id: game.nextWeaponId++, typeName, uses, x, y, angle: DOWN, state: 'falling', vy: 0, body: null, ground: null })
}

// A brand new one falls in from the sky at x (see skyDrop).
export function dropFromSky(game, typeName, x) {
  dropWeapon(game, typeName, x, skyDrop(game, x, WEAPON_TYPES[typeName].grip))   // (pointing down: the butt end is above the grip)
}

// Thrown by `thrower`: its grip at `at`, flying point first at `vel`, with `uses` left; power 0..1 (how
// hard: a weak throw hits softer).
export function throwWeapon(game, thrower, typeName, uses, at, vel, power) {
  const type = WEAPON_TYPES[typeName], angle = Math.atan2(vel.y, vel.x)
  const body = game.world.createBody({ type: 'dynamic', position: new Vec2(at.x, at.y), angle, bullet: true, gravityScale: type.throw.gravityScale })
  const head = addWeaponFixtures(body, type, type.heft.mass, { filterGroupIndex: thrower.group, filterCategoryBits: COLLIDE.weapon, filterMaskBits: 0xFFFF & ~COLLIDE.pumpkin })
  body.setLinearVelocity(new Vec2(vel.x, vel.y))
  const w = { id: game.nextWeaponId++, typeName, uses, x: at.x, y: at.y, angle, state: 'flying', body, head, ground: null, thrower, power, age: 0, victim: null, pinTime: 0 }
  body.setUserData({ kind: 'thrown', weapon: w })
  game.looseWeapons.push(w)
  return w
}

export function clearLooseWeapons(game) {
  for (const w of game.looseWeapons) if (w.body) game.world.destroyBody(w.body)
  game.looseWeapons = []
  game.weaponHits = []
}

// (begin-contact) A thrown weapon's head ran into something: dealt with after the physics step.
export function recordThrownContact(game, contact) {
  for (const [mine, other] of [[contact.getFixtureA(), contact.getFixtureB()], [contact.getFixtureB(), contact.getFixtureA()]]) {
    const ud = mine.getBody().getUserData()
    if (!ud || ud.kind !== 'thrown' || ud.weapon.state !== 'flying' || mine !== ud.weapon.head) continue
    const m = contact.getWorldManifold(null)
    const p = m && m.points.length ? m.points[0] : mine.getBody().getWorldCenter()
    game.weaponHits.push({ w: ud.weapon, other: other.getBody(), point: { x: p.x, y: p.y }, normal: m ? { x: m.normal.x, y: m.normal.y } : { x: 0, y: 1 } })
  }
}

// (pre-solve) A thrown weapon passes through people and crows (we handle hitting them), and nobody
// bumps against the peg they're pinned to.
export function looseContactEnabled(a, b) {
  for (const [ud, other] of [[a, b], [b, a]]) {
    if (!ud || !other) continue
    if (ud.kind === 'thrown' && (other.kind === 'player' || other.kind === 'crow')) return false
    if (ud.kind === 'peg' && other.kind === 'player' && other.player === ud.weapon.victim) return false
  }
  return true
}

// What a thrown weapon does to what its head runs into, by what that is. (Anything else: nothing.)
const HIT = {
  player: (game, w, ud, hit) => hitPlayer(game, w, ud.player, hit),
  bale: (game, w, ud, hit) => {
    const type = WEAPON_TYPES[w.typeName], dir = flightDir(w)
    damageBale(game, ud.bale, type.throw.damage * w.power * CONFIG.weapon.baleMultiplier)
    shoveBale(ud.bale, dir, 8 * w.power)
    game.events.push({ type: 'hit', x: r3(hit.point.x), y: r3(hit.point.y) })
    if (!wear(game, w, hit.point)) stick(game, w, hit)
  },
  crow: (game, w, ud, hit) => {   // (a crow flying over; one already knocked down it just passes)
    if (ud.crow.state !== 'flying') return
    knockDownCrow(game, ud.crow)
    wear(game, w, hit.point)
  },
  platform: (game, w, ud, hit) => stick(game, w, hit),
  hazard: (game, w, ud, hit) => stick(game, w, hit),
}

function hitPlayer(game, w, victim, hit) {
  if (victim.dead || victim === w.victim || (victim === w.thrower && w.age < GRACE)) return
  const T = WEAPON_TYPES[w.typeName].throw, dir = flightDir(w)
  victim.takeHit(game, T.damage * w.power, T.stun, hit.point)
  game.events.push({ type: 'hit', x: r3(hit.point.x), y: r3(hit.point.y) })
  if (wear(game, w, hit.point)) { launch(victim, victim.torso, dir.x, dir.y, 10 * w.power); return }
  if (!T.impale || w.victim) return
  w.victim = victim   // impaled: carried along on it
  victim.stun(10)     // (limp until it lets go of them)
  const v = w.body.getLinearVelocity()
  w.body.setLinearVelocity(new Vec2(v.x * T.impale.carrySlow, v.y * T.impale.carrySlow))
}

const flightDir = w => ({ x: Math.cos(w.angle), y: Math.sin(w.angle) })

// A throw that hits something costs its uses. Returns true if that snapped it.
function wear(game, w, p) {
  if ((w.uses -= WEAPON_TYPES[w.typeName].throw.cost) > 0) return false
  game.events.push({ type: 'weaponBreak', x: r3(p.x), y: r3(p.y), typeName: w.typeName })
  remove(game, w)
  return true
}

// It sticks in what it hit, its tip a little way in. In the side of something solid that doesn't
// move, one that makes a peg is a solid peg; someone on it is pinned there a moment (else they drop off).
function stick(game, w, hit) {
  const type = WEAPON_TYPES[w.typeName], dir = flightDir(w)
  const tip = { x: hit.point.x + dir.x * SINK, y: hit.point.y + dir.y * SINK }
  const grip = alongTool(tip, w.angle, -(type.length - type.grip))
  game.world.destroyBody(w.body)
  w.body = w.head = null
  w.state = 'stuck'
  w.x = grip.x; w.y = grip.y
  w.ground = { body: hit.other, local: hit.other.getLocalPoint(new Vec2(grip.x, grip.y)), angle: w.angle - hit.other.getAngle() }
  const wall = Math.abs(hit.normal.x) > 0.7 && hit.other.isStatic()
  if (type.throw.peg && wall) w.body = makePeg(game, w)
  if (w.victim && w.body) w.pinTime = type.throw.impale.pin
  else letGo(w)
}

// A solid peg sticking out of a wall: stand on it.
function makePeg(game, w) {
  const type = WEAPON_TYPES[w.typeName]
  const body = game.world.createBody({ type: 'static', position: new Vec2(w.x, w.y), angle: w.angle })
  addWeaponFixtures(body, type, 1, { friction: 0.8 })
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

export function updateLooseWeapons(game, dt) {
  for (const hit of game.weaponHits) {
    if (hit.w.state !== 'flying' || hit.w.gone) continue
    const ud = hit.other.getUserData()
    HIT[ud && ud.kind]?.(game, hit.w, ud, hit)
  }
  game.weaponHits.length = 0
  for (const w of game.looseWeapons) {
    if (w.gone) continue
    if (w.state === 'flying') fly(game, w, dt)
    else if (w.state === 'stuck') stayStuck(game, w, dt)
    else fall(game, w, dt)
    if (w.y < CONFIG.killY) remove(game, w)
  }
  game.looseWeapons = game.looseWeapons.filter(w => !w.gone)
}

// Thrown: point first (it turns to face the way it's going), carrying whoever's on it.
function fly(game, w, dt) {
  const body = w.body, v = body.getLinearVelocity(), p = body.getPosition()
  if ((w.age += dt) >= GRACE && w.age - dt < GRACE) {   // (from now on it can hit its thrower too)
    for (let f = body.getFixtureList(); f; f = f.getNext()) f.setFilterData({ groupIndex: 0, categoryBits: COLLIDE.weapon, maskBits: 0xFFFF & ~COLLIDE.pumpkin })
  }
  if (Math.hypot(v.x, v.y) > 1) body.setTransform(p, Math.atan2(v.y, v.x))
  body.setAngularVelocity(0)
  w.x = p.x; w.y = p.y; w.angle = body.getAngle()
  const type = WEAPON_TYPES[w.typeName], tip = tipOf(type, w, w.angle), dir = flightDir(w)
  // a Big Gourd shield in the way blocks it: it drops
  if (game.players.some(pl => !(pl === w.thrower && w.age < GRACE) && pl.tryBlock(game, tip, 0.1, dir))) {
    letGo(w)
    game.world.destroyBody(body)
    Object.assign(w, { state: 'falling', body: null, angle: DOWN, vy: 0 })
    return
  }
  if (w.victim) {
    if (w.victim.out || w.victim.removed) letGo(w)
    else pullTo(w.victim, tip, v)
  }
}

// Stuck: riding along with what it's in (falling again if that breaks), holding someone pinned a while.
function stayStuck(game, w, dt) {
  if (gone(w.ground.body)) {
    letGo(w)
    if (w.body) game.world.destroyBody(w.body)
    Object.assign(w, { state: 'falling', body: null, ground: null, angle: DOWN, vy: 0 })
    return
  }
  const { body, local, angle } = w.ground
  const p = body.getWorldPoint(local)
  w.x = p.x; w.y = p.y; w.angle = body.getAngle() + angle
  if (!w.victim) return
  if ((w.pinTime -= dt) <= 0 || w.victim.out || w.victim.removed) { letGo(w); return }
  w.victim.stun(0.3)
  pullTo(w.victim, tipOf(WEAPON_TYPES[w.typeName], w, w.angle), { x: 0, y: 0 })
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
  const from = tipOf(type, w, w.angle), to = new Vec2(from.x, from.y + w.vy * dt)
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
    const tip = tipOf(WEAPON_TYPES[w.typeName], w, w.angle)
    return {
      key: w, x: (w.x + tip.x) / 2, y: Math.min(w.y, tip.y), at: { x: w.x, y: w.y, r: 0.2 }, time: CONFIG.weapon.yankTime,
      take: player => {
        remove(game, w)
        game.looseWeapons = game.looseWeapons.filter(q => q !== w)
        player.holdWeapon(new HeldWeapon(w.typeName, w.uses))
      },
    }
  })
}
