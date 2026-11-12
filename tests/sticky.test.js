import { Vec2 } from 'planck'
import { expect, it } from 'vitest'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { explode, glueBurst } from '../src/game/powers.js'
import { spawnPumpkin } from '../src/game/pumpkins.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { packSnapshot, unpackSnapshot } from '../src/net/protocol.js'

const S = PUMPKIN_TYPES.sticky
// Practice: you and a dummy, standing. The Patch: the main floor's top at 4.4, x 9 to 23 (a pumpkin
// patch at 16: keep clear of it).
function setup() {
  const game = createGame()
  steps(game, 30)   // (stand up)
  return { game, me: game.players[0], dummy: game.players[1] }
}
const steps = (game, n) => { for (let i = 0; i < n; i++) stepGame(game, [emptyInput(), emptyInput()]) }
function standAt(p, x, y = 4.4) {
  const c = p.torso.getPosition()
  p.moveBy(x - c.x, y + 1.2 - c.y)
  p.setVelocity(0, 0)
}
const sticky = (game, x, y, vx, vy) => spawnPumpkin(game, 'sticky', new Vec2(x, y), new Vec2(vx, vy), null)
const bursts = game => game.events.filter(e => e.type === 'glueburst').length

it('sticks to the floor where it lands, then bursts 2 s later (not before), leaving the floor sticky', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  sticky(game, 20, 5.2, 0, -6)
  steps(game, 10)
  expect(game.pumpkins).toHaveLength(0)
  expect(game.stickies).toHaveLength(1)
  const st = game.stickies[0]
  expect(st.onPlayer).toBe(false)
  expect(st.x).toBeCloseTo(20, 0)
  expect(st.y).toBeGreaterThan(4.4)
  expect(st.y).toBeLessThan(4.4 + 0.5)
  expect(Math.sin(st.angle)).toBeGreaterThan(0.9)   // (out from the floor: up)
  game.events.length = 0
  steps(game, Math.floor(st.timer * 60) - 3)
  expect(bursts(game)).toBe(0)
  steps(game, 6)
  expect(bursts(game)).toBe(1)
  expect(game.stickies).toHaveLength(0)
  const goo = game.goo.find(z => Math.abs(z.y - 4.4) < 0.01)
  expect(goo.x0).toBeLessThan(18)
  expect(goo.x1).toBeGreaterThan(22)
  expect(makeSnapshot(game).goo.length).toBeGreaterThan(0)
  steps(game, Math.ceil(S.glue.floor * 60) + 2)
  expect(game.goo).toHaveLength(0)
})

it('walking into the sticky floor, you get stuck till it dries', () => {
  const { game, me, dummy } = setup()
  standAt(me, 12)
  standAt(dummy, 9.5)
  sticky(game, 20, 5.2, 0, -6)
  steps(game, 10 + Math.ceil(S.stuckFuse * 60))
  expect(game.goo.length).toBeGreaterThan(0)
  expect(me.glued).toBe(false)
  standAt(me, 18.5)
  steps(game, 3)
  expect(me.glued).toBe(true)
  expect(makeSnapshot(game).players[0].goo).toBe('sticky')
})

it('sticks to someone without hurting them, rides along on them, then bursts: glued, a little hurt, not pushed', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 20)
  steps(game, 2)
  sticky(game, 18.5, 5.7, 12, 0)
  steps(game, 10)
  expect(game.stickies).toHaveLength(1)
  expect(game.stickies[0].onPlayer).toBe(true)
  expect(dummy.damageTaken).toBe(0)
  const before = game.stickies[0].x
  dummy.moveBy(-2, 0)
  steps(game, 2)
  expect(game.stickies[0].x).toBeCloseTo(before - 2, 0)
  const at = dummy.torso.getPosition().x
  steps(game, Math.ceil(S.stuckFuse * 60))
  expect(game.stickies).toHaveLength(0)
  expect(dummy.damageTaken).toBeGreaterThan(5)
  expect(dummy.damageTaken).toBeLessThanOrEqual(S.glue.damage)
  expect(dummy.glued).toBe(true)
  expect(dummy.gluedTimer).toBeGreaterThan(S.glue.center - 0.6)
  expect(Math.abs(dummy.torso.getPosition().x - at)).toBeLessThan(0.3)   // (no push)
})

