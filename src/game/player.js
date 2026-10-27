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
import { canHarvest, emptyPatch, patchPower, patchPumpkin, patchRipeness } from './patches.js'
import { tryBlock } from './powers.js'
import { applyHit, spawnPumpkin } from './pumpkins.js'
import { PUMPKIN_TYPES } from './pumpkinTypes.js'
import { clamp, distToSegment, lerp, r3, wrapAngle } from '../util/math.js'

export class Player {
  constructor(world, opts) {
    this.world = world
    this.index = opts.index
    this.name = opts.name
    this.isDummy = false
    this.color = opts.color
    this.spawn = opts.spawn
    this.group = -(opts.index + 1)   // same negative group = limbs never collide with each other
    this.facing = 1
    this.aim = { x: this.spawn.x + 5, y: this.spawn.y + 1.5 }

    this.stunTimer = 0
    this.sinceStun = 99
    this.coyote = 0
    this.jumpBufferTimer = 0
    this.jumpLock = 0
    this.grounded = false
    this.groundDist = null
    this.groundVel = null   // the moving platform's velocity while standing on one
    this.walkPhase = 0
    this.charging = false
    this.charge = 0
    this.throwCooldown = 0
    this.punchTimer = 0           // > 0 while a jab is out
    this.punchCooldown = 0
    this.punchLanded = false      // each jab hits at most once
    this.punchDir = { x: 1, y: 0 }
    this.punchArm = 'L'           // alternates L / R each punch
    this.staggerMeter = 0         // recent damage; reaching CONFIG.damage.staggerAt knocks you down
    this.sinceHit = 99
    this.shoveTimer = 0           // got hit but not staggered: no walking control for a moment
    this.damageTaken = 0          // total this round
    this.health = CONFIG.player.maxHealth
    this.ko = false               // knocked out: limp until the next round
    this.held = null              // { typeName, power, ripeness, ammo?, blocks? } while holding a pumpkin
    this.sprayTimer = 0           // Seed Spitter: time until the next seed
    this.frozenTimer = 0          // Frost: stiff as a statue
    this.gluedTimer = 0           // Splat Pie: stuck to the floor
    this.pendingGlue = 0          // ...hit in the air: sticks when you land
    this.floatTimer = 0           // Balloon: floating helplessly upward
    this.fireTimer = 0.2          // bonfire damage ticks
    this.hopCooldown = 0          // bonfire pop-out
    this.reviveTimer = 0          // practice: back up after a hazard KO
    this.harvestTarget = null     // the patch we're pulling on
    this.harvestProgress = 0      // 0..1
    this.grapple = null           // Vine stuck in the level: { body, local, time, speed, from, best, stall } while reeling in
    this.dead = false
    this.respawnTimer = 0
    this.prev = emptyInput()
    this.debugRays = []

    this.build()
  }

  build() {
    const { x, y } = this.spawn
    const B = BODY
    const pelvisY = y + CONFIG.player.hoverHeight
    const neckY = pelvisY + B.torsoLen
    const shoulderY = neckY - 0.04
    this.shoulderLocalY = B.torsoLen / 2 - 0.04
    this.parts = []

    const addPart = (name, body, halfLen) => {
      body.setUserData({ kind: 'player', player: this, part: name })
      const pos = body.getPosition()
      this.parts.push({ name, body, halfLen, restX: pos.x - x, restY: pos.y - y })
      return body
    }
    const fixtureDef = { density: B.density, friction: 0.3, filterGroupIndex: this.group }
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
    const shinL = makeLimb('shinL', pelvisY - B.legSeg, B.legSeg)
    const shinR = makeLimb('shinR', pelvisY - B.legSeg, B.legSeg)
    const armL = makeLimb('armL', shoulderY, B.armSeg)
    const armR = makeLimb('armR', shoulderY, B.armSeg)
    this.forearmL = makeLimb('forearmL', shoulderY - B.armSeg, B.armSeg)
    this.forearmR = makeLimb('forearmR', shoulderY - B.armSeg, B.armSeg)

    this.joints = {
      neck: hinge(this.torso, this.head, neckY, 0.6),
      hipL: hinge(this.torso, thighL, pelvisY, 1.9),
      hipR: hinge(this.torso, thighR, pelvisY, 1.9),
      kneeL: hinge(thighL, shinL, pelvisY - B.legSeg, 2.3),
      kneeR: hinge(thighR, shinR, pelvisY - B.legSeg, 2.3),
      shoulderL: hinge(this.torso, armL, shoulderY, null),
      shoulderR: hinge(this.torso, armR, shoulderY, null),
      elbowL: hinge(armL, this.forearmL, shoulderY - B.armSeg, 2.5),
      elbowR: hinge(armR, this.forearmR, shoulderY - B.armSeg, 2.5),
    }
    this.mass = this.parts.reduce((m, p) => m + p.body.getMass(), 0)
  }

