import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'

const T = PUMPKIN_TYPES.chomper.trap
// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a
// pumpkin patch at 16: a pumpkin on it would break a Chomper).
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n, myInput = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [myInput, dummyInput]) }
function standAt(p, x, y) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
// A Chomper dropped onto the floor at x (from just above it), planted and opening.
function plant(game, owner, x, y = 4.4) {
  spawnPumpkin(game, 'chomper', new Vec2(x, y + 0.6), new Vec2(0, -4), owner)
  for (let i = 0; i < 30 && !game.traps.length; i++) steps(game, 1)
  return game.traps[0]
}

it('lands on the floor, plants itself and opens; walking into it, you\'re bitten and stuck (but can still throw)', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10, 4.4)
  standAt(dummy, 20, 4.4)
  const trap = plant(game, me, 18)
  expect(trap).toBeTruthy()
  expect(trap.y).toBeCloseTo(4.4, 1)
  expect(game.pumpkins).toHaveLength(0)
  steps(game, Math.ceil(T.armTime * 60) + 1)
  expect(makeSnapshot(game).traps[0]).toMatchObject({ open: 1, bite: false })
  steps(game, 60, emptyInput(), { ...emptyInput(), left: true })   // (the dummy walks into it)
  expect(dummy.trapped).toBe(true)
  expect(dummy.damageTaken).toBe(T.bite.damage)
  expect(makeSnapshot(game).traps[0]).toMatchObject({ open: 0, bite: true })
  expect(game.traps[0].y).toBeGreaterThan(4.3)   // (shut, standing on the floor where it bit: not sunk into it)
  const x = dummy.torso.getPosition().x
  dummy.held = { typeName: 'classic', power: 1, ripeness: 1, blocks: 0 }
  steps(game, 20, emptyInput(), { ...emptyInput(), left: true, jump: true, throw: true, aimX: 10, aimY: 6 })
  expect(Math.abs(dummy.torso.getPosition().x - x)).toBeLessThan(0.3)   // (held in place: no walking, no jumping)
  expect(dummy.torso.getPosition().y).toBeLessThan(6)
  steps(game, 1, emptyInput(), { ...emptyInput(), aimX: 10, aimY: 6 })   // (let go: thrown)
  expect(dummy.held).toBeNull()
  steps(game, Math.ceil(T.bite.hold * 60) + 2)
  expect(dummy.trapped).toBe(false)
  expect(game.traps).toHaveLength(0)   // (done biting: it wilts)
})

it('bites its own thrower too, but not while it\'s still opening', () => {
  const { game, me } = setup()
  standAt(me, 13, 4.4)
  steps(game, 2)
  plant(game, me, 13.1)
  expect(me.trapped).toBe(false)   // (opening)
  steps(game, Math.ceil(T.armTime * 60) + 2)
  expect(me.trapped).toBe(true)
})

it('unused, it wilts after a while', () => {
  const { game, me } = setup()
  plant(game, me, 13)
  game.events.length = 0
  steps(game, Math.ceil(T.life * 60) + 2)
  expect(game.traps).toHaveLength(0)
  expect(game.events.some(e => e.type === 'wilt')).toBe(true)
})

it('thrown right into someone, it just chomps them: the damage, but it doesn\'t hold them', () => {
  const { game, me, dummy } = setup()
  const c = dummy.torso.getPosition()
  const pk = spawnPumpkin(game, 'chomper', new Vec2(c.x - 1.5, c.y), new Vec2(20, 0), me)
  for (let i = 0; i < 20 && !dummy.damageTaken; i++) steps(game, 1)
  expect(dummy.damageTaken).toBe(T.bite.damage)
  expect(dummy.trapped).toBe(false)
  expect(pk.broken).toBe(true)
  expect(game.traps).toHaveLength(0)
})

it('off a wall it bounces on (no planting on walls)', () => {
  const { game, me } = setup('hayloft')   // (walls at x 0.8 and 31.2)
  const pk = spawnPumpkin(game, 'chomper', new Vec2(29.5, 9), new Vec2(15, 0), me)
  for (let i = 0; i < 12 && pk.hits === 0; i++) steps(game, 1)
  expect(pk.hits).toBe(1)
  expect(pk.broken).toBe(false)
  expect(game.traps).toHaveLength(0)
})

it('planted on a moving platform, it rides along', () => {
  const { game, me } = setup('testing')   // (a ferry over the pit: top 4.4)
  const ferry = game.movers[0].body.getPosition()
  plant(game, me, ferry.x)
  const trap = game.traps[0]
  expect(trap.on).toBe(game.movers[0].body)
  const x0 = trap.x, offset = x0 - ferry.x
  for (let i = 0; i < 300 && Math.abs(trap.x - x0) < 1; i++) steps(game, 1)   // (it waits a moment at each end)
  expect(Math.abs(trap.x - x0)).toBeGreaterThanOrEqual(1)
  expect(Math.abs(trap.x - game.movers[0].body.getPosition().x - offset)).toBeLessThan(0.05)
})
