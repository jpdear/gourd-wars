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
// A pair (the Sickles) is two blades, one in each hand, held down by your sides: they take turns (each
// tap, each slash of a flurry, each throw), and each has its own uses (one snapping, or thrown, leaves
// you the other; holding one, you can pick up the other).
// Clicks: a press starts charging; let go sooner it's the tap (see attack). A tap can be part of a run
// (tap.combo: the Sickle's every-3rd uppercut), and a click a moment too soon can be kept (tap.buffer).
// Only attacks hurt. During the part of a swing that can hit, whatever it passes (all of it, handle and
// all, for people, bales and crows; its edge for the rest):
//   players            hit, each at most once a swing (however close: right up against them still hits); what
//                      a hit does is the move's effect (see EFFECTS: knocked back, launched, caught on the
//                      blade, tripped, or hooked and hauled in: the Rake drags the first it catches in with it)
//   hay bales          damaged and shoved (or hooked and hauled in)
//   loose weapons      (only by a haul) hooked and dragged in, to fall in at your feet
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
import { dropWeapon, haulWeapon, hookWeapon, letGoWeapon, looseWeaponAt, throwWeapon } from './looseWeapons.js'
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
const SHIFT_QUICK = 0.6  // ...a pair's (from your side up into a slash, like a punch)

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
  // a quick slash from `sweep[0]` to `sweep[1]` degrees above the aim (the way you face), after a quick
  // start from where it was (the first `windup`); turned round (swing.turn -1: alternate ones), the other way.
  slash: (move, u, swing) => {
    const [a, b] = swing.turn < 0 ? [move.sweep[1], move.sweep[0]] : move.sweep
    const start = swing.aim + swing.f * a * DEG, end = swing.aim + swing.f * b * DEG
    if (u < move.windup) return { angle: swing.from + (start - swing.from) * smooth(u / move.windup), extend: 0, live: false }
    const v = (u - move.windup) / (1 - move.windup)
    return { angle: start + (end - start) * (1 - (1 - v) ** 2), extend: 0, live: v < 0.9 }
  },
  // `slashes` slashes back and forth through the aim (`arc` degrees each, starting down), after a quick
  // start from where it was; each one a fresh slash (it can hit the same one again), the last the finish.
  flurry: (move, u, swing) => {
    const a = move.arc / 2 * DEG, start = swing.aim + swing.f * a
    if (u < move.windup) return { angle: swing.from + (start - swing.from) * smooth(u / move.windup), extend: 0, live: false }
    const v = (u - move.windup) / (1 - move.windup), k = Math.min(move.slashes - 1, Math.floor(v * move.slashes))
    return { angle: swing.aim + swing.f * a * Math.cos(Math.PI * v * move.slashes), extend: 0, live: true, slash: k, finishing: k === move.slashes - 1 }
  },
  // raking: the hands down `low` (it lies flatter along the floor), pushed out `reach` along the aim (the
  // first `out` of it), dragged back in to `back` behind where it's held, then eased back to where it's
  // held. It hits on the way out (hookOut) or dragging back; whatever it hooks it drags in (drags), and lets
  // go once it's done dragging.
  rake: (move, u, swing) => {
    const out = move.out, home = 0.85, outward = u < out, dragging = !outward && u < home
    const extend = outward ? move.reach * (1 - (1 - u / out) ** 2)
      : dragging ? move.reach - (move.reach + move.back) * smooth((u - out) / (home - out))
      : -move.back * (1 - smooth((u - home) / (1 - home)))
    return { angle: swing.aim, extend, up: -(move.low ?? 0), live: move.hookOut ? outward : dragging, drags: outward || dragging }
  },
}
const smooth = u => u * u * (3 - 2 * u)
const DEG = Math.PI / 180
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
  up: holder => ({ x: 0.25 * holder.facing, y: 1 }),   // (popped up)
}
// How hard a swing hits right now: its move's numbers (its last slash, a flurry's finish).
const hitOf = s => s.finishing ? { ...s.move, ...s.move.finish } : s.move

