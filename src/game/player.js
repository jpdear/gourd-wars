// PLAYER (active ragdoll)
//
// The body is real physics (limbs joined by hinges), but while you're in
// control three "cheats" keep it standing:
//   1. a hover spring pushes the pelvis up to standing height
//   2. a torque keeps the torso upright
//   3. joint motors pose the limbs (walk cycle, arms aiming)
// Getting hit turns these off for a moment, so the body goes limp.

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { BODY, CONFIG } from '../config.js'
import { emptyInput } from './input.js'
import { baleAt, damageBale } from './level.js'
import { findPickup } from './pickups.js'
import { applyHit, launch, spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES, throwSpeeds } from './pumpkinTypes.js'
import { clamp, distToSegment, lerp, r3, wrapAngle } from '../util/math.js'

const BODY_FRICTION = 0.3   // every body part (the legs change while crouched: see setLegFriction)

// how thick a body part is (around its center line), for touching it with a fist or a foot
const partRadius = part => part.name === 'head' ? BODY.headR : part.name === 'torso' ? BODY.torsoHalfW : BODY.limbHalfW

// Everything that starts over when a player (re)spawns: health, being hit, status effects, what
// they're holding and doing. A field added here is reset by respawn() too.
const freshLife = () => ({
  dead: false,
  ko: false,                  // knocked out: limp until the next round
  health: CONFIG.player.maxHealth,
  damageTaken: 0,             // total this round
  reviveTimer: 0,             // practice: back up after a hazard KO
  // getting hit
  stunTimer: 0,               // > 0: ragdolled
  dazedTimer: 0,              // > 0: dazed (limp, then dizzy once back up), stars circling the head
  sinceStun: 99,
  staggerMeter: 0,            // recent damage; reaching CONFIG.damage.staggerAt knocks you down
  shoveTimer: 0,              // got hit but not staggered: no walking control for a moment
  tripTimer: 0,               // just tripped by a slide: can't be tripped again until this runs out
  // status effects (see the getters: frozen, glued, floating)
  frozenTimer: 0,             // Frost: stiff as a statue
  gluedTimer: 0,              // Splat Pie: stuck to the floor
  pendingGlue: 0,             // ...hit in the air: sticks when you land
  trappedTimer: 0,            // bitten by a Chomper: held in place
  floatTimer: 0,              // Balloon: floating helplessly upward
  // hazards (kept up by level.js)
  hopCooldown: 0,             // bonfire pop-out
  spikeTimer: 0,              // just hurt by pitchforks: not again until this runs out
  // hands
  held: null,                 // { typeName, power, ripeness, ammo?, blocks?, fuseLeft? } while holding a pumpkin (fuseLeft: a fused one caught ticking)
  charging: false,
  punchTimer: 0,              // > 0 while a jab is out
  pickup: null,               // what we could pick up from where we stand (see pickups.js)
  harvestTarget: null,        // ...the one we're pulling on (holding the harvest key)
  harvestProgress: 0,         // 0..1
  // moving
  grapple: null,              // Vine stuck in the level: { body, local, time, speed, from, best, stall } while reeling in
  wall: null,                 // on a wall (in the air, holding toward it): { dir: -1 left / 1 right, body, x }
  wallGrace: 0,               // can still kick off the wall this long after letting go...
  wallJumpTimer: 0,           // just kicked off a wall: steering back toward it is weak until this runs out
  crouching: false,           // holding down: soft, pressed down (sitting, on the ground)
  lowTimer: 0,                // crouched just now: the ground check looks from higher up (we may be sitting on it)
  sitTime: 0,                 // how long we've been sitting (crouched on the ground)
  wasSitting: false,          // crouched on the ground last step (a slide starts as you sit down)
  slide: null,                // power sliding (crouched while running): { dir: -1 left / 1 right, lead: 'L' / 'R', dustTimer }
  slideBoostTimer: 0,         // the slide's starting boost is used up until this runs out
  slideAir: false,            // jumped out of (or slid off the edge after) a slide: air control won't eat the extra speed
})

export class Player {
  constructor(world, opts) {
    // who they are
    this.world = world
    this.index = opts.index
    this.name = opts.name
    this.isDummy = false
    this.color = opts.color
    this.spawn = opts.spawn
    this.group = -(opts.index + 1)   // same negative group = limbs never collide with each other

    Object.assign(this, freshLife())

    // carried across a respawn (all short timers, or kept up to date every step anyway)
    this.facing = 1
    this.aim = { x: this.spawn.x + 5, y: this.spawn.y + 1.5 }
    this.prev = emptyInput()      // last step's input (to tell a new press from a held key)
    this.coyote = 0
    this.jumpBufferTimer = 0
    this.jumpLock = 0             // > 0: the hover spring is off (so it doesn't eat a jump or a hop)
    this.grounded = false
    this.groundDist = null
    this.groundVel = null         // the moving platform's velocity while standing on one
    this.walkPhase = 0
    this.charge = 0
    this.throwCooldown = 0
    this.punchCooldown = 0
    this.punchLanded = false      // each jab hits at most once
    this.punchDir = { x: 1, y: 0 }
    this.punchArm = 'L'           // alternates L / R each punch
    this.sinceHit = 99
    this.sprayTimer = 0           // Seed Spitter: time until the next seed
    this.fireTimer = 0.2          // bonfire damage ticks (kept up by level.js)
    this.wallGraceDir = 0         // the side of the wall we can still kick off (see wallGrace)
    this.dustTimer = 0
    this.slipperyLegs = false     // (crouched: see setLegFriction)
    this.respawnTimer = 0
    this.debugRays = []

    this.build()
  }

