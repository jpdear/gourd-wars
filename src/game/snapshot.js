// SNAPSHOT — a plain-data picture of the game. The host sends these to the
// guest, and everyone draws from them, so both screens look the same.
// (Over the network they go in a compact form: see packSnapshot in net/protocol.js.)

import { CONFIG } from '../config.js'
import { patchRot } from './patches.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { trapOpen } from './traps.js'
import { mapDef } from '../maps/builtin.js'
import { lerp, r3, wrapAngle } from '../util/math.js'

export const PART_NAMES = ['torso', 'head', 'thighL', 'thighR', 'shinL', 'shinR', 'armL', 'armR', 'forearmL', 'forearmR']

export function makeSnapshot(game) {
  return {
    time: r3(game.time),
    map: game.map,
    players: game.players.map(p => ({
      slot: p.index,
      color: p.color,
      facing: p.facing,
      aim: [r3(p.aim.x), r3(p.aim.y)],           // where they're aiming (their eyes look there)
      stunned: p.stunned && !game.transition,   // (no X eyes while just being carried)
      dazed: p.dazed && !game.transition,       // (stars circling their head: limp or dizzy)
      dead: p.dead,
      ko: p.ko,
      health: Math.ceil(p.health),
      held: p.held && !p.dead ? p.held.typeName : null,
      heldRipeness: p.held ? r3(p.held.ripeness) : 0,
      heldCracks: p.held ? p.held.blocks || 0 : 0,
      ...(p.held?.fuseLeft !== undefined && !p.dead && { heldFuse: r3(p.held.fuseLeft) }),   // a fused gourd ticking in their hand: s left
      frozen: p.frozen,
      glued: p.glued,
      ...(p.glued && p.gooKind !== 'pie' && { goo: p.gooKind }),   // whose goo (no field: a Splat Pie's)
      ...(p.onFire && !p.dead && { burning: true }),   // on fire (see fire.js; only when they are)
      floating: p.floating,
      charge: p.charging ? r3(p.charge) : 0,
      lockedOn: game.pumpkins.some(pk => pk.target === p),   // a Homing gourd is coming for them
      grapple: p.grapple && !p.dead ? (({ x, y }) => [r3(x), r3(y)])(p.grapplePoint()) : null,   // where a Vine is reeling them in
      // what they're picking up (harvest: how far along, 0..1), or else could pick up from where they stand: [x, y, r]
      harvest: r3(p.harvestProgress),
      harvestAt: p.harvestTarget ? at(p.harvestTarget) : null,
      pickup: p.pickup && !p.harvestTarget && !p.dead ? at(p.pickup) : null,
      // [x, y, angle] for each part, in PART_NAMES order
      parts: p.parts.map(({ body }) => {
        const pos = body.getPosition()
        return [r3(pos.x), r3(pos.y), r3(wrapAngle(body.getAngle()))]
      }),
    })),
    // owner: the thrower's slot (-1: nobody); heading: the way a Homing gourd chasing someone is flying (else null);
    // fuse: s left on a fused gourd (a Bouncing Bomb; only on those)
    pumpkins: game.pumpkins.map(pk => {
      const pos = pk.body.getPosition()
      return {
        id: pk.id, x: r3(pos.x), y: r3(pos.y), angle: r3(wrapAngle(pk.body.getAngle())), typeName: pk.typeName, ripeness: r3(pk.ripeness),
        owner: pk.owner ? pk.owner.index : -1, radius: r3(pk.radius), heading: pk.target ? r3(pk.heading) : null,
        ...(pk.fuseLeft !== undefined && { fuse: r3(Math.max(0, pk.fuseLeft)) }),
      }
    }),
    // health: 0..1; frozen (icy), sticky (goo), floating (a Balloon carrying it off)
    bales: game.bales.map(b => {
      const pos = b.body.getPosition()
      return {
        id: b.id, x: r3(pos.x), y: r3(pos.y), angle: r3(wrapAngle(b.body.getAngle())), health: r3(Math.max(0, b.hp) / b.maxHp),
        frozen: b.frozenTimer > 0, sticky: b.stickyTimer > 0, floating: b.floatTimer > 0,
        ...(b.stickyTimer > 0 && b.gooKind !== 'pie' && { goo: b.gooKind }),   // whose goo (no field: a Splat Pie's)
        ...(b.burnTimer > 0 && { burn: r3(1 - b.burnTimer / CONFIG.fire.baleBurn) }),   // on fire: 0 → 1 as it burns down (only when it is)
      }
    }),
    // kind: its pumpkin type; open: 0 shut (or just landed) .. 1 set; bite: a Chomper biting someone (its x, y: on them) (see traps.js)
    traps: game.traps.map(t => ({ id: t.id, kind: t.kind, x: r3(t.x), y: r3(t.y), angle: r3(wrapAngle(t.angle)), open: r3(trapOpen(t)), bite: !!t.victim })),
    // Sticky Bombs stuck to something (see stickies.js): angle: which way is out from what it's on; fuse: s left;
    // onPlayer: on someone (squashed flat against them) rather than a surface; span: on a surface, how far its goo
    // can spread either side before the surface ends (see stickies.js) (only while there are some)
    ...(game.stickies.length && { stickies: game.stickies.map(s => ({ id: s.id, x: r3(s.x), y: r3(s.y), angle: r3(wrapAngle(s.angle)), fuse: r3(Math.max(0, s.timer)), onPlayer: s.onPlayer, ...(s.span && { span: s.span.map(r3) }) })) }),
    holes: game.holes.map(h => ({ id: h.id, x: r3(h.x), y: r3(h.y), r: r3(h.r) })),   // r: the core's radius
    // t: 0 → 1 when the airdrop is due; r: the airdrop's radius
    strikes: game.strikes.map(st => ({
      id: st.id, x: r3(st.x), y: r3(st.y), t: r3(Math.min(1, st.age / PUMPKIN_TYPES.airstrike.delay)), r: r3(PUMPKIN_TYPES.airdrop.radius * st.power),
    })),
    movers: game.movers.map(m => { const pos = m.body.getPosition(); return { x: r3(pos.x), y: r3(pos.y) } }),   // (in the map's order)
    cannons: game.cannons.map(c => r3(c.timer)),   // seconds until each fires (in the map's order)
    ...(game.cannons.some(c => c.frozenTimer > 0) && { frozenCannons: game.cannons.flatMap((c, i) => (c.frozenTimer > 0 ? [i] : [])) }),   // which are frozen (only while some are)
    // in the map's patch order (where each one is comes from the map: see patchView)
    // frozen: an Ice Bomb froze its pumpkin (only on those)
    patches: game.patches.map(p => ({ state: p.state, growth: r3(p.growth), rot: r3(patchRot(p)), typeName: p.typeName, superRare: p.superRare, ...(p.frozenTimer > 0 && { frozen: true }) })),
    // icy stretches of floor (an Ice Bomb's: see iceOver in level.js): x0..x1 along the top at y; t: s left (only while there are some)
    ...(game.ice.length && { ice: game.ice.map(z => ({ id: z.id, x0: r3(z.x0), x1: r3(z.x1), y: r3(z.y), t: r3(z.timer) })) }),
    ...(game.fire.length && { fire: game.fire.map(z => ({ id: z.id, x0: r3(z.x0), x1: r3(z.x1), y: r3(z.y), t: r3(z.timer) })) }),   // fire patches (a Fire Gourd's), the same
    ...(game.goo.length && { goo: game.goo.map(z => ({ id: z.id, x0: r3(z.x0), x1: r3(z.x1), y: r3(z.y), t: r3(z.timer) })) }),   // sticky stretches (a Sticky Bomb's), the same
    timeScale: game.timeScale,
    sights: game.sights,   // (the host's setting: show each player their own sight)
    transition: game.transition && { from: game.transition.from, t: r3(Math.min(1, game.transition.elapsed / game.transition.duration)) },
    match: game.match && {
      ...game.match.settings,
      decided: game.match.decided,
      round: game.match.round,
      scores: [...game.match.scores],
      phase: game.match.phase,
      timer: r3(game.match.timer),
      roundWinner: game.match.roundWinner,
      matchWinner: game.match.matchWinner,
    },
  }
}

