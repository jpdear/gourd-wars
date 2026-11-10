// Drawing what you could pick up with the harvest key (see game/pickups.js): a ring filling up around
// whatever someone is pulling on, and your harvest key's name in a bubble over what you could pick
// up from where you stand. (Where they are comes in the snapshot: [x, y, r] of the thing.)
// Colors: PICKUP (palette.js).

import { snapPlayer } from '../game/snapshot.js'
import { PICKUP, font } from './palette.js'

export function drawPickupHints(ctx, snap, localIndex, harvestKey, X, Y, s) {
  ctx.strokeStyle = PICKUP.ring
  ctx.lineWidth = 0.06 * s
  for (const p of snap.players) {
    if (p.dead || !p.harvestAt || p.harvest <= 0) continue
    const [x, y, r] = p.harvestAt
    ctx.beginPath()
    ctx.arc(X(x), Y(y), (r + 0.15) * s, -Math.PI / 2, -Math.PI / 2 + p.harvest * Math.PI * 2)
    ctx.stroke()
  }

  // (round for one letter, stretched to fit a longer name)
  const me = snapPlayer(snap, localIndex)   // (none in the map editor, or before you've jumped in)
  if (!me || me.dead || !me.pickup) return
  const [x, y, r] = me.pickup
  const bx = X(x), by = Y(y + r + 0.45), br = 0.24 * s
  ctx.font = font('display', (harvestKey.length > 1 ? 0.24 : 0.3) * s)
  const half = Math.max(0, ctx.measureText(harvestKey).width / 2 - br * 0.6)
  ctx.fillStyle = PICKUP.bubble
  ctx.beginPath()
  ctx.arc(bx - half, by, br, Math.PI / 2, Math.PI * 3 / 2)
  ctx.arc(bx + half, by, br, -Math.PI / 2, Math.PI / 2)
  ctx.fill()
  ctx.fillStyle = PICKUP.key
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(harvestKey, bx, by + 0.01 * s)
  ctx.textBaseline = 'alphabetic'
}
