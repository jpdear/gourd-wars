// WEAPONS — melee weapons, lying loose in the level or in someone's hands (their numbers are in
// weaponTypes.js).
//
// Loose (game.looseWeapons), a weapon isn't a physics body: it falls straight down blade first and
// sticks into the first thing under it (riding along if that's a moving platform or a hay bale, and
// falling again if the bale breaks). Anyone with empty hands can yank it out with the harvest key
// (see weaponPickups).
//
// Held, a HeldWeapon is all its player deals with: each step it reads the attack button and moves the
// tool through its swing. Held, it's a real body (its shaft and its head, the blade): a motor joint on
// the holder's torso pulls it toward where the swing wants it, with only so much strength (its type's
// heft), so it has some weight, gets stopped by walls and shoves people it runs into. It never touches
// its holder, and flying pumpkins pass right through it. The arms are posed to hold its handle where
// it actually is.
// Only attacks hurt. During one, whatever the blade touches:
//   players            hit, each at most once a swing
//   hay bales          damaged and shoved
//   a crow flying over knocked down (see crows.js)
//   the level          (platforms, walls, hazards) the blade clanks off it and the swing stops
// and, checked along the blade since they aren't solid to it:
//   flying pumpkins    cut (see cutPumpkin)
//   patch pumpkins     knocked off the vine (they splat, like a thrown pumpkin knocks them off)
//   Big Gourd shields  block it (a clank)
// A swing that touches anything costs its cost in uses (once a swing). The one that uses the last
// one snaps the weapon.

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { COLLIDE, CONFIG } from '../config.js'
import { knockDownCrow } from './crows.js'
import { baleAt, damageBale, shoveBale, skyDrop } from './level.js'
import { patchPumpkin, splatPatch } from './patches.js'
import { applyHit, cutPumpkin, launch } from './pumpkins.js'
import { WEAPON_TYPES } from './weaponTypes.js'
import { lerp, r3, wrapAngle } from '../util/math.js'

const DOWN = -Math.PI / 2
const SINK = 0.12        // a loose weapon's tip goes this far into whatever it lands in (m)
const MAX_FALL = 25      // m/s
const SAMPLES = 3        // blade checks per step, from where it was to where it is (fast swings can't skip past anyone)
const CARRY = 0.22       // held, it's carried this far below the shoulders (at the chest, not through the head)
const SHAFT = 0.03       // half the handle's thickness (m)

// A point `along` m up the tool from its grip (negative: toward the butt end).
function alongTool(grip, angle, along) {
  return { x: grip.x + Math.cos(angle) * along, y: grip.y + Math.sin(angle) * along }
}
const tipOf = (type, grip, angle) => alongTool(grip, angle, type.length - type.grip)

// ---------------------------------------------------------------------
// LOOSE WEAPONS — { id, typeName, uses, x, y (the grip), angle (butt → head), vy,
//   ground: null while falling, or what it's stuck in: { body, local (the grip in the body's frame), angle (relative to the body) } }
// ---------------------------------------------------------------------

// A weapon falls from (x, y) (where its grip is), blade first, with `uses` left (default: brand new).
export function dropWeapon(game, typeName, x, y, uses = WEAPON_TYPES[typeName].uses) {
  game.looseWeapons.push({ id: game.nextWeaponId++, typeName, uses, x, y, angle: DOWN, vy: 0, ground: null })
}

// A brand new one falls in from the sky at x (see skyDrop).
export function dropFromSky(game, typeName, x) {
  dropWeapon(game, typeName, x, skyDrop(game, x, WEAPON_TYPES[typeName].grip))   // (pointing down: the butt end is above the grip)
}

export function clearWeapons(game) {
  game.looseWeapons = []
}

// What a weapon can stick into: anything solid but people, pumpkins, crows and weapons in someone's hands.
function sticksTo(body) {
  const ud = body.getUserData()
  return !ud || !['player', 'pumpkin', 'crow', 'weapon'].includes(ud.kind)
}
// (a bale it was stuck in broke: its body is gone)
const gone = body => { const ud = body.getUserData(); return !!(ud && ud.bale && ud.bale.broken) }

export function updateWeapons(game, dt) {
  for (const w of game.looseWeapons) {
    if (w.ground && gone(w.ground.body)) { w.ground = null; w.angle = DOWN; w.vy = 0 }
    if (w.ground) {   // ride along with whatever it's stuck in
      const { body, local, angle } = w.ground
      const p = body.getWorldPoint(local)
      w.x = p.x; w.y = p.y; w.angle = body.getAngle() + angle
      continue
    }
    w.vy = Math.max(w.vy - CONFIG.gravity * dt, -MAX_FALL)
    const type = WEAPON_TYPES[w.typeName]
    const from = tipOf(type, w, w.angle), to = new Vec2(from.x, from.y + w.vy * dt)
    let hit = null
    game.world.rayCast(new Vec2(from.x, from.y), to, (fixture, point, normal, fraction) => {
      if (!sticksTo(fixture.getBody())) return -1
      hit = { body: fixture.getBody(), y: point.y }
      return fraction
    })
    if (!hit) { w.y += w.vy * dt; continue }
    w.y += hit.y - SINK - from.y   // (the tip a little way in)
    w.ground = { body: hit.body, local: hit.body.getLocalPoint(new Vec2(w.x, w.y)), angle: w.angle - hit.body.getAngle() }
  }
  game.looseWeapons = game.looseWeapons.filter(w => w.y > CONFIG.killY)
}

