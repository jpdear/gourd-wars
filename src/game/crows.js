// CROWS — how weapons get into a round. Every so often (the host's Weapon Drops setting) a crow
// flies across the top of the screen (under the roof, if the map has one) carrying a weapon, and
// lets go of it over a platform; it falls in blade first and sticks (see weapons.js).
//
// Hit the crow on its way over (a pumpkin, or a weapon's attack) and it lets go right there and
// falls, dazed: a little body on the floor, shoved around like anything else. Anyone with empty
// hands can pick it up (the harvest key) and throw it like a pumpkin (it's the "crow" pumpkin type):
// whoever it hits gets a pecking frenzy (it sits on their head pecking a while, then flies off). Left
// lying there, it comes to and flies off; thrown and missing, it flies off where it lands.
//
// game.crows: { id, state: 'flying' | 'down', body, carrying (weapon type | null), dropX (where it lets go),
//   dir (-1 / 1: which way it's flying or facing), downTime (s lying there) }
// game.pecks: { victim, t, tick } (a crow on someone's head)
// game.crowTimer: seconds until the next crow is sent

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { BODY, COLLIDE, CONFIG } from '../config.js'
import { currentMap } from './game.js'
import { inFire, skyCeiling } from './level.js'
import { pickWeaponType } from './weaponTypes.js'
import { dropNew } from './looseWeapons.js'
import { r3 } from '../util/math.js'

const FLYING = { categoryBits: COLLIDE.crow, maskBits: COLLIDE.pumpkin | COLLIDE.weapon }   // (only pumpkins and weapons hit it)
const DOWN = { categoryBits: COLLIDE.crow, maskBits: 0xFFFF & ~COLLIDE.pumpkin }             // (on the floor: everything but pumpkins)

// Start of a round: no crows, and the first one comes after a while.
export function clearCrows(game) {
  for (const c of game.crows) game.world.destroyBody(c.body)
  game.crows = []
  game.pecks = []
  game.crowTimer = CONFIG.crow.firstAfter + Math.random() * dropInterval(game) * 0.5
}

const dropInterval = game => CONFIG.crow.every[game.weaponSettings.drops] || Infinity

// A crow sets off now, carrying a weapon of this type, if there's somewhere to drop it. Returns it (or null).
export function sendCrow(game, typeName) {
  const y = flightHeight(), dropX = pickDropSpot(game, y)
  if (dropX === null) return null
  const dir = Math.random() < 0.5 ? 1 : -1, x = dir > 0 ? -1 : CONFIG.view.w + 1
  const body = game.world.createBody({ type: 'kinematic', position: new Vec2(x, y) })
  body.createFixture(new planck.Circle(CONFIG.crow.radius), { density: 2, friction: 0.5, restitution: 0.2, filterCategoryBits: FLYING.categoryBits, filterMaskBits: FLYING.maskBits })
  body.setLinearVelocity(new Vec2(dir * CONFIG.crow.speed, 0))
  const crow = { id: game.nextCrowId++, state: 'flying', body, carrying: typeName, dropX, dir, downTime: 0 }
  body.setUserData({ kind: 'crow', crow })
  game.crows.push(crow)
  return crow

  // (a little below the open sky everywhere along the way: the top of the screen, or under the roof)
  function flightHeight() {
    let top = CONFIG.view.h
    for (let x = 0; x <= CONFIG.view.w; x += 0.5) top = Math.min(top, skyCeiling(game, x))
    return top - 1
  }
}

// Somewhere over a platform (not a moving one, not into hazards or a bonfire) where a weapon let go of
// at height y lands. A few random tries; null if none worked.
function pickDropSpot(game, y) {
  const floors = currentMap(game).platforms.filter(p => !p.wall && p.w > 1)
  for (let tries = 0; tries < 12 && floors.length; tries++) {
    const p = floors[Math.floor(Math.random() * floors.length)]
    const x = p.x + (Math.random() - 0.5) * (p.w - 1)
    let lands = null
    game.world.rayCast(new Vec2(x, y), new Vec2(x, CONFIG.killY), (fixture, point, normal, fraction) => {
      const ud = fixture.getBody().getUserData()
      if (ud && (ud.kind === 'player' || ud.kind === 'pumpkin' || ud.kind === 'weapon' || ud.kind === 'crow')) return -1
      lands = ud && ud.kind === 'platform' && !ud.mover && !inFire(game, point, 0.3)
      return fraction
    })
    if (lands) return x
  }
  return null
}