  build() {
    const { x, y } = this.spawn
    const B = BODY
    const pelvisY = y + CONFIG.player.hoverHeight
    const neckY = pelvisY + B.torsoLen
    const shoulderY = neckY - 0.04
    this.shoulderLocalY = B.torsoLen / 2 - B.shoulderDrop
    this.parts = []

    const addPart = (name, body, halfLen) => {
      body.setUserData({ kind: 'player', player: this, part: name })
      const pos = body.getPosition()
      this.parts.push({ name, body, halfLen, restX: pos.x - x, restY: pos.y - y })
      return body
    }
    const fixtureDef = { density: B.density, friction: BODY_FRICTION, filterGroupIndex: this.group }
    const makeLimb = (name, topY, len) => {
      const body = this.world.createBody({ type: 'dynamic', position: new Vec2(x, topY - len / 2), angularDamping: 1 })
      body.createFixture(new planck.Box(B.limbHalfW, len / 2), fixtureDef)
      return addPart(name, body, len / 2)
    }
    const hinge = (a, b, anchorY, limit) => {
      const def = { enableMotor: true, maxMotorTorque: 1, motorSpeed: 0 }
      if (limit != null) Object.assign(def, { enableLimit: true, lowerAngle: -limit, upperAngle: limit })
      return this.world.createJoint(new planck.RevoluteJoint(def, a, b, new Vec2(x, anchorY)))
    }

    // Parts are created in the order listed in PART_NAMES (snapshots rely on it).
    this.torso = this.world.createBody({ type: 'dynamic', position: new Vec2(x, pelvisY + B.torsoLen / 2) })
    this.torso.createFixture(new planck.Box(B.torsoHalfW, B.torsoLen / 2), fixtureDef)
    addPart('torso', this.torso, B.torsoLen / 2)

    this.head = this.world.createBody({ type: 'dynamic', position: new Vec2(x, neckY + B.headR + 0.03) })
    this.head.createFixture(new planck.Circle(B.headR), fixtureDef)
    addPart('head', this.head, 0)

    const thighL = makeLimb('thighL', pelvisY, B.legSeg)
    const thighR = makeLimb('thighR', pelvisY, B.legSeg)
    this.shinL = makeLimb('shinL', pelvisY - B.legSeg, B.legSeg)
    this.shinR = makeLimb('shinR', pelvisY - B.legSeg, B.legSeg)
    const armL = makeLimb('armL', shoulderY, B.armSeg)
    const armR = makeLimb('armR', shoulderY, B.armSeg)
    this.forearmL = makeLimb('forearmL', shoulderY - B.armSeg, B.armSeg)
    this.forearmR = makeLimb('forearmR', shoulderY - B.armSeg, B.armSeg)

    this.joints = {
      neck: hinge(this.torso, this.head, neckY, 0.6),
      hipL: hinge(this.torso, thighL, pelvisY, 1.9),
      hipR: hinge(this.torso, thighR, pelvisY, 1.9),
      kneeL: hinge(thighL, this.shinL, pelvisY - B.legSeg, 2.3),
      kneeR: hinge(thighR, this.shinR, pelvisY - B.legSeg, 2.3),
      shoulderL: hinge(this.torso, armL, shoulderY, null),
      shoulderR: hinge(this.torso, armR, shoulderY, null),
      elbowL: hinge(armL, this.forearmL, shoulderY - B.armSeg, 2.5),
      elbowR: hinge(armR, this.forearmR, shoulderY - B.armSeg, 2.5),
    }
    this.mass = this.parts.reduce((m, p) => m + p.body.getMass(), 0)
  }

  get stunned() { return this.stunTimer > 0 }   // ragdolled
  get frozen() { return this.frozenTimer > 0 }
  get glued() { return this.gluedTimer > 0 }
  get trapped() { return this.trappedTimer > 0 }
  get stuck() { return this.glued || this.trapped }   // can't walk or jump (glued, or in a Chomper's jaws)
  get floating() { return this.floatTimer > 0 }
  get shoved() { return this.shoveTimer > 0 }
  get helpless() { return this.stunned || this.frozen }   // can't do anything (ragdolled or frozen)
  get canWalk() { return !this.helpless && !this.shoved && !this.stuck }   // (also: slide, hold onto a wall)
  get out() { return this.ko || this.dead }   // out of the round

  // Ghost: passes through everything (while being carried across a map during a pan).
  setGhost(ghost) {
    for (const part of this.parts) {
      for (let f = part.body.getFixtureList(); f; f = f.getNext()) f.setFilterMaskBits(ghost ? 0 : 0xFFFF)
    }
  }

  // Take damage at world point `pos`. Hits add up on the stagger meter (it drains if you go a
  // moment without being hit); reaching CONFIG.damage.staggerAt knocks you into a ragdoll.
  // At 0 health you're knocked out (in practice you just refill). Returns true if staggered/KO'd.
  takeHit(game, damage, stunTime, pos) {
    if (this.ko) return false   // a knocked-out body can be knocked around but takes no damage
    damage = Math.max(1, Math.round(Math.min(damage, this.health)))
    this.health = Math.max(0, this.health - damage)
    this.damageTaken += damage
    game.events.push({ type: 'damage', x: r3(pos.x), y: r3(pos.y + 0.3), amount: damage })
    if (this.health <= 0) {
      const head = this.head.getPosition()
      game.events.push({ type: 'ko', x: r3(head.x), y: r3(head.y + 0.6) })
      if (!game.match) {
        this.health = CONFIG.player.maxHealth   // practice: nobody really dies
      } else {
        this.knockOut(game)
        return true
      }
    }
    this.staggerMeter += damage
    this.sinceHit = 0
    if (this.staggerMeter >= CONFIG.damage.staggerAt) {
      this.staggerMeter = 0
      this.stun(stunTime)
      return true
    }
    this.shoveTimer = CONFIG.damage.shoveTime
    return false
  }

  stun(seconds) {
    this.stunTimer = Math.max(this.stunTimer, seconds)
    this.charging = false
    this.punchTimer = 0
  }

  // Bonked: limp for `limp` s, then back up but dizzy for `dizzy` s more (left and right swapped,
  // swaying about), seeing stars all the while.
  daze(limp, dizzy) {
    this.stun(limp)
    this.dazedTimer = Math.max(this.dazedTimer, limp + dizzy)
  }
  get dazed() { return this.dazedTimer > 0 && !this.ko }
  get dizzy() { return this.dazed && !this.stunned }

  endStun() {
    this.stunTimer = 0
  }

  freeze(seconds) {
    this.frozenTimer = Math.max(this.frozenTimer, seconds)
    this.charging = false
    this.punchTimer = 0
  }

  // A Chomper's jaws: held in place for `seconds` (we can still aim, throw and punch).
  trap(seconds) {
    this.trappedTimer = Math.max(this.trappedTimer, seconds)
  }

  glue(seconds) {
    if (this.grounded) this.gluedTimer = Math.max(this.gluedTimer, seconds)
    else this.pendingGlue = Math.max(this.pendingGlue, seconds)
  }

  float(seconds) {
    this.floatTimer = Math.max(this.floatTimer, seconds)
    this.stun(seconds)
  }

  get handsFull() { return !!this.held }
  // We can pick this up (pickups.js): with empty hands.
  canPick() { return !this.handsFull }

  // What we're holding changes how we move (a Big Gourd is heavy, a Balloon makes you floaty...).
  get carry() {
    return (this.held && PUMPKIN_TYPES[this.held.typeName].carry) || {}
  }

  // fuseLeft: a fused gourd caught while ticking (s left; it keeps ticking in our hand)
  holdPumpkin(typeName, power, ripeness, fuseLeft) {
    this.held = { typeName, power, ripeness, ammo: PUMPKIN_TYPES[typeName].ammo, blocks: 0, fuseLeft }
    this.sprayTimer = 0
  }