const at = pickup => [r3(pickup.at.x), r3(pickup.at.y), r3(pickup.at.r)]

export const snapPlayer = (snap, slot) => snap.players.find(p => p.slot === slot)

// A patch from a snapshot, with where it is (from the map), in the same shape the patch helpers expect.
export function patchView(snap, i) {
  const def = mapDef(snap.map).patches[i]
  return { x: def.x, y: def.y, ...snap.patches[i] }
}

// Blend two snapshots: t = 0 gives a, t = 1 gives b.
export function interpolateSnapshots(a, b, t) {
  const lerpPart = (pa, pb) => [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), pa[2] + wrapAngle(pb[2] - pa[2]) * t]
  // things that come and go, matched up by id: blend(from a, from b) for the ones in both
  const byId = (listA, listB, blend) => listB.map(q => { const r = listA.find(x => x.id === q.id); return r ? blend(r, q) : q })
  const moved = (r, q) => ({ ...q, x: lerp(r.x, q.x, t), y: lerp(r.y, q.y, t), angle: r.angle + wrapAngle(q.angle - r.angle) * t })
  return {
    time: lerp(a.time, b.time, t),
    players: b.players.map(pb => {
      const pa = a.players.find(q => q.slot === pb.slot)   // (by slot: people come and go)
      // don't blend across a respawn (it would slide across the screen)
      if (!pa || pa.dead !== pb.dead || Math.hypot(pa.parts[0][0] - pb.parts[0][0], pa.parts[0][1] - pb.parts[0][1]) > 3) return pb
      return { ...pb, parts: pb.parts.map((q, k) => lerpPart(pa.parts[k], q)), aim: [lerp(pa.aim[0], pb.aim[0], t), lerp(pa.aim[1], pb.aim[1], t)] }
    }),
    pumpkins: byId(a.pumpkins, b.pumpkins, moved),
    bales: byId(a.bales, b.bales, moved),
    holes: byId(a.holes, b.holes, (r, q) => ({ ...q, r: lerp(r.r, q.r, t) })),
    traps: byId(a.traps, b.traps, moved),
    strikes: byId(a.strikes, b.strikes, (r, q) => ({ ...q, t: lerp(r.t, q.t, t) })),
    movers: b.movers.map((q, i) => (a.movers[i] && a.map === b.map ? { x: lerp(a.movers[i].x, q.x, t), y: lerp(a.movers[i].y, q.y, t) } : q)),
    cannons: b.cannons,
    ...(b.frozenCannons && { frozenCannons: b.frozenCannons }),
    map: b.map,
    timeScale: b.timeScale,
    sights: b.sights,
    transition: b.transition,
    patches: b.patches,
    ...(b.ice && { ice: b.ice }),
    ...(b.goo && { goo: b.goo }),
    ...(b.fire && { fire: b.fire }),
    ...(b.stickies && { stickies: byId(a.stickies || [], b.stickies, moved) }),
    match: b.match,
  }
}
