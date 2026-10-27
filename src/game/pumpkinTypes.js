// Every pumpkin type. Numbers are at full power (a fast, ripe throw); throwing softer or
// picking it green scales damage and knockback down.
//   name, color, rib, mark   how it looks (mark = extra decoration, see drawPumpkin)
//   radius, density, restitution, friction, gravityScale
//   damage, knockback, stun  a hit (staggers at CONFIG.damage.staggerAt; stun = ragdoll time if it does)
//   refSpeed                 impact speed that counts as full power (default CONFIG.throw.maxSpeed)
//   breakAfterHits           breaks after touching anything that isn't a player this many times
//   breakOnPlayer            breaks when it hits a player (otherwise it can hit them again after 0.4 s)
//   solidToPlayers           physically bounces off players (others pass through after hitting)
//   lifetime                 pops after this many seconds in the air (fizzle: quietly, no splat)
//   throwMode                'throw' (charge & release), 'lob' (short and slow), 'spray' (hold to fire seeds)
//   throwSpeed               { min, max }: a quick tap → a full charge (default CONFIG.throw minSpeed/maxSpeed)
//   aimLine                  while held, shows its owner a faint dotted line of where it'll go
//   spawnable                can grow on patches (seeds and cluster pieces can't)
//   carry                    while held: { speed, jump } multipliers, glide, wallStick: false = too heavy to hold onto walls
// Optional hooks (see powers.js):
//   onHitPlayer(game, pk, player, part, vel)   replaces the normal hit
//   onHitBale(game, pk, bale, vel)             hit a hay bale (instead of onHitWorld)
//   onHitWorld(game, pk, body)                 touched something else that isn't a player
//   onBreak(game, pk)                          when it breaks
//   update(game, pk, dt)                       every step while flying

import { freezeBale } from './level.js'
import { explode, splitCluster, vineYankBale, vineYankOwner, vineYankPlayer } from './powers.js'
import { knockback } from './pumpkins.js'
import { r3 } from '../util/math.js'

