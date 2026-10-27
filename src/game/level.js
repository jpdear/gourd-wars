// LEVEL PIECES — hay bales and hazards (pitchforks, scarecrow scythes, bonfires)
// Hazards aren't physics bodies; each step we just check what overlaps them.

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { BODY, CONFIG } from '../config.js'
import { currentMap } from './game.js'
import { breakPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { ease } from './transition.js'
import { lerp, r3 } from '../util/math.js'

export const BALE = { w: 1.0, h: 0.8, density: 7, friction: 0.45 }   // ~5.6 kg: slides along at about half walking speed when pushed

export function resetBales(game) {
  for (const b of game.bales) game.world.destroyBody(b.body)
  game.bales = []
  for (const def of currentMap(game).bales) spawnBale(game, def.x, def.y + BALE.h / 2)
}

function spawnBale(game, x, y) {
  const body = game.world.createBody({ type: 'dynamic', position: new Vec2(x, y), angularDamping: 0.5 })
  body.createFixture(new planck.Box(BALE.w / 2, BALE.h / 2), { density: BALE.density, friction: BALE.friction })
  const bale = {
    id: game.nextBaleId++, body, hp: CONFIG.level.baleHealth, maxHp: CONFIG.level.baleHealth, broken: false,
    frozenTimer: 0,   // Frost: slippery ice block
    stickyTimer: 0,   // Splat Pie: glues whoever touches it
    floatTimer: 0,    // Balloon: floating up
  }
  body.setUserData({ kind: 'bale', bale })
  game.bales.push(bale)
  return bale
}

// A pumpkin hit shoves a bale with the same push it would give a player, so heavier bales move less.
const PLAYER_MASS = 2.2
export function shoveBale(bale, dir, speed) {
  const m = PLAYER_MASS * speed
  bale.body.applyLinearImpulse(new Vec2(dir.x * m, dir.y * m), bale.body.getWorldCenter(), true)
}

// Frost: no friction for a while, so it slides a long way.
export function freezeBale(bale, seconds) {
  bale.frozenTimer = Math.max(bale.frozenTimer, seconds)
  setBaleFriction(bale, 0)
}
function setBaleFriction(bale, friction) {
  bale.body.getFixtureList().setFriction(friction)
  for (let e = bale.body.getContactList(); e; e = e.next) e.contact.resetFriction()   // touching contacts too
}

export function damageBale(game, bale, amount) {
  if (bale.broken) return
  bale.hp -= amount
  if (bale.hp <= 0) breakBale(game, bale, 'straw')
}

// how: 'straw' (smashed) or 'burn' (bonfire)
function breakBale(game, bale, how) {
  if (bale.broken) return
  bale.broken = true
  const p = bale.body.getPosition()
  game.events.push({ type: how, x: r3(p.x), y: r3(p.y) })
}

// The bale (if any) at `point`, within `pad` (checked in the bale's own rotated frame).
export function baleAt(game, point, pad) {
  return game.bales.find(b => {
    if (b.broken) return false
    const lp = b.body.getLocalPoint(point)
    return Math.abs(lp.x) < BALE.w / 2 + pad && Math.abs(lp.y) < BALE.h / 2 + pad
  })
}

export function updateBales(game, dt) {
  for (const b of game.bales) {
    if (b.broken) continue
    if (b.body.getPosition().y < CONFIG.killY) { b.broken = true; continue }
    if (b.frozenTimer > 0 && (b.frozenTimer -= dt) <= 0) setBaleFriction(b, BALE.friction)
    if (b.floatTimer > 0) {   // drift up like a floated player
      b.floatTimer -= dt
      const lift = CONFIG.gravity + (1.8 - b.body.getLinearVelocity().y) * 4
      b.body.applyForceToCenter(new Vec2(0, b.body.getMass() * lift), true)
    }
    if (b.stickyTimer > 0) {   // anyone touching the goo gets glued
      b.stickyTimer -= dt
      for (const pl of game.players) {
        if (pl.out) continue
        const touching = pl.parts.some(part =>
          [part.body.getWorldPoint(new Vec2(0, part.halfLen)), part.body.getWorldPoint(new Vec2(0, -part.halfLen))]
            .some(pt => baleAt(game, pt, 0.1) === b))
        if (touching) pl.glue(PUMPKIN_TYPES.pie.glue)
      }
    }
    // bonfires burn them (pitchforks and blades break them by touch)
    for (const [cx, cy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (inFire(game, b.body.getWorldPoint(new Vec2(cx * BALE.w / 2, cy * BALE.h / 2)), 0)) { breakBale(game, b, 'burn'); break }
    }
  }
  for (const b of game.bales) if (b.broken) game.world.destroyBody(b.body)
  game.bales = game.bales.filter(b => !b.broken)
}

// Pitchforks are solid: a wooden bar with a row of steel tines. Touching any of it is a KO.
export const TINE = { spacing: 0.24, halfW: 0.06, base: 0.12, tip: 0.55 }
export function pitchforkTines(sp) {
  const xs = []
  for (let x = sp.x - sp.w / 2 + TINE.spacing / 2; x < sp.x + sp.w / 2; x += TINE.spacing) xs.push(x)
  return xs
}
export function buildPitchforks(game, sp) {
  const body = game.world.createBody({ type: 'static' })
  body.createFixture(new planck.Box(sp.w / 2, TINE.base / 2, new Vec2(sp.x, sp.y + TINE.base / 2), 0), { friction: 0.8 })
  for (const x of pitchforkTines(sp)) {
    body.createFixture(new planck.Polygon([new Vec2(x - TINE.halfW, sp.y + TINE.base), new Vec2(x + TINE.halfW, sp.y + TINE.base), new Vec2(x, sp.y + TINE.tip)]), { friction: 0.8 })
  }
  body.setUserData({ kind: 'hazard', hazard: 'spikes' })
  return body
}

// A scarecrow's scythe is a solid blade spinning on a kinematic body (it shoves whatever it hits,
// and touching it is a KO). The arm itself is just for show.
const SCYTHE_BLADE = 1.2              // the outer 1.2 m of the arm carries the blade
export const SCYTHE_START = Math.PI / 2      // each round starts with the blade straight up
// The blade in the arm's own frame (pivot at 0, 0; arm along +x). It spins clockwise, so the
// sharp curve leads on the -y side.
export function scytheBladeShape(sc) {
  const r0 = sc.length - SCYTHE_BLADE, rm = r0 + 0.6, L = sc.length
  return [
    [[r0, 0.04], [rm, 0.04], [rm, -0.32], [r0, -0.22]],
    [[rm, 0.04], [L, 0.04], [L - 0.05, -0.16], [rm, -0.32]],
  ]
}
export function buildScythe(game, sc) {
  const body = game.world.createBody({ type: 'kinematic', position: new Vec2(sc.x, sc.y), angle: SCYTHE_START })
  for (const poly of scytheBladeShape(sc)) body.createFixture(new planck.Polygon(poly.map(([x, y]) => new Vec2(x, y))), { friction: 0.3 })
  body.setUserData({ kind: 'hazard', hazard: 'scythe' })
  return body
}
// Moving platforms: kinematic boxes that follow their trip exactly. Each step their velocity is set
// to land on the spot where they should be, so whatever stands on them is carried smoothly.
export function buildMover(game, m) {
  const body = game.world.createBody({ type: 'kinematic', position: new Vec2(m.x, m.y) })
  body.createFixture(new planck.Box(m.w / 2, m.h / 2), { friction: 0.8 })
  body.setUserData({ kind: 'platform', mover: true })
  return body
}
// where a mover is t seconds into the round: wait, glide over (easing in and out), wait, glide back
function moverPos(m, t) {
  const travel = Math.hypot(m.x2 - m.x, m.y2 - m.y) / m.speed
  if (travel < 1e-6) return { x: m.x, y: m.y }
  let u = t % (2 * (travel + m.pause)), f
  if (u < m.pause) f = 0
  else if ((u -= m.pause) < travel) f = ease(u / travel)
  else if ((u -= travel) < m.pause) f = 1
  else f = 1 - ease((u - m.pause) / travel)
  return { x: lerp(m.x, m.x2, f), y: lerp(m.y, m.y2, f) }
}
export function updateMovers(game, dt) {
  if (!game.transition) game.moverTime += dt   // (they wait at the start during the pan)
  for (const m of game.movers) {
    const to = moverPos(m.def, game.moverTime), at = m.body.getPosition()
    m.body.setLinearVelocity(new Vec2((to.x - at.x) / dt, (to.y - at.y) / dt))
  }
}

const scytheAngle = game => (game.scythes.length ? game.scythes[0].body.getAngle() : SCYTHE_START)

export function recordHazardContact(game, fixture, other) {
  const ud = fixture.getBody().getUserData()
  if (ud && ud.kind === 'hazard') game.hazardHits.push(other.getBody())
}

// Bonfires are just a zone (flames).
const fireBox = f => ({ x0: f.x - f.w / 2, x1: f.x + f.w / 2, y0: f.y, y1: f.y + 0.9 })
const inBox = (b, p, pad) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.y > b.y0 - pad && p.y < b.y1 + pad
export const inFire = (game, p, pad) => currentMap(game).fires.some(f => inBox(fireBox(f), p, pad))

// Whatever touched a pitchfork or a blade this step: players are KO'd, pumpkins and bales break.
// Bonfires burn players and pop them out.
export function updateHazards(game, dt) {
  for (const body of game.hazardHits) {
    const ud = body.getUserData()
    if (!ud) continue
    if (ud.kind === 'player') ud.player.kill(game)
    else if (ud.kind === 'pumpkin') breakPumpkin(game, ud.pumpkin)
    else if (ud.kind === 'bale') breakBale(game, ud.bale, 'straw')
  }
  game.hazardHits.length = 0

  const L = CONFIG.level
  for (const pl of game.players) {
    if (pl.dead || game.transition) continue   // (being carried across a map: no bonfires)
    pl.hopCooldown = Math.max(0, pl.hopCooldown - dt)
    const burning = pl.parts.some(part => {
      const r = part.name === 'head' ? BODY.headR : part.name === 'torso' ? BODY.torsoHalfW : BODY.limbHalfW
      return [part.body.getWorldPoint(new Vec2(0, part.halfLen)), part.body.getPosition(), part.body.getWorldPoint(new Vec2(0, -part.halfLen))]
        .some(pt => inFire(game, pt, r))
    })
    if (!burning || pl.ko) { pl.fireTimer = 0.2; continue }   // (so the first touch burns right away)
    pl.fireTimer += dt
    const pos = pl.torso.getPosition()
    if (pl.fireTimer >= 0.2) {
      pl.fireTimer -= 0.2
      pl.takeHit(game, L.fireDps * 0.2, 0.6, pos)
      game.events.push({ type: 'burn', x: r3(pos.x), y: r3(pos.y - 0.5), small: true })
    }
    if (pl.hopCooldown <= 0) {   // pop up out of the flames
      for (const part of pl.parts) {
        const v = part.body.getLinearVelocity()
        part.body.setLinearVelocity(new Vec2(v.x, L.fireHop))
      }
      pl.jumpLock = 0.25
      pl.hopCooldown = 0.35
    }
  }
}