// Hit by a pumpkin or a weapon: it lets go of what it's carrying and falls, dazed.
export function knockDownCrow(game, crow) {
  if (crow.state !== 'flying') return
  const p = crow.body.getPosition()
  if (crow.carrying) dropNew(game, crow.carrying, p.x, p.y - CONFIG.crow.talons, crow.dir)
  crow.carrying = null
  crow.state = 'down'
  crow.downTime = 0
  const body = crow.body
  body.setType('dynamic')
  body.getFixtureList().setFilterData({ categoryBits: DOWN.categoryBits, maskBits: DOWN.maskBits, groupIndex: 0 })
  body.setLinearVelocity(new Vec2(crow.dir * 2, 2))
  body.setAngularVelocity(-crow.dir * 6)
  body.setAwake(true)
  game.events.push({ type: 'feathers', x: r3(p.x), y: r3(p.y) })
}

// Crows lying dazed, as pickups (see pickups.js): it goes into your hands like a pumpkin.
export function crowPickups(game) {
  const r = CONFIG.crow.radius
  return game.crows.filter(c => c.state === 'down').map(c => {
    const p = c.body.getPosition()
    return {
      key: c, x: p.x, y: p.y - r, at: { x: p.x, y: p.y, r }, time: CONFIG.crow.pickTime,
      take: player => {
        removeCrow(game, c)
        player.holdPumpkin('crow', 1, 1)
      },
    }
  })
}

// A thrown crow hit someone: it sits on their head, pecking.
export function peck(game, victim) {
  const on = game.pecks.find(pk => pk.victim === victim)
  if (on) on.t = 0
  else game.pecks.push({ victim, t: 0, tick: 0 })
}

export function updateCrows(game, dt) {
  sendCrows(game, dt)
  const C = CONFIG.crow
  for (const c of game.crows) {
    const p = c.body.getPosition()
    if (c.state === 'flying') {
      if (c.carrying && (p.x - c.dropX) * c.dir >= 0) {   // over the spot: let go
        dropNew(game, c.carrying, p.x, p.y - CONFIG.crow.talons, c.dir)
        c.carrying = null
      }
      if (p.x < -2 || p.x > CONFIG.view.w + 2) c.gone = true   // (flown off)
    } else if ((c.downTime += dt) >= C.wakeTime || p.y < CONFIG.killY) flyOff(game, c)
  }
  for (const c of game.crows) if (c.gone) game.world.destroyBody(c.body)
  game.crows = game.crows.filter(c => !c.gone)

  for (const pk of game.pecks) {
    const v = pk.victim
    if (v.out || v.removed || (pk.t += dt) >= C.peck.time) { pk.done = true; continue }
    if ((pk.tick -= dt) <= 0) {
      pk.tick = C.peck.every
      const head = v.head.getPosition()
      v.takeHit(game, C.peck.damage, 0, head)
      game.events.push({ type: 'peck', x: r3(head.x + v.facing * BODY.headR), y: r3(head.y) })   // (feathers fly where the beak hits: their face)
    }
  }
  for (const pk of game.pecks) {
    if (!pk.done || pk.victim.removed) continue
    const head = pk.victim.head.getPosition()
    game.events.push({ type: 'crowAway', x: r3(head.x), y: r3(head.y + 0.3) })
  }
  game.pecks = game.pecks.filter(pk => !pk.done)
}

// Every so often a crow comes, bringing one of the weapons that are on, unless there are enough lying around.
function sendCrows(game, dt) {
  if (game.transition || game.weaponSettings.drops === 'off') return
  if ((game.crowTimer -= dt) > 0 || game.roundTime < CONFIG.crow.firstAfter) return
  game.crowTimer = dropInterval(game) * (0.75 + Math.random() * 0.5)
  const coming = game.looseWeapons.length + game.crows.filter(c => c.carrying).length
  const typeName = pickWeaponType(game.weaponSettings)
  if (coming < CONFIG.crow.maxLoose && typeName) sendCrow(game, typeName)
}

function flyOff(game, crow) {
  const p = crow.body.getPosition()
  if (p.y > CONFIG.killY) game.events.push({ type: 'crowAway', x: r3(p.x), y: r3(p.y) })
  crow.gone = true
}

function removeCrow(game, crow) {
  game.world.destroyBody(crow.body)
  game.crows = game.crows.filter(c => c !== crow)
}
