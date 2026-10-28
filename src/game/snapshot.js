// SNAPSHOT — a plain-data picture of the game. The host sends these to the
// guest, and everyone draws from them, so both screens look the same.

import { PATCH_STATES, patchRot } from './patches.js'
import { PUMPKIN_TYPE_NAMES } from './pumpkinTypes.js'
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
      heldRipeness: p.held ? r3(p.held.ripeness) : 0,
      heldCracks: p.held ? p.held.blocks || 0 : 0,
      frozen: p.frozenTimer > 0,
      glued: p.gluedTimer > 0,
      floating: p.floatTimer > 0,
      charge: p.charging ? r3(p.charge) : 0,
      grapple: p.grapple && !p.dead ? (({ x, y }) => [r3(x), r3(y)])(p.grapplePoint()) : null,   // where a Vine is reeling them in
      harvest: r3(p.harvestProgress),
      harvestPatch: p.harvestTarget ? game.patches.indexOf(p.harvestTarget) : -1,
      // [x, y, angle] for each part, in PART_NAMES order
      parts: p.parts.map(({ body }) => {
        const pos = body.getPosition()
        return [r3(pos.x), r3(pos.y), r3(wrapAngle(body.getAngle()))]
      }),
    })),
    pumpkins: game.pumpkins.map(pk => {
      const pos = pk.body.getPosition()
      return [pk.id, r3(pos.x), r3(pos.y), r3(wrapAngle(pk.body.getAngle())), pk.typeName, r3(pk.ripeness), pk.owner ? pk.owner.index : -1]
    }),
    // [id, x, y, angle, health 0..1, flags: 1 frozen, 2 sticky, 4 floating]
    bales: game.bales.map(b => {
      const pos = b.body.getPosition()
      const flags = (b.frozenTimer > 0 ? 1 : 0) | (b.stickyTimer > 0 ? 2 : 0) | (b.floatTimer > 0 ? 4 : 0)
      return [b.id, r3(pos.x), r3(pos.y), r3(wrapAngle(b.body.getAngle())), r3(Math.max(0, b.hp) / b.maxHp), flags]
    }),
    holes: game.holes.map(h => [h.id, r3(h.x), r3(h.y), r3(h.r)]),   // [id, x, y, core radius]
    scythes: game.scythes.map(sc => r3(wrapAngle(sc.body.getAngle()))),
    movers: game.movers.map(m => { const pos = m.body.getPosition(); return [r3(pos.x), r3(pos.y)] }),
    // [stateCode, growth, rot, typeCode, superRare 0/1] per patch, in the map's patch order
    patches: game.patches.map(p => [PATCH_STATES.indexOf(p.state), r3(p.growth), r3(patchRot(p)), PUMPKIN_TYPE_NAMES.indexOf(p.typeName), p.superRare ? 1 : 0]),
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

export const snapPlayer = (snap, slot) => snap.players.find(p => p.slot === slot)

// A patch from a snapshot, in the same shape the patch helpers expect.
export function patchView(snap, i) {
  const [code, growth, rot, type, superRare] = snap.patches[i]
  const def = mapDef(snap.map).patches[i]
  return { x: def.x, y: def.y, state: PATCH_STATES[code], growth, rot, typeName: PUMPKIN_TYPE_NAMES[type], superRare: !!superRare }
}

// Blend two snapshots: t = 0 gives a, t = 1 gives b.
export function interpolateSnapshots(a, b, t) {
  const lerpPart = (pa, pb) => [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), pa[2] + wrapAngle(pb[2] - pa[2]) * t]
  return {
    time: lerp(a.time, b.time, t),
    players: b.players.map(pb => {
      const pa = a.players.find(q => q.slot === pb.slot)   // (by slot: people come and go)
      // don't blend across a respawn (it would slide across the screen)
      if (!pa || pa.dead !== pb.dead || Math.hypot(pa.parts[0][0] - pb.parts[0][0], pa.parts[0][1] - pb.parts[0][1]) > 3) return pb
      return { ...pb, parts: pb.parts.map((q, k) => lerpPart(pa.parts[k], q)) }
    }),
    pumpkins: b.pumpkins.map(q => {
      const r = a.pumpkins.find(x => x[0] === q[0])
      return r ? [q[0], ...lerpPart(r.slice(1, 4), q.slice(1, 4)), q[4], q[5], q[6]] : q
    }),
    bales: b.bales.map(q => {
      const r = a.bales.find(x => x[0] === q[0])
      return r ? [q[0], ...lerpPart(r.slice(1, 4), q.slice(1, 4)), q[4], q[5]] : q
    }),
    holes: b.holes.map(q => { const r = a.holes.find(x => x[0] === q[0]); return r ? [q[0], q[1], q[2], lerp(r[3], q[3], t)] : q }),
    scythes: b.scythes.map((angle, i) => (a.scythes[i] === undefined ? angle : a.scythes[i] + wrapAngle(angle - a.scythes[i]) * t)),
    movers: b.movers.map((q, i) => (a.movers[i] && a.map === b.map ? [lerp(a.movers[i][0], q[0], t), lerp(a.movers[i][1], q[1], t)] : q)),
    map: b.map,
    timeScale: b.timeScale,
    sights: b.sights,
    transition: b.transition,
    patches: b.patches,
    match: b.match,
  }
}