  // A ticking gourd in our hand runs out: it goes off right there.
  heldGoesOff(game) {
    const h = this.handPosition(), held = this.held
    this.dropHeld()
    game.events.push({ type: 'splat', x: r3(h.x), y: r3(h.y), typeName: held.typeName, ripeness: held.ripeness, rot: 0 })
    PUMPKIN_TYPES[held.typeName].goOff(game, h.x, h.y, held.power)
  }

  // Where the shoulders are (throws and punches are aimed from here).
  shoulder() {
    return this.torso.getWorldPoint(new Vec2(0, this.shoulderLocalY))
  }

  // The front hand (the one closest to where you're aiming) holds the pumpkin.
  handPosition() {
    const forearm = this.facing > 0 ? this.forearmR : this.forearmL
    return forearm.getWorldPoint(new Vec2(0, -BODY.armSeg / 2))
  }

  // Empty hands: nothing to throw anymore.
  dropHeld() {
    this.held = null
    this.charging = false
  }

  // The body part (if any) within `pad` of `point`.
  partAt(point, pad) {
    for (const part of this.parts) {
      const a = part.body.getWorldPoint(new Vec2(0, part.halfLen))
      const b = part.body.getWorldPoint(new Vec2(0, -part.halfLen))
      if (distToSegment(point, a, b) < partRadius(part) + pad) return part.body
    }
    return null
  }

  // Our shield, if we have one up: { x, y, r, take (it blocked something: what that costs it) }, or
  // null. A held pumpkin whose type has shieldBlocks (a Big Gourd), in the front hand: it takes that
  // many hits, then cracks apart. Not while ragdolled or frozen.
  shield() {
    if (this.dead || this.helpless) return null
    const type = this.held && PUMPKIN_TYPES[this.held.typeName]
    if (!type || !type.shieldBlocks) return null
    const h = this.handPosition()
    return { x: h.x, y: h.y, r: type.radius, take: game => this.crackShield(game, h, type.shieldBlocks) }
  }

  crackShield(game, at, blocks) {
    this.held.blocks = (this.held.blocks || 0) + 1
    if (this.held.blocks < blocks) return
    game.events.push({ type: 'splat', x: r3(at.x), y: r3(at.y), typeName: this.held.typeName, ripeness: this.held.ripeness, rot: 0 })
    this.dropHeld()   // (it may have cracked mid-throw: nothing left to throw)
  }

  // Something at `pos` (radius r, moving along dir) reaches our shield? The shield takes the hit: a
  // small shove, and whatever that costs the shield. Returns true if it blocked.
  tryBlock(game, pos, r, dir) {
    const sh = this.shield()
    if (!sh || Math.hypot(pos.x - sh.x, pos.y - sh.y) > sh.r + r) return false
    launch(this, this.torso, dir.x, dir.y, 2)
    game.events.push({ type: 'block', x: r3(sh.x), y: r3(sh.y) })
    sh.take(game)
    return true
  }

  // --- moving the whole body (every part together) ---
  setVelocity(vx, vy) {
    const v = new Vec2(vx, vy)
    for (const p of this.parts) p.body.setLinearVelocity(v)
  }

  // Pop up: every part goes up at vy (keeping its sideways speed), and the hover spring lets go for
  // lockTime seconds so it doesn't eat the hop. (A jump, a bounce off pitchforks, a hop out of a bonfire.)
  popUp(vy, lockTime) {
    for (const p of this.parts) {
      const v = p.body.getLinearVelocity()
      p.body.setLinearVelocity(new Vec2(v.x, vy))
    }
    this.jumpLock = lockTime
  }

  // Shift the whole body by (dx, dy); every part keeps its angle and speed.
  moveBy(dx, dy) {
    for (const p of this.parts) {
      const q = p.body.getPosition()
      p.body.setTransform(new Vec2(q.x + dx, q.y + dy), p.body.getAngle())
    }
  }

  // Gone for good (left the game): the body is taken out of the world.
  destroy() {
    for (const p of this.parts) this.world.destroyBody(p.body)   // (takes the joints with it)
    this.dead = this.removed = true
    this.dropHeld()
  }

  update(input, dt, game) {
    if (this.dead) return
    const C = CONFIG.player
    const torso = this.torso
    const pos = torso.getPosition()
    const vel = torso.getLinearVelocity()
    const angle = wrapAngle(torso.getAngle())

    // --- timers ---
    this.throwCooldown = Math.max(0, this.throwCooldown - dt)
    this.punchCooldown = Math.max(0, this.punchCooldown - dt)
    this.shoveTimer = Math.max(0, this.shoveTimer - dt)
    this.sinceHit += dt
    if (this.sinceHit > CONFIG.damage.drainDelay) this.staggerMeter = Math.max(0, this.staggerMeter - CONFIG.damage.drainRate * dt)
    this.punchTimer = Math.max(0, this.punchTimer - dt)
    this.frozenTimer = Math.max(0, this.frozenTimer - dt)
    this.gluedTimer = Math.max(0, this.gluedTimer - dt)
    this.trappedTimer = Math.max(0, this.trappedTimer - dt)
    this.floatTimer = Math.max(0, this.floatTimer - dt)
    this.jumpLock = Math.max(0, this.jumpLock - dt)
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt)
    this.dazedTimer = Math.max(0, this.dazedTimer - dt)
    if (this.stunTimer > 0) {
      this.stunTimer -= dt
      this.sinceStun = 0
    } else {
      this.sinceStun += dt
    }
    if (input.ragdoll && !this.prev.ragdoll) this.stun(1.5)
    if (this.held?.fuseLeft !== undefined && (this.held.fuseLeft -= dt) <= 0) this.heldGoesOff(game)   // (caught ticking: see holdPumpkin)
    const canAct = !this.helpless
    const control = !canAct ? 0 : Math.min(1, this.sinceStun / C.recoverTime)
    const carry = this.carry
    this.crouching = !!input.crouch && canAct
    this.lowTimer = this.crouching ? 0.5 : Math.max(0, this.lowTimer - dt)
    this.sitTime = this.crouching && this.grounded ? this.sitTime + dt : 0
    if (this.crouching !== this.slipperyLegs) this.setLegFriction(this.crouching)

    this.aim.x = input.aimX
    this.aim.y = input.aimY
    this.facing = input.aimX >= pos.x ? 1 : -1

    // --- ground check ---
    this.senseGround()
    this.coyote = this.grounded ? C.coyoteTime : Math.max(0, this.coyote - dt)
    if (this.pendingGlue > 0 && this.grounded) { this.gluedTimer = this.pendingGlue; this.pendingGlue = 0 }

