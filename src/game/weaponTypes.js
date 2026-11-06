// Every melee weapon (farm tools that drop from the sky): each one's numbers, and its shape (shared by
// one in someone's hands, weapons.js, and one lying loose or thrown, looseWeapons.js). Like a pumpkin,
// a weapon takes your hands.
//   name, colors              how it looks (its shape is in render/weapons.js)
//   uses                      how many times it can connect (a hit, a bale, a pumpkin, a wall...)
//                             before it snaps. A swing uses at most one, however much it hits.
//   carry                     while held: { speed, jump } multipliers, wallStick: false, slide: false
//                             (same as a pumpkin's carry)
//   length, grip              the whole tool, and how far up from the butt end the back hand holds it (m)
//   handGap                   the front hand: this much further up the handle (m)
//   hold                      held, the grip (the back hand) rests this far out from the chest along the tool
//                             (m; negative: pulled back beside the body, leaving the arms room to push it out)
//   blade, headWidth          a head straight on the end (what hits things): the last `blade` m of the tool,
//                             this wide. Or, for any other head:
//   head                      { shape (a convex outline), edge (points along what cuts), point (what goes into
//                             things first: falling, it's lowest) }: in the tool's frame (see A WEAPON'S SHAPE)
//   bladeRadius               how close a pumpkin or a shield has to be to the edge to count (m)
//   bats                      { speed, reach, grace }: instead of cutting a thrown pumpkin, an attack bats it
//                             along your aim (at least `speed` m/s), and it's yours now. Any of the tool bats
//                             (the handle too), from `reach` m further off than bladeRadius, and for `grace`
//                             s after the swing's gone past
//   heft                      its weight:
//     mass                    lying loose or thrown, its mass (kg; a player is about 2.2)
//     turn                    held, how quickly it eases round to a new aim (a spring's rate, 1/s: it's most
//                             of the way there in 3/turn s; lower feels heavier).
//                             (In a swing it goes exactly where the swing takes it: see weapons.js)
//   tap                       a quick click:
//     motion                  how it moves (see MOTIONS in weapons.js), and its numbers:
//       reach                 (thrust) how far the arms push the tool out along the aim (m; with handGap and
//                             hold, the front hand mustn't end up past arm's length: ~0.65 m out from the chest)
//       arc, windup, follow   (reap) the same swing every time, wherever you aim: raised to `arc` degrees
//                             back from the aim in the first `windup` of the swing, then brought down
//                             to the aim and `follow` rad past it
//       turns                 (whirl) how many times it goes all the way round you
//     time, cooldown          how long the swing takes, and the wait after it before the next (s)
//     lunge                   { speed, time }: you lunge along the aim (sideways) at this speed (m/s) for this long (s)
//     damage, knockback, stun a hit (staggers at CONFIG.damage.staggerAt; stun = ragdoll time if it does)
//     knock                   which way a hit knocks them (see KNOCK in weapons.js; default: the way the blade's going)
//     fullLaunch              a hit always launches them at full knockback (not just when it staggers them)
//     ghost                   the tool passes through the level during it (walls, floors...): nothing to clank on
//     cost                    uses it costs if it touches anything (default 1)
//   charge                    keep holding after the tap, and let go once fully charged: the same as a tap, plus
//     chargeTime              how long to hold (from the press) until it's fully charged (s)
//     guard                   { angle, out, up, r }: while charging it's held up out in front, `angle` (rad)
//                             above the way you face, its grip `out` m forward and `up` m up from the chest,
//                             its head a shield there (r m round it; see Player.shield): it blocks like a Big
//                             Gourd, each block costing a use
//     grab                    the first one it hits is caught on the blade, helpless:
//       time                  ...carried for at most this long (s; a click flings them sooner)
//       carrySpeed            ...slowing you down this much (× your speed)
//       fling                 { speed, damage, stun }: then flung off it toward the aim
//   throw                     Throw Weapon (hold, let go): it flies point first, or spinning (see looseWeapons.js)
//     chargeTime              how long to hold for a full-power throw (s)
//     speed                   [a tap, a full charge] (m/s)
//     gravityScale            how much gravity pulls on it in flight (low: nearly straight)
//     spin                    it flies spinning this fast (rad/s; else point first)
//     damage, stun, cost      hitting someone (damage at full power: less on a weaker throw); the uses
//                             a throw that hits anything costs (a miss is free)
//     knockback               a hit knocks them along its flight this hard (m/s, at full power)
//     through                 it goes on through people and hay bales (hitting each once) instead of stopping
//     daze                    whoever it hits is knocked limp this long (s), stars circling their head
//     rebound                 it bounces back off whoever it hits
//     impale                  the one it hits is carried along on it: { carrySlow (it keeps this share
//                             of its speed), pin (s: stuck in a wall with them on it, pinned there this long) }
//     peg                     stuck in the side of something, it's a solid peg to stand on (until pulled out)

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { BODY } from '../config.js'
import { SPAWN_RATES } from './pumpkinTypes.js'

