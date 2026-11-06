import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { throwWeapon } from '../src/game/looseWeapons.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { WEAPON_TYPES, pointOf, toWorld } from '../src/game/weaponTypes.js'
import { HeldWeapon } from '../src/game/weapons.js'

const S = WEAPON_TYPES.shovel
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }

// Practice on The Patch with a shovel in hand, aiming right; the dummy out of the way until `put`.
function setup() {
  const game = createGame(), [me, dummy] = game.players
  steps(game, 30)
  me.holdWeapon(new HeldWeapon('shovel', S.uses))
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + 8 - b.x, 0)
  const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y + 1 }   // (a little up: launching them up and away)
  steps(game, 30, aim)
  const put = dx => { const p = me.torso.getPosition(), q = dummy.torso.getPosition(); dummy.moveBy(p.x + dx - q.x, p.y - q.y); dummy.setVelocity(0, 0) }
  return { game, me, dummy, aim, put }
}

it('a click smacks: raised over your head, brought down on them, launching them along your aim every time (one use)', () => {
  const { game, me, dummy, aim, put } = setup()
  steps(game, 1, { ...aim, throw: true })
  steps(game, 1, aim)
  let highest = -Infinity, launched = 0
  for (let i = 0; i < 6; i++) { steps(game, 1, aim); put(1.3) }
  for (let i = 0; i < 30; i++) {
    steps(game, 1, aim)
    highest = Math.max(highest, me.weapon.pose.angle)
    launched = Math.max(launched, dummy.torso.getLinearVelocity().x)
  }
  expect(highest).toBeGreaterThan(Math.PI / 2)
  expect(dummy.damageTaken).toBe(S.tap.damage)
  expect(launched).toBeGreaterThan(S.tap.knockback * 0.6)   // (a full launch, though it didn't stagger them)
  expect(me.weapon.uses).toBe(S.uses - 1)
})

it('it bats a thrown pumpkin along your aim instead of breaking it, and it\'s yours now', () => {
  const { game, me, dummy, aim } = setup()
  steps(game, 1, { ...aim, throw: true })
  steps(game, 1, aim)
  for (let i = 0; i < 30 && !me.weapon.striking; i++) steps(game, 1, aim)   // (raised: coming down now)
  const sh = me.shoulder()
  const pk = spawnPumpkin(game, 'classic', new Vec2(sh.x + 1.6, sh.y + 0.3), new Vec2(-8, 2), dummy)   // (coming at me)
  for (let i = 0; i < 25 && pk.owner !== me; i++) steps(game, 1, aim)
  expect(pk.owner).toBe(me)
  expect(pk.broken).toBe(false)
  const v = pk.body.getLinearVelocity()
  expect(v.x).toBeGreaterThan(S.bats.speed * 0.6)   // (back the way it came: along my aim)
  expect(me.damageTaken).toBe(0)
})

it('any of it bats, the handle too (not just the blade)', () => {
  const { game, me, dummy, aim } = setup()
  steps(game, 1, { ...aim, throw: true })
  steps(game, 1, aim)
  for (let i = 0; i < 30 && !me.weapon.striking; i++) steps(game, 1, aim)
  const { at, angle } = me.weapon.pose, h = toWorld(at, angle, me.weapon.side, [0.25, 0])   // (on the handle, by the hands)
  const pk = spawnPumpkin(game, 'classic', new Vec2(h.x, h.y), new Vec2(2, 0), dummy)
  steps(game, 2, aim)
  expect(pk.owner).toBe(me)
  expect(pk.broken).toBe(false)
})

it('a swing a moment too soon still bats: it keeps batting for bats.grace s after it goes past (but no longer)', () => {
  for (const wait of [0, Math.ceil(S.bats.grace * 60) + 4]) {
    const { game, me, dummy, aim } = setup()
    steps(game, 1, { ...aim, throw: true })
    steps(game, 1, aim)
    for (let i = 0; i < 30 && !me.weapon.striking; i++) steps(game, 1, aim)
    for (let i = 0; i < 30 && me.weapon.striking; i++) steps(game, 1, aim)   // (it's gone past)
    steps(game, wait, aim)
    const { at, angle } = me.weapon.pose, tip = pointOf(S, at, angle, me.weapon.side)
    const pk = spawnPumpkin(game, 'classic', new Vec2(tip.x, tip.y), new Vec2(2, 0), dummy)
    steps(game, 2, aim)
    expect(pk.owner).toBe(wait ? dummy : me)
  }
})

it('charging the Home Run holds it up as a shield: a pumpkin at it is blocked (a use); let go: a huge launch', () => {
  const { game, me, dummy, aim, put } = setup()
  const hold = { ...aim, throw: true }
  steps(game, 10, hold)
  const shield = me.shield()
  expect(shield).not.toBeNull()
  spawnPumpkin(game, 'classic', new Vec2(shield.x + 2, shield.y), new Vec2(-14, 0), dummy)
  steps(game, 12, hold)
  expect(me.damageTaken).toBe(0)
  expect(me.weapon.uses).toBe(S.uses - 1)
  steps(game, Math.ceil(S.charge.chargeTime * 60), hold)
  steps(game, 1, aim)   // (let go)
  let launched = 0
  for (let i = 0; i < 6; i++) { steps(game, 1, aim); put(1.3) }
  for (let i = 0; i < 30; i++) { steps(game, 1, aim); launched = Math.max(launched, dummy.torso.getLinearVelocity().x) }
  expect(dummy.damageTaken).toBe(S.charge.damage)
  expect(launched).toBeGreaterThan(S.charge.knockback * 0.6)
  expect(me.weapon.uses).toBe(S.uses - 1 - S.charge.cost)
})

it('thrown, it bonks whoever it hits: knocked limp, seeing stars, and it bounces back off them', () => {
  const { game, me, dummy, put } = setup()
  put(4)
  steps(game, 10)
  const head = dummy.head.getPosition()
  const w = throwWeapon(game, me, 'shovel', 5, { x: head.x - 2, y: head.y }, { x: S.throw.speed[1], y: 0 }, 1)
  let back = null
  for (let i = 0; i < 20 && back === null; i++) { steps(game, 1); if (dummy.damageTaken && w.body) back = w.body.getLinearVelocity().x }
  expect(dummy.damageTaken).toBe(S.throw.damage)
  expect(back).toBeLessThan(0)   // (bounced back)
  expect(dummy.stunned).toBe(true)
  expect(makeSnapshot(game).players[1].dazed).toBe(true)
  steps(game, Math.ceil(S.throw.daze * 60) + 2)
  expect(dummy.dazed).toBe(false)
})

it('when a swing ends it eases back round to the aim: no jerk (its turning speed never jumps)', () => {
  const { game, me, aim } = setup()
  steps(game, 1, { ...aim, throw: true })
  const angles = []
  let ended = -1
  for (let i = 0; i < 60; i++) {
    steps(game, 1, aim)
    angles.push(me.weapon.pose.angle)
    if (ended < 0 && !me.weapon.swing && i > 2) ended = angles.length - 1
  }
  expect(ended).toBeGreaterThan(0)
  const speed = i => angles[i] - angles[i - 1]   // (rad a step)
  let jump = 0
  for (let i = ended + 1; i < angles.length; i++) jump = Math.max(jump, Math.abs(speed(i) - speed(i - 1)))
  expect(jump).toBeLessThan(0.06)
  expect(me.weapon.pose.angle).toBeCloseTo(Math.atan2(aim.aimY - (me.shoulder().y - 0.22), aim.aimX - me.shoulder().x), 1)   // (back on the aim)
})
