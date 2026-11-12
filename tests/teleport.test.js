import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { openBlackHole } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'

// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a pumpkin
// patch at 16); a ledge x 2 to 7, top 7.3, bottom 6.7; the top platform x 13 to 19, bottom 10.2.
function setup() {
  const game = createGame()
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n, mine = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [mine, emptyInput()]) }
function standAt(p, x, y = 4.4) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
const at = p => { const c = p.torso.getPosition(); return { x: c.x, y: c.y } }
const throwFrom = (game, owner, x, y, vx, vy) => spawnPumpkin(game, 'teleport', new Vec2(x, y), new Vec2(vx, vy), owner, null, -100)   // (its own group: it never touches its thrower)
const warps = (game, how) => game.events.filter(e => e.type === 'warp' && e.how === how).length

it('lands on the floor: its thrower is standing right there, in an instant', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  game.events.length = 0
  throwFrom(game, me, 19, 5, 0, -6)
  steps(game, 6)
  const c = at(me)
  expect(game.pumpkins).toHaveLength(0)
  expect(Math.abs(c.x - 19)).toBeLessThan(0.3)
  expect(c.y).toBeGreaterThan(4.4 + 0.9)   // (on the floor, not in it)
  expect(c.y).toBeLessThan(4.4 + 1.6)
  expect(warps(game, 'leave')).toBe(1)
  expect(warps(game, 'arrive')).toBe(1)
})

it('keeps your own speed', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  const pk = throwFrom(game, me, 19, 4.7, 0, -6)
  me.setVelocity(3, 0)
  steps(game, 1)
  expect(game.pumpkins).not.toContain(pk)
  expect(me.torso.getLinearVelocity().x).toBeGreaterThan(2)
})

it('hits someone: you swap places', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 20)
  steps(game, 2)
  const a = at(me), b = at(dummy)
  throwFrom(game, me, 18.5, 5.6, 12, 0)
  steps(game, 10)
  expect(Math.abs(at(me).x - b.x)).toBeLessThan(0.4)
  expect(Math.abs(at(dummy).x - a.x)).toBeLessThan(0.4)
  expect(dummy.damageTaken).toBe(0)
  expect(warps(game, 'arrive')).toBe(2)
})

it('hits a wall: you appear just off it, on the side it came from', () => {
  const { game, me, dummy } = setup()
  standAt(me, 12)
  standAt(dummy, 22)
  steps(game, 2)
  throwFrom(game, me, 8, 7, -10, 0)   // (into the right side of the ledge, x 7)
  steps(game, 8)
  expect(at(me).x).toBeGreaterThan(7.2)
  expect(at(me).x).toBeLessThan(7.8)
})

it('hits a ceiling: you appear hanging just under it', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  throwFrom(game, me, 16, 9.4, 0, 10)   // (up into the top platform's underside, 10.2)
  steps(game, 6)
  const y = at(me).y
  expect(y).toBeLessThan(10.2 - 0.7)
  expect(y).toBeGreaterThan(8.5)
})

it('falls off the map without hitting anything: nothing happens', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  const before = at(me)
  throwFrom(game, me, 25, 5, 3, 0)   // (past the floor's end: down into the void)
  steps(game, 120)
  expect(game.pumpkins).toHaveLength(0)
  expect(Math.abs(at(me).x - before.x)).toBeLessThan(0.5)
  expect(warps(game, 'leave')).toBe(0)
})

it('teleporting frees you from glue and from a Chomper', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  me.glue(3)
  game.traps.push({ id: 99, kind: 'chomper', victim: me, hold: 2, age: 1, x: 10, y: 4.4, angle: 0, on: game.mapBodies[0], local: { x: -6, y: 0.4 }, turn: 0 })
  me.trap(2)
  throwFrom(game, me, 19, 5, 0, -6)
  steps(game, 6)
  expect(me.stuck).toBe(false)
  expect(game.traps.find(t => t.id === 99)).toBeUndefined()
  expect(Math.abs(at(me).x - 19)).toBeLessThan(0.3)
})

it('a Big Gourd shield blocks it: you appear right in front of the shield', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 20)
  steps(game, 2)
  dummy.holdPumpkin('biggourd', 1, 1)
  steps(game, 20)
  const hand = dummy.handPosition()
  throwFrom(game, me, hand.x - 1.5, hand.y, 12, 0)
  steps(game, 10)
  expect(dummy.held).not.toBe(null)   // (the shield took it)
  expect(at(me).x).toBeLessThan(hand.x)
  expect(at(me).x).toBeGreaterThan(hand.x - 1)
})

it('swallowed by a Black Hole: nothing happens', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 22)
  steps(game, 2)
  const before = at(me)
  openBlackHole(game, 16, 8, PUMPKIN_TYPES.blackhole.hole, 0.3)
  throwFrom(game, me, 16, 8.6, 0, 0)
  steps(game, 20)
  expect(game.pumpkins.filter(pk => pk.typeName === 'teleport')).toHaveLength(0)
  expect(warps(game, 'leave')).toBe(0)
  expect(Math.abs(at(me).x - before.x)).toBeLessThan(1.5)
})
