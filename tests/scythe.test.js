import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { dropWeapon, throwWeapon } from '../src/game/looseWeapons.js'
import { WEAPON_TYPES, pointOf } from '../src/game/weaponTypes.js'
import { HeldWeapon } from '../src/game/weapons.js'

const S = WEAPON_TYPES.scythe
const steps = (game, n, input = emptyInput(), dummyInput = emptyInput()) => { for (let i = 0; i < n; i++) stepGame(game, [input, dummyInput]) }

// Practice on The Patch with a scythe in hand, aiming right; the dummy out of the way until `put`.
function setup(map) {
  const game = createGame()
  if (map) { game.mapChoice = map; resetRound(game) }
  const [me, dummy] = game.players
  steps(game, 30)
  me.holdWeapon(new HeldWeapon('scythe', S.uses))
  const a = me.torso.getPosition(), b = dummy.torso.getPosition()
  dummy.moveBy(a.x + 8 - b.x, 0)
  const aim = { ...emptyInput(), aimX: 30, aimY: me.shoulder().y }
  steps(game, 30, aim)
  // the dummy, dx m to my right (left: negative), standing still
  const put = dx => { const p = me.torso.getPosition(), q = dummy.torso.getPosition(); dummy.moveBy(p.x + dx - q.x, p.y - q.y); dummy.setVelocity(0, 0) }
  return { game, me, dummy, aim, put }
}

it('a click reaps: raised `arc` back from the aim (aiming ahead: overhead), then brought down, hitting whoever\'s under it (one use)', () => {
  for (const dx of [1.6, 1, -1.6]) {   // (facing right; and left)
    const { game, me, dummy, put } = setup()
    const aim = { ...emptyInput(), aimX: dx > 0 ? 30 : 0, aimY: me.shoulder().y }
    steps(game, 30, aim)
    steps(game, 1, { ...aim, throw: true })
    steps(game, 1, aim)   // (let go: it swings)
    let highest = -Infinity   // (how far it's raised: up from pointing the way they face, toward their back)
    const raised = () => me.facing > 0 ? me.weapon.body.getAngle() : Math.PI - me.weapon.body.getAngle()
    for (let i = 0; i < 6; i++) { steps(game, 1, aim); put(dx) }   // (they step in while it's raised)
    for (let i = 0; i < 40; i++) { steps(game, 1, aim); highest = Math.max(highest, raised()) }
    expect(highest).toBeCloseTo(S.tap.arc * Math.PI / 180, 0)   // (up over your head, and no further back)
    expect(dummy.damageTaken).toBe(S.tap.damage)
    expect(me.weapon.uses).toBe(S.uses - 1)
  }
})

it('the reap is the same size of swing wherever you aim: only where it starts changes', () => {
  for (const a of [-0.7, 0, 0.7, 1.2]) {   // (down ahead, ahead, up ahead, nearly straight up)
    const { game, me } = setup()
    const sh = me.shoulder(), aim = { ...emptyInput(), aimX: sh.x + 6 * Math.cos(a), aimY: sh.y + 6 * Math.sin(a) }
    steps(game, 30, aim)
    steps(game, 1, { ...aim, throw: true })
    steps(game, 1, aim)
    let highest = -Infinity
    for (let i = 0; i < 20; i++) { steps(game, 1, aim); highest = Math.max(highest, me.weapon.body.getAngle()) }
    expect(highest - a).toBeCloseTo(S.tap.arc * Math.PI / 180, 0)
  }
})

it('hold for the Whirl: twice all the way round you (through the floor: no clank), flinging whoever it catches away from you', () => {
  for (const dx of [1.2, -1.2]) {
    const { game, me, dummy, aim, put } = setup()
    steps(game, Math.ceil(S.charge.chargeTime * 60) + 2, { ...aim, throw: true })
    put(dx)
    game.events.length = 0
    let flung = null
    for (let i = 0; i < 60; i++) {
      steps(game, 1, aim)
      if (flung === null && dummy.damageTaken) flung = dummy.torso.getLinearVelocity().x
    }
    expect(dummy.damageTaken).toBe(S.charge.damage)
    expect(Math.sign(flung)).toBe(Math.sign(dx))   // (away from you)
    expect(me.weapon.body.getAngle()).toBeCloseTo(-2 * S.charge.turns * Math.PI, 0)   // (all the way round, twice)
    expect(game.events.some(e => e.type === 'clank')).toBe(false)
    expect(me.weapon.uses).toBe(S.uses - S.charge.cost)
  }
})

it('its blade hangs down whichever way you face (turning round flips it over the handle)', () => {
  const { game, me } = setup()
  for (const aimX of [30, 0, 30]) {
    steps(game, 30, { ...emptyInput(), aimX, aimY: me.shoulder().y })
    const { at, angle } = me.weapon.pose
    expect(me.weapon.side).toBe(me.facing)
    expect(pointOf(S, at, angle, me.weapon.side).y).toBeLessThan(at.y - 0.5)
  }
})

