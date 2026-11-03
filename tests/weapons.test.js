import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { patchPumpkin } from '../src/game/patches.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { WEAPON_TYPES } from '../src/game/weaponTypes.js'
import { HeldWeapon, dropFromSky, dropWeapon } from '../src/game/weapons.js'

// Practice on The Patch: you (x 11) and a dummy, standing on the main platform (top at y 4.4).
function setup() {
  const game = createGame()
  const [me, dummy] = game.players
  steps(game, 30)   // (stand up)
  return { game, me, dummy }
}
// (input: mine; the dummy's too, if given)
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }
// the dummy, dx m to my right, standing
function placeDummy(game, me, dummy, dx) {
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + dx - b.x, a.y - b.y)
  steps(game, 1)
}
// One click at (x, y), then the swing plays out (and its cooldown) while still aiming there.
function swingAt(game, x, y, dummyInput) {
  const aim = { ...emptyInput(), aimX: x, aimY: y }
  steps(game, 1, { ...aim, throw: true }, dummyInput)
  steps(game, 40, aim, dummyInput)
}
const pitchfork = (uses = WEAPON_TYPES.pitchfork.uses) => new HeldWeapon('pitchfork', uses)
// Put a pitchfork in my hands and let it come down (it starts upright) to point to the right.
function hold(game, me, uses) {
  me.holdWeapon(pitchfork(uses))
  steps(game, 20, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y })
}

it('a weapon dropped from above sticks in the floor, and the harvest key yanks it out into your hands', () => {
  const { game, me } = setup()
  const c = me.torso.getPosition()
  dropWeapon(game, 'pitchfork', c.x, 16)
  steps(game, 120)
  const w = game.looseWeapons[0]
  expect(w.ground).not.toBeNull()
  expect(w.y).toBeGreaterThan(4.4)   // (stuck in the top of the platform, handle up)
  expect(w.y).toBeLessThan(4.4 + WEAPON_TYPES.pitchfork.length)
  expect(me.pickup.key).toBe(w)
  steps(game, Math.ceil(CONFIG.weapon.yankTime * 60) + 1, { ...emptyInput(), harvest: true })
  expect(me.weapon.typeName).toBe('pitchfork')
  expect(game.looseWeapons).toHaveLength(0)
})

it('with a weapon in hand, a click swings it instead of punching', () => {
  const { game, me, dummy } = setup()
  hold(game, me)
  placeDummy(game, me, dummy, 1.2)
  const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y }
  steps(game, 1, { ...aim, throw: true })
  expect(me.punchTimer).toBe(0)
  steps(game, 20, aim)
  expect(dummy.damageTaken).toBe(WEAPON_TYPES.pitchfork.tap.damage)
})

it('a thrust hits someone at the end of the reach, uses one use, and the last use snaps it', () => {
  const { game, me, dummy } = setup()
  hold(game, me, 2)
  placeDummy(game, me, dummy, 2)
  swingAt(game, 30, me.shoulder().y)
  expect(dummy.damageTaken).toBe(WEAPON_TYPES.pitchfork.tap.damage)
  expect(me.weapon.uses).toBe(1)

  placeDummy(game, me, dummy, 2)
  game.events.length = 0
  swingAt(game, 30, me.shoulder().y)
  expect(dummy.damageTaken).toBe(2 * WEAPON_TYPES.pitchfork.tap.damage)
  expect(me.weapon).toBeNull()
  expect(game.events.some(e => e.type === 'weaponBreak')).toBe(true)
})

it('a thrust into the floor clanks off it (a use, no damage)', () => {
  const { game, me } = setup()
  hold(game, me)
  const c = me.torso.getPosition()
  game.events.length = 0
  swingAt(game, c.x + 1, 0)
  expect(game.events.some(e => e.type === 'clank')).toBe(true)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses - 1)
})

// A pumpkin hanging in the air right where the thrust goes (2 m out at shoulder height).
function pumpkinInTheWay(game, me, typeName) {
  const sh = me.shoulder()
  return spawnPumpkin(game, typeName, new Vec2(sh.x + 2, sh.y + 0.1), new Vec2(0, 0), null)
}

it('a thrust cuts a flying pumpkin out of the air without setting it off, except a Jack-o\'-Boom', () => {
  const { game, me } = setup()
  hold(game, me)
  const blackHole = pumpkinInTheWay(game, me, 'blackhole')
  swingAt(game, 30, me.shoulder().y)
  expect(blackHole.broken).toBe(true)
  expect(game.holes).toHaveLength(0)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses - 1)

  game.events.length = 0
  steps(game, 30)   // (cooldown)
  const boom = pumpkinInTheWay(game, me, 'boom')
  swingAt(game, 30, me.shoulder().y)
  expect(boom.broken).toBe(true)
  expect(game.events.some(e => e.type === 'boom')).toBe(true)
})

