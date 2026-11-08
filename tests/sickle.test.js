import { expect, it } from 'vitest'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { dropFromSky, throwWeapon } from '../src/game/looseWeapons.js'
import { CONFIG } from '../src/config.js'
import { WEAPON_TYPES } from '../src/game/weaponTypes.js'
import { HeldWeapon } from '../src/game/weapons.js'

const S = WEAPON_TYPES.sickle
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }

// Practice on The Patch (or `map`) with a sickle in hand, aiming right; the dummy out of the way until `put`.
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  const [me, dummy] = game.players
  steps(game, 30)
  me.holdWeapon(new HeldWeapon('sickle', S.uses))
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + 8 - b.x, 0)
  const aim = { ...emptyInput(), aimX: a.x + 30, aimY: me.shoulder().y - 0.2 }
  steps(game, 30, aim)
  // the dummy, dx m to my right, standing still
  const put = dx => { const p = me.torso.getPosition(), q = dummy.torso.getPosition(); dummy.moveBy(p.x + dx - q.x, p.y - q.y); dummy.setVelocity(0, 0) }
  return { game, me, dummy, aim, put }
}
// A click (press, let go), then `wait` steps.
function click(game, aim, wait) {
  steps(game, 1, { ...aim, throw: true })
  steps(game, wait, aim)
}
const SLASH = Math.ceil((S.tap.time + S.tap.cooldown) * 60) + 1   // (steps: one slash and its wait)

it('they come in a pair, one in each hand, held down by your sides; carrying them you\'re quicker', () => {
  const { me } = setup()
  const hands = me.weapon.hands(), sh = me.shoulder()
  expect(me.weapon.blades.map(b => b.hand).sort()).toEqual(['L', 'R'])
  for (const h of [hands.front, hands.back]) expect(h.y).toBeLessThan(sh.y - 0.4)   // (down by your sides)
  expect(me.weapon.carry.speed).toBe(1.1)
})

it('clicks come from each hand in turn, like punches', () => {
  const { game, me, aim } = setup()
  const hands = []
  for (let i = 0; i < 4; i++) {
    steps(game, 1, { ...aim, throw: true })
    steps(game, 2, aim)
    hands.push(me.weapon.active.hand)
    for (let j = 0; j < 60 && (me.weapon.swing || me.weapon.cooldown > 0); j++) steps(game, 1, aim)   // (done: the uppercut's longer)
  }
  expect(hands[0]).not.toBe(hands[1])
  expect(hands[1]).not.toBe(hands[2])
  expect(hands[2]).not.toBe(hands[3])
})

it('Throw Weapon throws one at a time: fight on with the other, then throw that too; each lands as its own', () => {
  const { game, me, aim } = setup()
  const toss = () => { steps(game, 1, { ...aim, toss: true }); steps(game, 1, aim) }
  toss()
  expect(me.weapon.blades).toHaveLength(1)
  steps(game, 30, aim)
  toss()
  expect(me.weapon).toBeNull()
  steps(game, 60)
  expect(game.looseWeapons.filter(w => w.typeName === 'sickle')).toHaveLength(2)
})

it('each has its own uses: one snapping leaves you the other', () => {
  const { game, me, dummy, aim, put } = setup()
  me.weapon.blades.forEach(b => { b.uses = 1 })
  put(0.8)
  click(game, aim, SLASH)
  expect(me.weapon.blades).toHaveLength(1)
  expect(game.events.some(e => e.type === 'weaponBreak')).toBe(true)
  put(0.8)
  click(game, aim, SLASH)
  expect(me.weapon).toBeNull()
  expect(dummy.damageTaken).toBe(2 * S.tap.damage)
})

it('with one in hand, you can pick up the other', () => {
  const { game, me, aim } = setup()
  steps(game, 1, { ...aim, toss: true })
  steps(game, 1, aim)
  const p = me.torso.getPosition()
  dropFromSky(game, 'pitchfork', p.x - 3)   // (not that: it's not the other of the pair)
  game.looseWeapons.push(...[])
  const w = game.looseWeapons.length
  steps(game, 90)
  const loose = game.looseWeapons.find(l => l.typeName === 'sickle' && l.state === 'stuck')
  me.moveBy(loose.x - me.torso.getPosition().x, 0)
  steps(game, 5)
  expect(me.pickup?.key).toBe(loose)
  steps(game, Math.ceil(CONFIG.weapon.yankTime * 60) + 2, { ...emptyInput(), harvest: true })
  expect(me.weapon.blades).toHaveLength(2)
  expect(w).toBeGreaterThan(0)
})

it('a pair falls in as two, side by side', () => {
  const { game, me } = setup()
  me.dropHeld()
  dropFromSky(game, 'sickle', me.torso.getPosition().x + 3)
  expect(game.looseWeapons.filter(w => w.typeName === 'sickle')).toHaveLength(2)
})

