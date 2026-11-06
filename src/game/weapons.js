// HELD WEAPONS — a melee weapon in someone's hands (their numbers and shape are in weaponTypes.js;
// lying loose, dropped or thrown, they're in looseWeapons.js).
//
// A HeldWeapon is all its player deals with. Each step, before the physics, it reads the attack and
// Throw Weapon buttons (update); after the physics, once its holder has moved, it's put where it goes
// and does what it does (place).
// It isn't a physics body: it's posed, always right in its holder's hands, so it never lags behind,
// never gets stuck in anyone, and never tugs its holder around. Held, it eases round to a new aim at its
// own pace, never with a jerk (heft.turn: a heavy one comes round slower; a big turn goes over the top, not down through
// your legs); in a swing it goes exactly where the swing takes it. Its holder knocked down, it stays
// clutched where it was, tumbling with them.
// It keeps out of the level by giving way (see giveWay.js: it tilts away, slides back along its handle,
// or passes through), so it never gets in its holder's way. People pass right through it, and so do
// flying pumpkins, bales and crows: only attacks touch anything.
// The arms are posed (and drawn) with the hands on its handle (see heldHands in weaponTypes.js).
// Only attacks hurt. During the part of a swing that can hit, whatever it passes (all of it, handle and
// all, for people, bales and crows; its edge for the rest):
//   players            hit, each at most once a swing (however close: right up against them still hits)
//   hay bales          damaged and shoved
//   a crow flying over knocked down (see crows.js)
//   the level          (platforms, walls, hazards, pegs) the blade clanks off it and the swing stops. Not
//                      if it was already giving way to it (coming down from a wind-up squashed against a
//                      low ceiling, say): then it carries on giving way, so the swing always comes out
//   flying pumpkins    cut (see cutPumpkin); or, by a tool that bats them, batted along your aim (now yours).
//                      Batting is forgiving: any of the tool bats (handle too), from a little further off
//                      (bats.reach), and for a moment after the swing's gone past (bats.grace: see late)
//   patch pumpkins     knocked off the vine (they splat, like a thrown pumpkin knocks them off)
//   Big Gourd shields  block it (a clank)
// A swing that touches anything costs its cost in uses (once a swing). The one that uses the last
// one snaps the weapon.
// The parts of a swing that can't hit (winding up, coming back) give way to the level like it does
// held. A ghost move (the Scythe's Whirl) passes through the level: it clanks on nothing.
// Charging a move with a guard (the Shovel's Home Run), it's held up in front as a shield (see shield).
// Throw Weapon: hold it to charge (the weapon pulled back), let go to throw it (see throwWeapon).
// A lopsided head (a scythe's blade) hangs down whichever way you face: turning round flips it over the
// handle (between swings).

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { knockDownCrow } from './crows.js'
import { NO_GIVE, giveWay, toolBlocked } from './giveWay.js'
import { baleAt, damageBale, shoveBale } from './level.js'
import { dropWeapon, throwWeapon } from './looseWeapons.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { applyHit, batPumpkin, cutPumpkin, launch } from './pumpkins.js'
import { WEAPON_TYPES, alongTool, headOf, heldHands, pointOf, toWorld } from './weaponTypes.js'
import { lerp, r3, wrapAngle } from '../util/math.js'

const SAMPLES = 3        // blade checks per step, from where it was to where it is (fast swings can't skip past anyone)
// Points along a tool's handle (in its frame), butt to head, this far apart (m): what bats and hits
// besides its head.
const SHAFT_STEP = 0.15
function shaftPoints(type) {
  const neck = headOf(type).neck, n = Math.ceil((neck + type.grip) / SHAFT_STEP)
  return Array.from({ length: n }, (_, i) => [-type.grip + (neck + type.grip) * i / n, 0])
}
const CARRY = 0.22       // held, it's carried this far below the shoulders (at the chest, not through the head)
const SHIFT = 0.35       // moving its grip (into a guard, winding up a throw): the share of the way it goes each step