it('a Big Gourd can\'t be cut, and a Big Gourd shield blocks a thrust', () => {
  const { game, me, dummy } = setup()
  hold(game, me)
  pumpkinInTheWay(game, me, 'biggourd')
  swingAt(game, 30, me.shoulder().y)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses)   // (went right through it; it smashed on the floor)

  dummy.holdPumpkin('biggourd', 1, 1)
  placeDummy(game, me, dummy, 2)
  const sh = me.shoulder(), atMe = { ...emptyInput(), aimX: sh.x, aimY: sh.y }
  steps(game, 20, { ...emptyInput(), aimX: 30, aimY: sh.y }, atMe)   // (the dummy raises its shield at me)
  game.events.length = 0
  swingAt(game, 30, sh.y, atMe)
  expect(dummy.damageTaken).toBe(0)
  expect(dummy.held.blocks).toBe(1)
  expect(game.events.some(e => e.type === 'clank')).toBe(true)
})

it('knocked out holding a weapon, it falls where you went down, with the uses it had left', () => {
  const { game, me } = setup()
  hold(game, me, 3)
  me.kill(game)
  expect(me.weapon).toBeNull()
  expect(game.looseWeapons).toHaveLength(1)
  expect(game.looseWeapons[0].uses).toBe(3)
  expect(Math.abs(game.looseWeapons[0].x - me.torso.getPosition().x)).toBeLessThan(1)
})

it('a thrust lunges you forward along the aim (and not up, aiming up)', () => {
  const { game, me } = setup()
  hold(game, me)
  const x0 = me.torso.getPosition().x
  swingAt(game, 30, me.shoulder().y)
  expect(me.torso.getPosition().x - x0).toBeGreaterThan(0.9)

  const x1 = me.torso.getPosition().x
  swingAt(game, me.torso.getPosition().x, 18)   // (straight up)
  expect(Math.abs(me.torso.getPosition().x - x1)).toBeLessThan(0.1)
})

it('the hands hold the weapon: both on its handle', () => {
  const { game, me } = setup()
  hold(game, me)
  steps(game, 30, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y })
  const { front, back } = me.weapon.hands()
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y)
  const hand = arm => me[arm].getWorldPoint(new Vec2(0, -0.17))   // (the end of the forearm)
  expect(dist(hand('forearmR'), front)).toBeLessThan(0.12)   // (facing right: the right hand's in front)
  expect(dist(hand('forearmL'), back)).toBeLessThan(0.12)
})

it('under a roof, things from the sky come in under it instead of landing on it', () => {
  const game = createGame()
  game.mapChoice = 'hayloft'   // (a barn: its ceiling's underside is at y 17.3)
  resetRound(game)
  dropFromSky(game, 'pitchfork', 10.5)   // (over a shelf, top at y 5.5)
  steps(game, 120)
  const w = game.looseWeapons[0]
  expect(w.ground).not.toBeNull()
  expect(w.y).toBeLessThan(5.5 + WEAPON_TYPES.pitchfork.length)

  // an Airstrike's airdrop lands on its target, not on the roof
  game.strikes.push({ id: game.nextStrikeId++, x: 10.5, y: 5.5, power: 1, age: 0, airdrop: null })
  let landedAt = null
  for (let i = 0; i < 120 && game.strikes.length; i++) {
    const before = game.strikes[0].airdrop
    stepGame(game, [emptyInput()])
    if (before && before.broken) landedAt = before.body.getPosition().y
  }
  expect(landedAt).not.toBeNull()
  expect(landedAt).toBeLessThan(8)
})

// Hold the button (aiming at x, y) for n steps; the dummy is put dx m in front of you just before letting go.
function chargeAndRelease(game, me, dummy, n, dx) {
  const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y }
  steps(game, n, { ...aim, throw: true })
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + dx - b.x, a.y - b.y)
  steps(game, 1, aim)   // (let go)
  return aim
}
const skewer = WEAPON_TYPES.pitchfork.charge

it('hold to charge, let go: a Skewer hoists them overhead on the tines, then flings them toward the aim', () => {
  const { game, me, dummy } = setup()
  hold(game, me)
  const aim = chargeAndRelease(game, me, dummy, Math.ceil(skewer.chargeTime * 60) + 2, 2)   // (the tap missed: nobody was there)
  let caught = false
  for (let i = 0; i < 20 && !caught; i++) { steps(game, 1, aim); caught = me.weapon.grab?.victim === dummy }
  expect(caught).toBe(true)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses - skewer.cost)
  steps(game, 20, aim)
  expect(dummy.torso.getPosition().y).toBeGreaterThan(me.head.getPosition().y)   // (up overhead)
  expect(dummy.stunned).toBe(true)

  steps(game, Math.ceil(skewer.grab.time * 60), aim)   // (held too long: flung)
  expect(me.weapon.grab).toBeNull()
  expect(dummy.damageTaken).toBe(skewer.damage + skewer.grab.fling.damage)
  expect(dummy.torso.getLinearVelocity().x).toBeGreaterThan(5)
})

