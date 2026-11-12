// PLANTED GOURDS — what a thrown Chomper or Landmine turns into (see their pumpkin types' `trap`). Coming
// down on a floor (a platform, a moving platform, a hay bale: it rides along on it), it plants itself
// there; `armTime` s later it's set, and the first one to touch it (its thrower too) sets it off. What
// that does is its kind's (KINDS). Unused, it goes after `life` s.
//   chomper    splits open, its two halves lying flat on the ground. Stepped in, it's chomped shut
//              around their leg: hurt, and stuck in place a while (see Player.trap); then it shrivels.
//   landmine   sinks halfway into the floor, its stem blinking. Stepped on, it blows up (a blast out of
//              the floor: see explode in powers.js), launching whoever stepped on it. A thrown pumpkin
//              hitting it, or another blast reaching it, sets it off too.
// (Thrown straight into someone, neither plants: see their types' onHitPlayer.)
//
// game.traps: { id, kind (its pumpkin type's name), on (the body it sits on, or the part it's biting),
//   local (where on it), turn (its angle on it), x, y, angle (in the world), age, victim (a Chomper
//   biting: who), hold (s left) }

import { Vec2 } from 'planck'
import { explode } from './powers.js'
import { breakPumpkin, launch } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { r3 } from '../util/math.js'

const config = t => PUMPKIN_TYPES[t.kind].trap   // (read live: the tuning panel can change it)
const FLOORS = new Set(['platform', 'bale'])     // (what a trap can sit on)

// What each kind does, by kind:
//   touched(game, t, player, part)   someone touched it once it's set
//   explosive                        a thrown pumpkin or a blast sets it off (see detonate)
const KINDS = {
  chomper: { touched: (game, t, player, part) => bite(game, t, player, part) },
  landmine: {
    explosive: true,
    touched: (game, t, player) => {
      detonate(game, t)
      launch(player, player.torso, 0, 1, config(t).launch)   // (up and away, whoever stepped on it)
    },
  },
}

export function clearTraps(game) {
  game.traps = []
}

// A thrown Chomper or Landmine touched the level (or a bale): if there's floor right under it, it plants
// itself there. (Off a wall or a ceiling it just bounces on.)
export function plantTrap(game, pk) {
  const pos = pk.body.getPosition()
  let floor = null
  game.world.rayCast(pos, new Vec2(pos.x, pos.y - pk.radius - 0.25), (fixture, point, normal, fraction) => {
    const ud = fixture.getBody().getUserData()
    if (!ud || !FLOORS.has(ud.kind) || normal.y < 0.6) return -1   // (not a floor: look past it)
    floor = { body: fixture.getBody(), point: { x: point.x, y: point.y }, angle: Math.atan2(-normal.x, normal.y) }
    return fraction
  })
  if (!floor) return
  const local = floor.body.getLocalPoint(new Vec2(floor.point.x, floor.point.y))
  game.traps.push({
    id: game.nextTrapId++, kind: pk.typeName, on: floor.body, local: { x: local.x, y: local.y }, turn: floor.angle - floor.body.getAngle(),
    x: floor.point.x, y: floor.point.y, angle: floor.angle, age: 0, victim: null, hold: 0,
  })
  pk.used = true
  breakPumpkin(game, pk)
}

// A thrown Chomper flew right into someone: it chomps them (the bite's damage) and is used up. It
// doesn't hold them: only one they step in does.
export function biteWith(game, pk, player) {
  pk.used = true
  const p = pk.body.getPosition()
  player.takeHit(game, PUMPKIN_TYPES.chomper.trap.bite.damage, 0, p)
  game.events.push({ type: 'snap', x: r3(p.x), y: r3(p.y) })
}

// A blast at (x, y), `radius` m across: any explosive trap it reaches goes off too.
export function blastTraps(game, x, y, radius) {
  for (const t of game.traps) {
    if (!t.gone && KINDS[t.kind].explosive && Math.hypot(t.x - x, t.y - y) < radius) detonate(game, t)
  }
}

