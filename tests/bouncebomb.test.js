import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { explode } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'

const B = PUMPKIN_TYPES.bouncebomb
// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a
// pumpkin patch at 16: keep clear of it).
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
const booms = game => game.events.filter(e => e.type === 'boom').length
const bomb = (game, x, y, vx, vy, owner) => spawnPumpkin(game, 'bouncebomb', new Vec2(x, y), new Vec2(vx, vy), owner)

it('bounces off the floor without breaking, then goes off when its fuse runs out', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  const b = bomb(game, 20, 7, 0, -6, null)
  steps(game, Math.floor(B.fuse * 60) - 5)
  expect(game.pumpkins).toContain(b)
  expect(b.hits).toBeGreaterThan(1)   // (bounced, more than once)
  expect(b.body.getPosition().y).toBeGreaterThan(4.4)
  game.events.length = 0
  steps(game, 10)
  expect(game.pumpkins).toHaveLength(0)
  expect(booms(game)).toBe(1)
})

it('bonks someone it hits (a push, no damage) and bounces back off them', () => {
  const { game, dummy } = setup()
  standAt(dummy, 20)
  steps(game, 2)
  const b = bomb(game, 18, 5.7, 10, 0, null)
  game.events.length = 0
  steps(game, 15)
  expect(dummy.damageTaken).toBe(0)
  expect(game.events.some(e => e.type === 'damage')).toBe(false)
  expect(game.pumpkins).toContain(b)
  expect(b.body.getLinearVelocity().x).toBeLessThan(0)   // (back the way it came)
})

it('can be caught in the air; it keeps ticking in your hand and goes off there', () => {
  const { game, me, dummy } = setup()
  standAt(me, 12)
  standAt(dummy, 21)
  steps(game, 2)
  const b = bomb(game, 12.3, 6.2, 0, 0, dummy)
  steps(game, 30)
  const fuseBefore = b.fuseLeft
  steps(game, 6, { ...emptyInput(), harvest: true })
  expect(me.held).toMatchObject({ typeName: 'bouncebomb' })
  expect(me.held.fuseLeft).toBeLessThan(fuseBefore)
  expect(game.pumpkins).toHaveLength(0)
  expect(makeSnapshot(game).players[0].heldFuse).toBeCloseTo(me.held.fuseLeft, 2)
  game.events.length = 0
  steps(game, Math.ceil(me.held.fuseLeft * 60) + 2)
  expect(me.held).toBe(null)
  expect(booms(game)).toBe(1)
  expect(me.damageTaken).toBeGreaterThan(10)
})

it('thrown again, it carries on with the fuse it had left', () => {
  const { game, me } = setup()
  standAt(me, 12)
  me.holdPumpkin('bouncebomb', 1, 1, 1.2)
  me.throwPumpkin(game)
  expect(game.pumpkins[0].fuseLeft).toBe(1.2)
  expect(makeSnapshot(game).pumpkins[0].fuse).toBe(1.2)
})

it('picked off its patch it is not ticking yet: its fuse starts when it leaves your hand', () => {
  const { game, me } = setup()
  standAt(me, 12)
  me.holdPumpkin('bouncebomb', 1, 1)
  steps(game, 120)
  expect(me.held.fuseLeft).toBeUndefined()
  expect(makeSnapshot(game).players[0].heldFuse).toBeUndefined()
  me.throwPumpkin(game)
  expect(game.pumpkins[0].fuseLeft).toBe(B.fuse)
})

it('another blast sets it off a moment later (chain reaction)', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  const b = bomb(game, 20, 4.4 + B.radius, 0, 0, null)
  steps(game, 2)
  explode(game, 21, 4.6, PUMPKIN_TYPES.boom.blast, 1)
  expect(b.fuseLeft).toBeLessThanOrEqual(B.chainDelay)
  game.events.length = 0
  steps(game, Math.ceil(B.chainDelay * 60) + 2)
  expect(game.pumpkins).toHaveLength(0)
  expect(booms(game)).toBe(1)
})

it('knocked out holding a ticking one: it drops, still ticking', () => {
  const { game, me } = setup()
  standAt(me, 12)
  me.holdPumpkin('bouncebomb', 1, 1, 2)
  me.knockOut(game)
  expect(me.held).toBe(null)
  expect(game.pumpkins).toHaveLength(1)
  expect(game.pumpkins[0].fuseLeft).toBe(2)
})