// How each kind of swing moves the tool, u = 0 → 1 through it: { angle, extend (pushed out further
// than usual, m), live (the blade can hit things) }. The angle goes continuously on from where it
// started (it can wind round more than once: it goes there the way it goes, not the short way).
// swing.from: where it pointed when it started; swing.aim: the aim then (the way round nearest from);
// swing.f: which way they faced (1 right, -1 left). Over the top toward the way you face is clockwise
// facing right: -f.
const MOTIONS = {
  // a straight jab along the aim: out fast (the arms straightening), held a moment, back. It hits on
  // the way out and while held.
  thrust: (move, u, swing) => ({
    angle: swing.aim,
    extend: move.reach * (u < 0.35 ? 1 - (1 - u / 0.35) ** 2 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4),
    live: u < 0.6,
  }),
  // a quick snap from where it pointed to the aim (flinging someone off it). Hits nothing.
  snap: (move, u, swing) => ({ angle: swing.from + (swing.aim - swing.from) * (1 - (1 - u) ** 2), extend: 0, live: false }),
  // the same size of swing every time (`arc` degrees down to the aim, `follow` past it), so it always
  // takes as long to get there and goes as fast: where it starts depends on the aim. Raised up there
  // first (the windup, hitting nothing; never round through the floor), then brought down, picking up
  // speed. (Aiming ahead it's raised overhead; aiming up, back over your shoulder; aiming down, out in
  // front of you.)
  reap: (move, u, swing) => {
    const arc = move.arc * Math.PI / 180
    const top = swing.from + clearOfFloor(swing.from, swing.aim + swing.f * arc)
    if (u < move.windup) return { angle: swing.from + (top - swing.from) * smooth(u / move.windup), extend: 0, live: false }
    const v = (u - move.windup) / (1 - move.windup), down = Math.min(1, v / 0.8)
    return { angle: top - swing.f * (arc + move.follow) * down * (0.5 + 0.5 * down), extend: 0, live: v < 0.85 }
  },
  // all the way round you `turns` times, over the top toward the way you face (picking up speed, then
  // slowing at the end), and back to pointing where it started.
  whirl: (move, u, swing) => ({ angle: swing.from - swing.f * move.turns * 2 * Math.PI * smooth(u), extend: 0, live: u < 0.95 }),
}
const smooth = u => u * u * (3 - 2 * u)
// How far to turn from angle a to b (one way round or the other), not sweeping through straight down
// (the floor, your legs).
function clearOfFloor(a, b) {
  const d = wrapAngle(b - a), start = wrapAngle(a + Math.PI / 2)   // (from straight down)
  return (start < 0) !== (start + d < 0) ? d - Math.sign(d) * 2 * Math.PI : d
}
// Held, from angle `now` (turning at `spin` rad/s) toward `target`, for dt s: { angle, spin }. It eases
// round like a spring (rate: heft.turn, 1/s), picking up speed and settling in without overshooting, so
// it never starts or stops with a jerk (coming back from a swing, say). The short way, but a big turn goes
// round over the top (not down through your legs).
function turnToward(now, spin, target, rate, dt) {
  const short = wrapAngle(target - now), d = Math.abs(short) > Math.PI / 2 ? clearOfFloor(now, target) : short
  const x = -d, e = Math.exp(-rate * dt), j = (spin + rate * x) * dt   // (a critically damped spring, stepped exactly)
  return { angle: now + d + (x + j) * e, spin: (spin - rate * j) * e }
}
const FLING = { motion: 'snap', time: 0.18, cooldown: 0.3 }   // (the swing after flinging someone off the blade)

// Which way a hit knocks them (move.knock), given the way the blade's going at the hit (dir).
const KNOCK = {
  along: (holder, victim, dir) => dir,
  aim: (holder, victim, dir, swing) => ({ x: Math.cos(swing.aim), y: Math.sin(swing.aim) }),   // (where you were aiming)
  toward: (holder, victim) => unitFrom(victim.torso.getPosition(), holder.torso.getPosition()),   // (hooked in)
  away: (holder, victim) => unitFrom(holder.torso.getPosition(), victim.torso.getPosition()),
}
function unitFrom(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
  return { x: dx / d, y: dy / d }
}

