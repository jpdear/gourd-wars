import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { tryBlock } from '../src/game/powers.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'

it('a Big Gourd shield cracking mid-throw leaves nothing to throw (no crash on release)', () => {
  const game = createGame()
  const me = game.players[0]
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  me.held = { typeName: 'biggourd', power: 1, ripeness: 1, blocks: 0 }
  stepGame(game, [{ ...emptyInput(), throw: true, aimX: 20, aimY: 5 }])   // start charging
  expect(me.charging).toBe(true)
  for (let i = 0; i < PUMPKIN_TYPES.biggourd.shieldBlocks; i++) tryBlock(game, me, me.handPosition(), 0.1, { x: -1, y: 0 })
  expect(me.held).toBeNull()
  expect(me.charging).toBe(false)
  expect(() => stepGame(game, [{ ...emptyInput(), throw: false, aimX: 20, aimY: 5 }])).not.toThrow()   // release
})