export const WEAPON_TYPES = {
  pitchfork: {
    name: 'Pitchfork', color: '#9a6a3a', metal: '#8d949c', uses: 8,
    carry: {},
    length: 1.6, grip: 0.15, handGap: 0.38, hold: -0.05, blade: 0.4, headWidth: 0.24, bladeRadius: 0.1,   // (the tines reach ~1–1.4 m out; a thrust: ~2.8 m from where you started)
    heft: { mass: 0.4, turn: 35 },   // (light: quick to come round to a new aim)
    tap: { motion: 'thrust', time: 0.3, cooldown: 0.25, reach: 0.3, lunge: { speed: 9, time: 0.2 }, damage: 12, knockback: 7, stun: 0.8 },
    charge: {   // Skewer: hoisted overhead on the tines, then flung
      motion: 'thrust', chargeTime: 0.7, time: 0.35, cooldown: 0.3, reach: 0.3, lunge: { speed: 10, time: 0.22 }, cost: 2,
      damage: 5, knockback: 7, stun: 0.8,
      grab: { time: 0.75, carrySpeed: 0.6, fling: { speed: 18, damage: 10, stun: 1 } },
    },
    throw: {   // Javelin
      chargeTime: 0.6, speed: [16, 25], gravityScale: 0.35, damage: 20, stun: 1, cost: 2,
      impale: { carrySlow: 0.75, pin: 1 }, peg: true,
    },
  },
  scythe: {
    name: 'Scythe', color: '#8a6238', metal: '#9aa3ab', uses: 6,
    carry: { speed: 0.85, jump: 0.9, wallStick: false },   // (heavy: no holding onto walls)
    length: 1.75, grip: 0.1, handGap: 0.5, hold: -0.05, bladeRadius: 0.12,
    head: {   // the blade: off the end of the snath, hanging down (facing right) and curving back toward you
      shape: [[1.69, 0.03], [1.69, -0.11], [1.38, -0.74], [1.29, -0.67]],
      edge: [[1.62, -0.12], [1.53, -0.34], [1.44, -0.55], [1.35, -0.72]],
      point: [1.33, -0.74],
    },
    heft: { mass: 0.4, turn: 20 },   // (heavy: slow to come round to a new aim)
    tap: {   // Reap: raised up above your head, then brought down at the aim; it hooks whoever it catches toward you
      motion: 'reap', time: 0.5, cooldown: 0.35, arc: 100, windup: 0.45, follow: 0.35,
      damage: 15, knockback: 6, stun: 0.8, knock: 'toward',
    },
    charge: {   // Whirl: one full turn round you (through the floor and walls), flinging everyone it catches away
      motion: 'whirl', chargeTime: 0.9, time: 0.5, cooldown: 0.4, turns: 1, ghost: true, cost: 2,
      damage: 21, knockback: 6, stun: 1, knock: 'away',
    },
    throw: {   // Buzzsaw: flat and spinning, through everyone in its way, until it buries itself in the level
      chargeTime: 0.6, speed: [12, 20], gravityScale: 0.3, spin: 22, damage: 20, stun: 0.8, knockback: 8, cost: 2,
      through: true,
    },
  },
  shovel: {
    name: 'Shovel', color: '#8f6a43', metal: '#7d868f', uses: 7,
    carry: { speed: 0.95 },
    length: 1.4, grip: 0.08, handGap: 0.42, hold: -0.05, blade: 0.34, headWidth: 0.26, bladeRadius: 0.15,
    bats: { speed: 20, reach: 0.15, grace: 0.1 },   // (it doesn't cut pumpkins: it bats them)
    heft: { mass: 0.5, turn: 26 },
    tap: {   // Smack: raised up over your head and brought down flat on them, launching them along your aim
      motion: 'reap', time: 0.4, cooldown: 0.3, arc: 110, windup: 0.45, follow: 0.35,
      damage: 10, knockback: 7.5, stun: 0.8, knock: 'aim', fullLaunch: true,
    },
    charge: {   // Home Run: held up in front as a shield while you wind up; then a huge smack
      motion: 'reap', chargeTime: 0.8, guard: { angle: 1.22, out: 0.35, up: -0.3, r: 0.4 }, time: 0.45, cooldown: 0.45, arc: 140, windup: 0.4, follow: 0.35, cost: 2,
      damage: 20, knockback: 15, stun: 1.2, knock: 'aim', fullLaunch: true,
    },
    throw: {   // Bonk: end over end; whoever it hits is knocked limp, and it bounces off them
      chargeTime: 0.6, speed: [12, 20], gravityScale: 0.6, spin: 16, damage: 18, stun: 1.2, daze: 1.2, cost: 2,
      rebound: true,
    },
  },
}
export const WEAPON_TYPE_NAMES = Object.keys(WEAPON_TYPES)   // index = type code in snapshots

