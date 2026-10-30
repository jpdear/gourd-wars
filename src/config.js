// CONFIG — tweak numbers here to change how the game feels

export const CONFIG = {
  gravity: 30,               // m/s² downward (real life is 9.8, games feel better snappier)
  dt: 1 / 60,                // fixed physics step
  view: { w: 32, h: 18 },    // meters visible on screen
  killY: -3,                 // fall below this = dead
  respawnTime: 1.0,
  player: {
    moveSpeed: 7,            // m/s
    groundAccel: 70,         // how fast you reach moveSpeed on the ground
    airAccel: 35,            // ...and in the air
    jumpSpeed: 16,
    coyoteTime: 0.1,         // can still jump this long after walking off a ledge
    jumpBuffer: 0.1,         // jump pressed this long before landing still counts
    hoverHeight: 0.93,       // pelvis height above ground when standing
    hoverReach: 0.4,         // the hover spring catches you within this much extra distance
    hoverK: 180,             // hover spring stiffness
    hoverD: 22,              // hover spring damping
    uprightK: 120,           // how hard the torso tries to stay vertical
    uprightD: 18,
    uprightInertia: 0.6,
    uprightMaxTorque: 50,
    jointK: 15,              // joint motor speed per radian of error
    legTorque: 8,
    armTorque: 4.5,
    neckTorque: 3,
    limpTorque: 0.25,        // joint stiffness while ragdolled (0 = totally floppy)
    recoverTime: 0.4,        // seconds to ramp back to full control after a stun
    maxHealth: 50,           // a full-power ripe pumpkin does 25, a punch 5
    wall: {                  // in the air, hold toward a wall to slide down it; jump to kick off
      reach: 0.5,            // how close (torso center to the wall) counts as touching it
      slideSpeed: 2.5,       // fastest you slide down (m/s)
      grace: 0.12,           // a jump this long after letting go still kicks off the wall
      jumpUp: 12,            // the kick off: up...
      jumpAway: 4,           // ...and away from the wall (m/s)
      steerLock: 0.2,        // after a kick off, steering back toward the wall is weak this long
      dustEvery: 0.08,       // a puff of dust this often while sliding (s)
    },
    crouch: {                // hold down: go soft and press your body down (on the ground: drop onto your butt)
      lean: 0.5,             // sitting: lean back this far, away from your aim (radians; 0.5 ≈ 30°)
      airFall: 1.5,          // the press down: fall this many times as fast
      firmness: 0.3,         // joint motor strength while crouched (1 = normal): legs, head and free arms go floppy
      speed: 0.5,            // scooting along while sitting (share of moveSpeed; dragging your butt slows it more)
      legsOutTime: 0.5,      // sitting down: the legs swing out in front at full strength this long
      legFriction: 0,        // crouched, the legs are this slippery (normal: 0.3), so they slide out and you sit on your butt
    },
    slide: {                 // crouch while running: power slide, low, keeping your speed (jump out of it to keep it in the air)
      minSpeed: 5.5,         // going at least this fast (m/s, along the ground) when you sit down = a slide instead
      boost: 4,              // starting a slide adds this much speed (m/s)...
      boostMax: 11,          // ...but never pushes you past this...
      boostCooldown: 1,      // ...and only once this often (s); a slide in between just keeps your speed
      friction: 8,           // slowing down while sliding (m/s²)
      brake: 30,             // ...holding the other way
      endSpeed: 3,           // slower than this and the slide's over: you're sitting (if still crouched)
      height: 0.45,          // pelvis height while sliding (standing: hoverHeight)
      lean: 0.8,             // lean back this far, away from where you're sliding (radians; 0.8 ≈ 46°)
      legStrength: 4,        // leg motors this many times as strong (swinging the lead leg out before you land on it)
      dustEvery: 0.04,       // a puff of dust off the lead foot this often (s)
      tripReach: 0.1,        // the lead foot trips anyone it gets this close to (m)...
      tripStun: 0.6,         // ...no damage, but they go limp this long...
      tripPop: 5,            // ...popped up (m/s)...
      tripSweep: 5,          // ...legs swept out your way (m/s)
      tripKeep: 0.7,         // tripping someone, you keep this share of your speed
      tripImmune: 1,         // can't be tripped again for this long (s)
    },
  },
  throw: { minSpeed: 14, maxSpeed: 26, chargeTime: 0.7, cooldown: 0.35 },
  punch: {                   // click with empty hands (alternates arms)
    time: 0.2,               // how long the punch lasts
    cooldown: 0.2,
    reach: 0.24,             // extra hit distance around the fist
    knockback: 4.5,          // push speed (m/s) given to whoever gets hit
    damage: 5,               // 4 quick punches stagger
    stun: 0.6,               // ragdoll time if a punch is the hit that staggers
    lunge: 2,                // small forward push on the puncher (m/s)
  },
  match: {
    slowMo: 0.25,            // game speed after a round's last knockout
    lastStandingGrace: 0.5,  // (real s) if the other player also goes down in this window, it's a draw
    roundOverTime: 1.8,      // (real s) slow motion + "Blue wins!", then the pan to the next map
    transitionTime: 1.5,     // the pan to the next map, carrying players to their spawns
    matchOverTime: 5,        // "Blue wins the match!" before a new match starts
  },
  damage: {
    staggerAt: 20,           // stagger meter value that knocks you into a ragdoll
    drainDelay: 0.4,         // seconds after a hit before the meter starts draining
    drainRate: 40,           // meter drain per second
    shoveTime: 0.15,         // hit too small to stagger: no walking control for this long
    shoveScale: 0.4,         // ...and only this fraction of the knockback
  },
  level: {
    baleHealth: 100,         // a ripe Classic does 25
    balePunchMultiplier: 3,  // punches do 3x damage to bales (about 4 punches)
    baleBlastMultiplier: 5,  // blasts do 5x damage to bales (a close one wrecks it)
    balePushForce: 270,      // walking into a bale shoves it with this force (N)...
    balePushSpeed: 3.5,      // ...fading out as it approaches this speed (it settles around 2 m/s)
    fireDps: 15,             // bonfire damage per second (dealt in small ticks)
    fireHop: 10,             // m/s pop out of the flames
    spikeDamage: 25,         // touching pitchforks (health is 50: two touches knock you out)
    spikeCooldown: 0.5,      // ...then no more pitchfork damage for this long, however many tines you touch
    spikeBounce: 12,         // m/s pop up off the tines
    scytheTurnTime: 3,       // seconds per full turn of a scarecrow's scythe
  },
  patch: {
    growTime: 4,             // seconds from sprout to ripe
    ripeTime: 8,             // how long it stays ripe before rotting
    rotTime: 2,              // rotten for this long, then it pops
    regrowTime: 2,           // empty for about this long before a new sprout (±25%)
    harvestTime: 0.15,       // hold E this long to pick it
    reach: 1.1,              // how close (sideways) you need to be
    minGrowth: 0.2,          // tiny sprouts can't be picked yet
    greenPower: [0.4, 0.75], // power of a green pumpkin, from just-pickable to almost ripe
  },
}

// Stick figure proportions (meters)
export const BODY = {
  legSeg: 0.45, armSeg: 0.34, torsoLen: 0.62, headR: 0.17,
  limbHalfW: 0.055, torsoHalfW: 0.09, density: 4,
}

// Up to 4 players, each in a slot (0 = the host). The slot picks the color, spawn and score.
export const MAX_PLAYERS = 4
export const PLAYER_COLORS = ['#2b6cff', '#e8384f', '#1fa35c', '#e0a800']
export const PLAYER_COLOR_NAMES = ['Blue', 'Red', 'Green', 'Yellow']   // "Blue wins!"
