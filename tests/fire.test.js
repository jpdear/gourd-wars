import { Vec2 } from 'planck'
import { afterEach, expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { coatFloor } from '../src/game/level.js'
import { firePatch } from '../src/game/fire.js'
import { freezeBlast } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { packSnapshot, unpackSnapshot } from '../src/net/protocol.js'

const F = CONFIG.fire, P = PUMPKIN_TYPES.fire.patch
// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a pumpkin patch at 16).
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n) => { for (let i = 0; i < n; i++) stepGame(game, [emptyInput(), emptyInput()]) }
function standAt(p, x, y = 4.4) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
const fireGourd = (game, x, y, vx, vy) => spawnPumpkin(game, 'fire', new Vec2(x, y), new Vec2(vx, vy), null)
const bonfireWas = F.bonfireIgnites
afterEach(() => { F.bonfireIgnites = bonfireWas })

it('bursts on the floor into a fire patch; whoever stands in it catches fire', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 19.5)
  fireGourd(game, 19, 5, 0, -6)
  steps(game, 6)
  expect(game.pumpkins).toHaveLength(0)
  const z = game.fire.find(f => Math.abs(f.y - 4.4) < 0.05)
  expect(z.x0).toBeLessThan(18.5)
  expect(z.x1).toBeGreaterThan(19.5)
  steps(game, 3)
  expect(dummy.onFire).toBe(true)
  expect(me.onFire).toBe(false)
  expect(makeSnapshot(game).fire.length).toBeGreaterThan(0)
  steps(game, Math.ceil(P.time * 60))
  expect(game.fire).toHaveLength(0)
})

it('on fire, you burn for ~5 s at ~3 damage a second, then it goes out', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 20)
  dummy.ignite()
  const before = dummy.damageTaken
  steps(game, 60)
  expect(dummy.damageTaken - before).toBeGreaterThanOrEqual(2)
  expect(dummy.damageTaken - before).toBeLessThanOrEqual(4)
  expect(makeSnapshot(game).players[1].burning).toBe(true)
  steps(game, Math.ceil((F.burnTime - 1) * 60) + 2)
  expect(dummy.onFire).toBe(false)
  expect(makeSnapshot(game).players[1].burning).toBeUndefined()
})

it('a direct hit sets them on fire, with a fire patch on the floor under them', () => {
  const { game, dummy } = setup()
  standAt(dummy, 20)
  steps(game, 2)
  fireGourd(game, 18.5, 5.7, 12, 0)
  steps(game, 10)
  expect(dummy.onFire).toBe(true)
  expect(dummy.damageTaken).toBeLessThan(5)
  expect(game.fire.some(z => Math.abs(z.y - 4.4) < 0.05 && z.x0 < 20 && z.x1 > 19)).toBe(true)
})

it('it spreads: touching someone on fire, you catch fire too', () => {
  const { game, me, dummy } = setup()
  standAt(me, 14)
  standAt(dummy, 14.2)
  dummy.ignite()
  steps(game, 2)
  expect(me.onFire).toBe(true)
})

it('catching fire thaws you; being frozen puts it out', () => {
  const { game, dummy } = setup()
  dummy.freeze(3)
  dummy.ignite()
  expect(dummy.frozen).toBe(false)
  expect(dummy.onFire).toBe(true)
  dummy.freeze(1)
  expect(dummy.onFire).toBe(false)
})

it('a hay bale catches fire, sets whoever touches it alight, and burns away after a while', () => {
  const { game, me } = setup('testing')
  const bale = game.bales[0], b = bale.body.getPosition()
  firePatch(game, b.x, b.y, P.radius, 30)
  steps(game, 2)
  expect(bale.burnTimer).toBeGreaterThan(0)
  expect(makeSnapshot(game).bales[0].burn).toBeGreaterThanOrEqual(0)
  const snap = makeSnapshot(game)
  expect(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(snap)))).bales[0]).toEqual(JSON.parse(JSON.stringify(snap.bales[0])))
  standAt(me, b.x + 0.6, b.y - 0.4)
  steps(game, 2)
  expect(me.onFire).toBe(true)
  steps(game, Math.ceil(F.baleBurn * 60))
  expect(game.bales).not.toContain(bale)
})

it('an Ice Bomb puts out fire patches and burning bales; a fire patch melts the icy floor', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 22)
  coatFloor(game, 'ice', 16, 4.5, 3, 30)
  const iceWidth = () => game.ice.reduce((sum, z) => sum + z.x1 - z.x0, 0)
  const before = iceWidth()
  firePatch(game, 16, 4.6, 1, 10)
  expect(iceWidth()).toBeLessThan(before - 1.5)   // (a gap melted in it)
  freezeBlast(game, 16, 4.6, PUMPKIN_TYPES.icebomb.chill, 1)
  expect(game.fire).toHaveLength(0)
})

it('a Frost gourd breaking in a fire patch puts it out', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 22)
  firePatch(game, 16, 4.6, 1, 10)
  spawnPumpkin(game, 'frost', new Vec2(16, 5.2), new Vec2(0, -6), null)
  steps(game, 10)
  expect(game.fire).toHaveLength(0)
})

it('a thrown gourd flying through a fire patch burns, like in a bonfire', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 22)
  firePatch(game, 13, 4.6, 1, 10)
  spawnPumpkin(game, 'classic', new Vec2(11, 4.8), new Vec2(8, 0), null)
  steps(game, 20)
  expect(game.pumpkins).toHaveLength(0)
})

it('bonfires set you on fire (you keep burning after you leave), and bales catch fire instead of vanishing', () => {
  const { game, me } = setup('testing')   // (a bonfire at x 28.2 on the floor, top 4.4)
  standAt(me, 28.2)
  steps(game, 3)
  expect(me.onFire).toBe(true)
  standAt(me, 24)
  steps(game, 60)
  expect(me.onFire).toBe(true)   // (still burning a second later, away from it)
  const bale = game.bales[0]
  bale.body.setTransform(new Vec2(28.2, 4.85), 0)
  steps(game, 3)
  expect(game.bales).toContain(bale)
  expect(bale.burnTimer).toBeGreaterThan(0)
})

it('with CONFIG.fire.bonfireIgnites off, bonfires work the old way', () => {
  F.bonfireIgnites = false
  const { game, me } = setup('testing')
  standAt(me, 28.2)
  steps(game, 3)
  expect(me.onFire).toBe(false)
  const bale = game.bales[0]
  bale.body.setTransform(new Vec2(28.2, 4.85), 0)
  steps(game, 3)
  expect(game.bales).not.toContain(bale)
})
