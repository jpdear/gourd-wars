// FIRE — players and hay bales burning, and the fire patches a Fire Gourd leaves on the floor.
//   A player on fire (Player.ignite) burns for CONFIG.fire.burnTime s, taking CONFIG.fire.dps, and sets
//     anyone they touch on fire too. Catching fire thaws you; being frozen (a Frost hit, an Ice Bomb) puts
//     it out. Glue doesn't care.
//   A hay bale on fire (igniteBale) burns for CONFIG.fire.baleBurn s, setting anyone touching it on fire,
//     then burns away (the 'burn' break). Freezing it puts it out.
//   A fire patch (firePatch): the platform tops near a spot burn for a while (game.fire: floor coatings,
//     see coatFloor in level.js). Everything in it catches fire: players, bales, gourds still on their
//     patches burn away, and thrown gourds burn like in a bonfire (inAnyFire). A patch melts the icy floor
//     it lands on; frost puts it out (douse).
// Bonfires (level.js) set players and bales on fire too (CONFIG.fire.bonfireIgnites).
//
//   updateFire(game, dt)                  every step: burning players and bales, patches catching things
//   firePatch(game, x, y, radius, s)      the floor under (x, y) catches fire
//   douse(game, x, y, radius)             put out fire patches and burning bales within radius (frost)
//   igniteBale(bale), inAnyFire(game, p, pad)

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { breakBale, coatFloor, inFire, touchingBale } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { r3 } from '../util/math.js'

const PATCH_HEIGHT = 0.5   // m: how high above the floor a fire patch reaches (what's in it catches fire)

export function igniteBale(bale) {
  if (!(bale.burnTimer > 0)) bale.burnTimer = CONFIG.fire.baleBurn
}

// In a fire patch's flames: within one, up to PATCH_HEIGHT above it (pad: how far around p counts).
export const inPatch = (game, p, pad = 0) => game.fire.some(z => p.x >= z.x0 - pad && p.x <= z.x1 + pad && p.y >= z.y - pad && p.y <= z.y + PATCH_HEIGHT + pad)
// In any fire: a bonfire or a fire patch.
export const inAnyFire = (game, p, pad = 0) => inFire(game, p, pad) || inPatch(game, p, pad)

// The floor right under (x, y) (within `reach` m below) catches fire for `seconds`: the platform tops within
// `radius` of that spot. Any icy floor it lands on melts.
export function firePatch(game, x, y, radius, seconds, reach = 2.5) {
  const top = floorBelow(game, x, y, reach)
  if (top === null) return
  const before = game.fire.length
  coatFloor(game, 'fire', x, top + 0.01, radius, seconds)
  for (const f of game.fire.slice(before)) game.ice = game.ice.flatMap(z => cut(z, f))
}
// A zone with [f.x0, f.x1] taken out of it (if on the same floor): what's left of it, 0 to 2 zones.
const cut = (z, f) => (Math.abs(z.y - f.y) > 0.05 || z.x1 <= f.x0 || z.x0 >= f.x1 ? [z]
  : [z.x0 < f.x0 && { ...z, x1: f.x0 }, z.x1 > f.x1 && { ...z, id: z.id + 0.5, x0: f.x1 }].filter(Boolean))

// The top of the first platform (or anything solid) below (x, y), within reach m, or null.
function floorBelow(game, x, y, reach) {
  let top = null
  game.world.rayCast(new Vec2(x, y + 0.3), new Vec2(x, y - reach), (fixture, point) => {
    const ud = fixture.getBody().getUserData()
    if (ud && (ud.kind === 'player' || ud.kind === 'pumpkin')) return -1
    top = point.y
    return 0
  })
  return top
}

// Frost: fire patches reaching within `radius` of (x, y) go out, and so do burning bales there.
export function douse(game, x, y, radius) {
  game.fire = game.fire.filter(z => Math.hypot(Math.max(z.x0, Math.min(z.x1, x)) - x, z.y - y) > radius)
  for (const b of game.bales) if (Math.hypot(b.body.getPosition().x - x, b.body.getPosition().y - y) <= radius) b.burnTimer = 0
}

export function updateFire(game, dt) {
  const F = CONFIG.fire
  const burning = game.players.filter(pl => pl.onFire && !pl.dead)
  for (const pl of burning) {   // burning down, a little damage every tick
    pl.burnTimer -= dt
    pl.burnTick += dt
    while (pl.burnTick >= F.tick) {
      pl.burnTick -= F.tick
      const c = pl.torso.getPosition()
      pl.takeHit(game, F.dps * F.tick, 0, c)
      game.events.push({ type: 'burn', x: r3(c.x), y: r3(c.y - 0.5), small: true })
    }
  }
  for (const a of burning) {   // spreading to whoever they touch
    for (const b of game.players) if (b !== a && !b.dead && !b.onFire && touching(a, b, F.spreadReach)) b.ignite()
  }
  for (const pl of game.players) {   // standing in a fire patch
    if (!pl.dead && pl.parts.some(part => inPatch(game, part.body.getPosition(), 0.1))) pl.ignite()
  }
  for (const b of game.bales) {
    if (b.broken) continue
    if (!(b.burnTimer > 0) && inPatch(game, b.body.getPosition(), 0.45)) igniteBale(b)
    if (!(b.burnTimer > 0)) continue
    for (const pl of game.players) if (!pl.dead && touchingBale(game, pl, b)) pl.ignite()
    if ((b.burnTimer -= dt) <= 0) breakBale(game, b, 'burn')
  }
  for (const patch of game.patches) {   // gourds still on their patches burn away
    if (patch.state !== 'empty' && inPatch(game, patchPumpkin(patch))) splatPatch(game, patch)
  }
}

// Any part of a within `reach` m of any part of b (each part as its middle and its two ends).
function touching(a, b, reach) {
  const pts = pl => pl.parts.flatMap(part => [part.body.getWorldPoint(new Vec2(0, part.halfLen)), part.body.getPosition(), part.body.getWorldPoint(new Vec2(0, -part.halfLen))])
  const pa = pts(a), pb = pts(b)
  return pa.some(p => pb.some(q => Math.hypot(p.x - q.x, p.y - q.y) < reach))
}