export class HeldWeapon {
  constructor(typeName, uses) {
    this.typeName = typeName
    this.type = WEAPON_TYPES[typeName]
    this.uses = uses
    this.side = 1              // which side of the handle a lopsided head is on (see A WEAPON'S SHAPE)
    this.pose = null           // where it is: { at (the grip), angle } (see place)
    this.heading = 0           // the way it's pointing, before it gives way to the level
    this.spin = 0              // how fast that's turning (rad/s)
    this.shift = { out: 0, up: 0 }   // its grip moved from the chest (m forward, up; see want)
    this.give = { ...NO_GIVE } // how it's giving way to the level (see giveWay.js)
    this.giving = false        // it ran into the level last step (and is giving way to it)
    this.limp = null           // its holder knocked down: its angle to their torso, where they went down
    this.gone = false          // out of their hands (thrown, snapped, dropped)
    this.cooldown = 0
    // the swing going on: { move (the type's numbers for it), t (s in), aim, from, hit (what it has hit), wore (paid its cost), live }
    this.swing = null
    this.striking = false      // the swing's at a part that can hit
    this.charge = null         // holding the attack button: 0 → 1 (let go: the tap, or full: the charged move)
    this.aiming = null         // holding Throw Weapon: 0 → 1 (how hard it'll be thrown)
    this.grab = null           // someone caught on the blade (a charged move with grab): { victim, move, t, from }
    this.last = null           // the pose last step
    this.late = null           // a swing's just gone past, still batting pumpkins a moment: { swing, left (s) }
    const head = headOf(this.type)
    this.hitPoints = [...shaftPoints(this.type), ...head.edge, head.point]   // (what hits people: all of it, so right up against them still hits)
    this.batPoints = this.type.bats ? [...shaftPoints(this.type), ...head.edge] : null   // (what bats: all of it)
  }

  // Into someone's hands: held straight up (just pulled out of the ground), and it swings down to where
  // they aim.
  takeUp(player) {
    this.holder = player
    this.side = player.facing
    this.heading = Math.PI / 2
    this.pose = { at: alongTool(chestOf(player), this.heading, this.type.hold), angle: this.heading }
  }

  // Out of their hands (thrown, snapped, dropped...).
  release() {
    this.gone = true
  }

  // Effects on how you move while holding it (like a pumpkin's); slower carrying someone on it.
  get carry() {
    const c = this.type.carry
    return this.grab ? { ...c, speed: (c.speed ?? 1) * this.grab.move.grab.carrySpeed } : c
  }

  // Each step, before the physics step, even while you can't act (getting knocked down cuts a swing
  // short and lets go of whoever's on the blade): the buttons.
  update(game, player, input, dt) {
    this.cooldown = Math.max(0, this.cooldown - dt)
    const aim = aimAngle(player)
    const pressed = input.throw && !player.prev.throw
    if (player.helpless) {
      this.swing = this.charge = this.grab = this.aiming = this.late = null
      if (this.limp === null) this.limp = this.heading - player.torso.getAngle()
    } else {
      this.limp = null
      if (this.grab) this.holdOn(game, player, pressed, aim, dt)
      else if (this.aiming !== null || (input.toss && !player.prev.toss && !this.swing && this.type.throw)) {
        if (this.aimThrow(game, player, input.toss, aim, dt)) return   // (thrown: out of our hands)
      } else this.attack(game, player, input.throw, pressed, aim, dt)
    }
    if (player.facing !== this.side && headOf(this.type).lopsided && !this.swing && !this.grab) this.side = player.facing
    if (this.grab) this.carryVictim(player)
  }

  // Each step, after the physics step (its holder where they are now): it goes where it goes, and a
  // swing hits what it passes.
  place(game, player, dt) {
    if (this.gone) return
    const s = this.swing, want = this.want(game, player, aimAngle(player))
    const live = !!(s && s.live && want.live)
    const clank = this.reach(game, player, want, live, dt)
    this.striking = live
    if (live) {
      this.late = this.type.bats ? { swing: s, left: this.type.bats.grace ?? 0 } : null
      this.strike(game, player, clank)
    } else if (this.late) this.batLate(game, player, dt)
    if (this.gone) return   // (that snapped it)
    this.last = this.pose
    if (s && this.swing === s && (s.t += dt) >= s.move.time) this.endSwing()
  }

