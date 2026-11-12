import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { canHarvest } from '../src/game/patches.js'
import { freezeBlast } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { packSnapshot, unpackSnapshot } from '../src/net/protocol.js'

const C = PUMPKIN_TYPES.icebomb.chill
// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a
// pumpkin patch at 16).
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
const iceBomb = (game, x, y, vx, vy, owner = null) => spawnPumpkin(game, 'icebomb', new Vec2(x, y), new Vec2(vx, vy), owner)
const bursts = game => game.events.filter(e => e.type === 'iceburst').length

it('bursts on the floor and freezes whoever is in reach, with no damage; not anyone further away', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.3)
  standAt(dummy, 13)
  steps(game, 2)
  game.events.length = 0
  iceBomb(game, 12.2, 5, 0, -5)
  steps(game, 10)
  expect(bursts(game)).toBe(1)
  expect(game.pumpkins).toHaveLength(0)
  expect(dummy.frozen).toBe(true)
  expect(me.frozen).toBe(false)
  expect(dummy.damageTaken).toBe(0)
})

it('freezes longer the closer you were: about 3 s right at it, about 1 s at the edge', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 14)
  steps(game, 2)
  freezeBlast(game, 14, 5, C, 1)
  expect(dummy.frozenTimer).toBeCloseTo(C.center, 0)
  freezeBlast(game, 10 + C.radius - 0.05, 5.6, C, 1)
  expect(me.frozenTimer).toBeGreaterThan(C.edge - 0.01)
  expect(me.frozenTimer).toBeLessThan(C.edge + 0.5)
})

it('a direct hit does no damage: it bursts right on them, a long freeze', () => {
  const { game, dummy } = setup()
  standAt(dummy, 20)
  steps(game, 2)
  iceBomb(game, 18.5, 5.7, 12, 0)
  steps(game, 12)
  expect(dummy.damageTaken).toBe(0)
  expect(dummy.frozenTimer).toBeGreaterThan(2.3)
})

it('freezes its thrower too, if they are in reach', () => {
  const { game, me } = setup()
  standAt(me, 12)
  steps(game, 2)
  iceBomb(game, 12.6, 5, 0, -6, me)
  steps(game, 10)
  expect(me.frozen).toBe(true)
})

it('freezes hay bales in reach', () => {
  const { game } = setup()
  game.mapChoice = 'testing'   // (bales)
  resetRound(game)
  const bale = game.bales[0]
  const p = bale.body.getPosition()
  freezeBlast(game, p.x + 1, p.y, C, 1)
  expect(bale.frozenTimer).toBeCloseTo(C.objects, 5)
})

it('freezes a gourd on its patch: it stops growing and can\'t be picked until it thaws', () => {
  const { game } = setup()
  const patch = game.patches.find(p => Math.abs(p.x - 16) < 0.5) || game.patches[0]
  Object.assign(patch, { state: 'growing', growth: 0.5, timer: 0 })
  freezeBlast(game, patch.x + 1, patch.y + 0.3, C, 1)
  expect(patch.frozenTimer).toBeGreaterThan(0)
  expect(canHarvest(patch)).toBe(false)
  const snap = makeSnapshot(game), i = game.patches.indexOf(patch)
  expect(snap.patches[i].frozen).toBe(true)
  expect(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(snap)))).patches[i].frozen).toBe(true)
  steps(game, 60)
  expect(patch.growth).toBe(0.5)   // (waiting)
  steps(game, Math.ceil(C.objects * 60))
  expect(patch.frozenTimer).toBeLessThanOrEqual(0)
  expect(canHarvest(patch)).toBe(true)
  expect(makeSnapshot(game).patches[i].frozen).toBeUndefined()
})

it('ices over the floor in reach for a while; walking on it, you\'re slow to get going', () => {
  const run = onIce => {
    const { game, me, dummy } = setup()
    standAt(me, 15)
    standAt(dummy, 21)
    steps(game, 20)
    if (onIce) { freezeBlast(game, 15, 4.5, C, 1); me.frozenTimer = 0 }
    steps(game, 12, { ...emptyInput(), right: true })
    return { game, me, vx: me.torso.getLinearVelocity().x }
  }
  const slippery = run(true), normal = run(false)
  const zone = slippery.game.ice.find(z => Math.abs(z.y - 4.4) < 0.01)
  expect(zone.x0).toBeLessThan(13)
  expect(zone.x1).toBeGreaterThan(17)
  expect(slippery.me.onIce).toBe(true)
  expect(slippery.vx).toBeLessThan(normal.vx * 0.5)
  expect(makeSnapshot(slippery.game).ice.length).toBeGreaterThan(0)
  expect(makeSnapshot(normal.game).ice).toBeUndefined()
  steps(slippery.game, Math.ceil(C.floor * 60))
  expect(slippery.game.ice).toHaveLength(0)
})

it('on the ice you keep sliding after you let go (your feet don\'t grip it)', () => {
  const coast = onIce => {
    const { game, me, dummy } = setup()
    standAt(me, 13)
    standAt(dummy, 21)
    steps(game, 20)
    if (onIce) { freezeBlast(game, 15, 4.5, C, 1); me.frozenTimer = 0 }
    steps(game, 2)
    me.setVelocity(6, 0)
    steps(game, 30)   // (half a second, hands off)
    return me.torso.getLinearVelocity().x
  }
  expect(coast(true)).toBeGreaterThan(3)
  expect(coast(false)).toBeLessThan(1.5)
})

it('crouched (sitting) on the ice, you keep sliding too', () => {
  const coast = onIce => {
    const { game, me, dummy } = setup()
    standAt(me, 13)
    standAt(dummy, 21)
    steps(game, 20)
    if (onIce) { freezeBlast(game, 15, 4.5, C, 1); me.frozenTimer = 0 }
    steps(game, 2)
    me.setVelocity(4, 0)   // (under a power slide's speed: just sitting down)
    steps(game, 30, { ...emptyInput(), crouch: true })
    expect(me.slide).toBe(null)
    return me.torso.getLinearVelocity().x
  }
  expect(coast(true)).toBeGreaterThan(2)
  expect(coast(false)).toBeLessThan(1)
})
