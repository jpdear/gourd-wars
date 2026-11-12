// PICKUPS — what you can pick up with the harvest key (with empty hands): a pumpkin from its patch,
// or a fused gourd ticking away loose (caught in the air or grabbed off the floor).
// Hold the key next to one for its `time` and it's in your hands.
//
// Each source lists what could be picked up right now, as pickups:
//   key       what it is (switching to a different one starts the pull over)
//   x, y      where it sits on the ground: you need to be standing about there (see findPickup)
//   at        { x, y, r }: the thing itself (the hands reach for it; the progress ring and your key's bubble go around it)
//   time      how long to hold the key (s)
//   above     how far above your hips it can be (m; default 0: it has to be down at your feet)
//   take(player)   into their hands

import { Vec2 } from 'planck'
import { BODY, CONFIG } from '../config.js'
import { patchPickups } from './patches.js'
import { fusePickups } from './pumpkins.js'

const SOURCES = [patchPickups, fusePickups]

// The pickup this player is standing at (the closest one, sideways), or null.
export function findPickup(game, player) {
  const pelvis = player.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2))
  let best = null, bestDx = CONFIG.pickup.reach
  for (const source of SOURCES) {
    for (const pk of source(game)) {
      const dx = Math.abs(pelvis.x - pk.x), dy = pelvis.y - pk.y
      if (dx < bestDx && dy > -(pk.above ?? 0) && dy < CONFIG.pickup.height && player.canPick(pk)) { best = pk; bestDx = dx }
    }
  }
  return best
}
