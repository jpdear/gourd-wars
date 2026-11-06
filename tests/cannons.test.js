import { expect, it } from 'vitest'
import { CANNON, cannonParts, clampAim, mountPoint } from '../src/game/cannons.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { MAPS } from '../src/maps/builtin.js'
import { sanitizeMap } from '../src/maps/mapData.js'

const steps = (game, n, input = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, emptyInput()]) }
// Testing Grounds: its two cannons fire at the left ground
function testing() {
  const game = createGame()
  game.mapChoice = 'testing'
  resetRound(game)
  return { game, me: game.players[0], cannons: MAPS.testing.cannons }
}

it('a cannon waits its delay, then fires a Classic gourd out of its muzzle along its aim, every few seconds', () => {
  const { game, cannons } = testing()
  const c = cannons[0], { muzzle, dir } = cannonParts(c)
  const fired = () => game.pumpkins.filter(pk => pk.typeName === CANNON.ammo && pk.owner === null)
  steps(game, Math.floor(c.delay * 60) - 2)
  expect(fired()).toHaveLength(0)
  steps(game, 3)
  expect(fired()).toHaveLength(1)
  const pk = fired()[0], p = pk.body.getPosition(), v = pk.body.getLinearVelocity()
  expect(Math.hypot(p.x - muzzle.x, p.y - muzzle.y)).toBeLessThan(0.5)
  expect(v.x).toBeCloseTo(dir.x * c.speed, 1)   // (sideways: as fired; up and down, gravity's had a step at it)
  expect(Math.hypot(v.x, v.y)).toBeCloseTo(c.speed, 0)
  expect(game.events.some(e => e.type === 'cannon')).toBe(true)
  const shots = () => game.events.filter(e => e.type === 'cannon').length
  game.events.length = 0
  steps(game, Math.round(c.every * 60))
  expect(shots()).toBeGreaterThanOrEqual(1)   // (and the other one has started too)
})

it('its gourds belong to nobody: standing where Testing Grounds\' cannons aim, you get hit', () => {
  const { game, me } = testing()
  steps(game, 30)
  me.moveBy(7 - me.torso.getPosition().x, 0)
  steps(game, 7 * 60)
  expect(me.damageTaken).toBeGreaterThan(0)
})

it('it\'s solid: you can stand on one', () => {
  const { game, me, cannons } = testing()
  const c = cannons[0]
  steps(game, 30)
  const t = me.torso.getPosition()
  me.moveBy(c.x - 0.15 - t.x, c.y + 2.5 - t.y)
  steps(game, 60)
  expect(me.torso.getPosition().y).toBeGreaterThan(c.y + CANNON.base.h + 0.6)   // (on the mount, not the ledge)
})

it('it mounts on the nearest floor, wall or ceiling, never in mid-air, and can\'t aim into what it\'s on', () => {
  const wall = { x: 10, y: 5, w: 1, h: 6 }, floor = { x: 4, y: 1, w: 6, h: 1 }
  expect(mountPoint([wall, floor], 10.8, 6)).toEqual({ x: 10.5, y: 6, face: 'right' })
  expect(mountPoint([wall, floor], 9.3, 4)).toEqual({ x: 9.5, y: 4, face: 'left' })
  expect(mountPoint([wall, floor], 4, 1.8)).toEqual({ x: 4, y: 1.5, face: 'top' })
  expect(mountPoint([wall, floor], 4, 0.3)).toEqual({ x: 4, y: 0.5, face: 'bottom' })
  expect(mountPoint([wall, floor], 20, 12)).toBeNull()
  expect(clampAim('top', -90)).toBe(90 - CANNON.maxTilt)      // (not down into the floor)
  expect(clampAim('right', 170)).toBe(CANNON.maxTilt)
  expect(clampAim('bottom', -60)).toBe(-60)
})

it('maps keep their cannons (sensible numbers); maps from before have none', () => {
  const map = sanitizeMap({ name: 'x', cannons: [{ x: 5, y: 4, face: 'sideways', aim: -90, speed: 999, every: 0, delay: 2 }] })
  expect(map.cannons).toEqual([{ x: 5, y: 4, face: 'top', aim: 90 - CANNON.maxTilt, speed: 30, every: 0.5, delay: 2 }])
  expect(sanitizeMap({ name: 'old' }).cannons).toEqual([])
})
