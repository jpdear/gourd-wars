import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { openBlackHole, tryBlock } from '../src/game/powers.js'
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

it('a Black Hole pulls players in from across the map and swallows them, then collapses', () => {
  const game = createGame()
  const [me, dummy] = game.players
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  const c = dummy.torso.getPosition()
  const startD = Math.hypot(me.torso.getPosition().x - c.x, me.torso.getPosition().y - c.y)
  openBlackHole(game, c.x, c.y + 1, PUMPKIN_TYPES.blackhole.hole, 1)
  stepGame(game, [emptyInput()])
  const d = () => Math.hypot(me.torso.getPosition().x - c.x, me.torso.getPosition().y - c.y)
  expect(d()).toBeLessThan(startD + 0.01)   // pulled toward it from the other side of the map
  let swallowed = false
  for (let i = 0; i < 120 && !swallowed; i++) {
    stepGame(game, [emptyInput()])
    swallowed = dummy.dead
  }
  expect(swallowed).toBe(true)   // (practice: they'll respawn)
  const H = PUMPKIN_TYPES.blackhole.hole
  for (let i = 0; i < (H.growTime + H.collapseTime) * 60 + 5; i++) stepGame(game, [emptyInput()])
  expect(game.holes).toHaveLength(0)
})