it('clicks slash through the aim, down then back up', () => {
  const { game, me, aim } = setup()
  const turning = () => { const a = me.weapon.pose.angle; steps(game, 1, aim); return me.weapon.pose.angle - a }
  steps(game, 1, { ...aim, throw: true })
  steps(game, 4, aim)
  expect(turning()).toBeLessThan(0)      // (facing right: down is clockwise)
  steps(game, SLASH - 6, aim)
  steps(game, 1, { ...aim, throw: true })
  steps(game, 4, aim)
  expect(turning()).toBeGreaterThan(0)   // (back up)
})

it('every 3rd slash in a run is an uppercut: it pops them up', () => {
  const { game, dummy, aim, put } = setup()
  put(0.8)
  click(game, aim, SLASH)
  click(game, aim, SLASH)
  expect(dummy.damageTaken).toBe(2 * S.tap.damage)
  put(0.8)
  let rise = 0
  steps(game, 1, { ...aim, throw: true })
  for (let i = 0; i < 25; i++) { steps(game, 1, aim); rise = Math.max(rise, dummy.torso.getLinearVelocity().y) }
  expect(dummy.damageTaken).toBe(2 * S.tap.damage + S.tap.combo.finisher.damage)
  expect(rise).toBeGreaterThan(5)
})

it('a pause (longer than combo.window) starts the run over: no uppercut', () => {
  const { game, dummy, aim, put } = setup()
  put(0.8)
  click(game, aim, SLASH)
  click(game, aim, SLASH + Math.ceil(S.tap.combo.window * 60) + 2)
  put(0.8)
  click(game, aim, 25)
  expect(dummy.damageTaken).toBe(3 * S.tap.damage)
})

it('a click during a slash isn\'t lost: the next slash comes right after it', () => {
  const { game, me, aim } = setup()
  steps(game, 1, { ...aim, throw: true })
  steps(game, 2, aim)
  steps(game, 1, { ...aim, throw: true })   // (mid-slash)
  let starts = 0, was = me.weapon.swing
  for (let i = 0; i < 25; i++) { steps(game, 1, aim); if (me.weapon.swing && me.weapon.swing !== was) starts++; was = me.weapon.swing }
  expect(starts).toBe(1)
})

it('hold for the Flurry: six slashes, each can hit them again, the last knocks them back (two uses)', () => {
  const { game, me, dummy, aim, put } = setup()
  steps(game, Math.ceil(S.charge.chargeTime * 60) + 2, { ...aim, throw: true })
  put(0.75)
  steps(game, Math.ceil(S.charge.time * 60) + 5, aim)
  expect(dummy.damageTaken).toBeGreaterThanOrEqual(4 * S.charge.damage)
  expect(dummy.damageTaken % S.charge.damage).toBe(0)
  expect(me.weapon.blades.reduce((n, b) => n + b.uses, 0)).toBe(2 * S.uses - S.charge.cost)
})

it('you can move about while the Flurry goes on, and it follows your aim', () => {
  const { game, me, aim } = setup()
  steps(game, Math.ceil(S.charge.chargeTime * 60) + 2, { ...aim, throw: true })
  const x = me.torso.getPosition().x
  const left = { ...emptyInput(), aimX: me.torso.getPosition().x - 30, aimY: aim.aimY, left: true }
  steps(game, 1, aim)
  steps(game, Math.ceil(S.charge.time * 60) - 4, left)
  expect(me.weapon.swing?.move).toBe(S.charge)
  expect(me.torso.getPosition().x).toBeLessThan(x - 0.8)
  expect(Math.cos(me.weapon.swing.aim)).toBeLessThan(0)   // (slashing to the left now)
})

it('thrown, it bounces back off the first wall it hits, hitting people again on the way back, then sticks in what it hits next', () => {
  const { game, me, dummy } = setup('hayloft')   // (the barn's left wall: its face at x 0.8)
  me.moveBy(4 - me.torso.getPosition().x, 0)
  dummy.moveBy(2.4 - dummy.torso.getPosition().x, me.torso.getPosition().y - dummy.torso.getPosition().y)   // (between me and the wall)
  steps(game, 20)
  me.dropHeld()
  const c = me.shoulder()
  const w = throwWeapon(game, me, 'sickle', S.uses, { x: c.x - 0.4, y: c.y - 0.2 }, { x: -S.throw.speed[1], y: 1 }, 1, -1)
  for (let i = 0; i < 120 && w.state === 'flying'; i++) steps(game, 1)
  expect(w.bounced).toBe(true)
  expect(dummy.damageTaken).toBe(2 * S.throw.damage)   // (there and back)
  expect(w.state).toBe('stuck')
})
