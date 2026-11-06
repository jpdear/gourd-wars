// GOURD CANNONS — a map piece: a little iron cannon mounted on a floor, wall or ceiling (never
// floating), firing a Classic gourd along its aim every so often. Its gourds belong to nobody: they hit
// anyone. The cannon itself is solid (stand on it, bump it; blades clank off it) and can't be broken.
//
// In a map (see builtin.js): { x, y (where it sits on the surface), face (which side of the solid
// it's on: 'top' = a floor, 'bottom' = a ceiling, 'left' / 'right' = a wall's side), aim (degrees,
// 0 = right, 90 = up: kept within MAX_TILT of straight out from the surface), speed (m/s), every
// (s between shots), delay (s before the first shot of a round) }.
//
// game.cannons: { def, timer (s until it fires) }, in the map's order.

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { CONFIG } from '../config.js'
import { r3, wrapAngle } from '../util/math.js'

export const CANNON = {
  base: { w: 0.8, h: 0.4 },   // the mount: this wide along the surface, this deep out from it (m)
  barrel: 0.75,               // from its pivot (at the top of the mount) to the muzzle (m)
  maxTilt: 80,                // its aim stays within this many degrees of straight out from the surface
  ammo: 'classic',
  defaults: { speed: 12, every: 3, delay: 1 },
}
// which way is "out" from the surface, for each face (degrees)
export const CANNON_FACES = { top: 90, bottom: -90, left: 180, right: 0 }

const rad = d => d * Math.PI / 180

// Its aim (degrees), kept within reach of straight out from its face.
export function clampAim(face, aim) {
  const out = CANNON_FACES[face] ?? 90
  const off = wrapAngle(rad(aim - out)) * 180 / Math.PI
  return r3(wrapDeg(out + Math.max(-CANNON.maxTilt, Math.min(CANNON.maxTilt, off))))
}
const wrapDeg = d => ((d + 540) % 360) - 180

// Where its parts are (for the game, drawing it and the editor): { out (unit vector away from the
// surface), base (the mount's middle), angle (the mount's tilt, rad), pivot, aim (rad), dir (unit),
// muzzle }.
export function cannonParts(c) {
  const o = rad(CANNON_FACES[c.face] ?? 90), out = { x: Math.cos(o), y: Math.sin(o) }
  const base = { x: c.x + out.x * CANNON.base.h / 2, y: c.y + out.y * CANNON.base.h / 2 }
  const pivot = { x: c.x + out.x * CANNON.base.h, y: c.y + out.y * CANNON.base.h }
  const aim = rad(clampAim(c.face, c.aim)), dir = { x: Math.cos(aim), y: Math.sin(aim) }
  return { out, base, angle: o - Math.PI / 2, pivot, aim, dir, muzzle: { x: pivot.x + dir.x * CANNON.barrel, y: pivot.y + dir.y * CANNON.barrel } }
}

// Where a cannon would go for a click at (x, y), given the map's solid rectangles ({ x, y, w, h }):
// the nearest point on any of their sides within `reach` m, out in the open (not inside another one):
// { x, y, face }, or null (nothing to mount it on: it can't float).
export function mountPoint(rects, x, y, reach = 1.2) {
  let best = null, bestD = reach
  for (const r of rects) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, y0 = r.y - r.h / 2, y1 = r.y + r.h / 2
    const cx = Math.max(x0, Math.min(x1, x)), cy = Math.max(y0, Math.min(y1, y))
    const sides = [   // [face, point on that side]
      ['top', { x: cx, y: y1 }], ['bottom', { x: cx, y: y0 }], ['left', { x: x0, y: cy }], ['right', { x: x1, y: cy }],
    ]
    for (const [face, p] of sides) {
      const d = Math.hypot(x - p.x, y - p.y)
      if (d >= bestD) continue
      const o = rad(CANNON_FACES[face]), probe = { x: p.x + Math.cos(o) * 0.1, y: p.y + Math.sin(o) * 0.1 }
      if (rects.some(q => Math.abs(probe.x - q.x) < q.w / 2 && Math.abs(probe.y - q.y) < q.h / 2)) continue   // (buried against another piece)
      best = { x: r3(p.x), y: r3(p.y), face }
      bestD = d
    }
  }
  return best
}

// Its solid mount, in the world (static: it never moves).
export function buildCannon(game, c) {
  const { base, angle } = cannonParts(c)
  const body = game.world.createBody({ type: 'static', position: new Vec2(base.x, base.y), angle })
  body.createFixture(new planck.Box(CANNON.base.w / 2, CANNON.base.h / 2), { friction: 0.8 })
  body.setUserData({ kind: 'platform', cannon: true, x: base.x, y: base.y, w: CANNON.base.w, h: CANNON.base.h })
  return body
}

// Start of a round: each waits its delay before its first shot.
export function resetCannons(game) {
  for (const c of game.cannons) c.timer = c.def.delay
}

// They fire on their own schedules (not while the camera's carrying everyone to the next map).
export function updateCannons(game, dt) {
  if (game.transition) return
  for (const c of game.cannons) {
    if ((c.timer -= dt) > 0) continue
    c.timer += Math.max(0.5, c.def.every)
    fire(game, c.def)
  }
}

function fire(game, c) {
  const { muzzle, dir, aim } = cannonParts(c)
  const r = PUMPKIN_TYPES[CANNON.ammo].radius, at = new Vec2(muzzle.x + dir.x * r, muzzle.y + dir.y * r)
  spawnPumpkin(game, CANNON.ammo, at, new Vec2(dir.x * c.speed, dir.y * c.speed), null)
  game.events.push({ type: 'cannon', x: r3(muzzle.x), y: r3(muzzle.y), angle: r3(aim) })
}

// Where its gourds go (for the editor's dotted line): points along the flight, until it hits one of
// `rects` or leaves the screen.
export function cannonPath(c, rects, step = 0.03, max = 3) {
  const { muzzle, dir } = cannonParts(c), g = CONFIG.gravity * (PUMPKIN_TYPES[CANNON.ammo].gravityScale ?? 1)
  const pts = []
  for (let t = 0; t <= max; t += step) {
    const p = { x: muzzle.x + dir.x * c.speed * t, y: muzzle.y + dir.y * c.speed * t - g * t * t / 2 }
    if (p.x < -1 || p.x > CONFIG.view.w + 1 || p.y < -1) break
    pts.push(p)
    if (rects.some(q => Math.abs(p.x - q.x) < q.w / 2 && Math.abs(p.y - q.y) < q.h / 2)) break
  }
  return pts
}
