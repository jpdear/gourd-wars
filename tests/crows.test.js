import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { sendCrow } from '../src/game/crows.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { defaultWeaponSettings } from '../src/game/weaponTypes.js'
import { dropWeapon } from '../src/game/looseWeapons.js'
import { HeldWeapon } from '../src/game/weapons.js'

// Practice on The Patch: you (x 11) and a dummy, on the main platform (top at y 4.4).
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }
const until = (game, done, max = 900) => { for (let i = 0; i < max && !done(); i++) steps(game, 1); return done() }

it('a crow flies over and lets go of its weapon over a platform, where it sticks; then flies off', () => {
  const { game } = setup()
  const crow = sendCrow(game, 'pitchfork')
  expect(crow).not.toBeNull()
  expect(crow.body.getPosition().y).toBeGreaterThan(CONFIG.view.h - 2)   // (along the top of the screen)
  expect(until(game, () => game.looseWeapons[0]?.ground)).toBeTruthy()
  expect(game.looseWeapons[0].ground.body.getUserData().kind).toBe('platform')
  expect(until(game, () => !game.crows.length)).toBe(true)
})

it('under a roof, a crow flies under it', () => {
  const { game } = setup('hayloft')   // (the barn's ceiling: underside at y 17.3)
  const crow = sendCrow(game, 'pitchfork')
  expect(crow.body.getPosition().y).toBeLessThan(17.3 - CONFIG.crow.radius)
})

// A crow hanging still at (x, y) (flying, carrying a pitchfork) to throw things at.
function crowAt(game, x, y) {
  const crow = sendCrow(game, 'pitchfork')
  crow.body.setTransform(new Vec2(x, y), 0)
  crow.body.setLinearVelocity(new Vec2(0, 0))
  crow.dropX = crow.dir > 0 ? 99 : -99   // (never lets go on its own)
  return crow
}

it('hit by a pumpkin, a crow lets go of its weapon and falls, dazed; picked up, it\'s thrown like a pumpkin', () => {
  const { game, me } = setup()
  const c = me.torso.getPosition()
  const crow = crowAt(game, c.x + 0.5, c.y + 3)
  spawnPumpkin(game, 'classic', new Vec2(c.x + 0.5, c.y + 1.5), new Vec2(0, 14), me)
  expect(until(game, () => crow.state === 'down', 60)).toBe(true)
  expect(game.looseWeapons).toHaveLength(1)   // (on its way down)
  expect(game.events.some(e => e.type === 'feathers')).toBe(true)
  game.looseWeapons = []   // (so the crow's the closest thing to pick up)
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

it('a weapon\'s attack knocks a crow down', () => {
  const { game, me } = setup()
  me.holdWeapon(new HeldWeapon('pitchfork', 8))
  const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y }
  steps(game, 20, aim)
  const sh = me.shoulder()
  const crow = crowAt(game, sh.x + 1.6, sh.y - 0.22)
  steps(game, 1, { ...aim, throw: true })
  expect(until(game, () => crow.state === 'down', 20)).toBe(true)
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

it('crows come on the host\'s schedule: not in a round\'s first seconds, never when off, not while weapons lie around', () => {
  const firstCrow = (settings, before = () => {}) => {
    const game = createGame()
    game.weaponSettings = settings
    resetRound(game)
    before(game)
    for (let i = 0; i < 60 * 60; i++) {
      stepGame(game, [emptyInput()])
      if (game.crows.length) return game.roundTime
    }
    return null
  }
  const normal = defaultWeaponSettings()
  const t = firstCrow(normal)
  expect(t).toBeGreaterThanOrEqual(CONFIG.crow.firstAfter)
  expect(t).toBeLessThan(CONFIG.crow.firstAfter + CONFIG.crow.every.normal * 0.5 + 0.1)
  expect(firstCrow({ ...normal, drops: 'off' })).toBeNull()
  expect(firstCrow(normal, game => { for (let i = 0; i < CONFIG.crow.maxLoose; i++) dropWeapon(game, 'pitchfork', 9 + i, 6) })).toBeNull()
  const allOff = defaultWeaponSettings()
  for (const k in allOff.types) allOff.types[k].on = false
  expect(firstCrow(allOff)).toBeNull()
})