it('a click flings them off early; getting knocked down drops them; letting go too soon does nothing more', () => {
  const { game, me, dummy } = setup()
  hold(game, me)
  const aim = chargeAndRelease(game, me, dummy, Math.ceil(skewer.chargeTime * 60) + 2, 2)
  steps(game, 15, aim)
  expect(me.weapon.grab).not.toBeNull()
  steps(game, 1, { ...aim, throw: true })
  expect(me.weapon.grab).toBeNull()
  expect(dummy.damageTaken).toBe(skewer.damage + skewer.grab.fling.damage)

  steps(game, 180, aim)   // (it flew off the map: back at its spawn)
  chargeAndRelease(game, me, dummy, Math.ceil(skewer.chargeTime * 60) + 2, 2)
  steps(game, 15, aim)
  expect(me.weapon.grab).not.toBeNull()
  me.stun(0.5)
  steps(game, 1, aim)
  expect(me.weapon.grab).toBeNull()

  steps(game, 120, aim)
  const uses = me.weapon.uses
  chargeAndRelease(game, me, dummy, 10, 4)   // (not charged: the tap only, nobody in reach)
  steps(game, 30, aim)
  expect(me.weapon.grab).toBeNull()
  expect(me.weapon.uses).toBe(uses)
})

it('a held weapon is solid: brought down onto someone it shoves them, but only attacks hurt', () => {
  const { game, me, dummy } = setup()
  hold(game, me)
  placeDummy(game, me, dummy, 1.1)
  const sh = me.shoulder()
  steps(game, 20, { ...emptyInput(), aimX: sh.x + 0.3, aimY: 18 })   // (raised)
  let shoved = 0   // (the fastest any part of them moved)
  for (let i = 0; i < 20; i++) {
    steps(game, 1, { ...emptyInput(), aimX: sh.x + 1.5, aimY: sh.y - 0.8 })   // (brought down onto them)
    for (const p of dummy.parts) shoved = Math.max(shoved, Math.hypot(p.body.getLinearVelocity().x, p.body.getLinearVelocity().y))
  }
  expect(shoved).toBeGreaterThan(1)
  expect(dummy.damageTaken).toBe(0)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses)
})

it('a held weapon can\'t go through the floor, and flying pumpkins pass right through it', () => {
  const { game, me } = setup()
  hold(game, me)
  const c = me.torso.getPosition()
  steps(game, 30, { ...emptyInput(), aimX: c.x + 1, aimY: 0 })   // (pointing down into the floor, top at y 4.4)
  const { at, angle } = me.weapon.pose, tip = WEAPON_TYPES.pitchfork.length - WEAPON_TYPES.pitchfork.grip
  expect(at.y + Math.sin(angle) * tip).toBeGreaterThan(4.4 - 0.15)

  steps(game, 20, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y })
  const mid = me.weapon.body.getWorldPoint(new Vec2(0.85, 0))   // (on the shaft, clear of the front hand)
  const pk = spawnPumpkin(game, 'classic', new Vec2(mid.x, mid.y + 0.4), new Vec2(0, -6), null)
  steps(game, 6)
  expect(pk.broken).toBe(false)
  expect(pk.body.getPosition().y).toBeLessThan(mid.y - 0.1)   // (out the other side)
})

it('the hands hold it spread along the handle, and a thrust pushes it out from the body', () => {
  const { game, me } = setup()
  hold(game, me)
  const { front, back } = me.weapon.hands()
  expect(Math.hypot(front.x - back.x, front.y - back.y)).toBeCloseTo(WEAPON_TYPES.pitchfork.handGap, 2)
  const out = () => me.weapon.pose.at.x - me.shoulder().x
  const idle = out()
  steps(game, 1, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y, throw: true })
  steps(game, 7, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y })
  expect(out()).toBeGreaterThan(idle + 0.2)
})

it('an attack knocks a pumpkin growing on its patch off the vine (a use)', () => {
  const { game, me } = setup()
  hold(game, me)
  const patch = game.patches[0]   // (The Patch: middle of the main platform, x 16)
  expect(patch.state).not.toBe('empty')
  me.moveBy(patch.x - 1.3 - me.torso.getPosition().x, 0)
  const pk = () => patchPumpkin(patch)
  steps(game, 20, { ...emptyInput(), aimX: pk().x, aimY: pk().y })
  game.events.length = 0
  swingAt(game, pk().x, pk().y)
  expect(patch.state).toBe('empty')
  expect(game.events.some(e => e.type === 'splat')).toBe(true)
  expect(me.weapon.uses).toBe(WEAPON_TYPES.pitchfork.uses - 1)
})
