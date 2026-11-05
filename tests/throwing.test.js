import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { throwWeapon } from '../src/game/looseWeapons.js'
import { WEAPON_TYPES } from '../src/game/weaponTypes.js'
import { HeldWeapon } from '../src/game/weapons.js'

const T = WEAPON_TYPES.pitchfork.throw
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
// Stand someone at x on the floor whose top is at y.
function standAt(game, p, x, y) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}

it('holding Throw Weapon charges it (pulled back); letting go throws it point first, harder the longer it was held', () => {
  const speedAfter = holdSteps => {
    const { game, me } = setup()
    me.holdWeapon(new HeldWeapon('pitchfork', 5))
    const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y + 2 }
    steps(game, 20, aim)
    steps(game, holdSteps, { ...aim, toss: true })
    expect(me.weapon.view()[4]).toBeCloseTo(Math.min(1, holdSteps / 60 / T.chargeTime), 1)
    steps(game, 1, aim)   // (let go)
    expect(me.weapon).toBeNull()
    const w = game.looseWeapons[0]
    expect(w.state).toBe('flying')
    expect(w.uses).toBe(5)
    const v = w.body.getLinearVelocity()
    expect(Math.abs(Math.atan2(v.y, v.x) - w.angle)).toBeLessThan(0.05)   // (point first)
    return Math.hypot(v.x, v.y)
  }
  const tap = speedAfter(1), full = speedAfter(Math.ceil(T.chargeTime * 60) + 5)
  expect(tap).toBeLessThan(T.speed[0] + 3)
  expect(full).toBeGreaterThan(T.speed[1] - 3)
})

it('thrown into a wall, a pitchfork sticks in it as a solid peg (a miss: no uses), to stand on until pulled out', () => {
  const { game, me } = setup('hayloft')   // (its left wall's face at x 0.8; the floor's top at y 2.6)
  const w = throwWeapon(game, me, 'pitchfork', 6, { x: 4, y: 4.5 }, { x: -30, y: 0 }, 1)
  steps(game, 20)
  expect(w.state).toBe('stuck')
  expect(w.body.getUserData().kind).toBe('peg')
  expect(w.uses).toBe(6)
  const top = w.y + 0.03   // (the top of its handle)
  standAt(game, me, 1.7, top)
  steps(game, 60)
  expect(me.torso.getPosition().y).toBeGreaterThan(top + 0.5)   // (standing on it, not fallen to the floor)
  expect(me.pickup?.key).toBe(w)
  steps(game, Math.ceil(CONFIG.weapon.yankTime * 60) + 2, { ...emptyInput(), harvest: true })
  expect(me.weapon.uses).toBe(6)
  expect(game.looseWeapons).toHaveLength(0)
  steps(game, 60)
  expect(me.torso.getPosition().y).toBeLessThan(top)   // (the peg's gone: down to the floor)
})

it('thrown into the floor, it sticks in it like a dropped one (no peg)', () => {
  const { game, me } = setup()
  const c = me.torso.getPosition()
  const w = throwWeapon(game, me, 'pitchfork', 6, { x: c.x + 2, y: c.y + 2 }, { x: 4, y: -25 }, 1)
  steps(game, 30)
  expect(w.state).toBe('stuck')
  expect(w.body).toBeNull()
})

it('a javelin impales whoever it hits and carries them along; into a wall, they\'re pinned there a moment', () => {
  const { game, me, dummy } = setup('hayloft')
  standAt(game, dummy, 3, 2.6)
  steps(game, 20)
  const d = dummy.torso.getPosition()
  const w = throwWeapon(game, me, 'pitchfork', 6, { x: d.x + 3, y: d.y }, { x: -30, y: 0 }, 1)
  steps(game, 6)
  expect(dummy.damageTaken).toBe(T.damage)
  expect(w.uses).toBe(6 - T.cost)
  let pinnedAt = null
  for (let i = 0; i < 40 && !pinnedAt; i++) { steps(game, 1); if (w.state === 'stuck') pinnedAt = i }
  expect(pinnedAt).not.toBeNull()
  expect(w.victim).toBe(dummy)
  const tip = () => ({ x: w.x + Math.cos(w.angle) * 1.45, y: w.y + Math.sin(w.angle) * 1.45 })
  steps(game, 30)
  expect(Math.hypot(dummy.torso.getPosition().x - tip().x, dummy.torso.getPosition().y - tip().y)).toBeLessThan(0.5)   // (pinned)
  steps(game, Math.ceil(T.impale.pin * 60))
  expect(w.victim).toBeNull()   // (let go)
})

it('a throw that hits someone with no uses left after it snaps the weapon', () => {
  const { game, me, dummy } = setup()
  const d = dummy.torso.getPosition()
  throwWeapon(game, me, 'pitchfork', T.cost, { x: d.x - 3, y: d.y }, { x: 30, y: 0 }, 1)
  steps(game, 10)
  expect(dummy.damageTaken).toBe(T.damage)
  expect(game.looseWeapons).toHaveLength(0)
  expect(game.events.some(e => e.type === 'weaponBreak')).toBe(true)
})

it('a Big Gourd shield blocks a thrown weapon: it drops', () => {
  const { game, me, dummy } = setup()
  dummy.holdPumpkin('biggourd', 1, 1)
  const d = dummy.torso.getPosition(), atMe = { ...emptyInput(), aimX: d.x - 5, aimY: d.y }
  steps(game, 20, emptyInput(), atMe)   // (shield up, facing the throw)
  const w = throwWeapon(game, me, 'pitchfork', 6, { x: d.x - 3.5, y: dummy.handPosition().y }, new Vec2(30, 0), 1)
  steps(game, 8, emptyInput(), atMe)
  expect(dummy.damageTaken).toBe(0)
  expect(dummy.held.blocks).toBe(1)
  expect(w.state).not.toBe('flying')
})
