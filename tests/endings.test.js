import { afterEach, expect, it } from 'vitest'
import { clock } from '../src/render/anims.js'
import { createEffects } from '../src/render/effects.js'
import { DRAIN, gooLeft, trackEndings } from '../src/render/endings.js'

// Just enough of a snapshot for the endings tracker (The Patch, no patches).
const snap = ({ player = {}, bale = null, ice = [] } = {}) => ({
  map: 'patch', transition: null, patches: [],
  players: [{ slot: 0, glued: false, frozen: false, dead: false, parts: [[12, 5.6, 0]], ...player }],
  bales: bale ? [{ id: 3, x: 14, y: 4.8, sticky: false, frozen: false, ...bale }] : [],
  ...(ice.length && { ice }),
})
const realNow = clock.now
afterEach(() => { clock.now = realNow; trackEndings(null, createEffects()) })

it('a player coming unglued: their goo drains away over DRAIN s, in its own color', () => {
  const fx = createEffects()
  let t = 100
  clock.now = () => t
  trackEndings(snap({ player: { glued: true, goo: 'sticky' } }), fx)
  expect(gooLeft('p0')).toBe(null)   // (still glued: nothing draining)
  trackEndings(snap(), fx)
  expect(gooLeft('p0')).toMatchObject({ k: 1, goo: 'sticky' })
  t += DRAIN / 2
  const half = gooLeft('p0').k
  expect(half).toBeGreaterThan(0)
  expect(half).toBeLessThan(1)
  t += DRAIN
  expect(gooLeft('p0')).toBe(null)
})

it('a hay bale losing its goo drains the same way', () => {
  const fx = createEffects()
  trackEndings(snap({ bale: { sticky: true } }), fx)
  trackEndings(snap({ bale: { sticky: false } }), fx)
  expect(gooLeft('b3')).toMatchObject({ goo: 'pie' })
})

it('thawing, players, bales and icy floor burst into ice shards', () => {
  const fx = createEffects()
  trackEndings(snap({ player: { frozen: true }, bale: { frozen: true }, ice: [{ id: 1, x0: 10, x1: 14, y: 4.4, t: 0.1 }] }), fx)
  expect(fx.particles).toHaveLength(0)
  trackEndings(snap({ bale: { frozen: false } }), fx)
  const shards = fx.particles.filter(q => q.shape === 'shard')
  expect(shards.length).toBeGreaterThan(18 + 14)   // (player, bale, and all along the floor)
})

it('nothing when the map changes (a new round on another map); dead players still shatter', () => {
  const fx = createEffects()
  trackEndings(snap({ player: { frozen: true, glued: true } }), fx)
  trackEndings({ ...snap(), map: 'testing' }, fx)
  expect(fx.particles).toHaveLength(0)
  expect(gooLeft('p0')).toBe(null)
  trackEndings(snap({ player: { frozen: true, dead: true } }), fx)
  trackEndings(snap({ player: { dead: true } }), fx)
  expect(fx.particles.length).toBeGreaterThan(0)
})

it('nothing for someone respawning, or when a new round starts', () => {
  const fx = createEffects()
  trackEndings(snap({ player: { frozen: true } }), fx)
  trackEndings(snap({ player: { parts: [[25, 8, 0]] } }), fx)   // (back at their spawn)
  expect(fx.particles).toHaveLength(0)
  trackEndings({ ...snap({ player: { frozen: true } }), match: { round: 1 } }, fx)
  trackEndings({ ...snap(), match: { round: 2 } }, fx)
  expect(fx.particles).toHaveLength(0)
})
