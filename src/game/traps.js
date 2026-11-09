// CHOMPERS — what a thrown Chomper gourd turns into (see the 'chomper' pumpkin type). Coming down on a
// floor (a platform, a moving platform, a hay bale: it rides along on it), it plants itself there and
// splits open, its two halves lying flat on the ground; once it's open, anyone who touches it (its
// thrower too) is chomped: hurt, and stuck in place a while (see Player.trap), the trap clamped shut on
// whatever it bit. Thrown straight into someone, it bites them right away. Unused, it shrivels away
// after a while; done biting, it does too.
//
// game.traps: { id, on (the body it sits on, or the part it's biting), local (where on it), turn (its
//   angle on it), x, y, angle (in the world), age, victim (biting: who), hold (biting: s left) }

import { Vec2 } from 'planck'
import { breakPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { r3 } from '../util/math.js'

const T = () => PUMPKIN_TYPES.chomper.trap   // (read live: the tuning panel can change it)
const FLOORS = new Set(['platform', 'bale'])  // (what a trap can sit on)

export function clearTraps(game) {
  game.traps = []
}

// A thrown Chomper touched the level (or a bale): if there's floor right under it, it plants itself
// there. (Off a wall or a ceiling it just bounces on.)
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
  addTrap(game, floor.body, floor.point, floor.angle)
  pk.used = true
  breakPumpkin(game, pk)
}

// A thrown Chomper flew right into someone: it bites `part` (one of their bodies) at once. (A biting
// trap stands on the spot it holds, like one bitten shut on the floor: so this one stands half its
// length below where it hit, to be shut around it.)
export function biteWith(game, pk, player, part) {
  pk.used = true
  const p = pk.body.getPosition()
  bite(game, addTrap(game, part, { x: p.x, y: p.y - 1.2 * T().size }, 0), player, part)
}

export function updateTraps(game, dt) {
  const C = T()
  for (const t of game.traps) {
    t.age += dt
    const ud = t.on.getUserData()
    if (ud && ud.kind === 'bale' && ud.bale.broken) { wilt(game, t); continue }   // (its bale's gone)
    const p = t.on.getWorldPoint(new Vec2(t.local.x, t.local.y))
    t.x = p.x; t.y = p.y; t.angle = t.on.getAngle() + t.turn
    if (t.victim) {
      if ((t.hold -= dt) <= 0 || t.victim.out || t.victim.removed) wilt(game, t)
      continue
    }
    if (t.age >= C.life || t.y < -2) { wilt(game, t); continue }
    if (t.age < C.armTime) continue   // (still opening)
    const mouth = { x: t.x - Math.sin(t.angle) * 0.15, y: t.y + Math.cos(t.angle) * 0.15 }   // (over its open halves, where it sits)
    for (const pl of game.players) {
      if (pl.out || pl.removed) continue
      const part = pl.partAt(mouth, C.reach)
      if (part) { bite(game, t, pl, part, { x: part.getPosition().x, y: t.y }); break }   // (shut around their leg, on the floor)
    }
  }
  game.traps = game.traps.filter(t => !t.gone)
}

// How open each trap is (0 shut: biting, or a bud; 1 wide open), for the snapshot.
export const trapOpen = t => (t.victim ? 0 : Math.min(1, t.age / T().armTime))

function addTrap(game, body, at, angle) {
  const local = body.getLocalPoint(new Vec2(at.x, at.y))
  const t = {
    id: game.nextTrapId++, on: body, local: { x: local.x, y: local.y }, turn: angle - body.getAngle(),
    x: at.x, y: at.y, angle, age: 0, victim: null, hold: 0,
  }
  game.traps.push(t)
  return t
}

// The jaws snap shut on `part` of `player`, standing at `spot` (default: where it is): it hurts,
// they're stuck, and the trap goes with that part.
function bite(game, t, player, part, spot = { x: t.x, y: t.y }) {
  t.x = spot.x; t.y = spot.y
  const B = T().bite, at = part.getLocalPoint(new Vec2(t.x, t.y))
  Object.assign(t, { on: part, local: { x: at.x, y: at.y }, turn: t.angle - part.getAngle(), victim: player, hold: B.hold })
  player.takeHit(game, B.damage, 0, { x: t.x, y: t.y })
  player.trap(B.hold)
  game.events.push({ type: 'snap', x: r3(t.x), y: r3(t.y) })
}

function wilt(game, t) {
  t.gone = true
  game.events.push({ type: 'wilt', x: r3(t.x), y: r3(t.y) })
}