// ---------------------------------------------------------------------
// A WEAPON'S SHAPE — in the tool's frame: its grip (where the back hand holds it) at (0, 0), +x up the
// handle toward the head, +y to its left. A head that isn't the same both sides (a scythe's blade) is
// drawn hanging down when you face right; `side` (1, or -1: mirrored) flips it over the handle, so it
// hangs down facing either way.
// ---------------------------------------------------------------------

const SHAFT = 0.03   // half the handle's thickness (m)
export const DOWN = -Math.PI / 2

// A point `along` m up the tool from its grip at `grip`, the tool pointing along `angle` (negative: toward the butt end).
export function alongTool(grip, angle, along) {
  return { x: grip.x + Math.cos(angle) * along, y: grip.y + Math.sin(angle) * along }
}

// A point [x, y] in the tool's frame, out in the world: the grip at `grip`, pointing along `angle`, on `side`.
export function toWorld(grip, angle, side, [x, y]) {
  const c = Math.cos(angle), s = Math.sin(angle)
  return { x: grip.x + c * x - s * y * side, y: grip.y + s * x + c * y * side }
}

// Its head, in the tool's frame (side 1): { shape, edge, point, neck (where the handle ends: m up from
// the grip), lopsided (not the same both sides) }. A head straight on the end is worked out from blade
// and headWidth.
const heads = new Map()
export function headOf(type) {
  if (heads.has(type)) return heads.get(type)
  const tip = type.length - type.grip
  let head
  if (type.head) {
    const outer = Math.max(...type.head.shape.map(p => p[0]))   // (the handle runs on up into the head)
    head = { ...type.head, neck: Math.min(tip, outer - 0.05), lopsided: true }
  } else {
    const neck = tip - type.blade, w = type.headWidth / 2
    head = {
      shape: [[neck, -w], [tip, -w], [tip, w], [neck, w]],
      edge: [[neck, 0], [neck + type.blade / 2, 0], [tip, 0]],
      point: [tip, 0], neck, lopsided: false,
    }
  }
  heads.set(type, head)
  return head
}

// Where its point is (what goes into things first): the grip at `grip`, pointing along `angle`, on `side`.
export const pointOf = (type, grip, angle, side) => toWorld(grip, angle, side, headOf(type).point)
// The angle it falls at (and hangs from a crow's feet at): its point straight down under the grip.
export function fallAngle(type, side) {
  const [x, y] = headOf(type).point
  return DOWN - Math.atan2(y * side, x)
}

