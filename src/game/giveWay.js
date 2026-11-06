// GIVING WAY — how a weapon in someone's hands keeps out of the level (platforms, walls, cannons,
// hazards, pegs) without ever getting in its holder's way.
//
// A held weapon isn't pushed around by physics: it goes exactly where its holder's pose wants it. But
// where that would put it into the level, it gives way, in this order:
//   1. tilt     turned away from what it ran into (up to CONFIG.weapon.give.tilt degrees), as close to
//               the pose as it can be: it rests on the floor, leans on the wall
//   2. back     slid back along its handle toward its holder (up to give.back m)
//   3. through  still in the way (jumping up past a ledge with it under the lip, say): it passes
//               through, until it's clear again
// It never pushes or pulls its holder, so it never stops a jump, a step or a climb.
//
// What it is checked against is its outline: from the chest to its grip, up the handle, round its head.

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { alongTool, headOf, toWorld } from './weaponTypes.js'

// What a held weapon keeps out of (and clanks off, swung into it).
export const LEVEL = new Set(['platform', 'hazard', 'peg'])
export const NO_GIVE = { tilt: 0, back: 0, through: false }
const SEARCH = 6   // halvings to find the least tilt / slide that clears it

// Where a tool held from `from` (its grip `along` m out from there, pointing along `angle`, its head on
// `side`) first runs into the level: { x, y, normal }, or null if it's clear.
export function toolBlocked(game, type, side, from, angle, along) {
  const grip = alongTool(from, angle, along), head = headOf(type)
  const outline = head.shape.map(p => toWorld(grip, angle, side, p))
  const segments = [[from, grip], [grip, toWorld(grip, angle, side, [head.neck, 0])]]
  outline.forEach((p, i) => segments.push([p, outline[(i + 1) % outline.length]]))
  for (const [a, b] of segments) {
    const hit = levelRay(game, a, b)
    if (hit) return hit
  }
  return null
}

// The first bit of the level on the line from a to b: { x, y, normal }, or null.
function levelRay(game, a, b) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-4) return null
  let hit = null
  game.world.rayCast(new Vec2(a.x, a.y), new Vec2(b.x, b.y), (fixture, point, normal, fraction) => {
    const ud = fixture.getBody().getUserData()
    if (!ud || !LEVEL.has(ud.kind) || fixture.isSensor()) return -1
    hit = { x: point.x, y: point.y, normal: { x: normal.x, y: normal.y } }
    return fraction   // (keep looking for anything nearer)
  })
  return hit
}

// How to give way (see the top), the tool held as in toolBlocked having run into the level at `hit`:
// { tilt (rad, added to its angle), back (m, slid back along it), through }. `before`: how it gave way
// last time (it keeps tilting the same way, so it doesn't flip-flop at a corner).
export function giveWay(game, type, side, from, angle, along, hit, before) {
  const G = CONFIG.weapon.give, maxTilt = G.tilt * Math.PI / 180
  const clear = (tilt, back) => !toolBlocked(game, type, side, from, angle + tilt, along - back)
  // 1. tilt: toward the side the surface faces (the way it last tilted, if it's still tilting)
  const d = { x: Math.cos(angle), y: Math.sin(angle) }
  const away = d.x * hit.normal.y - d.y * hit.normal.x >= 0 ? 1 : -1
  const first = before.tilt ? Math.sign(before.tilt) : away
  for (const sign of [first, -first]) {
    if (clear(sign * maxTilt, 0)) return { tilt: sign * least(t => clear(sign * t, 0), maxTilt), back: 0, through: false }
  }
  // 2. slid back along the handle
  if (clear(0, G.back)) return { tilt: 0, back: least(b => clear(0, b), G.back), through: false }
  // 3. through it, until it's clear
  return { tilt: 0, back: 0, through: true }
}

// The least x in (0, max] for which ok(x) (ok(max) is true; ok(0) isn't).
function least(ok, max) {
  let lo = 0, hi = max
  for (let i = 0; i < SEARCH; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) hi = mid
    else lo = mid
  }
  return hi
}
