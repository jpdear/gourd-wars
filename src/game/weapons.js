// HELD WEAPONS — a melee weapon in someone's hands (their numbers and shape are in weaponTypes.js;
// lying loose, dropped or thrown, they're in looseWeapons.js).
//
// A HeldWeapon is all its player deals with: each step it reads the attack and Throw Weapon buttons and
// moves the tool through its swing. Held, it's a real body (its shaft and its head, the blade): a motor
// joint pulls it toward where the swing wants it, with only so much strength (its type's heft), so it
// has some weight, gets stopped by walls and shoves people it runs into. The joint's on an anchor that
// moves with the holder's torso but can't be moved by anything (a kinematic body), so whatever the
// weapon runs into never tugs its holder around. It never touches its holder, and flying pumpkins pass
// right through it. The arms are posed to hold its handle where it actually is.
// Caught on something and left behind (its grip pulled out of reach of the hands for a moment, say
// walking on with it jammed against a wall, or jumping past a ledge it's under) it slips: it passes
// through everything but people until it's back in hand and clear, so it's never left behind. (Just
// pressed against what it's aimed into, it stays solid: a thrust into the floor clanks.)
// Only attacks hurt. During one, whatever the blade touches:
//   players            hit, each at most once a swing
//   hay bales          damaged and shoved
//   a crow flying over knocked down (see crows.js)
//   the level          (platforms, walls, hazards, pegs) the blade clanks off it and the swing stops
// and, checked along the blade since they aren't solid to it:
//   flying pumpkins    cut (see cutPumpkin)
//   patch pumpkins     knocked off the vine (they splat, like a thrown pumpkin knocks them off)
//   Big Gourd shields  block it (a clank)
// A swing that touches anything costs its cost in uses (once a swing). The one that uses the last
// one snaps the weapon.
// Throw Weapon: hold it to charge (the weapon pulled back), let go to throw it (see throwWeapon).

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { COLLIDE, CONFIG } from '../config.js'
import { knockDownCrow } from './crows.js'
import { baleAt, damageBale, shoveBale } from './level.js'
import { dropWeapon, throwWeapon } from './looseWeapons.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { applyHit, cutPumpkin, launch } from './pumpkins.js'
import { WEAPON_TYPES, addWeaponFixtures, alongTool, tipOf } from './weaponTypes.js'
import { lerp, r3, wrapAngle } from '../util/math.js'

const SAMPLES = 3        // blade checks per step, from where it was to where it is (fast swings can't skip past anyone)
const CARRY = 0.22       // held, it's carried this far below the shoulders (at the chest, not through the head)
// Caught on something: its grip this far (m) from the shoulders (out of reach of the hands), for this
// long (s), and it slips; its grip back within `back` m of where it should be (and touching nothing),
// it's solid again.
const SNAG = { reach: 0.75, time: 0.03, back: 0.15 }

// How each kind of swing moves the tool, u = 0 → 1 through it: { angle, extend (pushed out further
// than usual, m), live (the blade can hit things) }.
// swing.aim: the aim when it started; swing.from: where it pointed then.
const MOTIONS = {
  // a straight jab along the aim: out fast (the arms straightening), held a moment, back. It hits on
  // the way out and while held.
  thrust: (move, u, swing) => ({
    angle: swing.aim,
    extend: move.reach * (u < 0.35 ? 1 - (1 - u / 0.35) ** 2 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4),
    live: u < 0.6,
  }),
  // a quick snap from where it pointed to the aim (flinging someone off it). Hits nothing.
  snap: (move, u, swing) => ({ angle: swing.from + wrapAngle(swing.aim - swing.from) * (1 - (1 - u) ** 2), extend: 0, live: false }),
}
const FLING = { motion: 'snap', time: 0.18, cooldown: 0.3 }   // (the swing after flinging someone off the blade)

// What the blade does to what it touches during an attack, by what that is (see strike). Each returns
// true if that ended the swing.
const TOUCH = {
  player: (w, game, holder, body, ud, p, dir) => w.hitPlayer(game, holder, ud.player, body, p, dir),
  bale: (w, game, holder, body, ud, p, dir) => w.hitBale(game, holder, ud.bale, p, dir),
  crow: (w, game, holder, body, ud, p) => { knockDownCrow(game, ud.crow); return w.wear(game, holder, p) },
  platform: (w, game, holder, body, ud, p, dir) => w.clank(game, holder, p, dir),
  hazard: (w, game, holder, body, ud, p, dir) => w.clank(game, holder, p, dir),
  peg: (w, game, holder, body, ud, p, dir) => w.clank(game, holder, p, dir),
}