// Give `body` (its origin at the grip, its +x up the tool) the weapon's shape on `side`: the handle, from
// the butt to the head, and the head, `mass` kg between them. Returns the head's fixture (the blade).
export function addWeaponFixtures(body, type, mass, def, side = 1) {
  const head = headOf(type), outline = head.shape.map(([x, y]) => new Vec2(x, y * side))
  const shaft = head.neck + type.grip
  const area = shaft * 2 * SHAFT + polygonArea(outline)
  const fixture = { density: mass / area, friction: 0.4, ...def }
  body.createFixture(new planck.Box(shaft / 2, SHAFT, new Vec2((head.neck - type.grip) / 2, 0), 0), fixture)
  return body.createFixture(new planck.Polygon(outline), fixture)
}

// ---------------------------------------------------------------------
// IN SOMEONE'S HANDS — the back hand at the grip, the front one handGap further up the handle. Both
// the game (posing the arms) and the drawing (drawing them) use these, so they agree.
// ---------------------------------------------------------------------

const REACH = 2 * BODY.armSeg * 0.98   // (a hand can be this far from its shoulder: the arm just short of straight)

// Where the hands go on a tool with its grip at `grip`, pointing along `angle`, held by someone whose
// shoulder is at `shoulder`: { back, front }. Each slides along the handle as far as it has to to stay in
// arm's reach, so the hands never come off it.
export function heldHands(type, grip, angle, shoulder) {
  const wx = grip.x - shoulder.x, wy = grip.y - shoulder.y
  const b = wx * Math.cos(angle) + wy * Math.sin(angle), disc = b * b - (wx * wx + wy * wy - REACH * REACH)
  const lo = disc >= 0 ? -b - Math.sqrt(disc) : -b, hi = disc >= 0 ? -b + Math.sqrt(disc) : -b   // (the stretch of handle in reach)
  const on = t => alongTool(grip, angle, Math.min(hi, Math.max(lo, t)))
  return { back: on(0), front: on(type.handGap) }
}

// An arm from `shoulder` reaching for `hand` (out of reach: as near as it gets), for someone facing f
// (1 right, -1 left): { elbow, hand }. The elbow bends below the line to the hand when it's out ahead,
// and sticks out behind when it's in by the chest.
export function armTo(shoulder, hand, f) {
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, seg = BODY.armSeg
  const toHand = Math.atan2(dy, dx), lift = Math.acos(Math.min(1, Math.hypot(dx, dy) / (2 * seg)))
  const upper = toHand - f * lift, fore = toHand + f * lift
  const elbow = { x: shoulder.x + Math.cos(upper) * seg, y: shoulder.y + Math.sin(upper) * seg }
  return { elbow, hand: { x: elbow.x + Math.cos(fore) * seg, y: elbow.y + Math.sin(fore) * seg } }
}

function polygonArea(ps) {
  let a = 0
  for (let i = 0; i < ps.length; i++) { const p = ps[i], q = ps[(i + 1) % ps.length]; a += p.x * q.y - q.x * p.y }
  return Math.abs(a) / 2
}

// Which weapons crows bring, and how often: the host's choice (also used in practice; see app/settings.js).
//   drops   how often a crow comes: one of DROP_RATES (the times are CONFIG.crow.every)
//   types   each weapon: { on, rate } (rate: how likely it's the one a crow brings, weighted like the
//           pumpkins' rarities: SPAWN_RATES)
export const DROP_RATES = ['off', 'rare', 'normal', 'often']
export const DROP_RATE_LABELS = { off: 'Off', rare: 'Rare', normal: 'Normal', often: 'Often' }
export const defaultWeaponSettings = () => ({
  drops: 'normal',
  types: Object.fromEntries(WEAPON_TYPE_NAMES.map(k => [k, { on: true, rate: 'normal' }])),
})

// Weighted random pick among the weapons that are on (null if they're all off).
export function pickWeaponType(settings) {
  const options = WEAPON_TYPE_NAMES.filter(k => settings.types[k] && settings.types[k].on)
  const weight = k => SPAWN_RATES[settings.types[k].rate] || 0
  let r = Math.random() * options.reduce((sum, k) => sum + weight(k), 0)
  for (const k of options) if ((r -= weight(k)) < 0) return k
  return options[options.length - 1] ?? null
}