    // --- wall check: in the air, holding toward a wall (not right after kicking off one) ---
    const W = C.wall
    const dir = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * (this.dizzy ? -1 : 1)   // (dizzy: the wrong way)
    this.wallJumpTimer = Math.max(0, this.wallJumpTimer - dt)
    const canStick = dir && this.canWalk && !this.crouching && !this.grounded && !this.floating && !this.grapple && this.wallJumpTimer <= 0 &&
      carry.wallStick !== false
    this.wall = canStick ? this.senseWall(dir) : null
    if (this.wall) { this.wallGrace = W.grace; this.wallGraceDir = dir }
    else this.wallGrace = Math.max(0, this.wallGrace - dt)

    // --- sliding: start, stop ---
    this.updateSlide(dt, carry)
    // how far the torso leans back (sliding: away from where we're going; sitting: away from the aim)
    // (dizzy: swaying from side to side)
    const lean = (this.slide ? this.slide.dir * C.slide.lean : this.crouching && this.grounded ? this.facing * C.crouch.lean : 0) +
      (this.dizzy ? Math.sin(this.dazedTimer * C.dizzy.swayRate) * C.dizzy.sway : 0)

    // --- 1. hover spring (crouched: off, so you drop and sit; sliding: on, holding you low) ---
    if (canAct && (!this.crouching || this.slide) && this.groundDist !== null && this.jumpLock <= 0) {
      // (sliding, we look for the ground from the middle of the leaned-back torso: work out the pelvis's height)
      const height = this.slide ? this.groundDist + BODY.torsoLen / 2 * (1 - Math.cos(angle)) : this.groundDist
      const err = (this.slide ? C.slide.height : C.hoverHeight) - height
      const accel = clamp(CONFIG.gravity + C.hoverK * err - C.hoverD * (vel.y - (this.groundVel ? this.groundVel.y : 0)), 0, 5 * CONFIG.gravity)
      const uprightness = 0.3 + 0.7 * Math.max(0, Math.cos(angle - lean))
      torso.applyForceToCenter(new Vec2(0, accel * this.mass * control * uprightness), true)
    }

    // --- crouching: press the body down (crouch.airFall times gravity; with the hover spring off, that
    // sits you down on your butt) ---
    if (this.crouching && !this.slide) {
      for (const p of this.parts) p.body.applyForceToCenter(new Vec2(0, -p.body.getMass() * CONFIG.gravity * (C.crouch.airFall - 1)), true)
    }

    // --- 2. stay upright ---
    if (canAct) {
      const torque = C.uprightInertia * (C.uprightK * (lean - angle) - C.uprightD * torso.getAngularVelocity())
      torso.applyTorque(clamp(torque, -C.uprightMaxTorque, C.uprightMaxTorque) * control, true)
    }

    // --- movement (not while staggered or glued, or for a moment after a shove) ---
    if (this.slide) {
      // sliding: no walking, just slowing down (harder holding the other way), never past a stop
      const s = this.slide.dir
      const along = (this.bodyVx() - (this.groundVel ? this.groundVel.x : 0)) * s
      const decel = Math.min(dir === -s ? C.slide.brake : C.slide.friction, Math.max(0, along) / dt)
      torso.applyForceToCenter(new Vec2(-s * decel * this.mass, 0), true)
    } else if (this.canWalk) {
      const maxAccel = this.grounded ? C.groundAccel : C.airAccel
      const crouchSpeed = this.crouching && this.grounded ? C.crouch.speed : 1
      let targetVx = dir * C.moveSpeed * (carry.speed ?? 1) * crouchSpeed + (this.grounded && this.groundVel ? this.groundVel.x : 0)
      // Walking into a hay bale pushes it: it gets a shove, and we walk along at its speed instead
      // of through it. (Our legs alone would just fold and let us slide up over it.)
      const bale = dir && this.grounded ? this.baleAhead(game, dir, vel.x) : null
      if (bale) {
        const L = CONFIG.level, bv = bale.body.getLinearVelocity().x
        bale.body.applyForceToCenter(new Vec2(dir * L.balePushForce * clamp(1 - bv * dir / L.balePushSpeed, 0, 1), 0), true)
        targetVx = dir > 0 ? Math.min(targetVx, bv) : Math.max(targetVx, bv)
      }
      // (crouched and not walking: hold still harder, or the soft legs pushing on the floor shuffle you along)
      const grip = this.crouching && this.grounded && !dir ? 60 : 10
      let ax = clamp((targetVx - vel.x) * grip, -maxAccel, maxAccel)
      if (!this.grounded && dir === 0) ax *= 0.15   // keep momentum in the air
      // after a slide: going faster than you can run, holding forward (or nothing) doesn't slow you down
      if (this.slideAir && !this.grounded && dir * vel.x >= 0 && Math.abs(vel.x) > C.moveSpeed * (carry.speed ?? 1)) ax = 0
      if (this.wallJumpTimer > 0 && ax * this.wallGraceDir > 0) ax *= 0.15   // (let the kick off a wall happen)
      torso.applyForceToCenter(new Vec2(ax * this.mass * control, 0), true)
    }

    // stuck (glued, or a Chomper's got us): held in place on the floor
    if (this.stuck && this.grounded) {
      for (const p of this.parts) {
        const v = p.body.getLinearVelocity()
        p.body.setLinearVelocity(new Vec2(v.x * 0.5, v.y))
      }
    }

    // floating (hit by a Balloon): drift helplessly upward
    if (this.floating) {
      const lift = CONFIG.gravity + (1.8 - vel.y) * 4
      for (const p of this.parts) p.body.applyForceToCenter(new Vec2(0, p.body.getMass() * lift), true)
    }

    // gliding (holding a Balloon): fall only about 3-4 m/s
    if (carry.glide && canAct && vel.y < -3) {
      torso.applyForceToCenter(new Vec2(0, this.mass * Math.min(1.5 * CONFIG.gravity, (-3 - vel.y) * 40)), true)
    }

    // on a wall: slide down it no faster than wall.slideSpeed (relative to it: a moving platform carries you)
    if (this.wall) {
      const minVy = this.wall.body.getLinearVelocity().y - W.slideSpeed
      for (const p of this.parts) {
        const v = p.body.getLinearVelocity()
        if (v.y < minVy) p.body.setLinearVelocity(new Vec2(v.x, minVy))
      }
      this.dustTimer -= dt
      if (vel.y < minVy + W.slideSpeed - 1 && this.dustTimer <= 0) {   // (sliding, not just touching)
        this.dustTimer = W.dustEvery
        game.events.push({ type: 'dust', x: r3(this.wall.x), y: r3(pos.y - BODY.torsoLen / 2 - 0.5) })
      }
    }