  get stunned() { return this.stunTimer > 0 }
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
        this.knockOut()
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

  freeze(seconds) {
    this.frozenTimer = Math.max(this.frozenTimer, seconds)
    this.charging = false
    this.punchTimer = 0
  }

  glue(seconds) {
    if (this.grounded) this.gluedTimer = Math.max(this.gluedTimer, seconds)
    else this.pendingGlue = Math.max(this.pendingGlue, seconds)
  }

  float(seconds) {
    this.floatTimer = Math.max(this.floatTimer, seconds)
    this.stun(seconds)
  }

  // Held-pumpkin effects on movement (Big Gourd is heavy, Balloon makes you floaty).
  get carry() { return (this.held && PUMPKIN_TYPES[this.held.typeName].carry) || {} }

  // The front hand (the one closest to where you're aiming) holds the pumpkin.
  handPosition() {
    const forearm = this.facing > 0 ? this.forearmR : this.forearmL
    return forearm.getWorldPoint(new Vec2(0, -BODY.armSeg / 2))
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
    this.floatTimer = Math.max(0, this.floatTimer - dt)
    this.jumpLock = Math.max(0, this.jumpLock - dt)
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt)
    if (this.stunTimer > 0) {
      this.stunTimer -= dt
      this.sinceStun = 0
    } else {
      this.sinceStun += dt
    }
    if (input.ragdoll && !this.prev.ragdoll) this.stun(1.5)
    const frozen = this.frozenTimer > 0
    const stunned = this.stunned || frozen   // can't act
    const control = stunned ? 0 : Math.min(1, this.sinceStun / C.recoverTime)
    const carry = this.carry

    this.aim.x = input.aimX
    this.aim.y = input.aimY
    this.facing = input.aimX >= pos.x ? 1 : -1

    // --- ground check ---
    this.senseGround()
    this.coyote = this.grounded ? C.coyoteTime : Math.max(0, this.coyote - dt)
    if (this.pendingGlue > 0 && this.grounded) { this.gluedTimer = this.pendingGlue; this.pendingGlue = 0 }

    // --- 1. hover spring ---
    if (!stunned && this.groundDist !== null && this.jumpLock <= 0) {
      const err = C.hoverHeight - this.groundDist
      const accel = clamp(CONFIG.gravity + C.hoverK * err - C.hoverD * (vel.y - (this.groundVel ? this.groundVel.y : 0)), 0, 5 * CONFIG.gravity)
      const uprightness = 0.3 + 0.7 * Math.max(0, Math.cos(angle))
      torso.applyForceToCenter(new Vec2(0, accel * this.mass * control * uprightness), true)
    }

    // --- 2. stay upright ---
    if (!stunned) {
      const torque = C.uprightInertia * (C.uprightK * -angle - C.uprightD * torso.getAngularVelocity())
      torso.applyTorque(clamp(torque, -C.uprightMaxTorque, C.uprightMaxTorque) * control, true)
    }