  // Put it where `want` says, giving way to the level (see giveWay.js). A swing's hitting part running
  // into the level (that it wasn't already giving way to) doesn't give way: returns where it hit
  // ({ x, y, normal }: it clanks), or null.
  reach(game, player, want, live, dt) {
    const type = this.type, k = perStep(CONFIG.weapon.give.ease, dt), shift = perStep(SHIFT, dt)
    this.shift.out += ((want.out ?? 0) - this.shift.out) * shift
    this.shift.up += ((want.up ?? 0) - this.shift.up) * shift
    const chest = want.limp ? limpChestOf(player) : chestOf(player)
    const from = { x: chest.x + player.facing * this.shift.out, y: chest.y + this.shift.up }
    if (this.swing || want.limp) {   // (exactly where it says: going on from there at the speed it's going)
      this.spin = (want.angle - this.heading) / dt
      this.heading = want.angle
    } else ({ angle: this.heading, spin: this.spin } = turnToward(this.heading, this.spin, want.angle, type.heft.turn, dt))
    const along = type.hold + want.extend
    const hit = this.swing && this.swing.move.ghost ? null : toolBlocked(game, type, this.side, from, this.heading, along)
    const clank = hit && live && !this.giving ? hit : null
    this.giving = !!hit && !clank
    if (clank) this.give = { ...NO_GIVE }
    else {
      const target = hit ? giveWay(game, type, this.side, from, this.heading, along, hit, this.give) : NO_GIVE
      this.give = { tilt: lerp(this.give.tilt, target.tilt, k), back: lerp(this.give.back, target.back, k), through: target.through }
    }
    const angle = this.heading + this.give.tilt
    this.pose = { at: alongTool(from, angle, along - this.give.back), angle }
    return clank
  }

  // The swing's over: the wait before the next one starts.
  endSwing() {
    this.cooldown = this.swing.move.cooldown
    this.swing = null
  }

  // A press starts charging. Let go fully charged: the charged move; any sooner (a click): the tap.
  // (A weapon with no charged move taps right on the press.)
  attack(game, player, held, pressed, aim, dt) {
    const special = this.type.charge
    if (pressed && !this.swing && this.cooldown <= 0) {
      if (!special) return this.start(game, player, this.type.tap, aim)
      this.charge = 0
    }
    if (this.charge === null) return
    if (held) { this.charge = Math.min(1, this.charge + dt / special.chargeTime); return }
    this.start(game, player, this.charge >= 1 ? special : this.type.tap, aim)
    this.charge = null
  }

  // Throw Weapon held: it charges (0 → 1). Let go: thrown along the aim from where it is, point first,
  // as hard as it's charged. Returns true if it's been thrown.
  aimThrow(game, player, held, aim, dt) {
    const T = this.type.throw
    if (this.aiming === null) { this.aiming = 0; this.charge = null }
    if (held) { this.aiming = Math.min(1, this.aiming + dt / T.chargeTime); return false }
    const speed = lerp(T.speed[0], T.speed[1], this.aiming), v = player.torso.getLinearVelocity()
    const vel = { x: Math.cos(aim) * speed + v.x * 0.5, y: Math.sin(aim) * speed + v.y * 0.5 }
    const power = 0.4 + 0.6 * this.aiming   // (a tap still hits, just softer)
    const at = this.pose.at
    player.dropHeld()   // (out of our hands; a thrown one takes its place)
    throwWeapon(game, player, this.typeName, this.uses, at, vel, power, this.side)
    return true
  }

  start(game, player, move, aim) {
    this.beginSwing(player, move, aim)
    if (move.lunge) player.lunge(game, Math.cos(aim) * move.lunge.speed, move.lunge.time)   // (sideways: no flying by thrusting up)
  }

  // A swing starts from where it is now (tilted away from the level and all: so that tilt's in it now).
  beginSwing(player, move, aim, extra = {}) {
    const from = this.pose.angle
    this.swing = { move, t: 0, aim: from + wrapAngle(aim - from), f: player.facing, from, hit: new Set(), wore: false, live: true, ...extra }
    this.heading = from
    this.spin = 0
    this.give.tilt = 0
    this.giving = false   // (what it was resting on held, it can clank off now: a thrust into the floor)
    this.last = null   // (the blade sweeps from where the swing starts, not from wherever it was pointing)
    this.late = null
  }