// What a hit does to someone, by the move's effect (see weaponTypes.js): (w, game, holder, victim, part
// (the body part hit), p (where), knock (which way)) → true if that ended the swing's hitting.
const EFFECTS = {
  knock: (w, game, holder, victim, part, p, knock) => {
    const m = hitOf(w.swing)
    applyHit(game, victim, part, knock.x, knock.y, m.knockback, m.damage, m.stun)
    return w.wear(game, holder, p)
  },
  launch: (w, game, holder, victim, part, p, knock) => {
    const m = hitOf(w.swing)
    victim.takeHit(game, m.damage, m.stun, part.getPosition())
    launch(victim, part, knock.x, knock.y, m.knockback)
    return w.wear(game, holder, p)
  },
  grab: (w, game, holder, victim, part, p) => {   // (caught on the blade: the first one it reaches)
    const m = w.swing.move
    victim.takeHit(game, m.damage, 0, part.getPosition())
    if (!w.wear(game, holder, p)) w.catch(victim, m)
    return true
  },
  trip: (w, game, holder, victim, part, p, knock) => {   // (their legs swept out toward us, and they're dragged in with it)
    victim.takeHit(game, w.swing.move.damage, 0, part.getPosition())
    victim.tripped(Math.sign(knock.x) || -holder.facing, 0)
    w.hook('player', victim)
    w.wear(game, holder, p)
    return true
  },
  haul: (w, game, holder, victim, part, p) => {   // (hooked: dragged in with it)
    victim.takeHit(game, w.swing.move.damage, 0, part.getPosition())
    w.hook('player', victim)
    w.wear(game, holder, p)   // (snapping it lets go)
    return true
  },
}

// What a haul has hooked, by what it is: each step it's dragged to the hook (`at`, the holder moving at
// v); at the end of the swing it's let go (someone hauled in lies there a moment).
const HAULED = {
  player: {
    hook: victim => victim.stun(10),   // (limp until it lets go of them)
    carry: (victim, at, v) => { const c = victim.torso.getPosition(); victim.setVelocity(v.x + (at.x - c.x) * FOLLOW, v.y + (at.y + 0.15 - c.y) * FOLLOW) },
    release: (victim, move) => { victim.stunTimer = move.haul.stun },
    gone: victim => victim.out || victim.removed,
  },
  bale: {
    hook: () => {},
    carry: (bale, at, v) => { const c = bale.body.getPosition(); bale.body.setLinearVelocity(new Vec2(v.x + (at.x - c.x) * FOLLOW, v.y + (at.y - c.y) * FOLLOW)) },
    release: () => {},
    gone: bale => bale.broken,
  },
  weapon: { hook: w => hookWeapon(w), carry: (w, at) => haulWeapon(w, at), release: w => letGoWeapon(w), gone: w => w.gone },
}
const FOLLOW = 15   // something hooked or on the blade is pulled to it this hard (1/s)

function unitFrom(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
  return { x: dx / d, y: dy / d }
}

// One blade in hand (a weapon has one; a pair, the Sickles, one in each hand):
//   hand     which hand holds it (a pair's: 'R' or 'L'; else null: see heldHands)
//   uses     how many it has left
//   pose     where it is: { at (the grip), angle } (see place)
//   heading  the way it's pointing, before it gives way to the level; spin: how fast that's turning (rad/s)
//   shift    its grip moved from the chest ({ out, up }: m forward, up; see want)
//   give     how it's giving way to the level (see giveWay.js); giving: it ran into the level last step
//   last     its pose last step
const blade = (hand, uses) => ({ hand, uses, pose: null, heading: 0, spin: 0, shift: { out: 0, up: 0 }, give: { ...NO_GIVE }, giving: false, last: null })

