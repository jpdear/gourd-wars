import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { sendCrow } from '../src/game/crows.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'

// Practice on The Patch: you (x 11) and a dummy, on the main platform (top at y 4.4). No crows but the
// ones a test sends (the schedule's are random: one could turn up mid-test).
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  game.crowTimer = Infinity
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }
const until = (game, done, max = 900) => { for (let i = 0; i < max && !done(); i++) steps(game, 1); return done() }

it('a crow flies across the top of the screen, then off the other side', () => {
  const { game } = setup()
  const crow = sendCrow(game)
  expect(crow.body.getPosition().y).toBeGreaterThan(CONFIG.view.h - 2)   // (along the top of the screen)
  expect(until(game, () => !game.crows.length)).toBe(true)
})

it('under a roof, a crow flies under it', () => {
  const { game } = setup('hayloft')   // (the barn's ceiling: underside at y 17.3)
  const crow = sendCrow(game)
  expect(crow.body.getPosition().y).toBeLessThan(17.3 - CONFIG.crow.radius)
})

// A crow hanging still at (x, y) (flying) to throw things at.
function crowAt(game, x, y) {
  const crow = sendCrow(game)
  crow.body.setTransform(new Vec2(x, y), 0)
  crow.body.setLinearVelocity(new Vec2(0, 0))
  return crow
}

it('hit by a pumpkin, a crow falls, dazed; picked up, it\'s thrown like a pumpkin', () => {
  const { game, me } = setup()
  const c = me.torso.getPosition()
  const crow = crowAt(game, c.x + 0.5, c.y + 3)
  spawnPumpkin(game, 'classic', new Vec2(c.x + 0.5, c.y + 1.5), new Vec2(0, 14), me)
  expect(until(game, () => crow.state === 'down', 60)).toBe(true)
  expect(game.events.some(e => e.type === 'feathers')).toBe(true)
  steps(game, 60)   // (it lands)
  me.moveBy(crow.body.getPosition().x - me.torso.getPosition().x, 0)   // (go over to it)
  steps(game, 2)
  expect(me.pickup?.key).toBe(crow)
  steps(game, Math.ceil(CONFIG.crow.pickTime * 60) + 1, { ...emptyInput(), harvest: true })
  expect(me.held.typeName).toBe('crow')
  expect(game.crows).toHaveLength(0)
})

it('a thrown crow pecks whoever it hits for a while, then flies off', () => {
  const { game, me, dummy } = setup()
  const head = dummy.head.getPosition()
  spawnPumpkin(game, 'crow', new Vec2(head.x - 1, head.y), new Vec2(12, 1), me)
  expect(until(game, () => game.pecks.length, 30)).toBeTruthy()
  game.events.length = 0
  steps(game, Math.ceil(CONFIG.crow.peck.time * 60) + 2)
  const P = CONFIG.crow.peck
  expect(dummy.damageTaken).toBe(Math.ceil(P.time / P.every) * P.damage)
  expect(game.pecks).toHaveLength(0)
  expect(game.events.some(e => e.type === 'crowAway')).toBe(true)
})

it('left lying there, a knocked-down crow comes to and flies off', () => {
  const { game, me } = setup()
  const c = me.torso.getPosition()
  const crow = crowAt(game, c.x + 3, c.y + 3)
  spawnPumpkin(game, 'classic', new Vec2(c.x + 3, c.y + 1.5), new Vec2(0, 14), me)
  expect(until(game, () => crow.state === 'down', 60)).toBe(true)
  steps(game, Math.ceil(CONFIG.crow.wakeTime * 60) + 2)
  expect(game.crows).toHaveLength(0)
})

it('crows come on the host\'s schedule: not in a round\'s first seconds, never when off, not while enough are around', () => {
  const firstCrow = (rate, before = () => {}) => {
    const game = createGame()
    game.crowRate = rate
    resetRound(game)
    before(game)
    const already = game.crows.length
    for (let i = 0; i < 60 * 60; i++) {
      stepGame(game, [emptyInput()])
      if (game.crows.length > already) return game.roundTime
    }
    return null
  }
  const t = firstCrow('normal')
  expect(t).toBeGreaterThanOrEqual(CONFIG.crow.firstAfter)
  expect(t).toBeLessThan(CONFIG.crow.firstAfter + CONFIG.crow.every.normal * 0.5 + 0.1)
  expect(firstCrow('off')).toBeNull()
  // (enough knocked down already: lying there, they don't fly off before the first one's due)
  const lying = game => { for (let i = 0; i < CONFIG.crow.maxAround; i++) { const c = sendCrow(game); c.state = 'down'; c.downTime = -Infinity } }
  expect(firstCrow('normal', lying)).toBeNull()
})