  // Where it should be this step: in a swing, hoisting someone, held back charging (shaking a little
  // once it's full), wound up to throw, clutched by its knocked-down holder, or just pointing at the
  // aim: { angle, extend (pushed out along it, m), out, up (the grip moved this far from the chest:
  // forward, up; m), live, limp }.
  want(game, player, aim) {
    const s = this.swing
    if (s) return MOTIONS[s.move.motion](s.move, s.t / s.move.time, s)
    if (this.limp !== null) return { angle: player.torso.getAngle() + this.limp, extend: 0, live: false, limp: true }
    if (this.grab) {   // up overhead (tilted a little forward), with them on it
      const up = Math.PI / 2 - player.facing * 0.3, u = Math.min(1, this.grab.t / 0.2)
      return { angle: this.grab.from + wrapAngle(up - this.grab.from) * (1 - (1 - u) ** 2), extend: 0, live: false }
    }
    if (this.charge !== null) {
      const shake = this.charge >= 1 ? Math.sin(game.time * 70) * 0.03 : 0
      const guard = this.type.charge.guard
      if (guard) return { angle: facingAngle(player.facing, guard.angle) + shake, extend: 0, out: guard.out, up: guard.up, live: false }   // (held up in front)
      return { angle: aim + shake, extend: -0.25 * this.charge, live: false }
    }
    if (this.aiming !== null) return THROW_POSES[this.type.throw.spin ? 'spinning' : 'point'](aim, this.aiming, player.facing)
    return { angle: aim, extend: 0, live: false }
  }

  // The blade caught someone: they're stuck on it, helpless, until we fling them off.
  catch(victim, move) {
    this.grab = { victim, move, t: 0, from: this.pose.angle }
    this.swing = null
    victim.stun(move.grab.time + 0.5)
  }

  // Someone on the blade: a click (or running out of time) flings them off it toward the aim.
  holdOn(game, player, pressed, aim, dt) {
    const g = this.grab
    if (g.victim.out || g.victim.removed) { this.grab = null; return }
    if (!pressed && (g.t += dt) < g.move.grab.time) return
    const F = g.move.grab.fling, victim = g.victim, pos = victim.torso.getPosition()
    this.grab = null
    victim.takeHit(game, F.damage, F.stun, pos)
    victim.stun(F.stun)
    launch(victim, victim.torso, Math.cos(aim), Math.sin(aim), F.speed)
    game.events.push({ type: 'hit', x: r3(pos.x), y: r3(pos.y) })
    this.beginSwing(player, FLING, aim, { wore: true, live: false })
  }

  // Whoever's on the blade goes where its tip goes (their middle on the tines).
  carryVictim(player) {
    const { at, angle } = this.pose, tip = pointOf(this.type, at, angle, this.side), body = this.grab.victim.torso.getPosition()
    const v = player.torso.getLinearVelocity()
    this.grab.victim.setVelocity(v.x + (tip.x - body.x) * 15, v.y + (tip.y + 0.2 - body.y) * 15)
  }

  // Where the hands go on its handle (the arms are posed to reach them: see heldHands).
  hands() {
    return heldHands(this.type, this.pose.at, this.pose.angle, this.holder.shoulder())
  }

  // Lying loose again where it is (its holder was knocked out), with the uses it has left.
  drop(game) {
    const p = this.pose.at
    dropWeapon(game, this.typeName, p.x, p.y, this.uses, this.side)
  }

  // For snapshots: [type, grip x, grip y, angle, throw charge (0..1, or -1: not about to throw), side]
  view() {
    const { at, angle } = this.pose
    return [this.typeName, r3(at.x), r3(at.y), r3(wrapAngle(angle)), this.aiming === null ? -1 : r3(this.aiming), this.side]
  }

  // An attack: what did it pass, from where it was last step to where it is? Shields and pumpkins
  // first, then people, bales and crows; then the level, if it ran into it (`clank`: see reach).
  strike(game, player, clank) {
    const now = this.pose, before = this.last || now
    if (this.sweep(game, player, before, now)) return
    if (this.hitBodies(game, player, before, now)) return
    if (clank) this.clank(game, player, clank, { x: -clank.normal.x, y: -clank.normal.y })
  }

  // Along the blade from pose a to pose b, in small steps, against shields and pumpkins (flying or on
  // their patch). Returns true if that ended the swing.
  sweep(game, player, a, b) {
    for (const { p, dir } of this.sweepPoints(a, b, headOf(this.type).edge)) if (this.pass(game, player, p, dir)) return true
    return !!this.batPoints && this.bat(game, player, a, b, this.swing)
  }

