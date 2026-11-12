import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'

const D = PUMPKIN_TYPES.daze
// Practice on The Patch: you and a dummy, standing.
function setup() {
  const game = createGame()
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n, dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [emptyInput(), dummyInput]) }
// A Dizzy Gourd thrown hard at the dummy's `part` (a body: its torso, its head) from 1.5 m to its left.
function bonk(game, me, part) {
  const at = part.getPosition()
  const pk = spawnPumpkin(game, 'daze', new Vec2(at.x - 1.5, at.y), new Vec2(26, 0), me)
  for (let i = 0; i < 20 && !pk.broken; i++) steps(game, 1)
  return pk
}

it('bonked: 10 dmg, knocked limp, then back up dizzy (stars all along), and it breaks on the hit', () => {
  const { game, me, dummy } = setup()
  const pk = bonk(game, me, dummy.torso)
  expect(pk.broken).toBe(true)   // (no bounce)
  expect(dummy.damageTaken).toBe(D.damage)
  expect(dummy.stunned).toBe(true)
  expect(dummy.dizzy).toBe(false)
  expect(makeSnapshot(game).players[1].dazed).toBe(true)
  steps(game, Math.ceil(D.daze.limp * 60) + 2)
  expect(dummy.stunned).toBe(false)
  expect(dummy.dizzy).toBe(true)
  expect(makeSnapshot(game).players[1].dazed).toBe(true)
  steps(game, Math.ceil(D.daze.dizzy * 60) + 2)
  expect(dummy.dazed).toBe(false)
  expect(makeSnapshot(game).players[1].dazed).toBe(false)
})

it('dizzy, left and right are swapped', () => {
  const { game, me, dummy } = setup()
  bonk(game, me, dummy.torso)
  steps(game, Math.ceil(D.daze.limp * 60) + 30)   // (back up)
  expect(dummy.dizzy).toBe(true)
  const x0 = dummy.torso.getPosition().x
  steps(game, 20, { ...emptyInput(), right: true })
  expect(dummy.torso.getPosition().x).toBeLessThan(x0 - 0.5)   // (holding right: off to the left)
})

it('a hit on the head dazes them twice as long', () => {
  const body = setup(), head = setup()
  bonk(body.game, body.me, body.dummy.torso)
  bonk(head.game, head.me, head.dummy.head)
  expect(head.dummy.dazedTimer).toBeGreaterThan(body.dummy.dazedTimer * 1.8)
})