export class HeldWeapon {
  // `count`: how many (a pair's: 1 or 2, a new one 2), each with `uses`.
  constructor(typeName, uses, count) {
    this.typeName = typeName
    this.type = WEAPON_TYPES[typeName]
    const pair = this.type.pair
    this.blades = (count ?? (pair ? 2 : 1)) === 2 ? [blade('R', uses), blade('L', uses)] : [blade(pair ? 'R' : null, uses)]
    this.active = this.blades[0]   // the one attacking (or about to be thrown); the rest are held at your side
    this.used = null               // (a pair: the one that attacked last: the other goes next)
    this.side = 1              // which side of the handle a lopsided head is on (see A WEAPON'S SHAPE)
    this.limp = null           // its holder knocked down: its angle to their torso, where they went down
    this.gone = false          // out of their hands (thrown, snapped, dropped)
    this.cooldown = 0
    // the swing going on: { move (the type's numbers for it), t (s in), aim, from, hit (what it has hit), wore (paid its cost), live }
    this.swing = null
    this.striking = false      // the swing's at a part that can hit
    this.charge = null         // holding the attack button: 0 → 1 (let go: the tap, or full: the charged move)
    this.aiming = null         // holding Throw Weapon: 0 → 1 (how hard it'll be thrown)
    this.grab = null           // someone caught on the blade (a charged move with grab): { victim, move, t, from }
    this.haul = null           // what a haul has hooked, being dragged in: { kind (see HAULED), target, move }
    this.late = null           // a swing's just gone past, still batting pumpkins a moment: { swing, left (s) }
    this.queued = null         // a click a moment before it could attack (see tap.buffer): { at (game time), held }
    this.run = { n: -1, end: -Infinity, hurt: 0 }   // a run of taps (see tap.combo): which one the last was, when it ended, our damage then
    const head = headOf(this.type)
    this.hitPoints = [...shaftPoints(this.type), ...head.edge, head.point]   // (what hits people: all of it, so right up against them still hits)
    this.batPoints = this.type.bats ? [...shaftPoints(this.type), ...head.edge] : null   // (what bats: all of it)
  }

  // The active blade's (see blade).
  get pose() { return this.active.pose }
  set pose(v) { this.active.pose = v }
  get last() { return this.active.last }
  set last(v) { this.active.last = v }
  get heading() { return this.active.heading }
  set heading(v) { this.active.heading = v }
  get uses() { return this.active.uses }
  get give() { return this.active.give }
  set uses(v) { this.active.uses = v }

  // Into someone's hands: held straight up (just pulled out of the ground), and it swings down to where
  // they aim.
  takeUp(player) {
    this.holder = player
    this.side = player.facing
    for (const b of this.blades) this.raise(b)
  }

  // Held straight up, in front of the chest (just pulled out of the ground).
  raise(b) {
    b.heading = Math.PI / 2
    b.pose = { at: alongTool(chestOf(this.holder), b.heading, this.type.hold), angle: b.heading }
  }

  // A pair with a hand free can take another of its kind (see Player.canPick): `key` a weapon lying about.
  takes(key) {
    return !!this.type.pair && this.blades.length < 2 && !!key && key.typeName === this.typeName
  }

  // Another one of the pair, into the free hand.
  addBlade(uses) {
    const b = blade(this.blades[0].hand === 'R' ? 'L' : 'R', uses)
    this.blades.push(b)
    this.raise(b)
  }

  // A pair: the one that goes next (not the one that went last).
  next() {
    return this.blades.find(b => b !== this.used) ?? this.blades[0]
  }

  // The active blade's gone from our hands (snapped, thrown): the other carries on, or our hands are empty.
  // Returns true if they're empty.
  loseBlade(player) {
    if (this.blades.length < 2) { player.dropHeld(); return true }
    this.blades = this.blades.filter(b => b !== this.active)
    this.active = this.used = this.blades[0]
    if (this.swing) this.endSwing()
    return false
  }

  // Out of their hands (thrown, snapped, dropped...).
  release() {
    this.letGoHaul()
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
      this.letGoHaul()
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
    if (this.haul) this.carryHaul(player)
  }