export function updateTraps(game, dt) {
  for (const t of game.traps) {
    if (t.gone) continue   // (set off by a blast this step)
    const C = config(t)
    t.age += dt
    const ud = t.on.getUserData()
    if (ud && ud.kind === 'bale' && ud.bale.broken) { goAway(game, t); continue }   // (its bale's gone)
    const p = t.on.getWorldPoint(new Vec2(t.local.x, t.local.y))
    t.x = p.x; t.y = p.y; t.angle = t.on.getAngle() + t.turn
    if (t.victim) {
      if ((t.hold -= dt) <= 0 || t.victim.out || t.victim.removed) goAway(game, t)
      continue
    }
    if (t.age >= C.life || t.y < -2) { goAway(game, t); continue }
    if (KINDS[t.kind].explosive && shotBy(game, t)) continue
    if (t.age < C.armTime) continue   // (still setting)
    const top = { x: t.x - Math.sin(t.angle) * 0.15, y: t.y + Math.cos(t.angle) * 0.15 }   // (just over where it sits)
    for (const pl of game.players) {
      if (pl.out || pl.removed) continue
      const part = pl.partAt(top, C.reach)
      if (part) { KINDS[t.kind].touched(game, t, pl, part); break }
    }
  }
  game.traps = game.traps.filter(t => !t.gone)
}

// How open each trap is (0 shut: biting, or just landed; 1 set), for the snapshot.
export const trapOpen = t => (t.victim ? 0 : Math.min(1, t.age / config(t).armTime))

// A thrown pumpkin broke (see breakPumpkin): right at an explosive trap, it sets it off. (Not one
// that broke planting itself.)
export function pumpkinBroke(game, pk) {
  if (pk.used) return
  for (const t of game.traps) if (!t.gone && KINDS[t.kind].explosive && hits(pk, t)) detonate(game, t)
}

// Is pumpkin `pk` right at trap `t` (touching it, about)?
const hits = (pk, t) => {
  const p = pk.body.getPosition(), C = config(t)
  return Math.hypot(p.x - (t.x - Math.sin(t.angle) * 0.1), p.y - (t.y + Math.cos(t.angle) * 0.1)) < pk.radius + C.reach
}

// A thrown pumpkin flying into an explosive trap breaks on it and sets it off. Returns true if one did.
function shotBy(game, t) {
  const pk = game.pumpkins.find(pk => !pk.broken && hits(pk, t))
  if (!pk) return false
  breakPumpkin(game, pk)   // (which sets it off: see pumpkinBroke)
  detonate(game, t)
  return true
}

// Someone stepped in a Chomper: the jaws snap shut around `part` of `player` (standing on the floor,
// around their leg): it hurts, they're stuck, and the trap goes with that part.
function bite(game, t, player, part) {
  t.x = part.getPosition().x
  const B = config(t).bite, at = part.getLocalPoint(new Vec2(t.x, t.y))
  Object.assign(t, { on: part, local: { x: at.x, y: at.y }, turn: t.angle - part.getAngle(), victim: player, hold: B.hold })
  player.takeHit(game, B.damage, 0, { x: t.x, y: t.y })
  player.trap(B.hold)
  game.events.push({ type: 'snap', x: r3(t.x), y: r3(t.y) })
}

// A Landmine goes off: the blast comes up out of the floor, a little above where it sits.
function detonate(game, t) {
  if (t.gone) return
  t.gone = true
  const C = config(t), up = C.blastHeight
  explode(game, t.x - Math.sin(t.angle) * up, t.y + Math.cos(t.angle) * up, C.blast, 1)
}

// Its time's up (or it's done biting, or what it sat on is gone): it shrivels away.
// Let go of whoever a Chomper has hold of (a Teleport gourd whisked them away): it wilts.
export function freeVictim(game, player) {
  for (const t of game.traps) if (t.victim === player && !t.gone) goAway(game, t)
}

function goAway(game, t) {
  t.gone = true
  game.events.push({ type: 'wilt', x: r3(t.x), y: r3(t.y) })
}