export class HeldWeapon {
  constructor(typeName, uses) {
    this.typeName = typeName
    this.type = WEAPON_TYPES[typeName]
    this.uses = uses
    this.body = null           // (while held: see takeUp)
    this.anchor = null         // the body moving with the holder's torso that it's jointed to
    this.joint = null          // the motor joint pulling it there
    this.blade = null          // the body's head fixture
    this.holder = null
    this.snagged = 0           // s it's been caught on something, out of reach of the hands
    this.slipping = false      // passing through everything but people (see SNAG)
    this.cooldown = 0
    // the swing going on: { move (the type's numbers for it), t (s in), aim, from, hit (what it has hit), wore (paid its cost), live }
    this.swing = null
    this.charge = null         // holding the attack button: 0 → 1 (let go: the tap, or full: the charged move)
    this.aiming = null         // holding Throw Weapon: 0 → 1 (how hard it'll be thrown)
    this.grab = null           // someone caught on the blade (a charged move with grab): { victim, move, t, from }
    this.last = null           // the blade's pose last step: { at, angle }
  }

  // Into someone's hands: its body appears there, held straight up (just pulled out of the ground; and
  // pointing anywhere else it could start inside the floor), and swings down to where they aim.
  takeUp(player) {
    const type = this.type
    const chest = chestOf(player), angle = Math.PI / 2
    const at = alongTool(chest, angle, type.hold)
    const body = player.world.createBody({ type: 'dynamic', position: new Vec2(at.x, at.y), angle, bullet: true })
    this.blade = addWeaponFixtures(body, type, type.heft.mass, { filterGroupIndex: player.group, filterCategoryBits: COLLIDE.weapon, filterMaskBits: 0xFFFF & ~COLLIDE.pumpkin })
    body.setUserData({ kind: 'weapon', weapon: this })
    this.body = body
    this.holder = player
    this.anchor = player.world.createBody({ type: 'kinematic' })
    this.followTorso(player)
    const H = type.heft
    this.joint = player.world.createJoint(new planck.MotorJoint({ maxForce: H.force, maxTorque: H.torque, correctionFactor: H.snap }, this.anchor, body))
    this.snagged = 0
    this.slipping = false
  }

  // Out of their hands (dropped, snapped...): its body's gone.
  release() {
    if (this.body) {
      this.holder.world.destroyBody(this.body)   // (takes the joint with it)
      this.holder.world.destroyBody(this.anchor)
    }
    this.body = this.anchor = this.joint = this.blade = null
  }

  // The anchor goes where the torso is, moving as it moves.
  followTorso(player) {
    const torso = player.torso
    this.anchor.setTransform(torso.getPosition(), torso.getAngle())
    this.anchor.setLinearVelocity(torso.getLinearVelocity())
    this.anchor.setAngularVelocity(torso.getAngularVelocity())
  }

  // Effects on how you move while holding it (like a pumpkin's); slower carrying someone on it.
  get carry() {
    const c = this.type.carry
    return this.grab ? { ...c, speed: (c.speed ?? 1) * this.grab.move.grab.carrySpeed } : c
  }

  // Where it actually is: { at (the grip), angle }
  get pose() {
    const p = this.body.getPosition()
    return { at: { x: p.x, y: p.y }, angle: this.body.getAngle() }
  }

  // Each step, before the physics step, even while you can't act (getting knocked down cuts a swing
  // short, lets go of whoever's on the blade, and lets the weapon flop).
  update(game, player, input, dt) {
    this.cooldown = Math.max(0, this.cooldown - dt)
    const chest = chestOf(player)
    const aim = Math.atan2(player.aim.y - chest.y, player.aim.x - chest.x)
    const pressed = input.throw && !player.prev.throw
    if (player.helpless) this.swing = this.charge = this.grab = this.aiming = null
    else if (this.grab) this.holdOn(game, player, pressed, aim, dt)
    else if (this.aiming !== null || (input.toss && !player.prev.toss && !this.swing && this.type.throw)) {
      if (this.aimThrow(game, player, input.toss, aim, dt)) return   // (thrown: out of our hands)
    } else this.attack(game, player, input.throw, pressed, aim, dt)

    const s = this.swing
    const want = this.want(game, player, aim)
    this.drive(player, alongTool(chest, want.angle, this.type.hold + want.extend), want.angle, dt)
    if (s && s.live && want.live) {
      this.strike(game, player)
      if (!this.body) return   // (that snapped it)
    }
    this.last = this.pose
    if (this.grab) this.carryVictim(player)
    if (s && this.swing === s && (s.t += dt) >= s.move.time) {
      this.swing = null
      this.cooldown = s.move.cooldown
    }
  }