  // Each step, after the physics step (its holder where they are now): it goes where it goes, and a
  // swing hits what it passes.
  place(game, player, dt) {
    if (this.gone) return
    const s = this.swing
    if (s && s.move.tracks) s.aim += wrapAngle(aimAngle(player) - s.aim)   // (following the aim)
    const want = this.want(game, player, aimAngle(player))
    if (s && want.slash !== undefined && want.slash !== s.slash) {   // (a fresh slash: a pair's, from the other hand)
      s.slash = want.slash
      s.hit = new Set()
      if (this.blades.length > 1 && s.slash > 0) { this.active = this.used = this.next(); this.active.last = null }
    }
    if (s) s.finishing = !!want.finishing
    if (this.haul && !want.drags) this.letGoHaul()   // (done dragging it in)
    const live = !!(s && s.live && want.live)
    for (const b of this.blades) if (b !== this.active) this.reach(game, player, b, this.atSide(player, b), false, dt)
    const clank = this.reach(game, player, this.active, want, live, dt)
    this.striking = live
    if (live) {
      this.late = this.type.bats ? { swing: s, left: this.type.bats.grace ?? 0 } : null
      this.strike(game, player, clank)
    } else if (this.late) this.batLate(game, player, dt)
    if (this.gone) return   // (that snapped it)
    this.last = this.pose
    if (s && this.swing === s && (s.t += dt) >= s.move.time) {
      this.endSwing()
      if (s.run) this.run.end = game.time
    }
  }

  // Put it where `want` says, giving way to the level (see giveWay.js). A swing's hitting part running
  // into the level (that it wasn't already giving way to) doesn't give way: returns where it hit
  // ({ x, y, normal }: it clanks), or null.
  // (Blade b: the active one goes where the swing says; the others are at your side.)
  reach(game, player, b, want, live, dt) {
    const type = this.type, swing = b === this.active ? this.swing : null
    const k = perStep(CONFIG.weapon.give.ease, dt), shift = perStep(type.pair ? SHIFT_QUICK : SHIFT, dt)
    b.shift.out += ((want.out ?? 0) - b.shift.out) * shift
    b.shift.up += ((want.up ?? 0) - b.shift.up) * shift
    const chest = want.limp ? limpChestOf(player) : chestOf(player)
    const from = { x: chest.x + player.facing * b.shift.out, y: chest.y + b.shift.up }
    if (swing || want.limp) {   // (exactly where it says: going on from there at the speed it's going)
      b.spin = (want.angle - b.heading) / dt
      b.heading = want.angle
    } else ({ angle: b.heading, spin: b.spin } = turnToward(b.heading, b.spin, want.angle, type.heft.turn, dt))
    const along = type.hold + want.extend
    const hit = swing && swing.move.ghost ? null : toolBlocked(game, type, this.side, from, b.heading, along)
    const clank = hit && live && !b.giving && !swing.move.scrape ? hit : null
    b.giving = !!hit && !clank
    if (clank) b.give = { ...NO_GIVE }
    else {
      const target = hit ? giveWay(game, type, this.side, from, b.heading, along, hit, b.give) : NO_GIVE
      b.give = { tilt: lerp(b.give.tilt, target.tilt, k), back: lerp(b.give.back, target.back, k), through: target.through }
    }
    const angle = b.heading + b.give.tilt
    b.pose = { at: alongTool(from, angle, along - b.give.back), angle }
    return clank
  }

  // A pair's blade, held at its hand's side (hands by your sides), pointing down and forward.
  atSide(player, b) {
    const front = (b.hand === 'R') === (player.facing > 0)
    return { angle: facingAngle(player.facing, -0.95), extend: 0, out: front ? 0.06 : -0.1, up: -0.3, live: false }
  }

  // The swing's over: the wait before the next one starts.
  endSwing() {
    this.letGoHaul()
    this.cooldown = this.swing.move.cooldown
    this.swing = null
  }

  // A haul hooked something (see HAULED): it's dragged in with the head; nothing else is hit now.
  hook(kind, target) {
    this.haul = { kind, target, move: this.swing.move }
    this.swing.live = false
    HAULED[kind].hook(target)
  }

  carryHaul(player) {
    const H = HAULED[this.haul.kind]
    if (H.gone(this.haul.target)) { this.haul = null; return }
    const { at, angle } = this.pose, edge = headOf(this.type).edge
    H.carry(this.haul.target, toWorld(at, angle, this.side, edge[edge.length >> 1]), player.torso.getLinearVelocity())
  }

  letGoHaul() {
    if (!this.haul) return
    const { kind, target, move } = this.haul
    this.haul = null
    if (!HAULED[kind].gone(target)) HAULED[kind].release(target, move)
  }

