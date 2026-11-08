import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { dropWeapon, throwWeapon } from '../src/game/looseWeapons.js'
import { WEAPON_TYPES, headOf, toWorld } from '../src/game/weaponTypes.js'
import { HeldWeapon } from '../src/game/weapons.js'

const R = WEAPON_TYPES.rake
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }

// Practice on The Patch (the main platform's top at y 4.4) with a rake in hand, aiming right; the dummy
// out of the way until `put`.
function setup() {
  const game = createGame(), [me, dummy] = game.players
  steps(game, 30)
  me.holdWeapon(new HeldWeapon('rake', R.uses))
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + 8 - b.x, 0)
  steps(game, 30, { ...emptyInput(), aimX: 30, aimY: me.shoulder().y })
  // the dummy, dx m to my right, standing still
  const put = dx => { const p = me.torso.getPosition(), q = dummy.torso.getPosition(); dummy.moveBy(p.x + dx - q.x, p.y - q.y); dummy.setVelocity(0, 0) }
  const gap = () => dummy.torso.getPosition().x - me.torso.getPosition().x
  return { game, me, dummy, put, gap }
}
const FLOOR = 4.4
// Hold attack until the charged move's ready, then let go (and let it play out).
function longPull(game, aim, after = 70) {
  steps(game, Math.ceil(R.charge.chargeTime * 60) + 2, { ...aim(), throw: true })
  for (let i = 0; i < after; i++) steps(game, 1, aim())
}

it('a click rakes: pushed out low, dragged back; whoever the teeth catch is tripped and pulled ~1 m in (one use)', () => {
  for (const feet of [true, false]) {   // (aiming at their feet, or at them)
    const { game, me, dummy, put, gap } = setup()
    put(1.8)
    const aim = { ...emptyInput(), aimX: me.torso.getPosition().x + 1.8, aimY: feet ? FLOOR + 0.1 : dummy.torso.getPosition().y }
    steps(game, 15, aim)
    steps(game, 1, { ...aim, throw: true })
    let tripped = false
    for (let i = 0; i < 70; i++) { steps(game, 1, aim); tripped ||= dummy.stunned }
    expect(dummy.damageTaken).toBe(R.tap.damage)
    expect(tripped).toBe(true)
    expect(1.8 - gap()).toBeGreaterThan(0.5)   // (pulled in...)
    expect(1.8 - gap()).toBeLessThan(1.6)      // (...not flung past)
    expect(me.weapon.uses).toBe(R.uses - 1)
  }
})

it('raking along the floor scrapes it: no clank, no use', () => {
  const { game, me } = setup()
  const aim = { ...emptyInput(), aimX: me.torso.getPosition().x + 1.5, aimY: FLOOR }
  steps(game, 15, aim)
  game.events.length = 0
  steps(game, 1, { ...aim, throw: true })
  steps(game, 50, aim)
  expect(game.events.some(e => e.type === 'clank')).toBe(false)
  expect(me.weapon.uses).toBe(R.uses)
})

it('hold for the Long Pull: a lunge, shoved right out, and the first one it hooks (~3.5 m out) is hauled in, left lying at your feet', () => {
  for (const dx of [2.5, 3.5]) {
    const { game, me, dummy, put, gap } = setup()
    put(dx)
    const aim = () => ({ ...emptyInput(), aimX: me.torso.getPosition().x + 6, aimY: FLOOR + 0.2 })
    const start = me.torso.getPosition().x
    longPull(game, aim)
    expect(me.torso.getPosition().x - start).toBeGreaterThan(0.8)   // (the lunge)
    expect(dummy.damageTaken).toBe(R.charge.damage)
    expect(gap()).toBeLessThan(2.1)                                 // (hauled in)
    expect(dummy.stunned).toBe(true)                                // (lying there)
    expect(me.weapon.uses).toBe(R.uses - R.charge.cost)
  }
})