it('its burst makes hay bales gooey (its own green goo), there and back over the network', () => {
  const { game } = setup()
  game.mapChoice = 'testing'   // (bales)
  resetRound(game)
  steps(game, 30)
  const bale = game.bales[0], b = bale.body.getPosition()
  glueBurst(game, b.x + 1, b.y, S.glue, 1)
  expect(bale.stickyTimer).toBeGreaterThan(S.glue.edge)
  const snap = makeSnapshot(game), i = 0
  expect(snap.bales[i]).toMatchObject({ sticky: true, goo: 'sticky' })
  expect(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(snap)))).bales[i]).toEqual(JSON.parse(JSON.stringify(snap.bales[i])))   // (JSON turns -0 into 0)
})

it('sticks to a hay bale and moves with it', () => {
  const { game } = setup()
  game.mapChoice = 'testing'   // (bales)
  resetRound(game)
  steps(game, 30)
  const bale = game.bales[0], b = bale.body.getPosition()
  sticky(game, b.x - 1, b.y, 10, 0)
  steps(game, 8)
  expect(game.stickies).toHaveLength(1)
  const st = game.stickies[0], dx = st.x - bale.body.getPosition().x
  bale.body.setTransform(new Vec2(bale.body.getPosition().x + 1, bale.body.getPosition().y), bale.body.getAngle())
  steps(game, 1)
  expect(game.stickies[0].x - bale.body.getPosition().x).toBeCloseTo(dx, 1)
})

it('another blast sets it off a moment later', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  sticky(game, 20, 5.2, 0, -6)
  steps(game, 10)
  explode(game, 21, 4.8, PUMPKIN_TYPES.boom.blast, 1)
  expect(game.stickies[0].timer).toBeLessThanOrEqual(S.chainDelay)
  game.events.length = 0
  steps(game, Math.ceil(S.chainDelay * 60) + 2)
  expect(bursts(game)).toBe(1)
})

it('on someone who falls off the map, it goes with them, quietly', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 20)
  steps(game, 2)
  sticky(game, 18.5, 5.7, 12, 0)
  steps(game, 10)
  dummy.moveBy(0, -20)   // (below the map)
  game.events.length = 0
  steps(game, 5)
  expect(game.stickies).toHaveLength(0)
  expect(bursts(game)).toBe(0)
})

it('a Big Gourd shield blocks it: it sticks to the arm holding the shield', () => {
  const { game, me, dummy } = setup()
  standAt(me, 10)
  standAt(dummy, 20)
  steps(game, 2)
  dummy.holdPumpkin('biggourd', 1, 1)
  steps(game, 20)
  const hand = dummy.handPosition()
  sticky(game, hand.x - 1.5, hand.y, 12, 0)
  steps(game, 10)
  expect(game.stickies).toHaveLength(1)
  expect(game.stickies[0].onPlayer).toBe(true)
  expect(dummy.held).not.toBe(null)
})

it('goes in snapshots (only while there are some), there and back over the network', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  expect(makeSnapshot(game).stickies).toBeUndefined()
  sticky(game, 20, 5.2, 0, -6)
  steps(game, 10)
  const snap = makeSnapshot(game)
  expect(snap.stickies).toHaveLength(1)
  expect(snap.stickies[0]).toMatchObject({ onPlayer: false })
  expect(unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(snap)))).stickies).toEqual(snap.stickies)
})

it('hitting another gourd in the air, it breaks (bursting there) instead of sticking', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 22)
  sticky(game, 14, 8, 6, 0)
  spawnPumpkin(game, 'classic', new Vec2(17, 8), new Vec2(-6, 0), null)
  game.events.length = 0
  steps(game, 20)
  expect(game.stickies).toHaveLength(0)
  expect(game.pumpkins.filter(pk => pk.typeName === 'sticky')).toHaveLength(0)
  expect(bursts(game)).toBe(1)
})

it('near the edge of what it sticks to, it knows where the surface ends (so its goo stops there)', () => {
  const { game, me, dummy } = setup()
  standAt(me, 9.5)
  standAt(dummy, 12)
  sticky(game, 22.95, 5.2, 0, -6)   // (the floor ends at 23)
  sticky(game, 19, 5.2, 0, -6)      // (and well inside it)
  steps(game, 10)
  const [edgy, inside] = [...game.stickies].sort((a, b) => b.x - a.x)
  expect(edgy.span[1]).toBeLessThan(0.12)   // (to the right: the edge, just past it)
  expect(edgy.span[0]).toBeLessThan(-0.2)   // (to the left: floor as far as the goo goes)
  expect(inside.span[0]).toBeLessThan(-0.2)
  expect(inside.span[1]).toBeGreaterThan(0.2)
  expect(makeSnapshot(game).stickies.every(s => Array.isArray(s.span))).toBe(true)
})

it('gooey bales and the sticky floor last 6 s', () => {
  expect(S.glue.bale).toBe(6)
  expect(S.glue.floor).toBe(6)
})