  // A press starts charging. Let go fully charged: the charged move; any sooner (a click): the tap.
  // (A weapon with no charged move taps right on the press.)
  // A click a moment too soon (during a swing or the wait after it) is kept (tap.buffer s), and happens as
  // soon as it can: a quick click, the tap; still held, it starts charging.
  attack(game, player, held, pressed, aim, dt) {
    const special = this.type.charge, ready = !this.swing && this.cooldown <= 0, buffer = this.type.tap.buffer
    if (pressed && !ready && buffer) this.queued = { at: game.time, held: true }
    if (this.queued && !held) this.queued.held = false
    if (ready && this.queued) {
      const q = this.queued
      this.queued = null
      if (game.time - q.at <= buffer) {
        if (!special || !q.held) return this.tap(game, player, aim)
        pressed = true
      }
    }
    if (pressed && ready) {
      if (!special) return this.tap(game, player, aim)
      this.charge = 0
    }
    if (this.charge === null) return
    if (held) { this.charge = Math.min(1, this.charge + dt / special.chargeTime); return }
    const full = this.charge >= 1
    this.charge = null
    if (!full) return this.tap(game, player, aim)
    this.run.end = -Infinity   // (the charged move breaks a run of taps)
    this.active = this.used = this.next()
    this.start(game, player, special, aim)
  }

  // A tap: part of a run, if the type has a combo (a click within combo.window s of the last one ending,
  // without being hurt since): alternate ones turned round (tap.alternate), every 3rd the finisher.
  tap(game, player, aim) {
    const tap = this.type.tap, C = tap.combo, r = this.run
    const carry = !!C && game.time - r.end <= C.window && player.damageTaken === r.hurt
    r.n = carry ? (r.n + 1) % 3 : 0
    r.hurt = player.damageTaken
    const move = C && r.n === 2 ? C.finisher : tap
    this.active = this.used = this.next()   // (a pair: from the other hand)
    this.start(game, player, move, aim, { turn: tap.alternate && r.n === 1 ? -1 : 1, run: true })
  }

  // Throw Weapon held: it charges (0 → 1). Let go: thrown along the aim from where it is, point first,
  // as hard as it's charged (a pair: one of them). Returns true if our hands are empty now.
  aimThrow(game, player, held, aim, dt) {
    const T = this.type.throw
    if (this.aiming === null) { this.aiming = 0; this.charge = null; this.active = this.next() }   // (a pair: the next hand's)
    if (held) { this.aiming = Math.min(1, this.aiming + dt / T.chargeTime); return false }
    const speed = lerp(T.speed[0], T.speed[1], this.aiming), v = player.torso.getLinearVelocity()
    const vel = { x: Math.cos(aim) * speed + v.x * 0.5, y: Math.sin(aim) * speed + v.y * 0.5 }
    const power = 0.4 + 0.6 * this.aiming   // (a tap still hits, just softer)
    const at = this.pose.at, uses = this.uses
    this.aiming = null
    this.used = this.active
    const empty = this.loseBlade(player)   // (out of our hands; a thrown one takes its place)
    throwWeapon(game, player, this.typeName, uses, at, vel, power, this.side)
    return empty
  }

  start(game, player, move, aim, extra) {
    this.beginSwing(player, move, aim, extra)
    if (move.lunge) player.lunge(game, Math.cos(aim) * move.lunge.speed, move.lunge.time)   // (sideways: no flying by thrusting up)
  }

  // A swing starts from where it is now (tilted away from the level and all: so that tilt's in it now).
  beginSwing(player, move, aim, extra = {}) {
    const from = this.pose.angle
    this.swing = { move, t: 0, aim: from + wrapAngle(aim - from), f: player.facing, from, hit: new Set(), wore: false, live: true, ...extra }
    const b = this.active
    b.heading = from
    b.spin = 0
    b.give.tilt = 0
    b.giving = false   // (what it was resting on held, it can clank off now: a thrust into the floor)
    b.last = null      // (the blade sweeps from where the swing starts, not from wherever it was pointing)
    this.late = null
  }