it('carrying it slows you (heavy)', () => {
  const speedWith = weapon => {
    const game = createGame(), me = game.players[0]
    steps(game, 30)
    if (weapon) me.holdWeapon(new HeldWeapon(weapon, 9))
    steps(game, 60, { ...emptyInput(), right: true, aimX: 30, aimY: 5 })
    return me.torso.getLinearVelocity().x
  }
  expect(speedWith('scythe')).toBeLessThan(speedWith(null) * 0.92)
})

it('thrown, a buzzsaw spins through everyone in its way (hitting each once, one throw\'s uses) and buries itself in a wall', () => {
  const { game, me, dummy } = setup('hayloft')   // (its left wall's face at x 0.8)
  const d = dummy.torso.getPosition()
  me.moveBy(8 - me.torso.getPosition().x, 0)
  dummy.moveBy(4 - d.x, 0)
  steps(game, 10)
  const at = dummy.torso.getPosition()
  const w = throwWeapon(game, me, 'scythe', 5, { x: at.x + 2.5, y: at.y }, { x: -S.throw.speed[1], y: 0 }, 1, -1)
  let spun = 0, last = w.body.getAngle()
  for (let i = 0; i < 60 && w.state === 'flying'; i++) {
    steps(game, 1)
    if (w.body) { spun += Math.abs(w.body.getAngle() - last); last = w.body.getAngle() }
  }
  expect(spun).toBeGreaterThan(Math.PI)   // (spinning, not point first)
  expect(dummy.damageTaken).toBe(S.throw.damage)
  expect(w.state).toBe('stuck')   // (on through them, into the wall)
  expect(w.x).toBeLessThan(2.6)
  expect(w.uses).toBe(5 - S.throw.cost)
})

it('a crow\'s scythe falls in point first and sticks, to be pulled out', () => {
  const { game, me } = setup()
  me.dropHeld()
  const c = me.torso.getPosition()
  dropWeapon(game, 'scythe', c.x, 12)
  steps(game, 120)
  const w = game.looseWeapons[0]
  expect(w.state).toBe('stuck')
  expect(pointOf(S, w, w.angle, w.side).y).toBeLessThan(4.4)   // (its point in the platform)
  expect(me.pickup?.key).toBe(w)
  steps(game, Math.ceil(CONFIG.weapon.yankTime * 60) + 1, { ...emptyInput(), harvest: true })
  expect(me.weapon.typeName).toBe('scythe')
})

it('under a low ceiling, raising it back for a reap clanks into it: the swing stops (a use)', () => {
  const { game, me, aim } = setup('hayloft')   // (the left shelf: x 9–12, its underside at 5.1; the floor's top at 2.6)
  me.moveBy(8.6 - me.torso.getPosition().x, 0)
  steps(game, 30, aim)
  game.events.length = 0
  steps(game, 1, { ...aim, throw: true })
  steps(game, 30, aim)
  expect(game.events.some(e => e.type === 'clank')).toBe(true)
  expect(me.weapon.swing).toBeNull()
  expect(me.weapon.uses).toBe(S.uses - 1)
})

it('reaping with it resting on the floor (aiming down) doesn\'t clank on the floor it starts on', () => {
  const { game, me, put, dummy } = setup()
  const down = { ...emptyInput(), aimX: me.shoulder().x + 1.2, aimY: me.shoulder().y - 3 }
  steps(game, 30, down)
  game.events.length = 0
  steps(game, 1, { ...down, throw: true })
  steps(game, 1, down)
  for (let i = 0; i < 6; i++) { steps(game, 1, down); put(1.3) }
  steps(game, 40, down)
  expect(dummy.damageTaken).toBe(S.tap.damage)
})

it('a buzzsaw bounces off the floor (it buries itself only in walls, or once slow), and a weak toss just lies where it lands', () => {
  const { game, me } = setup('hayloft')   // (the barn floor's top at 2.6; its left wall's face at x 0.8)
  me.moveBy(12 - me.torso.getPosition().x, 0)
  const far = throwWeapon(game, me, 'scythe', 5, { x: 9, y: 3.4 }, { x: -S.throw.speed[1], y: 0 }, 1, -1)
  for (let i = 0; i < 120 && far.state === 'flying'; i++) steps(game, 1)
  expect(far.state).toBe('stuck')
  expect(far.x).toBeLessThan(2.6)   // (in the wall, not the floor along the way)
  const weak = throwWeapon(game, me, 'scythe', 5, { x: 7, y: 4 }, { x: 2, y: 0 }, 0.4, 1)
  for (let i = 0; i < 240 && weak.state === 'flying'; i++) steps(game, 1)
  expect(weak.state).toBe('stuck')
})
