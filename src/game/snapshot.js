// SNAPSHOT — a plain-data picture of the game. The host sends these to the
// guest, and everyone draws from them, so both screens look the same.
// (Over the network they go in a compact form: see packSnapshot in net/protocol.js.)

import { patchRot } from './patches.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
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
      stunned: p.stunned && !game.transition,   // (no X eyes while just being carried)
      dead: p.dead,
      ko: p.ko,
      health: Math.ceil(p.health),
      held: p.held && !p.dead ? p.held.typeName : null,
      weapon: p.weapon && !p.dead ? p.weapon.view() : null,   // [type, grip x, grip y, angle] (see HeldWeapon.view)
      heldRipeness: p.held ? r3(p.held.ripeness) : 0,
      heldCracks: p.held ? p.held.blocks || 0 : 0,
      frozen: p.frozen,
      glued: p.glued,
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
    // owner: the thrower's slot (-1: nobody); heading: the way a Homing gourd chasing someone is flying (else null)
    pumpkins: game.pumpkins.map(pk => {
      const pos = pk.body.getPosition()
      return {
        id: pk.id, x: r3(pos.x), y: r3(pos.y), angle: r3(wrapAngle(pk.body.getAngle())), typeName: pk.typeName, ripeness: r3(pk.ripeness),
        owner: pk.owner ? pk.owner.index : -1, radius: r3(pk.radius), heading: pk.target ? r3(pk.heading) : null,
      }
    }),
    // health: 0..1; frozen (icy), sticky (goo), floating (a Balloon carrying it off)
    bales: game.bales.map(b => {
      const pos = b.body.getPosition()
      return {
        id: b.id, x: r3(pos.x), y: r3(pos.y), angle: r3(wrapAngle(b.body.getAngle())), health: r3(Math.max(0, b.hp) / b.maxHp),
        frozen: b.frozenTimer > 0, sticky: b.stickyTimer > 0, floating: b.floatTimer > 0,
      }
    }),
    holes: game.holes.map(h => ({ id: h.id, x: r3(h.x), y: r3(h.y), r: r3(h.r) })),   // r: the core's radius
    weapons: game.looseWeapons.map(w => ({ id: w.id, typeName: w.typeName, x: r3(w.x), y: r3(w.y), angle: r3(wrapAngle(w.angle)) })),   // (x, y: the grip)
    // t: 0 → 1 when the airdrop is due; r: the airdrop's radius
    strikes: game.strikes.map(st => ({
      id: st.id, x: r3(st.x), y: r3(st.y), t: r3(Math.min(1, st.age / PUMPKIN_TYPES.airstrike.delay)), r: r3(PUMPKIN_TYPES.airdrop.radius * st.power),
    })),
    scythes: game.scythes.map(sc => r3(wrapAngle(sc.body.getAngle()))),   // their angles, in the map's order
    movers: game.movers.map(m => { const pos = m.body.getPosition(); return { x: r3(pos.x), y: r3(pos.y) } }),   // (in the map's order)
    // in the map's patch order (where each one is comes from the map: see patchView)
    patches: game.patches.map(p => ({ state: p.state, growth: r3(p.growth), rot: r3(patchRot(p)), typeName: p.typeName, superRare: p.superRare })),
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
      const wa = pa.weapon, wb = pb.weapon
      const weapon = wa && wb && wa[0] === wb[0] ? [wb[0], lerp(wa[1], wb[1], t), lerp(wa[2], wb[2], t), wa[3] + wrapAngle(wb[3] - wa[3]) * t] : wb
      return { ...pb, parts: pb.parts.map((q, k) => lerpPart(pa.parts[k], q)), weapon }
    }),
    pumpkins: byId(a.pumpkins, b.pumpkins, moved),
    bales: byId(a.bales, b.bales, moved),
    holes: byId(a.holes, b.holes, (r, q) => ({ ...q, r: lerp(r.r, q.r, t) })),
    weapons: byId(a.weapons, b.weapons, moved),
    strikes: byId(a.strikes, b.strikes, (r, q) => ({ ...q, t: lerp(r.t, q.t, t) })),
    scythes: b.scythes.map((angle, i) => (a.scythes[i] === undefined ? angle : a.scythes[i] + wrapAngle(angle - a.scythes[i]) * t)),
    movers: b.movers.map((q, i) => (a.movers[i] && a.map === b.map ? { x: lerp(a.movers[i].x, q.x, t), y: lerp(a.movers[i].y, q.y, t) } : q)),
    map: b.map,
    timeScale: b.timeScale,
    sights: b.sights,
    transition: b.transition,
    patches: b.patches,
    match: b.match,
  }
}