  // Pull it toward the grip at `at`, pointing along `angle` (the short way round), as hard as its heft
  // allows (barely at all while its holder is ragdolled: it flops).
  drive(player, at, angle, dt) {
    const H = this.type.heft, anchor = this.anchor, now = this.body.getAngle()
    const k = player.helpless ? CONFIG.weapon.limp : 1
    this.followTorso(player)
    this.joint.setLinearOffset(anchor.getLocalPoint(new Vec2(at.x, at.y)))
    this.joint.setAngularOffset(now + wrapAngle(angle - now) - anchor.getAngle())
    this.joint.setMaxForce(H.force * k)
    this.joint.setMaxTorque(H.torque * k)
    this.joint.setCorrectionFactor(H.snap)
    this.checkSnag(player, at, dt)
  }

  // Caught on something, it slips (see SNAG). It isn't caught while its holder flops, or while
  // something's on its tines.
  checkSnag(player, at, dt) {
    const grip = this.body.getPosition()
    if (this.slipping) {
      if (Math.hypot(grip.x - at.x, grip.y - at.y) < SNAG.back && !this.touchingAnything()) this.slipping = false
      return
    }
    const sh = player.shoulder(), caught = Math.hypot(grip.x - sh.x, grip.y - sh.y) > SNAG.reach && !player.helpless && !this.grab
    this.snagged = caught ? this.snagged + dt : 0
    if (this.snagged >= SNAG.time) { this.slipping = true; this.snagged = 0 }
  }

  // Overlapping anything besides people (slipping, it might be inside a wall).
  touchingAnything() {
    for (let ce = this.body.getContactList(); ce; ce = ce.next) {
      const ud = ce.other.getUserData()
      if (ce.contact.isTouching() && !(ud && ud.kind === 'player')) return true
    }
    return false
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
    player.dropHeld()   // (its body in our hands goes; a thrown one takes its place)
    throwWeapon(game, player, this.typeName, this.uses, at, vel, power)
    return true
  }

  start(game, player, move, aim) {
    this.swing = { move, t: 0, aim, from: this.body.getAngle(), hit: new Set(), wore: false, live: true }
    this.last = null   // (the blade sweeps from where the swing starts, not from wherever it was pointing)
    if (move.lunge) player.lunge(game, Math.cos(aim) * move.lunge.speed, move.lunge.time)   // (sideways: no flying by thrusting up)
  }

  // Where it should be this step: in a swing, hoisting someone, held back charging (shaking a little
  // once it's full), or just pointing at the aim.
  want(game, player, aim) {
    const s = this.swing
    if (s) return MOTIONS[s.move.motion](s.move, s.t / s.move.time, s)
    if (this.grab) {   // up overhead (tilted a little forward), with them on it
      const up = Math.PI / 2 - player.facing * 0.3, u = Math.min(1, this.grab.t / 0.2)
      return { angle: this.grab.from + wrapAngle(up - this.grab.from) * (1 - (1 - u) ** 2), extend: 0, live: false }
    }
    if (this.charge) {
      const shake = this.charge >= 1 ? Math.sin(game.time * 70) * 0.03 : 0
      return { angle: aim + shake, extend: -0.25 * this.charge, live: false }
    }
    if (this.aiming !== null) return { angle: aim, extend: -0.35 * this.aiming, live: false }   // (drawn back to throw)
    return { angle: aim, extend: 0, live: false }
  }

  // The blade caught someone: they're stuck on it, helpless, until we fling them off.
  catch(victim, move) {
    this.grab = { victim, move, t: 0, from: this.body.getAngle() }
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
    this.swing = { move: FLING, t: 0, aim, from: this.body.getAngle(), hit: new Set(), wore: true, live: false }
  }

  // Whoever's on the blade goes where its tip goes (their middle on the tines).
  carryVictim(player) {
    const { at, angle } = this.pose, tip = tipOf(this.type, at, angle), body = this.grab.victim.torso.getPosition()
    const v = player.torso.getLinearVelocity()
    this.grab.victim.setVelocity(v.x + (tip.x - body.x) * 15, v.y + (tip.y + 0.2 - body.y) * 15)
  }

  // Where the hands go on its handle (the arms are posed to reach them): the back hand at the grip,
  // the front one further up the shaft.
  hands() {
    return { back: this.body.getWorldPoint(new Vec2(0, 0)), front: this.body.getWorldPoint(new Vec2(this.type.handGap, 0)) }
  }

  // Lying loose again where it is (its holder was knocked out), with the uses it has left.
  drop(game) {
    const p = this.body.getPosition()
    dropWeapon(game, this.typeName, p.x, p.y, this.uses)
  }