  // Where it should be this step: in a swing, hoisting someone, held back charging (shaking a little
  // once it's full), wound up to throw, clutched by its knocked-down holder, or just pointing at the
  // aim: { angle, extend (pushed out along it, m), out, up (the grip moved this far from the chest:
  // forward, up; m), live, drags (still dragging in what it's hooked), limp }.
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
    if (this.aiming !== null) return THROW_POSES[this.type.throw.flight](aim, this.aiming, player.facing)
    if (this.type.pair) return this.atSide(player, this.active)   // (hands by your sides)
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
    this.grab.victim.setVelocity(v.x + (tip.x - body.x) * FOLLOW, v.y + (tip.y + 0.2 - body.y) * FOLLOW)
  }

  // Where the hands go on its handle (the arms are posed to reach them: see heldHands).
  // A pair: one in each hand ({ front, back }: the hand nearest the aim, the other; null if it's empty).
  hands() {
    const sh = this.holder.shoulder()
    if (!this.type.pair) return heldHands(this.type, this.pose.at, this.pose.angle, sh)
    const grip = hand => { const b = this.blades.find(b => b.hand === hand); return b ? heldHands(this.type, b.pose.at, b.pose.angle, sh).front : null }
    const [front, back] = this.holder.facing > 0 ? ['R', 'L'] : ['L', 'R']
    return { front: grip(front), back: grip(back) }
  }

  // Lying loose again where it is (its holder was knocked out), with the uses it has left (a pair: each).
  drop(game) {
    for (const b of this.blades) dropWeapon(game, this.typeName, b.pose.at.x, b.pose.at.y, b.uses, this.side)
  }

  // For snapshots: [type, grip x, grip y, angle, throw charge (0..1, or -1: not about to throw), side], the
  // active blade's; a pair's also [hand (1 right, -1 left), and the other's grip x, grip y, angle, hand].
  view() {
    const pose = b => [r3(b.pose.at.x), r3(b.pose.at.y), r3(wrapAngle(b.pose.angle))], hand = b => b.hand === 'R' ? 1 : -1
    const v = [this.typeName, ...pose(this.active), this.aiming === null ? -1 : r3(this.aiming), this.side]
    if (!this.type.pair) return v
    const other = this.blades.find(b => b !== this.active)
    return [...v, hand(this.active), ...(other ? [...pose(other), hand(other)] : [])]
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
      const loose = s.move.effect === 'haul' && looseWeaponAt(game, p, R)   // (a haul hooks a weapon lying about, too)
      if (loose) {
        this.hook('weapon', loose)
        this.wear(game, player, p)
        return true
      }
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

  // Returns true if that ended the swing's hitting.
  hitPlayer(game, player, other, part, p, dir) {
    const s = this.swing
    if (other === player || other.dead || s.hit.has(other)) return false
    s.hit.add(other)
    game.events.push({ type: 'hit', x: r3(p.x), y: r3(p.y) })
    return EFFECTS[s.move.effect || 'knock'](this, game, player, other, part, p, KNOCK[s.move.knock || 'along'](player, other, dir, s))
  }

  hitBale(game, player, bale, p, dir) {
    const s = this.swing, move = s.move
    if (s.hit.has(bale)) return false
    s.hit.add(bale)
    if (move.effect === 'haul') { this.hook('bale', bale); this.wear(game, player, p); return true }   // (hooked)
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
  // (A pair: the active one snaps; the other carries on.)
  spend(game, player, p, cost) {
    if ((this.uses -= cost) > 0) return false
    game.events.push({ type: 'weaponBreak', x: r3(p.x), y: r3(p.y), typeName: this.typeName })
    this.loseBlade(player)
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
const overShoulder = (aim, u, f) => ({ angle: facingAngle(f, 1.9 + 0.5 * u), extend: 0, out: -0.1, up: 0.3, live: false })
const THROW_POSES = {
  point: (aim, u) => ({ angle: aim, extend: -0.35 * u, live: false }),   // drawn back along the aim, a javelin
  spinning: overShoulder,   // raised back over the shoulder, like an axe
  trap: overShoulder,       // (for a lob)
  ricochet: (aim, u) => ({ angle: aim, extend: -0.15 * u, live: false }),   // drawn back a little, for a flat throw
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