    // --- reeled in by a Vine (overrides walking and the hover spring) ---
    this.updateGrapple(input, dt, game, canAct)

    // --- jump ---
    if (input.jump && !this.prev.jump) this.jumpBufferTimer = C.jumpBuffer
    if (canAct && !this.stuck && this.jumpBufferTimer > 0 && this.coyote > 0) {
      this.popUp(C.jumpSpeed * (carry.jump ?? 1), 0.2)
      this.coyote = 0
      this.jumpBufferTimer = 0
      if (this.slide) { this.slide = null; this.slideAir = true }   // (slide-jump: keeps the slide's speed)
    } else if (canAct && this.jumpBufferTimer > 0 && this.wallGrace > 0 && carry.wallStick !== false) {
      // kick off the wall: up and away from it
      this.setVelocity(-this.wallGraceDir * W.jumpAway, W.jumpUp)
      this.wall = null
      this.wallGrace = 0
      this.wallJumpTimer = W.steerLock
      this.jumpBufferTimer = 0
      this.jumpLock = 0.2
    }

    // --- harvesting ---
    this.updateHarvest(input, dt, game, canAct)

    // --- 3. pose the limbs ---
    this.poseLimbs(game, dt, vel, control)
    if (this.slide) this.updateSlideFoot(dt, game)

    // --- throwing (or punching with empty hands) ---
    if (canAct) {
      const clicked = input.throw && !this.prev.throw
      const heldType = this.held && PUMPKIN_TYPES[this.held.typeName]
      if (heldType && heldType.throwMode === 'spray') {
        this.sprayTimer -= dt
        if (input.throw && this.sprayTimer <= 0) this.fireSeed(game)
      } else if (clicked && this.held && this.throwCooldown <= 0) {
        this.charging = true
        this.charge = 0
      } else if (clicked && !this.handsFull && !this.harvestTarget && this.punchCooldown <= 0) {
        this.startPunch(game)
      }
      if (this.charging) {
        this.charge = Math.min(1, this.charge + dt / CONFIG.throw.chargeTime)
        if (!input.throw) this.throwPumpkin(game)
      }
      if (this.punchTimer > 0 && !this.punchLanded) this.checkPunchHit(game)
    }

