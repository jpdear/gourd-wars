import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { addPlayer, createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'

const B = PUMPKIN_TYPES.buzzsaw
// Practice; everyone standing.
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n) => { for (let i = 0; i < n; i++) stepGame(game, game.players.map(() => emptyInput())) }
// Stand someone at x on the floor whose top is at y.
function standAt(p, x, y) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
// A Buzzsaw thrown flat and fast (full power) from (x, y) to the right.
const throwSaw = (game, owner, x, y, vx = B.throwSpeed.max) => spawnPumpkin(game, 'buzzsaw', new Vec2(x, y), new Vec2(vx, 0), owner)

it('goes right through everyone in a line, hitting each once, and keeps flying', () => {
  const { game, me, dummy } = setup()   // (The Patch: the main floor's top at 4.4, from x 9 to 23)
  const other = addPlayer(game, 2, { dummy: true })
  steps(game, 30)
  standAt(me, 10, 4.4)
  standAt(dummy, 14, 4.4)
  standAt(other, 17, 4.4)
  steps(game, 2)
  const saw = throwSaw(game, me, 11, dummy.torso.getPosition().y)
  const cuts = []
  for (let i = 0; i < 40 && saw.body.getPosition().x < 20; i++) { game.events.length = 0; steps(game, 1); cuts.push(...game.events.filter(e => e.type === 'pierce')) }
  expect(cuts).toHaveLength(2)   // (chips fly once per person it cuts through)
  expect(cuts[0].dx).toBeGreaterThan(0.9)   // (on ahead, the way it's going)
  expect(saw.broken).toBe(false)
  expect(saw.body.getPosition().x).toBeGreaterThanOrEqual(20)   // (past both)
  expect(dummy.damageTaken).toBe(B.damage)
  expect(other.damageTaken).toBe(B.damage)
  expect(me.damageTaken).toBe(0)
})

it('cuts through hay bales (damaging them) instead of breaking on them', () => {
  const { game, me } = setup('testing')   // (bales at x 10.4 and 11.45 on the left ground, top 4.4)
  standAt(me, 5, 4.4)
  steps(game, 2)
  const bales = game.bales.filter(b => b.body.getPosition().x < 12)
  const saw = throwSaw(game, me, 8, 4.8)
  for (let i = 0; i < 30 && saw.body.getPosition().x < 12.5; i++) steps(game, 1)
  expect(saw.broken).toBe(false)
  expect(saw.body.getPosition().x).toBeGreaterThanOrEqual(12.5)   // (past them: short of the ferry, which it does break on)
  const low = bales.filter(b => b.body.getPosition().y < 5)   // (the bottom two: right in its way)
  for (const b of low) expect(b.hp).toBeLessThan(b.maxHp)
})

it('breaks on the level', () => {
  const { game, me } = setup()
  const saw = spawnPumpkin(game, 'buzzsaw', new Vec2(16, 6), new Vec2(0, -20), me)   // (straight down into the floor)
  for (let i = 0; i < 30 && !saw.broken; i++) steps(game, 1)
  expect(saw.broken).toBe(true)
  expect(game.pumpkins).not.toContain(saw)
})

it('a Big Gourd shield still blocks it', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10, 4.4)
  standAt(dummy, 15, 4.4)
  dummy.facing = -1
  dummy.held = { typeName: 'biggourd', power: 1, ripeness: 1, blocks: 0 }
  steps(game, 10)
  const h = dummy.handPosition()
  const saw = throwSaw(game, me, 11, h.y)
  for (let i = 0; i < 30 && !saw.broken; i++) steps(game, 1)
  expect(saw.broken).toBe(true)
  expect(dummy.held.blocks).toBe(1)
  expect(dummy.damageTaken).toBe(0)
})
