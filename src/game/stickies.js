// STICKY BOMBS — a Sticky Bomb that hit something stays stuck on it, riding along with whatever it's on
// (a platform, a moving platform, a hay bale, a cannon, pitchforks, a part of someone), its fuse burning
// down from the moment it stuck; then it bursts, gluing everything near (see glueBurst in powers.js). A blast in reach sets it off
// a moment sooner (chain reactions). On someone it can't be shaken off; if they fall off the map (or a
// Black Hole takes them) it goes with them, quietly; if its hay bale breaks, it goes off right away.
//
// game.stickies: [{ id, on (the body it's stuck to), local ({x, y}: its middle, in that body's frame),
//   turn (which way is "out" from what it's on, in that body's frame), onPlayer, timer (s left), power,
//   typeName, x, y, angle ("out", in the world: kept up to date every step),
//   span ([from, to]: on a surface, how far the surface runs either side of it along the surface, in m, as far
//   as its goo reaches: so near an edge the goo is drawn stopping at the edge, not hanging in the air) }]
//
//   stickTo(game, pk, body, onPlayer)   a thrown one (pk) sticks to `body` where it is now (another gourd: it breaks instead)
//   updateStickies(game, dt)            ride along, burn down, burst
//   blastStickies(game, x, y, radius)   a blast reaches them: off they go a moment later
//   clearStickies(game)                 a new round

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { glueBurst } from './powers.js'
import { breakPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'

const GAP = 1.32   // on a surface, its middle sits this many of its radii out from it (room for its goo strands)
const GOO_REACH = 1.35   // ...and its goo spreads this many of its radii either side along the surface (see span)

export function clearStickies(game) {
  game.stickies = []
}

export function stickTo(game, pk, body, onPlayer) {
  if (pk.broken) return
  const ud = body.getUserData()
  if (ud && ud.kind === 'pumpkin') return breakPumpkin(game, pk)   // (gourds don't stay put: it breaks on them, like any gourd)
  pk.broken = true   // (quietly: it's not breaking, it's stuck)
  const pos = pk.body.getPosition(), r = pk.radius
  let at = { x: pos.x, y: pos.y }, out, span
  if (onPlayer) {   // out from the middle of the part it hit
    const c = body.getPosition()
    out = unit(pos.x - c.x, pos.y - c.y)
  } else {          // out from the surface it hit, sitting a little off it
    const hit = surfaceUnder(game, body, pos, pk.impactVel || pk.body.getLinearVelocity(), r)
    out = hit.normal
    at = { x: hit.point.x + out.x * r * GAP, y: hit.point.y + out.y * r * GAP }
    span = surfaceSpan(game, body, hit.point, out, r * GOO_REACH)
  }
  const local = body.getLocalPoint(new Vec2(at.x, at.y))
  game.stickies.push({
    id: game.nextStickyId++, on: body, local: { x: local.x, y: local.y }, turn: Math.atan2(out.y, out.x) - body.getAngle(),
    onPlayer, timer: pk.type.stuckFuse, power: pk.power, typeName: pk.typeName, x: at.x, y: at.y, angle: Math.atan2(out.y, out.x), span,
  })
}

// How far `body`'s surface runs either side of `point` (out: the way out from it), up to `reach` m: feeling
// for it every few cm along the surface (to the right of out, then the left), stopping at the first gap.
// [from (≤ 0), to (≥ 0)], in m along the surface (+: clockwise from out, which is rightward on a floor).
function surfaceSpan(game, body, point, out, reach) {
  const along = { x: out.y, y: -out.x }, step = 0.03
  const touches = o => {
    let hit = false
    const from = new Vec2(point.x + along.x * o + out.x * 0.05, point.y + along.y * o + out.y * 0.05)
    game.world.rayCast(from, new Vec2(from.x - out.x * 0.15, from.y - out.y * 0.15), fixture => {
      if (fixture.getBody() !== body) return -1
      hit = true
      return 0
    })
    return hit
  }
  const edge = dir => { let o = 0; while (o + step <= reach && touches(dir * (o + step))) o += step; return o >= reach - step ? reach : o }
  return [-edge(-1), edge(1)]
}

// Where it hit `body` and which way is out from it: a ray from its middle along the way it was going (then
// down, sideways and up, if that misses), against that body only. { point, normal }
function surfaceUnder(game, body, pos, vel, r) {
  const v = unit(vel.x, vel.y)
  for (const d of [v, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
    let hit = null
    game.world.rayCast(new Vec2(pos.x, pos.y), new Vec2(pos.x + d.x * (r + 0.4), pos.y + d.y * (r + 0.4)), (fixture, point, normal, fraction) => {
      if (fixture.getBody() !== body) return -1
      hit = { point: { x: point.x, y: point.y }, normal: { x: normal.x, y: normal.y } }
      return fraction
    })
    if (hit) return hit
  }
  return { point: { x: pos.x - v.x * r, y: pos.y - v.y * r }, normal: { x: -v.x, y: -v.y } }
}

// What happened to what it's on (by its kind): 'off' (go off now), 'gone' (gone quietly), or nothing.
const LOST = {
  bale: ud => (ud.bale.broken ? 'off' : null),
  player: ud => (ud.player.dead || ud.player.removed ? 'gone' : null),
}

export function updateStickies(game, dt) {
  for (const s of game.stickies) {
    const ud = s.on.getUserData(), lost = ud && LOST[ud.kind] ? LOST[ud.kind](ud) : null
    if (lost === 'gone') { s.gone = true; continue }
    if (!lost) {
      const p = s.on.getWorldPoint(new Vec2(s.local.x, s.local.y))
      s.x = p.x; s.y = p.y; s.angle = s.on.getAngle() + s.turn
      if (s.y < CONFIG.killY) { s.gone = true; continue }
    }
    if (lost === 'off' || (s.timer -= dt) <= 0) goOff(game, s)
  }
  game.stickies = game.stickies.filter(s => !s.gone)
}

function goOff(game, s) {
  if (s.gone) return
  s.gone = true
  glueBurst(game, s.x, s.y, PUMPKIN_TYPES[s.typeName].glue, s.power)
}

export function blastStickies(game, x, y, radius) {
  for (const s of game.stickies) {
    if (!s.gone && Math.hypot(s.x - x, s.y - y) <= radius) s.timer = Math.min(s.timer, PUMPKIN_TYPES[s.typeName].chainDelay)
  }
}

const unit = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d } }
