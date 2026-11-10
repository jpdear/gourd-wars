// Drawing what you could pick up with the harvest key (see game/pickups.js): a ring filling up around
// whatever someone is pulling on, and your harvest key's name in a bubble over what you could pick
// up from where you stand. (Where they are comes in the snapshot: [x, y, r] of the thing.)
// Colors: ink on light maps and paper on dark ones, like the HUD's chips (st: see hudSurface in hud.js).

import { snapPlayer } from '../game/snapshot.js'
import { onLedge } from './hud.js'
import { font } from './palette.js'

export function drawPickupHints(ctx, snap, localIndex, harvestKey, st, X, Y, s) {
  ctx.strokeStyle = st.face
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
  onLedge(ctx, bx, by, 2 * (br + half), 2 * br, br, 0.05 * s, st)
  ctx.fillStyle = st.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(harvestKey, bx, by + 0.01 * s)
  ctx.textBaseline = 'alphabetic'
}