  // What hits (see hitPoints), from pose a to pose b, against people, bales and crows. Returns true if
  // that ended the swing.
  hitBodies(game, player, a, b) {
    const s = this.swing, R = this.type.bladeRadius
    for (const { p, dir } of this.sweepPoints(a, b, this.hitPoints)) {
      for (const other of game.players) {
        if (other === player || other.dead || s.hit.has(other)) continue
        const part = other.partAt(p, R)
        if (part && this.hitPlayer(game, player, other, part, p, dir)) return true
      }
      const bale = baleAt(game, p, R)
      if (bale && this.hitBale(game, player, bale, p, dir)) return true
      for (const crow of game.crows) {
        if (crow.state !== 'flying') continue
        const c = crow.body.getPosition()
        if (Math.hypot(c.x - p.x, c.y - p.y) > CONFIG.crow.radius + R) continue
        knockDownCrow(game, crow)
        if (this.wear(game, player, p)) return true
      }
    }
    return false
  }

  // Points of it (local: in its own frame) from pose a to pose b, SAMPLES steps a point: { p, dir (the
  // way it's moving there) }.
  *sweepPoints(a, b, locals) {
    const at = (f, local) => toWorld(
      { x: lerp(a.at.x, b.at.x, f), y: lerp(a.at.y, b.at.y, f) },
      a.angle + wrapAngle(b.angle - a.angle) * f,
      this.side, local,
    )
    for (let i = 1; i <= SAMPLES; i++) {
      for (const local of locals) {
        const p = at(i / SAMPLES, local), q = at((i - 1) / SAMPLES, local)
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        yield { p, dir: d > 0.02 ? { x: (p.x - q.x) / d, y: (p.y - q.y) / d } : { x: Math.cos(b.angle), y: Math.sin(b.angle) } }
      }
    }
  }