    // --- movement (not while staggered or glued, or for a moment after a shove) ---
    if (!stunned && this.shoveTimer <= 0 && this.gluedTimer <= 0) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
      const maxAccel = this.grounded ? C.groundAccel : C.airAccel
      let targetVx = dir * C.moveSpeed * (carry.speed ?? 1) + (this.grounded && this.groundVel ? this.groundVel.x : 0)
      // Walking into a hay bale pushes it: it gets a shove, and we walk along at its speed instead
      // of through it. (Our legs alone would just fold and let us slide up over it.)
      const bale = dir && this.grounded ? this.baleAhead(game, dir, vel.x) : null
      if (bale) {
        const L = CONFIG.level, bv = bale.body.getLinearVelocity().x
        bale.body.applyForceToCenter(new Vec2(dir * L.balePushForce * clamp(1 - bv * dir / L.balePushSpeed, 0, 1), 0), true)
        targetVx = dir > 0 ? Math.min(targetVx, bv) : Math.max(targetVx, bv)
      }
      let ax = clamp((targetVx - vel.x) * 10, -maxAccel, maxAccel)
      if (!this.grounded && dir === 0) ax *= 0.15   // keep momentum in the air
      torso.applyForceToCenter(new Vec2(ax * this.mass * control, 0), true)
    }

    // glued: held in place on the floor
    if (this.gluedTimer > 0 && this.grounded) {
      for (const p of this.parts) {
        const v = p.body.getLinearVelocity()
        p.body.setLinearVelocity(new Vec2(v.x * 0.5, v.y))
      }
    }

    // floating (hit by a Balloon): drift helplessly upward
    if (this.floatTimer > 0) {
      const lift = CONFIG.gravity + (1.8 - vel.y) * 4
      for (const p of this.parts) p.body.applyForceToCenter(new Vec2(0, p.body.getMass() * lift), true)
    }

    // gliding (holding a Balloon): fall only about 3-4 m/s
    if (carry.glide && !stunned && vel.y < -3) {
      torso.applyForceToCenter(new Vec2(0, this.mass * Math.min(1.5 * CONFIG.gravity, (-3 - vel.y) * 40)), true)
    }

    // --- reeled in by a Vine (overrides walking and the hover spring) ---
    this.updateGrapple(input, dt, game, stunned)

    // --- jump ---
    if (input.jump && !this.prev.jump) this.jumpBufferTimer = C.jumpBuffer
    if (!stunned && this.gluedTimer <= 0 && this.jumpBufferTimer > 0 && this.coyote > 0) {
      for (const p of this.parts) {
        const v = p.body.getLinearVelocity()
        p.body.setLinearVelocity(new Vec2(v.x, C.jumpSpeed * (carry.jump ?? 1)))
      }
      this.coyote = 0
      this.jumpBufferTimer = 0
      this.jumpLock = 0.2
    }

    // --- harvesting ---
    this.updateHarvest(input, dt, game, stunned)

    // --- 3. pose the limbs ---
    this.poseLimbs(dt, vel, control)

    // --- throwing (or punching with empty hands) ---
    if (!stunned) {
      const clicked = input.throw && !this.prev.throw
      const heldType = this.held && PUMPKIN_TYPES[this.held.typeName]
      if (heldType && heldType.throwMode === 'spray') {
        this.sprayTimer -= dt
        if (input.throw && this.sprayTimer <= 0) this.fireSeed(game)
      } else if (clicked && this.held && this.throwCooldown <= 0) {
        this.charging = true
        this.charge = 0
      } else if (clicked && !this.held && !this.harvestTarget && this.punchCooldown <= 0) {
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
  updateGrapple(input, dt, game, stunned) {
    const g = this.grapple
    if (!g) return
    const G = PUMPKIN_TYPES.vine.grapple
    const a = this.grapplePoint(), c = this.torso.getPosition()
    const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy) || 1e-6
    g.time += dt
    if (d < g.best - 0.05) { g.best = d; g.stall = 0 } else g.stall += dt   // (not getting closer: blocked)
    const arrived = d <= Math.max(G.stopAt, g.from * (1 - G.reach))
    if (stunned || game.transition) { this.grapple = null; return }
    if (arrived || g.stall > 0.15 || g.time >= G.maxTime || (input.jump && !this.prev.jump)) {
      this.grapple = null
      const v = this.torso.getLinearVelocity()
      const out = new Vec2(v.x * G.keep, v.y * G.keep + G.hop)
      for (const p of this.parts) p.body.setLinearVelocity(out)
      this.jumpLock = 0.2   // (so the hover spring doesn't eat the hop)
      return
    }
    g.speed = Math.min(G.speed, g.speed + G.accel * dt)
    const speed = Math.min(g.speed, d / dt)   // (never past the spot in one step)
    const v = new Vec2(dx / d * speed, dy / d * speed)
    for (const p of this.parts) p.body.setLinearVelocity(v)
    this.jumpLock = Math.max(this.jumpLock, 0.1)   // hover spring off while reeling
  }

  startPunch(game) {
    const P = CONFIG.punch
    const shoulder = this.torso.getWorldPoint(new Vec2(0, this.shoulderLocalY))
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
      if (tryBlock(game, other, fist, P.reach, this.punchDir)) { this.punchLanded = true; return }
      for (const part of other.parts) {
        const radius = part.name === 'head' ? BODY.headR : part.name === 'torso' ? BODY.torsoHalfW : BODY.limbHalfW
        const a = part.body.getWorldPoint(new Vec2(0, part.halfLen))
        const b = part.body.getWorldPoint(new Vec2(0, -part.halfLen))
        if (distToSegment(fist, a, b) < radius + P.reach) {
          this.punchLanded = true
          applyHit(game, other, part.body, this.punchDir.x, this.punchDir.y, P.knockback, P.damage, P.stun)
          game.events.push({ type: 'hit', x: r3(fist.x), y: r3(fist.y) })
          return
        }
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
    this.knockOut()
    if (!game.match) this.reviveTimer = 1.2
  }

  knockOut() {
    this.ko = true
    this.stunTimer = Infinity   // limp for the rest of the round
    this.held = null
    this.charging = false
    this.harvestTarget = null
    this.harvestProgress = 0
  }

  // A hay bale right in front of us at about knee height, if we're walking into one.
  baleAhead(game, dir, vx) {
    const pelvis = this.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2))
    const reach = 0.22 + Math.abs(vx) * 0.04   // look a bit further ahead when moving fast
    return baleAt(game, { x: pelvis.x + dir * reach, y: pelvis.y - 0.55 }, 0)
  }

  // Hold harvest next to a patch with empty hands to pick its pumpkin.
  updateHarvest(input, dt, game, stunned) {
    const target = !stunned && input.harvest && !this.held && !this.charging ? this.findPatch(game) : null
    if (target !== this.harvestTarget) this.harvestProgress = 0   // walked away, let go, or switched patch
    this.harvestTarget = target
    if (!target) return
    this.harvestProgress += dt / CONFIG.patch.harvestTime
    if (this.harvestProgress >= 1) {
      const type = PUMPKIN_TYPES[target.typeName]
      this.held = { typeName: target.typeName, power: patchPower(target), ripeness: patchRipeness(target), ammo: type.ammo, blocks: 0 }
      this.sprayTimer = 0
      emptyPatch(target)
      this.harvestTarget = null
      this.harvestProgress = 0
    }
  }

  findPatch(game) {
    const pelvis = this.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2))
    let best = null
    let bestDx = CONFIG.patch.reach
    for (const patch of game.patches) {
      const dx = Math.abs(pelvis.x - patch.x), dy = pelvis.y - patch.y
      if (canHarvest(patch) && dx < bestDx && dy > 0 && dy < 1.6) { best = patch; bestDx = dx }
    }
    return best
  }

  senseGround() {
    const C = CONFIG.player
    const pelvis = this.torso.getWorldPoint(new Vec2(0, -BODY.torsoLen / 2))
    const len = C.hoverHeight + C.hoverReach
    let best = null, bestBody = null
    this.debugRays = []
    // (two rays, kept inside the body's width: wider and you'd hop up onto any hay bale you walk into)
    for (const ox of [-0.05, 0.05]) {
      const from = new Vec2(pelvis.x + ox, pelvis.y)
      const to = new Vec2(pelvis.x + ox, pelvis.y - len)
      let hit = null, hitBody = null
      this.world.rayCast(from, to, (fixture, point, normal, fraction) => {
        const ud = fixture.getBody().getUserData()
        // ignore all players (another player's body under you isn't ground; the hover spring
        // would launch you), pumpkins, and hazards (you'd hover over pitchforks instead of landing on them)
        if (ud && (ud.kind === 'player' || ud.kind === 'pumpkin' || ud.kind === 'hazard')) return -1
        hit = fraction
        hitBody = fixture.getBody()
        return fraction
      })
      if (hit !== null && (best === null || hit * len < best)) { best = hit * len; bestBody = hitBody }
      this.debugRays.push({ from, to, hit: hit !== null })
    }
    this.groundDist = best
    this.grounded = best !== null && best < C.hoverHeight + 0.15
    // standing on a moving platform: we move with it (we hover, so friction can't carry us)
    const ud = bestBody && bestBody.getUserData()
    this.groundVel = ud && ud.mover ? bestBody.getLinearVelocity() : null
  }

  poseLimbs(dt, vel, control) {
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
    } else {
      hipL = f * 0.55; hipR = -f * 0.25
      kneeL = -f * 0.9; kneeR = -f * 0.35
    }

    // Both arms point at the aim, like holding the pumpkin with two hands
    // (or reach down to the pumpkin we're harvesting).
    const shoulder = this.torso.getWorldPoint(new Vec2(0, this.shoulderLocalY))
    const target = this.harvestTarget ? patchPumpkin(this.harvestTarget) : this.aim
    const aimAngle = Math.atan2(target.x - shoulder.x, -(target.y - shoulder.y))
    const armTarget = aimAngle - this.torso.getAngle()
    const [frontShoulder, backShoulder] = f > 0 ? [J.shoulderR, J.shoulderL] : [J.shoulderL, J.shoulderR]

    const legT = lerp(C.limpTorque, C.legTorque, control)
    const armT = lerp(C.limpTorque, C.armTorque, control)
    const neckT = lerp(C.limpTorque, C.neckTorque, control)
    this.drive(J.hipL, hipL, legT)
    this.drive(J.hipR, hipR, legT)
    this.drive(J.kneeL, kneeL, legT)
    this.drive(J.kneeR, kneeR, legT)
    const [frontElbow, backElbow] = f > 0 ? [J.elbowR, J.elbowL] : [J.elbowL, J.elbowR]
    if (this.held || this.harvestTarget) {
      // straight arms: holding the pumpkin with both hands / reaching for one
      this.drive(frontShoulder, armTarget, armT)
      this.drive(backShoulder, armTarget - 0.15 * f, armT)
      this.drive(frontElbow, 0, armT)
      this.drive(backElbow, 0, armT)
    } else {
      // Arms relaxed at the sides, swinging opposite the legs while walking
      // (thrown out a bit in the air). A punch swings one arm straight at the aim.
      const front = f > 0 ? 'R' : 'L', back = f > 0 ? 'L' : 'R'
      const rest = { L: -0.6 * amt * Math.sin(this.walkPhase), R: -0.6 * amt * Math.sin(this.walkPhase + Math.PI) }
      if (!this.grounded) { rest[front] = 0.8 * f; rest[back] = -0.5 * f }
      const elbowBend = f * (this.grounded ? 0.2 + 0.4 * amt : 0.5)
      for (const side of ['L', 'R']) {
        const jab = this.punchTimer > 0 && this.punchArm === side
        const t = jab ? armT * 3 : armT
        this.drive(J['shoulder' + side], jab ? armTarget : rest[side], t)
        this.drive(J['elbow' + side], jab ? 0 : elbowBend, t)
      }
    }
    this.drive(J.neck, 0, neckT)
  }

  // Joint motor as a spring: spin toward the target angle, with limited strength.
  // While stunned, the motor just resists motion a little (floppy, not chaotic).
  drive(joint, target, torque) {
    if (this.frozenTimer > 0) {   // frozen: every joint locks where it is (a stiff statue)
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
    const shoulder = this.torso.getWorldPoint(new Vec2(0, this.shoulderLocalY))
    let dx = this.aim.x - shoulder.x, dy = this.aim.y - shoulder.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    const type = PUMPKIN_TYPES[this.held.typeName]
    const [lo, hi] = type.throwMode === 'lob' ? type.lobSpeed : type.throwSpeed ? [type.throwSpeed.min, type.throwSpeed.max] : [T.minSpeed, T.maxSpeed]
    const speed = lerp(lo, hi, this.charge)
    const tv = this.torso.getLinearVelocity()
    const pos = new Vec2(hand.x + dx * 0.15, hand.y + dy * 0.15)
    spawnPumpkin(game, this.held.typeName, pos, new Vec2(dx * speed + tv.x * 0.5, dy * speed + tv.y * 0.5), this, this.held)
    this.held = null
    this.charging = false
    this.charge = 0
    this.throwCooldown = T.cooldown
  }

  // Seed Spitter: one seed toward the aim (a little spread); the pumpkin is used up when empty.
  fireSeed(game) {
    const type = PUMPKIN_TYPES[this.held.typeName]
    const hand = this.handPosition()
    const shoulder = this.torso.getWorldPoint(new Vec2(0, this.shoulderLocalY))
    const a = Math.atan2(this.aim.y - shoulder.y, this.aim.x - shoulder.x) + (Math.random() - 0.5) * 0.12
    const dx = Math.cos(a), dy = Math.sin(a)
    const tv = this.torso.getLinearVelocity()
    const pos = new Vec2(hand.x + dx * 0.15, hand.y + dy * 0.15)
    spawnPumpkin(game, 'seed', pos, new Vec2(dx * type.seedSpeed + tv.x * 0.3, dy * type.seedSpeed + tv.y * 0.3), this, this.held)
    this.sprayTimer = type.fireInterval
    if (--this.held.ammo <= 0) this.held = null
  }

  checkDeath(dt, game) {
    if (!this.dead && this.torso.getPosition().y < CONFIG.killY) {
      this.dead = true
      this.respawnTimer = CONFIG.respawnTime
      this.held = null
      this.grapple = null
      this.charging = false
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
    const { x, y } = this.spawn
    for (const p of this.parts) {
      p.body.setTransform(new Vec2(x + p.restX, y + p.restY), 0)
      p.body.setLinearVelocity(new Vec2(0, 0))
      p.body.setAngularVelocity(0)
      p.body.setAwake(true)
    }
    this.dead = false
    this.stunTimer = 0
    this.sinceStun = 99
    this.staggerMeter = 0
    this.shoveTimer = 0
    this.health = CONFIG.player.maxHealth
    this.ko = false
    this.damageTaken = 0
    this.charging = false
    this.punchTimer = 0
    this.held = null
    this.frozenTimer = 0
    this.gluedTimer = 0
    this.pendingGlue = 0
    this.floatTimer = 0
    this.reviveTimer = 0
    this.hopCooldown = 0
    this.grapple = null
    this.harvestTarget = null
    this.harvestProgress = 0
  }
}