export const PUMPKIN_TYPES = {
  classic: {
    name: 'Classic', color: '#f28c28', rib: '#c4630f',
    radius: 0.22, density: 2, restitution: 0.2,
    damage: 25, knockback: 6.5, stun: 0.9, breakAfterHits: 1, breakOnPlayer: true,
  },
  bouncy: {
    name: 'Bouncy', color: '#ffb84a', rib: '#d98a1c', mark: 'bands',
    radius: 0.2, density: 1.5, restitution: 0.85,
    damage: 15, knockback: 6, stun: 0.6, breakAfterHits: 4, breakOnPlayer: true,
  },
  boom: {
    name: "Jack-o'-Boom", color: '#e2571b', rib: '#8c2f0b', mark: 'fuse',
    radius: 0.22, density: 2, restitution: 0.1,
    damage: 0, knockback: 0, stun: 0, breakAfterHits: 1, breakOnPlayer: true,
    blast: { radius: 2.5, damage: 40, knockback: 30, stun: 1.2 },   // everyone in the blast goes ragdoll
    // a direct hit is lethal (practice: the dummy just refills); then it explodes as usual
    onHitPlayer: (game, pk, player, part) => player.takeHit(game, Infinity, pk.type.blast.stun, part.getPosition()),
    onBreak: (game, pk) => { const p = pk.body.getPosition(); explode(game, p.x, p.y, pk.type.blast, pk.power) },
  },
  cluster: {
    name: 'Gourd Cluster', color: '#d6a03a', rib: '#8f6a1f', mark: 'cluster',
    radius: 0.24, density: 2, restitution: 0.2,
    damage: 10, knockback: 5, stun: 0.6, breakAfterHits: 1, breakOnPlayer: true,
    update: (game, pk) => { if (pk.age > 0.12 && pk.body.getLinearVelocity().y <= 0) splitCluster(game, pk) },
  },
  mini: {   // the 3 pieces of a Gourd Cluster
    name: 'Mini', color: '#d6a03a', rib: '#8f6a1f', spawnable: false,
    radius: 0.12, density: 2, restitution: 0.2,
    damage: 10, knockback: 4.5, stun: 0.5, breakAfterHits: 1, breakOnPlayer: true,
  },
  squash: {
    name: 'Squash Ball', color: '#e8d24a', rib: '#b39a1c', mark: 'stripe',
    radius: 0.17, density: 1.2, restitution: 0.95, friction: 0,
    damage: 10, knockback: 5, stun: 0.6, breakAfterHits: Infinity, breakOnPlayer: false, lifetime: 4,
    solidToPlayers: true,   // bounces off people instead of passing through
  },
  frost: {
    name: 'Frost', color: '#9fd8f0', rib: '#5aa9cc', mark: 'ice',
    radius: 0.22, density: 2, restitution: 0.2,
    damage: 8, knockback: 3, stun: 0.6, breakAfterHits: 1, breakOnPlayer: true, freeze: 2, baleFreeze: 3,
    onHitBale: (game, pk, bale) => freezeBale(bale, pk.type.baleFreeze),   // a slippery ice block
    onHitPlayer: (game, pk, player, part, vel) => {
      knockback(game, player, part, pk, vel)
      player.freeze(pk.type.freeze)
      const p = player.torso.getPosition()
      game.events.push({ type: 'freeze', x: r3(p.x), y: r3(p.y) })
    },
  },
  pie: {
    name: 'Splat Pie', color: '#f3dfb0', rib: '#c79a54', mark: 'pie',
    radius: 0.22, density: 2, restitution: 0.1,
    damage: 8, knockback: 2, stun: 0.6, breakAfterHits: 1, breakOnPlayer: true, glue: 1.5, baleGoo: 5,
    onHitBale: (game, pk, bale) => { bale.stickyTimer = pk.type.baleGoo },   // gooey: glues whoever touches it
    onHitPlayer: (game, pk, player, part, vel) => { knockback(game, player, part, pk, vel); player.glue(pk.type.glue) },
  },
  vine: {   // shot more than thrown: fast and nearly straight, ~19 m on a tap, ~23 m charged
    name: 'Vine', color: '#5fae3c', rib: '#3c7a22', mark: 'vine',
    radius: 0.2, density: 1.5, restitution: 0, gravityScale: 0.25,
    damage: 5, knockback: 0, stun: 0.5, breakAfterHits: 1, breakOnPlayer: true, lifetime: 0.55, fizzle: true,
    throwSpeed: { min: 34, max: 42 }, aimLine: true,
    yankSpeed: 20, yankLift: 5,   // hits a player or a bale: it flies toward you this fast (+ lift upward)
    // hits the level: you're reeled in toward where it stuck (see Player.updateGrapple in player.js)
    //   speed, accel   reel speed (m/s) and how fast it gets there
    //   reach          how much of the way you're pulled (1 = all the way)
    //   stopAt         ...stopping this close to the spot (m)
    //   maxTime        lets go after this long no matter what
    //   keep, hop      when it lets go: the share of your speed you keep, plus a hop up (m/s)
    grapple: { speed: 22, accel: 120, reach: 1, stopAt: 0.7, maxTime: 0.7, keep: 0.35, hop: 11 },   // (hop 11: enough to climb onto a ledge you grabbed the side of)
    onHitPlayer: (game, pk, player, part) => vineYankPlayer(game, pk, player, part),
    onHitWorld: (game, pk, body) => vineYankOwner(game, pk, body),
    onHitBale: (game, pk, bale) => vineYankBale(game, pk, bale),
  },
  biggourd: {
    name: 'Big Gourd', color: '#d9b25c', rib: '#9c7a2e', mark: 'gourd',
    radius: 0.38, density: 2.5, restitution: 0, refSpeed: 11,
    damage: 35, knockback: 10, stun: 1.2, breakAfterHits: 1, breakOnPlayer: true,   // smashes on the first thing it hits
    throwMode: 'lob', lobSpeed: [5, 11], carry: { speed: 0.55, jump: 0.7, wallStick: false }, shieldBlocks: 3,
  },
  spitter: {
    name: 'Seed Spitter', color: '#a8c94a', rib: '#6f8f2a', mark: 'speckle',
    radius: 0.22, density: 2, restitution: 0.2,
    damage: 0, knockback: 0, stun: 0, breakAfterHits: 1, breakOnPlayer: true,
    throwMode: 'spray', ammo: 15, fireInterval: 0.06, seedSpeed: 32,
  },
  seed: {   // fired by the Seed Spitter
    name: 'Seed', color: '#3d2f14', rib: '#fff6dc', mark: 'seed', spawnable: false,
    radius: 0.07, density: 1, restitution: 0, gravityScale: 0.35, refSpeed: 22,
    damage: 2, knockback: 2.6, stun: 0.5, breakAfterHits: 1, breakOnPlayer: true,   // small pushes add up fast
  },
  balloon: {
    name: 'Balloon Gourd', color: '#c7a8e8', rib: '#8e6cc0', mark: 'string',
    radius: 0.22, density: 0.6, restitution: 0.3, gravityScale: 0.35, refSpeed: 14,
    damage: 3, knockback: 1, stun: 0.6, breakAfterHits: 1, breakOnPlayer: true, float: 2,
    onHitBale: (game, pk, bale) => { bale.floatTimer = pk.type.float },
    carry: { jump: 1.25, glide: true },
    onHitPlayer: (game, pk, player, part, vel) => { knockback(game, player, part, pk, vel); player.float(pk.type.float) },
  },
}
export const PUMPKIN_TYPE_NAMES = Object.keys(PUMPKIN_TYPES)   // index = type code in snapshots
export const SPAWNABLE_TYPES = PUMPKIN_TYPE_NAMES.filter(k => PUMPKIN_TYPES[k].spawnable !== false)

// How often each type grows (host setting): relative weights.
export const SPAWN_RATES = { common: 20, normal: 5, rare: 1 }
export const defaultSpawnSettings = () =>
  Object.fromEntries(SPAWNABLE_TYPES.map(k => [k, { on: true, rate: k === 'classic' ? 'common' : 'rare' }]))

// Weighted random pick among the enabled types (Classic if everything is off).
export function pickPumpkinType(settings) {
  const options = SPAWNABLE_TYPES.filter(k => settings[k] && settings[k].on)
  if (!options.length) return 'classic'
  const weight = k => SPAWN_RATES[settings[k].rate] || 0
  let r = Math.random() * options.reduce((sum, k) => sum + weight(k), 0)
  for (const k of options) {
    r -= weight(k)
    if (r < 0) return k
  }
  return options[options.length - 1]
}
