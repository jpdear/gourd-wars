import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { openBlackHole } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { makeCode, packInput, packSnapshot, unpackInput, unpackSnapshot } from '../src/net/protocol.js'

it('sends input compactly and gets the same input back', () => {
  const input = { ...emptyInput(), left: true, crouch: true, throw: true, ragdoll: true, aimX: 12.3456, aimY: 7.891 }
  expect(unpackInput(packInput(input))).toEqual({ ...input, aimX: 12.35, aimY: 7.89 })
  expect(unpackInput({})).toEqual(emptyInput())   // (garbage in: nothing pressed)
})

it('sends snapshots compactly and gets the same snapshot back', () => {
  const game = createGame()
  game.mapChoice = 'testing'   // (bales, a moving platform)
  resetRound(game)
  spawnPumpkin(game, 'homing', new Vec2(10, 10), new Vec2(5, 2), game.players[0])
  spawnPumpkin(game, 'boomerang', new Vec2(20, 10), new Vec2(-5, 2), game.players[1])
  spawnPumpkin(game, 'bouncebomb', new Vec2(15, 10), new Vec2(3, 2), game.players[0])   // (a fuse: only on fused ones)
  openBlackHole(game, 16, 14, PUMPKIN_TYPES.blackhole.hole, 0.5)
  game.strikes.push({ id: game.nextStrikeId++, x: 24, y: 4.4, power: 1, age: 0.2, airdrop: null })
  Object.assign(game.bales[0], { frozenTimer: 1, floatTimer: 1 })
  game.bales[1].stickyTimer = 1
  spawnPumpkin(game, 'chomper', new Vec2(27, 5), new Vec2(0, -5), game.players[0])   // (planted on the floor: a trap)
  for (let i = 0; i < 5; i++) stepGame(game, [emptyInput(), emptyInput()])
  const snap = makeSnapshot(game)
  for (const k of ['pumpkins', 'bales', 'holes', 'strikes', 'traps', 'movers', 'patches']) expect(snap[k].length).toBeGreaterThan(0)
  const packed = JSON.parse(JSON.stringify(packSnapshot(snap)))   // (through JSON, like the network)
  expect(Array.isArray(packed.pumpkins[0])).toBe(true)
  expect(unpackSnapshot(packed)).toEqual(JSON.parse(JSON.stringify(snap)))   // (JSON turns -0 into 0)
})

it('makes 4-character join codes without look-alike characters', () => {
  for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
})
