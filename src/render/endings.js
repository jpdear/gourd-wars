// ENDINGS — how glue and ice end on screen. Purely visual: worked out by comparing each snapshot with the
// last one drawn, so every screen shows the same thing and nothing in the game changes.
//   goo drains away   a player or hay bale coming unglued: its goo (the puddle, the drips, the cap) shrinks
//                     away over DRAIN s (the Sticky Bomb's sticky floor narrows away by itself: see drawGoo)
//   ice shatters      a player, hay bale, gourd on its patch or stretch of icy floor thawing: it bursts into
//                     ice shards there (a gourd cannon's own `thaw` event does the same: see effects.js)
//
//   trackEndings(snap, effects)   call once per frame, before drawing
//   gooLeft(key)                  how much of a draining goo is left (1 → 0), or null if none is draining;
//                                 key: 'p' + a player's slot, 'b' + a hay bale's id. { k, goo (whose) }

import { patchPumpkin } from '../game/patches.js'
import { patchView } from '../game/snapshot.js'
import { emit } from './effects.js'
import { clock } from './anims.js'
import { FX } from './palette.js'

export const DRAIN = 0.6   // s for goo to drain away

let last = null               // what was glued / frozen in the last snapshot drawn
const draining = new Map()    // key → { start (clock s), goo }

const ease = u => 1 - (1 - u) * (1 - u)
export function gooLeft(key) {
  const d = draining.get(key)
  if (!d) return null
  const u = (clock.now() - d.start) / DRAIN
  if (u >= 1) { draining.delete(key); return null }
  return { k: 1 - ease(Math.max(0, u)), goo: d.goo }
}

// Ice shards bursting from (x, y), n of them, `size` across (m).
const shatter = (effects, x, y, n, size = [0.04, 0.07]) =>
  emit(effects, { x, y, n, colors: FX.iceburst.shards, speed: [2, 5], life: [0.3, 0.5], size, shape: 'shard', lift: 1.5, gravity: 1, spin: 14 })

export function trackEndings(snap, effects) {
  if (!snap) { last = null; return }
  const now = clock.now()
  const seen = {
    map: snap.map, round: snap.match ? snap.match.round : 0,
    players: new Map(snap.players.map(p => [p.slot, { glued: p.glued, frozen: p.frozen, goo: p.goo || 'pie', at: p.parts[0] }])),   // (dead ones too)
    bales: new Map(snap.bales.map(b => [b.id, { sticky: b.sticky, frozen: b.frozen, goo: b.goo || 'pie', x: b.x, y: b.y }])),
    patches: snap.patches.map((p, i) => ({ frozen: !!p.frozen, i })),
    ice: new Map((snap.ice || []).map(z => [z.id, z])),
  }
  if (last && last.map === snap.map && last.round === seen.round && !snap.transition) {   // (not across a new round, a change of map or a pan to the next one)
    for (const [slot, now_] of seen.players) {
      const was = last.players.get(slot)
      if (!was) continue
      if (was.at && now_.at && Math.hypot(now_.at[0] - was.at[0], now_.at[1] - was.at[1]) > 3) continue   // (respawned)
      if (was.glued && !now_.glued) draining.set('p' + slot, { start: now, goo: was.goo })
      if (was.frozen && !now_.frozen && now_.at) {   // (along their body: torso, then above and below it)
        const [x, y] = now_.at
        for (const dy of [-0.45, 0, 0.45]) shatter(effects, x, y + dy, 6)
      }
    }
    for (const [id, b] of seen.bales) {
      const was = last.bales.get(id)
      if (!was) continue
      if (was.sticky && !b.sticky) draining.set('b' + id, { start: now, goo: was.goo })
      if (was.frozen && !b.frozen) shatter(effects, b.x, b.y, 14, [0.05, 0.08])
    }
    seen.patches.forEach((p, i) => {
      if (last.patches[i] && last.patches[i].frozen && !p.frozen) {
        const at = patchPumpkin(patchView(snap, i))
        shatter(effects, at.x, at.y, 8, [0.035, 0.06])
      }
    })
    for (const [id, z] of last.ice) {   // a stretch of icy floor gone: shards all along it
      if (seen.ice.has(id)) continue
      for (let x = z.x0 + 0.25; x < z.x1; x += 0.5) shatter(effects, x, z.y + 0.05, 3, [0.03, 0.05])
    }
  }
  last = seen
}