  // For snapshots: [type, grip x, grip y, angle, throw charge (0..1, or -1: not about to throw)]
  view() {
    const { at, angle } = this.pose
    return [this.typeName, r3(at.x), r3(at.y), r3(wrapAngle(angle)), this.aiming === null ? -1 : r3(this.aiming)]
  }

  // An attack: what did the blade run into? Shields and pumpkins first (along the blade, swept from
  // where it was last step), then whatever its body touched in the last physics step.
  strike(game, player) {
    const now = this.pose
    if (this.sweep(game, player, this.last || now, now)) return
    for (let ce = this.body.getContactList(); ce; ce = ce.next) {
      const c = ce.contact
      if (!c.isTouching() || !c.isEnabled() || (c.getFixtureA() !== this.blade && c.getFixtureB() !== this.blade)) continue   // (not one it passes through)
      const ud = ce.other.getUserData(), touch = ud && TOUCH[ud.kind]
      if (!touch) continue
      const m = c.getWorldManifold(null), p = m && m.points.length ? m.points[0] : this.blade.getBody().getWorldCenter()
      if (touch(this, game, player, ce.other, ud, p, this.pushAt(p))) return
    }
  }

  // The way the blade's moving at p (held still: the way it points).
  pushAt(p) {
    const v = this.body.getLinearVelocityFromWorldPoint(p), d = Math.hypot(v.x, v.y)
    const a = this.body.getAngle()
    return d > 0.5 ? { x: v.x / d, y: v.y / d } : { x: Math.cos(a), y: Math.sin(a) }
  }

  // Points along the blade from pose a to pose b, in small steps, against what isn't solid to it
  // (shields, pumpkins flying or on their patch). Returns true if that ended the swing.
  sweep(game, player, a, b) {
    const type = this.type
    const at = (f, along) => alongTool(
      { x: lerp(a.at.x, b.at.x, f), y: lerp(a.at.y, b.at.y, f) },
      a.angle + wrapAngle(b.angle - a.angle) * f,
      along,
    )
    const tip = type.length - type.grip
    for (let i = 1; i <= SAMPLES; i++) {
      for (const along of [tip - type.blade, tip - type.blade / 2, tip]) {
        const p = at(i / SAMPLES, along), q = at((i - 1) / SAMPLES, along)
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        const dir = d > 0.02 ? { x: (p.x - q.x) / d, y: (p.y - q.y) / d } : { x: Math.cos(b.angle), y: Math.sin(b.angle) }
        if (this.pass(game, player, p, dir)) return true
      }
    }
    return false
  }

  // The blade passing point p, moving along dir: a shield there blocks it; a flying pumpkin there is
  // cut; one growing on its patch is knocked off.
  pass(game, player, p, dir) {
    const s = this.swing, R = this.type.bladeRadius
    for (const other of game.players) {
      if (other === player || other.dead || s.hit.has(other)) continue
      if (other.tryBlock(game, p, R, dir)) { s.hit.add(other); return this.clank(game, player, p, dir) }
    }
    for (const pk of game.pumpkins) {
      if (pk.broken || pk.type.uncuttable) continue
      const c = pk.body.getPosition()
      if (Math.hypot(c.x - p.x, c.y - p.y) > pk.radius + R) continue
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
    applyHit(game, other, part, dir.x, dir.y, move.knockback, move.damage, move.stun)
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

  // The blade bounced off something hard: sparks, a little push back, and the swing's over.
  clank(game, player, p, dir) {
    game.events.push({ type: 'clank', x: r3(p.x), y: r3(p.y) })
    launch(player, player.torso, -dir.x, -dir.y, CONFIG.weapon.clankPush)
    this.swing.live = false
    this.wear(game, player, p)
    return true
  }

  // The swing touched something: it costs its move's cost in uses (once a swing). Returns true if
  // that snapped it.
  wear(game, player, p) {
    if (this.swing.wore) return false
    this.swing.wore = true
    if ((this.uses -= this.swing.move.cost ?? 1) > 0) return false
    game.events.push({ type: 'weaponBreak', x: r3(p.x), y: r3(p.y), typeName: this.typeName })
    this.swing.live = false
    player.dropHeld()
    return true
  }
}

const chestOf = player => { const sh = player.shoulder(); return { x: sh.x, y: sh.y - CARRY } }

// (pre-solve) Someone stuck on a blade doesn't bump against it; a slipping one (see SNAG) passes
// through everything but people.
export function weaponContactEnabled(a, b) {
  const [w, other] = a && a.kind === 'weapon' ? [a.weapon, b] : b && b.kind === 'weapon' ? [b.weapon, a] : [null, null]
  if (!w) return true
  const person = other && other.kind === 'player'
  if (w.slipping && !person) return false
  return !(w.grab && person && other.player === w.grab.victim)
}