    this.prev = { ...input }
  }

  // Crouched, the legs go slippery: however they land, they slide out under you and you sit on your butt.
  setLegFriction(slippery) {
    this.slipperyLegs = slippery
    const friction = slippery ? CONFIG.player.crouch.legFriction : BODY_FRICTION
    for (const { name, body } of this.parts) {
      if (!name.startsWith('thigh') && !name.startsWith('shin')) continue
      body.getFixtureList().setFriction(friction)
      for (let edge = body.getContactList(); edge; edge = edge.next) edge.contact.resetFriction()   // (touching things now)
    }
  }

  // Sliding: crouch while running (or land running, crouch held) and you power slide instead of
  // sitting down. It starts with a small boost (at most once per slide.boostCooldown, never past
  // slide.boostMax), then slows down (see the movement) until you're under slide.endSpeed and just
  // sitting. Let go of crouch to stand up still moving; it also ends if you jump, leave the ground or
  // get hit. Its speed is relative to the ground (a moving platform's own speed doesn't count).
  updateSlide(dt, carry) {
    const S = CONFIG.player.slide
    this.slideBoostTimer = Math.max(0, this.slideBoostTimer - dt)
    this.tripTimer = Math.max(0, this.tripTimer - dt)
    if ((this.grounded && this.jumpLock <= 0) || this.helpless || this.wall || this.grapple) this.slideAir = false
    const sitting = this.crouching && this.grounded
    const speed = this.bodyVx() - (this.groundVel ? this.groundVel.x : 0)
    const able = sitting && this.canWalk && !this.grapple && carry.slide !== false
    if (this.slide) {
      if (this.crouching && !this.grounded) this.slideAir = true   // slid off an edge: keep the speed in the air
      if (!able || speed * this.slide.dir < S.endSpeed) this.slide = null
    } else if (able && !this.wasSitting && Math.abs(speed) >= S.minSpeed) {
      const dir = Math.sign(speed)
      // the leg that's already swung forward leads (the other way, the body drops onto it and folds it back)
      const J = this.joints
      this.slide = { dir, lead: J.hipL.getJointAngle() * dir >= J.hipR.getJointAngle() * dir ? 'L' : 'R', dustTimer: 0 }
      const boost = this.slideBoostTimer > 0 ? 0 : clamp(S.boostMax - Math.abs(speed), 0, S.boost)
      if (boost > 0) {
        for (const p of this.parts) {
          const v = p.body.getLinearVelocity()
          p.body.setLinearVelocity(new Vec2(v.x + dir * boost, v.y))
        }
        this.slideBoostTimer = S.boostCooldown
      }
    }
    this.wasSitting = sitting
  }

  // How fast the whole body is going sideways (the torso's own speed swings around as it leans).
  bodyVx() {
    return this.parts.reduce((sum, p) => sum + p.body.getMass() * p.body.getLinearVelocity().x, 0) / this.mass
  }

  // While sliding: dust off the lead foot, and trip whoever it runs into (a slide tackle).
  updateSlideFoot(dt, game) {
    const S = CONFIG.player.slide
    const foot = this['shin' + this.slide.lead].getWorldPoint(new Vec2(0, -BODY.legSeg / 2))
    this.slide.dustTimer -= dt
    if (this.slide.dustTimer <= 0) {
      this.slide.dustTimer = S.dustEvery
      game.events.push({ type: 'dust', x: r3(foot.x), y: r3(foot.y) })
    }
    for (const other of game.players) {
      if (other === this || other.out || other.stunned || other.tripTimer > 0) continue
      const touching = other.parts.some(part => {
        const a = part.body.getWorldPoint(new Vec2(0, part.halfLen))
        const b = part.body.getWorldPoint(new Vec2(0, -part.halfLen))
        return distToSegment(foot, a, b) < partRadius(part) + BODY.limbHalfW + S.tripReach
      })
      if (touching) this.trip(game, other, foot)
    }
  }

  // Slide tackle: no damage, but their legs get swept out our way, they pop up and go limp for a moment.
  // We lose a bit of speed.
  trip(game, other, at) {
    const S = CONFIG.player.slide
    other.tripped(this.slide.dir, S.tripStun)
    for (const p of this.parts) {
      const v = p.body.getLinearVelocity()
      p.body.setLinearVelocity(new Vec2(v.x * S.tripKeep, v.y))
    }
    game.events.push({ type: 'hit', x: r3(at.x), y: r3(at.y) })
  }

  // Our legs swept out from under us along dir (1 right, -1 left): we pop up and go limp for `stun` s
  // (a slide tackle, a rake...).
  tripped(dir, stun) {
    const S = CONFIG.player.slide
    this.stun(stun)
    this.tripTimer = S.tripImmune
    for (const p of this.parts) {
      const v = p.body.getLinearVelocity()
      const sweep = p.name.startsWith('thigh') || p.name.startsWith('shin') ? dir * S.tripSweep : 0
      p.body.setLinearVelocity(new Vec2(v.x + sweep, Math.max(v.y, S.tripPop)))
    }
  }

  // Vine stuck in `body` at `point`: start reeling in (the spot moves along with a moving platform).
  startGrapple(body, point) {
    const c = this.torso.getPosition(), v = this.torso.getLinearVelocity()
    const dx = point.x - c.x, dy = point.y - c.y, d = Math.hypot(dx, dy) || 1e-6
    const local = body.getLocalPoint(point)
    this.grapple = {
      body, local: new Vec2(local.x, local.y), time: 0, from: d, best: d, stall: 0,
      speed: Math.max(0, (v.x * dx + v.y * dy) / d),   // (picks up from how fast we're already going that way)
    }
  }

  // Where the Vine is stuck right now (world point), or null.
  grapplePoint() {
    return this.grapple ? this.grapple.body.getWorldPoint(this.grapple.local) : null
  }

  // Reel in along a straight line toward the spot. Lets go on arrival (see grapple.reach / stopAt),
  // when something's in the way, after grapple.maxTime, on a jump press, or when hit/stunned.
  updateGrapple(input, dt, game, canAct) {
    const g = this.grapple
    if (!g) return
    const G = PUMPKIN_TYPES.vine.grapple
    const a = this.grapplePoint(), c = this.torso.getPosition()
    const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy) || 1e-6
    g.time += dt
    if (d < g.best - 0.05) { g.best = d; g.stall = 0 } else g.stall += dt   // (not getting closer: blocked)
    const arrived = d <= Math.max(G.stopAt, g.from * (1 - G.reach))
    if (!canAct || game.transition) { this.grapple = null; return }
    if (arrived || g.stall > 0.15 || g.time >= G.maxTime || (input.jump && !this.prev.jump)) {
      this.grapple = null
      const v = this.torso.getLinearVelocity()
      this.setVelocity(v.x * G.keep, v.y * G.keep + G.hop)
      this.jumpLock = 0.2   // (so the hover spring doesn't eat the hop)
      return
    }
    g.speed = Math.min(G.speed, g.speed + G.accel * dt)
    const speed = Math.min(g.speed, d / dt)   // (never past the spot in one step)
    this.setVelocity(dx / d * speed, dy / d * speed)
    this.jumpLock = Math.max(this.jumpLock, 0.1)   // hover spring off while reeling
  }

  startPunch(game) {
    const P = CONFIG.punch
    const shoulder = this.shoulder()
    const dx = this.aim.x - shoulder.x, dy = this.aim.y - shoulder.y
    const d = Math.hypot(dx, dy) || 1
    this.punchDir = { x: dx / d, y: dy / d }
    this.punchArm = this.punchArm === 'L' ? 'R' : 'L'
    this.punchTimer = P.time
    this.punchCooldown = P.cooldown
    this.punchLanded = false
    // small lunge in the punch direction (sideways only, so you can't fly by punching up);
    // not into a hay bale right in front of you, or you'd end up climbing onto it
    if (!this.baleAhead(game, Math.sign(dx), 0)) {
      this.torso.applyLinearImpulse(new Vec2(Math.sign(dx) * P.lunge * this.mass, 0), this.torso.getWorldCenter(), true)
    }
  }

  // Does the punching fist touch any part of another player?
  checkPunchHit(game) {
    const P = CONFIG.punch
    const forearm = this.punchArm === 'L' ? this.forearmL : this.forearmR
    const fist = forearm.getWorldPoint(new Vec2(0, -BODY.armSeg / 2))
    for (const other of game.players) {
      if (other === this || other.dead) continue
      // a carried Big Gourd sits in front of the body, so it gets hit first
      if (other.tryBlock(game, fist, P.reach, this.punchDir)) { this.punchLanded = true; return }
      const part = other.partAt(fist, P.reach)
      if (part) {
        this.punchLanded = true
        applyHit(game, other, part, this.punchDir.x, this.punchDir.y, P.knockback, P.damage, P.stun)
        game.events.push({ type: 'hit', x: r3(fist.x), y: r3(fist.y) })
        return
      }
    }
    const bale = baleAt(game, fist, P.reach)
    if (bale) {
      this.punchLanded = true
      damageBale(game, bale, P.damage * CONFIG.level.balePunchMultiplier)
      const m = bale.body.getMass() * 1.5
      bale.body.applyLinearImpulse(new Vec2(this.punchDir.x * m, this.punchDir.y * m), fist, true)
      game.events.push({ type: 'hit', x: r3(fist.x), y: r3(fist.y) })
    }
  }

  // Instant KO from a hazard. Out for the round in a match; in practice you get back up.
  kill(game) {
    if (this.out) return
    this.health = 0
    const head = this.head.getPosition()
    game.events.push({ type: 'ko', x: r3(head.x), y: r3(head.y + 0.6) })
    this.knockOut(game)
    if (!game.match) this.reviveTimer = 1.2
  }

  // Limp for the rest of the round. A pumpkin in hand is lost (one ticking away drops, still ticking).
  knockOut(game) {
    this.ko = true
    this.stunTimer = Infinity
    if (this.held?.fuseLeft !== undefined) spawnPumpkin(game, this.held.typeName, this.handPosition(), (v => new Vec2(v.x, v.y))(this.torso.getLinearVelocity()), this, this.held)
    this.dropHeld()
    this.harvestTarget = null
    this.harvestProgress = 0
  }

  // A hay bale right in front of us at about knee height, if we're walking into one.
  baleAhead(game, dir, vx) {
    const pelvis = this.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2))
    const reach = 0.22 + Math.abs(vx) * 0.04   // look a bit further ahead when moving fast
    return baleAt(game, { x: pelvis.x + dir * reach, y: pelvis.y - 0.55 }, 0)
  }

  // Hold harvest with empty hands next to something to pick up (see pickups.js).
  updateHarvest(input, dt, game, canAct) {
    this.pickup = canAct && !this.charging ? findPickup(game, this) : null
    const target = input.harvest ? this.pickup : null
    if (target?.key !== this.harvestTarget?.key) this.harvestProgress = 0   // walked away, let go, or switched to another
    this.harvestTarget = target
    if (!target) return
    this.harvestProgress += dt / target.time
    if (this.harvestProgress >= 1) {
      target.take(this)
      this.pickup = this.harvestTarget = null
      this.harvestProgress = 0
    }
  }

  senseGround() {
    const C = CONFIG.player
    // (crouched or just now: we may be sitting on the ground, so look from the middle of the torso)
    const lift = this.lowTimer > 0 ? BODY.torsoLen / 2 : 0
    const origin = this.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2 + lift))   // (the pelvis, normally)
    const len = C.hoverHeight + C.hoverReach + lift
    let best = null, bestBody = null
    this.debugRays = []
    // (two rays, kept inside the body's width: wider and you'd hop up onto any hay bale you walk into)
    for (const ox of [-0.05, 0.05]) {
      const from = new Vec2(origin.x + ox, origin.y)
      const to = new Vec2(origin.x + ox, origin.y - len)
      let hit = null, hitBody = null
      this.world.rayCast(from, to, (fixture, point, normal, fraction) => {
        const ud = fixture.getBody().getUserData()
        // ignore all players (another player's body under you isn't ground; the hover spring
        // would launch you), pumpkins, and hazards (you'd hover over pitchforks instead of landing on them)
        if (ud && ['player', 'pumpkin', 'hazard'].includes(ud.kind)) return -1
        hit = fraction
        hitBody = fixture.getBody()
        return fraction
      })
      if (hit !== null && (best === null || hit * len - lift < best)) { best = hit * len - lift; bestBody = hitBody }
      this.debugRays.push({ from, to, hit: hit !== null })
    }
    this.groundDist = best
    this.grounded = best !== null && best < C.hoverHeight + 0.15
    // standing on a moving platform: we move with it (we hover, so friction can't carry us)
    const ud = bestBody && bestBody.getUserData()
    this.groundVel = ud && ud.mover ? bestBody.getLinearVelocity() : null
  }

  // A wall at our side (dir: -1 left, 1 right) within wall.reach of the torso: the side of a platform,
  // wall or moving platform, facing us. Two rays, chest and hips. Returns { dir, body, x } or null.
  senseWall(dir) {
    const reach = CONFIG.player.wall.reach
    for (const ly of [0.15, -BODY.torsoLen / 2]) {
      const from = this.torso.getWorldPoint(new Vec2(0, ly))
      let found = null
      this.world.rayCast(from, new Vec2(from.x + dir * reach, from.y), (fixture, point, normal, fraction) => {
        const ud = fixture.getBody().getUserData()
        if (!ud || ud.kind !== 'platform' || Math.abs(normal.x) < 0.7) return -1   // (only sides of solid ground)
        found = { dir, body: fixture.getBody(), x: point.x }
        return fraction
      })
      if (found) return found
    }
    return null
  }

  poseLimbs(game, dt, vel, control) {
    const C = CONFIG.player
    const f = this.facing
    const J = this.joints
    let hipL, hipR, kneeL, kneeR
    const speed = Math.abs(vel.x)
    const amt = this.grounded ? Math.min(1, speed / C.moveSpeed) : 0   // how much we're walking (0..1)

    if (this.grounded) {
      this.walkPhase += dt * speed * 2.8
      if (amt < 0.08) {
        hipL = 0.12; hipR = -0.12
        kneeL = kneeR = -0.08 * f
      } else {
        const a = this.walkPhase, b = this.walkPhase + Math.PI
        hipL = 0.75 * amt * Math.sin(a)
        hipR = 0.75 * amt * Math.sin(b)
        kneeL = -f * (0.1 + 1.1 * amt * Math.max(0, Math.cos(a)))
        kneeR = -f * (0.1 + 1.1 * amt * Math.max(0, Math.cos(b)))
      }
    } else if (this.wall) {
      // on a wall (we're pressed right against it): knees out, feet tucked back against it
      const w = this.wall.dir
      hipL = -w * 0.9; kneeL = w * 1.6
      hipR = -w * 0.4; kneeR = w * 0.9
    } else {
      hipL = f * 0.55; hipR = -f * 0.25
      kneeL = -f * 0.9; kneeR = -f * 0.35
    }
    if (this.crouching && this.grounded) {
      // sitting: legs straight out in front, flat on the floor (so we sit on our butt, not on our folded
      // legs; the hips allow for the lean back). After the first moment they go soft: where they end
      // up is up to the physics
      hipL = hipR = f * (Math.PI / 2 - C.crouch.lean)
      kneeL = kneeR = 0
    }
    if (this.slide) {
      // power slide: the lead leg out ahead, knee a little up, heel skimming the floor; the other folded
      // under, knee down and shin flat behind (world angles from straight down, minus the lean back)
      const s = this.slide.dir, lean = C.slide.lean
      const out = [s * (1.2 - lean), -s * 0.2], tuck = [s * (0.35 - lean), -s * 1.9]
      const [l, r] = this.slide.lead === 'L' ? [out, tuck] : [tuck, out]
      hipL = l[0]; kneeL = l[1]
      hipR = r[0]; kneeR = r[1]
    }

    // Both arms point at the aim, like holding the pumpkin with two hands (or reach for what we're
    // picking up). (Angles here are from straight down.)
    const shoulder = this.shoulder()
    const target = this.harvestTarget ? this.harvestTarget.at : this.aim
    const aimAngle = Math.atan2(target.x - shoulder.x, -(target.y - shoulder.y))
    const armTarget = aimAngle - this.torso.getAngle()
    const [frontShoulder, backShoulder] = f > 0 ? [J.shoulderR, J.shoulderL] : [J.shoulderL, J.shoulderR]

    // crouched: everything goes soft (sitting down, the legs first swing out in front at full strength
    // as you drop; sliding stays firm, holding the pose)
    const firm = this.crouching && !this.slide ? C.crouch.firmness : 1
    const legsOut = this.sitTime > 0 && this.sitTime < C.crouch.legsOutTime
    const legT = lerp(C.limpTorque, C.legTorque * (this.slide ? C.slide.legStrength : legsOut ? 1 : firm), control)
    const busyArms = this.handsFull || this.harvestTarget || this.punchTimer > 0   // (arms aiming, reaching or punching stay firm)
    const armT = lerp(C.limpTorque, C.armTorque * (busyArms ? 1 : firm), control)
    const neckT = lerp(C.limpTorque, C.neckTorque * firm, control)
    this.drive(J.hipL, hipL, legT)
    this.drive(J.hipR, hipR, legT)
    this.drive(J.kneeL, kneeL, legT)
    this.drive(J.kneeR, kneeR, legT)
    const [frontElbow, backElbow] = f > 0 ? [J.elbowR, J.elbowL] : [J.elbowL, J.elbowR]
    if (this.harvestTarget || this.handsFull) {
      // straight arms: holding something with both hands / reaching for it
      this.drive(frontShoulder, armTarget, armT)
      this.drive(backShoulder, armTarget - 0.15 * f, armT)
      this.drive(frontElbow, 0, armT)
      this.drive(backElbow, 0, armT)
    } else {
      // Arms relaxed (see relaxedArms). A punch swings one arm straight at the aim.
      const { rest, bend } = this.relaxedArms(C, f, amt)
      for (const side of ['L', 'R']) {
        const jab = this.punchTimer > 0 && this.punchArm === side
        const t = jab ? armT * 3 : armT
        this.drive(J['shoulder' + side], jab ? armTarget : rest[side], t)
        this.drive(J['elbow' + side], jab ? 0 : bend[side], t)
      }
    }
    this.drive(J.neck, 0, neckT)
  }

  // Arms relaxed at the sides, swinging opposite the legs while walking (thrown out a bit in the air;
  // sitting, sliding or on a wall, posed for it): { rest (shoulder), bend (elbow) } angles, by side (L, R).
  relaxedArms(C, f, amt) {
    const front = f > 0 ? 'R' : 'L', back = f > 0 ? 'L' : 'R'
    const rest = { L: -0.6 * amt * Math.sin(this.walkPhase), R: -0.6 * amt * Math.sin(this.walkPhase + Math.PI) }
    if (!this.grounded) { rest[front] = 0.8 * f; rest[back] = -0.5 * f }
    const bend = { L: f * (this.grounded ? 0.2 + 0.4 * amt : 0.5) }
    bend.R = bend.L
    if (this.crouching && this.grounded) {   // sitting: hands forward toward the knees (hanging down, they'd prop us up)
      rest.L = rest.R = f * 1.2
      bend.L = bend.R = f * 0.4
    }
    if (this.slide) {   // power slide: back hand reaching down to skim the floor, front arm forward, ready
      const s = this.slide.dir, lean = C.slide.lean, trail = s > 0 ? 'L' : 'R', front = s > 0 ? 'R' : 'L'
      rest[trail] = -s * (0.5 + lean); bend[trail] = 0
      rest[front] = s * (1.3 - lean); bend[front] = s * 0.8
    }
    if (this.wall) {   // on a wall: one hand up against it, the other out for balance
      const w = this.wall.dir, wallArm = w > 0 ? 'R' : 'L', freeArm = w > 0 ? 'L' : 'R'
      // (straight up, a hair away from the wall: the motor takes the short way round, and the short
      // way to "up along the wall" would swing the arm into the wall)
      rest[wallArm] = -w * 3.05; bend[wallArm] = -w * 0.15
      rest[freeArm] = -w * 1.2; bend[freeArm] = w * 0.5
    }
    return { rest, bend }
  }

  // Joint motor as a spring: spin toward the target angle, with limited strength.
  // While stunned, the motor just resists motion a little (floppy, not chaotic).
  drive(joint, target, torque) {
    if (this.frozen) {   // every joint locks where it is (a stiff statue)
      joint.setMotorSpeed(0)
      joint.setMaxMotorTorque(400)
      return
    }
    // Joints with limits (elbows, knees...) must turn the direct way; wrapping the angle could
    // send them "the short way round" straight into their limit, where they'd get stuck.
    const error = joint.isLimitEnabled() ? target - joint.getJointAngle() : wrapAngle(target - joint.getJointAngle())
    const speed = this.stunned ? 0 : CONFIG.player.jointK * error
    joint.setMotorSpeed(speed)
    joint.setMaxMotorTorque(torque)
  }

  throwPumpkin(game) {
    const T = CONFIG.throw
    const hand = this.handPosition()
    const shoulder = this.shoulder()
    let dx = this.aim.x - shoulder.x, dy = this.aim.y - shoulder.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    const [lo, hi] = throwSpeeds(PUMPKIN_TYPES[this.held.typeName])
    const speed = lerp(lo, hi, this.charge)
    const tv = this.torso.getLinearVelocity()
    const pos = new Vec2(hand.x + dx * 0.15, hand.y + dy * 0.15)
    spawnPumpkin(game, this.held.typeName, pos, new Vec2(dx * speed + tv.x * 0.5, dy * speed + tv.y * 0.5), this, this.held)
    this.dropHeld()
    this.charge = 0
    this.throwCooldown = T.cooldown
  }

  // Seed Spitter: one seed toward the aim (a little spread); the pumpkin is used up when empty.
  fireSeed(game) {
    const type = PUMPKIN_TYPES[this.held.typeName]
    const hand = this.handPosition()
    const shoulder = this.shoulder()
    const a = Math.atan2(this.aim.y - shoulder.y, this.aim.x - shoulder.x) + (Math.random() - 0.5) * 0.12
    const dx = Math.cos(a), dy = Math.sin(a)
    const tv = this.torso.getLinearVelocity()
    const pos = new Vec2(hand.x + dx * 0.15, hand.y + dy * 0.15)
    spawnPumpkin(game, 'seed', pos, new Vec2(dx * type.seedSpeed + tv.x * 0.3, dy * type.seedSpeed + tv.y * 0.3), this, this.held)
    game.events.push({ type: 'spit', typeName: this.held.typeName, ripeness: r3(this.held.ripeness), x: r3(pos.x), y: r3(pos.y), dx: r3(dx), dy: r3(dy) })   // (just for looks: a puff at its mouth)
    this.sprayTimer = type.fireInterval
    if (--this.held.ammo <= 0) this.held = null
  }

  checkDeath(dt, game) {
    if (!this.dead && this.torso.getPosition().y < CONFIG.killY) {
      this.dead = true
      this.respawnTimer = CONFIG.respawnTime
      this.dropHeld()
      this.grapple = null
      if (game.match) this.health = 0
    }
    if (this.reviveTimer > 0) {
      this.reviveTimer -= dt
      if (this.reviveTimer <= 0) this.respawn()
    }
    if (this.dead && !game.match) {   // practice: come back; in a match you're out until the next round
      this.respawnTimer -= dt
      if (this.respawnTimer <= 0) this.respawn()
    }
  }

  respawn() {
    this.dropHeld()
    const { x, y } = this.spawn
    for (const p of this.parts) {
      p.body.setTransform(new Vec2(x + p.restX, y + p.restY), 0)
      p.body.setLinearVelocity(new Vec2(0, 0))
      p.body.setAngularVelocity(0)
      p.body.setAwake(true)
    }
    Object.assign(this, freshLife())
    if (this.slipperyLegs) this.setLegFriction(false)
  }
}