  // The blade passing point p, moving along dir: a shield there blocks it; a flying pumpkin there is
  // cut (a tool that bats them: see bat); one growing on its patch is knocked off.
  pass(game, player, p, dir) {
    const s = this.swing, R = this.type.bladeRadius
    for (const other of game.players) {
      if (other === player || other.dead || s.hit.has(other)) continue
      if (other.tryBlock(game, p, R, dir)) { s.hit.add(other); return this.clank(game, player, p, dir) }
    }
    for (const pk of this.type.bats ? [] : game.pumpkins) {
      if (pk.broken || pk.type.uncuttable || s.hit.has(pk)) continue
      const c = pk.body.getPosition()
      if (Math.hypot(c.x - p.x, c.y - p.y) > pk.radius + R) continue
      s.hit.add(pk)
      cutPumpkin(game, pk)
      if (this.wear(game, player, p)) return true
    }
    for (const patch of game.patches) {
      if (patch.state === 'empty') continue
      const pk = patchPumpkin(patch)
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > pk.r + R) continue
      splatPatch(game, patch)
      if (this.wear(game, player, p)) return true
    }
    return false
  }

  // Swing s's tool (any of it) going from pose a to pose b bats any flying pumpkin it passes near
  // (within bats.reach of its edge) along your aim. Returns true if that snapped it.
  bat(game, player, a, b, s) {
    const B = this.type.bats, R = this.type.bladeRadius + (B.reach ?? 0)
    for (const { p } of this.sweepPoints(a, b, this.batPoints)) {
      for (const pk of game.pumpkins) {
        if (pk.broken || pk.type.uncuttable || s.hit.has(pk)) continue
        const c = pk.body.getPosition()
        if (Math.hypot(c.x - p.x, c.y - p.y) > pk.radius + R) continue
        s.hit.add(pk)
        batPumpkin(game, pk, player, aimFrom(player), B.speed)
        if (this.wear(game, player, p, s)) return true
      }
    }
    return false
  }

  // Just after a swing's gone past (it can't hit anything else now), it still bats pumpkins, for
  // bats.grace s: a swing a moment too soon still connects.
  batLate(game, player, dt) {
    const L = this.late
    if ((L.left -= dt) < 0) { this.late = null; return }
    this.bat(game, player, this.last || this.pose, this.pose, L.swing)
  }

  hitPlayer(game, player, other, part, p, dir) {
    const s = this.swing, move = s.move
    if (other === player || other.dead || s.hit.has(other)) return false
    s.hit.add(other)
    game.events.push({ type: 'hit', x: r3(p.x), y: r3(p.y) })
    if (move.grab) {   // caught on the blade (the first one it reaches)
      other.takeHit(game, move.damage, 0, part.getPosition())
      if (!this.wear(game, player, p)) this.catch(other, move)
      return true
    }
    const knock = KNOCK[move.knock || 'along'](player, other, dir, s)
    if (move.fullLaunch) {
      other.takeHit(game, move.damage, move.stun, part.getPosition())
      launch(other, part, knock.x, knock.y, move.knockback)
    } else applyHit(game, other, part, knock.x, knock.y, move.knockback, move.damage, move.stun)
    return this.wear(game, player, p)
  }

  hitBale(game, player, bale, p, dir) {
    const s = this.swing, move = s.move
    if (s.hit.has(bale)) return false
    s.hit.add(bale)
    damageBale(game, bale, move.damage * CONFIG.weapon.baleMultiplier)
    shoveBale(bale, dir, move.knockback)
    game.events.push({ type: 'hit', x: r3(p.x), y: r3(p.y) })
    return this.wear(game, player, p)
  }

  // The blade bounced off something hard (at p, going along dir): sparks, a little push back, and the
  // swing's over.
  clank(game, player, p, dir) {
    game.events.push({ type: 'clank', x: r3(p.x), y: r3(p.y) })
    launch(player, player.torso, -dir.x, -dir.y, CONFIG.weapon.clankPush)
    this.wear(game, player, p)
    if (this.swing) this.endSwing()
    this.late = null
    return true
  }

  // Swing s touched something: it costs its move's cost in uses (once a swing). Returns true if
  // that snapped it.
  wear(game, player, p, s = this.swing) {
    if (s.wore) return false
    s.wore = true
    if (!this.spend(game, player, p, s.move.cost ?? 1)) return false
    s.live = false
    return true
  }

  // `cost` uses gone (at p). Returns true if that was the last: it snaps, out of their hands.
  spend(game, player, p, cost) {
    if ((this.uses -= cost) > 0) return false
    game.events.push({ type: 'weaponBreak', x: r3(p.x), y: r3(p.y), typeName: this.typeName })
    player.dropHeld()
    return true
  }

  // Held up as a shield (charging a move with a guard: see Player.shield): { x, y, r (round its head),
  // take (it blocked something: a use) }, or null.
  shield(player) {
    const guard = this.charge !== null && this.type.charge.guard
    if (!guard) return null
    const { at, angle } = this.pose, c = toWorld(at, angle, this.side, headOf(this.type).edge[1])   // (the middle of its head)
    return { x: c.x, y: c.y, r: guard.r, take: game => this.spend(game, player, c, 1) }
  }
}

// How it's held winding up a throw (u: how charged, 0..1), by how it'll fly (see FLIGHT in looseWeapons.js):
const THROW_POSES = {
  point: (aim, u) => ({ angle: aim, extend: -0.35 * u, live: false }),   // drawn back along the aim, a javelin
  spinning: (aim, u, f) => ({ angle: facingAngle(f, 1.9 + 0.5 * u), extend: 0, out: -0.1, up: 0.3, live: false }),   // raised back over the shoulder, like an axe
}

// Pointing `angle` up from the way someone facing f faces.
const facingAngle = (f, angle) => f > 0 ? angle : Math.PI - angle

// Where it's carried from: the chest (just below the shoulders); knocked down, in the torso's frame (it
// tumbles with them).
const chestOf = player => { const sh = player.shoulder(); return { x: sh.x, y: sh.y - CARRY } }
const limpChestOf = player => player.torso.getWorldPoint(new Vec2(0, player.shoulderLocalY - CARRY))
// Which way they're aiming, from the chest: an angle, and a unit vector.
function aimAngle(player) {
  const c = chestOf(player)
  return Math.atan2(player.aim.y - c.y, player.aim.x - c.x)
}
function aimFrom(player) {
  const a = aimAngle(player)
  return { x: Math.cos(a), y: Math.sin(a) }
}

// A share of the way to close each step (per normal step), for a step of dt: the same in game time
// however long the steps are (slow motion's are short).
function perStep(share, dt) {
  const k = dt / CONFIG.dt
  return k === 1 ? share : 1 - (1 - share) ** k
}