it('the Long Pull hooks a weapon lying about and drags it to your feet', () => {
  const { game, me } = setup()
  dropWeapon(game, 'pitchfork', me.torso.getPosition().x + 3, 6)
  steps(game, 40)
  const w = game.looseWeapons[0]
  expect(w.state).toBe('stuck')
  longPull(game, () => ({ ...emptyInput(), aimX: me.torso.getPosition().x + 6, aimY: FLOOR + 0.2 }), 90)
  expect(w.state).toBe('stuck')   // (let go: fallen in again)
  expect(Math.abs(w.x - me.torso.getPosition().x)).toBeLessThan(1.8)
})

// Throw it (as hard as a full charge) from where it's held, at `vel`; then let it come to rest.
function toss(game, me, vel) {
  const at = me.weapon.pose.at, uses = me.weapon.uses
  me.dropHeld()
  const w = throwWeapon(game, me, 'rake', uses, at, vel, 1, me.facing)
  for (let i = 0; i < 240 && w.state === 'flying'; i++) steps(game, 1)
  return w
}
// A rake let go just above the floor at x, lying flat, tines up (or down); let it come to rest.
function lay(game, me, x, up = true) {
  me.dropHeld()   // (empty hands)
  const w = throwWeapon(game, me, 'rake', R.uses, { x, y: FLOOR + 0.3 }, { x: 0.01, y: 0 }, 1, up ? -1 : 1)
  w.body.setAngularVelocity(0)
  for (let i = 0; i < 240 && w.state === 'flying'; i++) steps(game, 1)
  return w
}
const teethUp = w => toWorld(w, w.angle, w.side, headOf(R).point).y > w.y + 0.1

it('thrown, it\'s lobbed and tumbles to rest however it lands: armed only if that\'s tines up', () => {
  for (const vel of [{ x: 7, y: 4 }, { x: 5, y: 3 }, { x: 6, y: 6 }]) {
    const { game, me } = setup()
    const w = toss(game, me, vel)
    expect(w.state).toBe('stuck')
    expect(!!w.armed).toBe(teethUp(w))
  }
  for (const up of [true, false]) {
    const { game, me } = setup()
    const w = lay(game, me, me.torso.getPosition().x + 2, up)
    expect(teethUp(w)).toBe(up)
    expect(!!w.armed).toBe(up)
  }
})

it('anyone touching an armed trap sets it off: the handle smacks them (damage, knocked back), once; then it\'s an ordinary rake', () => {
  const { game, me, dummy } = setup()
  const w = lay(game, me, me.torso.getPosition().x + 2)
  const head = toWorld(w, w.angle, w.side, headOf(R).edge[1])
  const q = dummy.torso.getPosition()
  dummy.moveBy(head.x - q.x, 0)
  dummy.setVelocity(0, 0)
  steps(game, 3)
  expect(dummy.damageTaken).toBe(R.throw.trap.damage)
  expect(w.armed).toBe(false)
  expect(w.uses).toBe(R.uses - R.throw.trap.cost)
  steps(game, 60)
  expect(dummy.damageTaken).toBe(R.throw.trap.damage)   // (once)
  expect(teethUp(w)).toBe(true)                         // (the handle back down, lying there)
})

it('it goes off on its thrower too', () => {
  const { game, me } = setup()
  const w = lay(game, me, me.torso.getPosition().x + 2)
  steps(game, 20)
  const head = toWorld(w, w.angle, w.side, headOf(R).edge[1]), p = me.torso.getPosition()
  me.moveBy(head.x - p.x, 0)
  steps(game, 3)
  expect(me.damageTaken).toBe(R.throw.trap.damage)
})

it('pulled out with the harvest key while armed, it\'s disarmed: back in your hands, no smack', () => {
  const { game, me } = setup()
  const w = lay(game, me, me.torso.getPosition().x + 2)
  expect(w.armed).toBe(true)
  const p = me.torso.getPosition(), mid = w.x + Math.cos(w.angle) * 0.7
  me.moveBy(mid - p.x, 0)   // (by the middle of it, off the teeth)
  steps(game, 5)
  expect(me.pickup?.key).toBe(w)
  steps(game, Math.ceil(CONFIG.weapon.yankTime * 60) + 2, { ...emptyInput(), harvest: true })
  expect(me.weapon?.typeName).toBe('rake')
  expect(me.damageTaken).toBe(0)
})
