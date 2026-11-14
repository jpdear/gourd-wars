import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, setDummies, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { boomerangPull, openBlackHole } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { resetPatches } from '../src/game/patches.js'
import { PUMPKIN_TYPES, SPAWNABLE_TYPES, defaultSpawnSettings } from '../src/game/pumpkinTypes.js'
import { makeSnapshot, patchView } from '../src/game/snapshot.js'

it('a Big Gourd shield cracking mid-throw leaves nothing to throw (no crash on release)', () => {
  const game = createGame()
  const me = game.players[0]
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  me.held = { typeName: 'biggourd', power: 1, ripeness: 1, blocks: 0 }
  stepGame(game, [{ ...emptyInput(), throw: true, aimX: 20, aimY: 5 }])   // start charging
  expect(me.charging).toBe(true)
  for (let i = 0; i < PUMPKIN_TYPES.biggourd.shieldBlocks; i++) me.tryBlock(game, me.handPosition(), 0.1, { x: -1, y: 0 })
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

it('Super Rare pumpkins are flagged on their patch (and in snapshots) so they can glow gold', () => {
  const game = createGame()
  game.spawnSettings = defaultSpawnSettings()
  expect(game.spawnSettings.blackhole.rate).toBe('superrare')   // (the default)
  for (const k of SPAWNABLE_TYPES) game.spawnSettings[k].on = k === 'blackhole' || k === 'frost'
  game.spawnSettings.frost.rate = 'rare'
  const seen = { blackhole: false, frost: false }
  for (let i = 0; i < 200; i++) {
    resetPatches(game)
    const snap = makeSnapshot(game)
    game.patches.forEach((p, j) => {
      seen[p.typeName] = true
      expect(p.superRare).toBe(p.typeName === 'blackhole')
      expect(patchView(snap, j).superRare).toBe(p.superRare)
    })
  }
  expect(seen).toEqual({ blackhole: true, frost: true })
})

it('an Airstrike on a player marks the ground below them, and the airdrop crushes them right on time', () => {
  const game = createGame()
  const [me, dummy] = game.players
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  const c = dummy.torso.getPosition()
  spawnPumpkin(game, 'airstrike', new Vec2(c.x, c.y + 1.2), new Vec2(0, -8), me)
  let steps = 0
  while (!game.strikes.length && steps++ < 30) stepGame(game, [emptyInput()])
  const st = game.strikes[0]
  expect(st.x).toBeCloseTo(c.x, 1)
  expect(st.y).toBeLessThan(dummy.torso.getPosition().y - 0.5)   // on the ground, not on them
  game.events.length = 0
  let landed = 0
  for (let i = 1; i <= 120 && !landed; i++) {
    stepGame(game, [emptyInput()])
    if (!game.strikes.length) landed = i / 60
  }
  expect(landed).toBeGreaterThan(PUMPKIN_TYPES.airstrike.delay - 0.15)
  expect(landed).toBeLessThan(PUMPKIN_TYPES.airstrike.delay + 0.1)
  expect(game.events.some(e => e.type === 'ko')).toBe(true)   // crushed (practice: they just refill)
  expect(game.events.some(e => e.type === 'boom')).toBe(true)
})

it('a Homing gourd thrown straight up locks onto the dummy and curves into it', () => {
  const game = createGame()
  const [me, dummy] = game.players
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  const c = me.torso.getPosition()
  const pk = spawnPumpkin(game, 'homing', new Vec2(c.x, c.y + 1), new Vec2(0, 12), me)
  let locked = false
  for (let i = 0; i < 180 && !dummy.damageTaken; i++) {
    stepGame(game, [emptyInput()])
    locked ||= pk.target === dummy
  }
  expect(locked).toBe(true)
  expect(dummy.damageTaken).toBeGreaterThan(0)
  expect(me.damageTaken).toBe(0)
})

it('a Boomerang hooks back past its thrower without touching them, swinging out underneath', () => {
  for (const aimY of [0.5, -0.5]) {   // (a little above level, a little below: underneath either way)
    const game = createGame()
    const me = game.players[0]
    for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
    const c = me.torso.getPosition()
    const start = { x: c.x, y: c.y + 5 }   // (over the platform: clear air to fly in)
    const pk = spawnPumpkin(game, 'boomerang', new Vec2(start.x, start.y), new Vec2(-26, aimY), me)
    let out = 0, top = -Infinity, bottom = Infinity, back = null
    for (let i = 0; i < 240 && !pk.broken && !back; i++) {
      stepGame(game, [emptyInput()])
      const p = pk.body.getPosition()
      out = Math.max(out, start.x - p.x)
      top = Math.max(top, p.y); bottom = Math.min(bottom, p.y)
      if (i > 30 && p.x >= start.x) back = { y: p.y, vx: pk.body.getLinearVelocity().x }
    }
    const { reach } = PUMPKIN_TYPES.boomerang.curve
    expect(out).toBeGreaterThan(reach - 1)    // ~reach m out...
    expect(out).toBeLessThan(reach + 1.5)
    expect(back).not.toBeNull()       // ...and back through where it was thrown from (it didn't hit them),
    expect(Math.abs(back.y - start.y)).toBeLessThan(0.3)   // along the line it left on
    expect(back.vx).toBeGreaterThan(24)   // about as fast as it left
    expect(bottom).toBeLessThan(start.y - 2)   // having swung underneath
    expect(top).toBeLessThan(start.y + 1)
    expect(me.damageTaken).toBe(0)
  }
})

it('a Boomerang always bends toward the underside of its throw, whichever way it was aimed', () => {
  const C = PUMPKIN_TYPES.boomerang.curve
  for (const deg of [-150, -90, -60, -10, 0, 10, 60, 90, 150]) {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a)
    const pull = boomerangPull(C, { x: 26 * dx, y: 26 * dy }, 0.5)
    const nx = dy * Math.sign(dx || 1), ny = -Math.abs(dx)   // (sideways from the throw, the lower side)
    expect(pull.x * nx + pull.y * ny).toBeGreaterThan(0)
  }
})

// A lighter Boomerang throw away from the dummy, from right in front of the thrower's chest, a hair below
// level (so it swings under, off the end of the platform, not up into the ledge): it comes back through
// them. setup(me) runs first (fill their hands, knock them down...). Returns what happened.
function throwBoomerangAwayFromDummy(setup = () => {}) {
  const game = createGame()
  const [me, dummy] = game.players
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  setup(me)
  const c = me.torso.getPosition(), d = dummy.torso.getPosition()
  const away = Math.sign(c.x - d.x)
  const pk = spawnPumpkin(game, 'boomerang', new Vec2(c.x + away * 0.3, c.y + 0.2), new Vec2(away * 16, -0.01), me, { power: 0.8, ripeness: 0.6 })
  for (let i = 0; i < 180 && !dummy.damageTaken && game.pumpkins.includes(pk); i++) {
    stepGame(game, [emptyInput()])
    if (pk.age < 0.5) expect(me.held?.typeName).not.toBe('boomerang')   // (not caught on the way out)
  }
  return { me, dummy, gone: !game.pumpkins.includes(pk) }
}

it('a Boomerang that comes back to its thrower with their hands empty is caught, as ripe as it was', () => {
  const { me, dummy, gone } = throwBoomerangAwayFromDummy()
  expect(gone).toBe(true)
  expect(me.held).toMatchObject({ typeName: 'boomerang', power: 0.8, ripeness: 0.6 })
  expect(dummy.damageTaken).toBe(0)
  expect(me.damageTaken).toBe(0)
})

it('a Boomerang flies on past a thrower who has their hands full, and hits whoever is behind them', () => {
  const { me, dummy } = throwBoomerangAwayFromDummy(me => me.holdPumpkin('classic', 1, 1))
  expect(me.held.typeName).toBe('classic')
  expect(dummy.damageTaken).toBeGreaterThan(0)
  expect(me.damageTaken).toBe(0)
})

it("a knocked-down or frozen thrower can't catch their Boomerang", () => {
  for (const setup of [me => me.stun(5), me => { me.frozenTimer = 5 }]) {
    const { me, dummy } = throwBoomerangAwayFromDummy(setup)
    expect(me.held).toBeNull()
    expect(dummy.damageTaken).toBeGreaterThan(0)
  }
})

it("a Homing gourd whose target is knocked out gives up instead of picking someone else", () => {
  const game = createGame()
  setDummies(game, 2)
  const me = game.players[0]
  for (let i = 0; i < 30; i++) stepGame(game, [emptyInput()])   // (stand up)
  const c = me.torso.getPosition()
  const pk = spawnPumpkin(game, 'homing', new Vec2(c.x, c.y + 1), new Vec2(0, 12), me)
  for (let i = 0; i < 60 && !pk.target; i++) stepGame(game, [emptyInput()])
  const target = pk.target
  expect(target).toBeTruthy()
  target.ko = true
  stepGame(game, [emptyInput()])
  expect(pk.target).toBeNull()
  for (let i = 0; i < 20 && !pk.broken; i++) {
    stepGame(game, [emptyInput()])
    expect(pk.target).toBeNull()
  }
})