// Weapons stuck in something, as pickups (see pickups.js): the hands reach for the grip.
export function weaponPickups(game) {
  return game.looseWeapons.filter(w => w.ground).map(w => {
    const tip = tipOf(WEAPON_TYPES[w.typeName], w, w.angle)
    return {
      key: w, x: tip.x, y: tip.y + SINK, at: { x: w.x, y: w.y, r: 0.2 }, time: CONFIG.weapon.yankTime,
      take: player => {
        game.looseWeapons = game.looseWeapons.filter(q => q !== w)
        player.holdWeapon(new HeldWeapon(w.typeName, w.uses))
      },
    }
  })
}

// ---------------------------------------------------------------------
// HELD WEAPONS
// ---------------------------------------------------------------------

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
}

export class HeldWeapon {
  constructor(typeName, uses) {
    this.typeName = typeName
    this.type = WEAPON_TYPES[typeName]
    this.uses = uses
    this.body = null           // (while held: see takeUp)
    this.joint = null          // the motor joint pulling it along with its holder
    this.blade = null          // the body's head fixture
    this.holder = null
    this.cooldown = 0
    // the swing going on: { move (the type's numbers for it), t (s in), aim, from, hit (what it has hit), wore (paid its cost), live }
    this.swing = null
    this.charge = null         // holding the button after a tap: 0 → 1 (full: let go for the charged move)
    this.grab = null           // someone caught on the blade (a charged move with grab): { victim, move, t, from }
    this.last = null           // the blade's pose last step: { at, angle }
  }

  // Into someone's hands: its body appears there, held straight up (just pulled out of the ground; and
  // pointing anywhere else it could start inside the floor), and swings down to where they aim.
  takeUp(player) {
    const type = this.type, H = type.heft
    const chest = chestOf(player), angle = Math.PI / 2
    const at = alongTool(chest, angle, type.hold)
    const body = player.world.createBody({ type: 'dynamic', position: new Vec2(at.x, at.y), angle, bullet: true })
    // the grip (the body's origin) is `grip` m up from the butt end; the shaft runs from the butt to the
    // neck, the head on from there (its mass: heft.mass, spread over them)
    const neck = type.length - type.grip - type.blade
    const area = (neck + type.grip) * 2 * SHAFT + type.blade * type.headWidth
    const fixture = { density: H.mass / area, friction: 0.4, filterGroupIndex: player.group, filterCategoryBits: COLLIDE.weapon, filterMaskBits: 0xFFFF & ~COLLIDE.pumpkin }
    body.createFixture(new planck.Box((neck + type.grip) / 2, SHAFT, new Vec2((neck - type.grip) / 2, 0), 0), fixture)
    this.blade = body.createFixture(new planck.Box(type.blade / 2, type.headWidth / 2, new Vec2(neck + type.blade / 2, 0), 0), fixture)
    body.setUserData({ kind: 'weapon', weapon: this })
    this.body = body
    this.holder = player
    this.joint = player.world.createJoint(new planck.MotorJoint({ maxForce: H.force, maxTorque: H.torque, correctionFactor: H.snap }, player.torso, body))
  }

  // Out of their hands (dropped, snapped...): its body's gone.
  release() {
    if (this.body) this.holder.world.destroyBody(this.body)   // (takes the joint with it)
    this.body = this.joint = this.blade = null
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
    if (player.helpless) this.swing = this.charge = this.grab = null
    else if (this.grab) this.holdOn(game, player, pressed, aim, dt)
    else this.attack(game, player, input.throw, pressed, aim, dt)

    const s = this.swing
    const want = this.want(game, player, aim)
    this.drive(player, alongTool(chest, want.angle, this.type.hold + want.extend), want.angle)
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
  drive(player, at, angle) {
    const H = this.type.heft, torso = player.torso, now = this.body.getAngle()
    const k = player.helpless ? CONFIG.weapon.limp : 1
    this.joint.setLinearOffset(torso.getLocalPoint(new Vec2(at.x, at.y)))
    this.joint.setAngularOffset(now + wrapAngle(angle - now) - torso.getAngle())
    this.joint.setMaxForce(H.force * k)
    this.joint.setMaxTorque(H.torque * k)
    this.joint.setCorrectionFactor(H.snap)
  }

  // A press swings (the tap). Keep holding and it charges; let go fully charged for the charged move.
  attack(game, player, held, pressed, aim, dt) {
    const special = this.type.charge
    if (pressed && !this.swing && this.cooldown <= 0) {
      this.start(game, player, this.type.tap, aim)
      this.charge = special ? 0 : null
    }
    if (this.charge === null) return
    if (held) this.charge = Math.min(1, this.charge + dt / special.chargeTime)
    else {
      if (this.charge >= 1) this.start(game, player, special, aim)
      this.charge = null
    }
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

  // For snapshots: [type, grip x, grip y, angle]
  view() {
    const { at, angle } = this.pose
    return [this.typeName, r3(at.x), r3(at.y), r3(wrapAngle(angle))]
  }

  // An attack: what did the blade run into? Shields and pumpkins first (along the blade, swept from
  // where it was last step), then whatever its body touched in the last physics step.
  strike(game, player) {
    const now = this.pose
    if (this.sweep(game, player, this.last || now, now)) return
    for (let ce = this.body.getContactList(); ce; ce = ce.next) {
      const c = ce.contact
      if (!c.isTouching() || (c.getFixtureA() !== this.blade && c.getFixtureB() !== this.blade)) continue
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

// (pre-solve) Someone stuck on a blade doesn't bump against it.
export function weaponContactEnabled(a, b) {
  const [w, other] = a && a.kind === 'weapon' ? [a.weapon, b] : b && b.kind === 'weapon' ? [b.weapon, a] : [null, null]
  return !(w && w.grab && other && other.kind === 'player' && other.player === w.grab.victim)
}
