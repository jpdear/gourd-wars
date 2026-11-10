import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { explode } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'

const M = PUMPKIN_TYPES.landmine, T = M.trap
// Practice (no crows): you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a
// pumpkin patch at 16: keep clear of it).
function setup() {
  const game = createGame()
  game.crowTimer = Infinity
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n) => { for (let i = 0; i < n; i++) stepGame(game, [emptyInput(), emptyInput()]) }
function standAt(p, x, y = 4.4) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
// A Landmine dropped onto the floor at x, planted (and, `set`, done sinking in).
function plant(game, owner, x, set = true) {
  const n = game.traps.length
  spawnPumpkin(game, 'landmine', new Vec2(x, 5), new Vec2(0, -4), owner)
  for (let i = 0; i < 30 && game.traps.length === n; i++) steps(game, 1)
  if (set) steps(game, Math.ceil(T.armTime * 60) + 1)
  return game.traps[game.traps.length - 1]
}
const booms = game => game.events.filter(e => e.type === 'boom').length

it('lands on the floor and sinks in; stepped on, it blows up, launching whoever stepped on it', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 21)
  const mine = plant(game, me, 19)
  expect(mine.kind).toBe('landmine')
  expect(makeSnapshot(game).traps[0]).toMatchObject({ kind: 'landmine', open: 1 })
  game.events.length = 0
  standAt(dummy, 19)
  steps(game, 2)
  expect(game.traps).toHaveLength(0)
  expect(booms(game)).toBe(1)
  expect(dummy.damageTaken).toBeGreaterThan(10)
  expect(dummy.stunned).toBe(true)
  expect(dummy.torso.getLinearVelocity().y).toBeGreaterThan(8)   // (up it goes)
})

it('not while it\'s still sinking in', () => {
  const { game, me } = setup()
  standAt(me, 13)
  steps(game, 2)
  plant(game, me, 13.1, false)
  expect(game.traps).toHaveLength(1)
  expect(me.damageTaken).toBe(0)
  steps(game, Math.ceil(T.armTime * 60) + 2)
  expect(game.traps).toHaveLength(0)   // (set: and it's under you)
})

it('a thrown pumpkin hitting it sets it off', () => {
  const { game, me } = setup()
  standAt(me, 10)
  plant(game, me, 19)
  game.events.length = 0
  const pk = spawnPumpkin(game, 'classic', new Vec2(19, 5.8), new Vec2(0, -8), me)   // (smashing down onto it)
  for (let i = 0; i < 30 && game.traps.length; i++) steps(game, 1)
  expect(game.traps).toHaveLength(0)
  expect(booms(game)).toBe(1)
  expect(pk.broken).toBe(true)
})

it('a blast reaching it sets it off too (chain reactions)', () => {
  const { game, me } = setup()
  standAt(me, 10)
  plant(game, me, 18)
  plant(game, me, 19.2)
  plant(game, me, 22.5)   // (out of reach of the others' blasts)
  game.events.length = 0
  explode(game, 17.5, 4.6, { radius: 1, damage: 0, knockback: 0, stun: 0 }, 1)
  expect(booms(game)).toBe(3)   // (that one, then 18, then 19.2)
  steps(game, 1)
  expect(game.traps.map(t => t.x)).toEqual([expect.closeTo(22.5, 1)])
})

it('thrown straight into someone, it\'s just a small pop', () => {
  const { game, me, dummy } = setup()
  const c = dummy.torso.getPosition()
  const pk = spawnPumpkin(game, 'landmine', new Vec2(c.x - 1.5, c.y), new Vec2(20, 0), me)
  game.events.length = 0
  for (let i = 0; i < 20 && !pk.broken; i++) steps(game, 1)
  expect(dummy.damageTaken).toBeGreaterThan(0)
  expect(dummy.damageTaken).toBeLessThanOrEqual(M.damage)
  expect(booms(game)).toBe(0)
  expect(game.events.some(e => e.type === 'pop')).toBe(true)
  expect(game.traps).toHaveLength(0)
})

it('unused, it fizzles out after a while (no blast)', () => {
  const { game, me } = setup()
  plant(game, me, 13)
  game.events.length = 0
  steps(game, Math.ceil(T.life * 60) + 2)
  expect(game.traps).toHaveLength(0)
  expect(booms(game)).toBe(0)
})
