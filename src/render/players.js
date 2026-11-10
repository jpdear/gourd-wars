// Drawing the stick figures (from snapshot data), plus what they hold and wear, their contact shadows,
// the Vine reeling them in and their sight. Flat and two-tone shaded (see shading.js).
// Colors: each player's own (from the snapshot), PLAYER (palette.js) and the map's shade and shadow.

import { BODY, CONFIG } from '../config.js'
import { BALE, TINE } from '../game/level.js'
import { boomerangPull } from '../game/powers.js'
import { PUMPKIN_TYPES, throwSpeeds } from '../game/pumpkinTypes.js'
import { PART_NAMES } from '../game/snapshot.js'
import { drawDizzyStars, drawPeckingCrow } from './crows.js'
import { PLAYER, UI, shadeOf, shadowOf } from './palette.js'
import { drawHeldPumpkin, drawPumpkin } from './pumpkins.js'
import { drawShaded } from './shading.js'
import { mixHex } from '../util/color.js'
import { lerp } from '../util/math.js'

export const PART_HALF_LEN = {
  torso: BODY.torsoLen / 2, head: 0,
  thighL: BODY.legSeg / 2, thighR: BODY.legSeg / 2, shinL: BODY.legSeg / 2, shinR: BODY.legSeg / 2,
  armL: BODY.armSeg / 2, armR: BODY.armSeg / 2, forearmL: BODY.armSeg / 2, forearmR: BODY.armSeg / 2,
}

// Endpoints of a limb from its [x, y, angle]: [topX, topY, bottomX, bottomY]
export function partEnds(part, halfLen) {
  const [x, y, a] = part
  const dx = -Math.sin(a) * halfLen, dy = Math.cos(a) * halfLen
  return [x + dx, y + dy, x - dx, y - dy]
}

// Where a snapshot player's front hand is: [x, y]
export function handOf(p) {
  const forearm = PART_NAMES.indexOf(p.facing > 0 ? 'forearmR' : 'forearmL')
  const [, , x, y] = partEnds(p.parts[forearm], PART_HALF_LEN.forearmR)
  return [x, y]
}

// A Vine reeling a player in: pulled taut from their hand to where it stuck, with a knot there.
export function drawGrappleVine(ctx, p, X, Y, s) {
  const [hx, hy] = handOf(p), [ax, ay] = p.grapple
  ctx.strokeStyle = PLAYER.grappleVine
  ctx.lineWidth = 0.05 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(X(hx), Y(hy))
  ctx.lineTo(X(ax), Y(ay))
  ctx.stroke()
  ctx.fillStyle = PUMPKIN_TYPES.vine.color
  ctx.beginPath()
  ctx.arc(X(ax), Y(ay), 0.1 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineCap = 'butt'
}

// What a player (from the snapshot) would throw right now, and how it'd fly: { x0, y0 (where it
// starts), dx, dy (which way), speed, gravity, life (s), radius, color, splitAge?, curve? }, or null.
//   a pumpkin   from the hand (a Seed Spitter's: its seeds')
function flightOf(p, aim) {
  const [sx, sy] = partEnds(p.parts[PART_NAMES.indexOf('torso')], PART_HALF_LEN.torso)   // (the shoulders: aimed from there)
  if (p.held) {
    const type = PUMPKIN_TYPES[p.held], flying = type.throwMode === 'spray' ? PUMPKIN_TYPES.seed : type
    const [lo, hi] = throwSpeeds(type), [hx, hy] = handOf(p)
    const d = Math.hypot(aim.x - sx, aim.y - sy) || 1, dx = (aim.x - sx) / d, dy = (aim.y - sy) / d
    return {
      x0: hx + dx * 0.15, y0: hy + dy * 0.15, dx, dy, speed: lerp(lo, hi, p.charge), gravity: CONFIG.gravity * (flying.gravityScale ?? 1),
      life: flying.lifetime || Infinity, radius: flying.radius, color: type.color, splitAge: type.splitAge, curve: type.curve, pierces: type.pierces,
    }
  }
  return null
}

// What a thrown gourd would stop at: boxes { x0, x1, y0, y1 } for platforms and walls, moving
// platforms and hay bales (where this snapshot has them; bales as if upright; not for a gourd that
// pierces them) and pitchfork rows.
function sightObstacles(map, snap, pierces) {
  const box = (x, y, w, h) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 })
  const boxes = map.platforms.map(p => box(p.x, p.y, p.w, p.h))
  map.movers.forEach((m, i) => { const { x, y } = (snap.movers && snap.movers[i]) || m; boxes.push(box(x, y, m.w, m.h)) })
  if (!pierces) for (const { x, y } of snap.bales) boxes.push(box(x, y, BALE.w, BALE.h))
  for (const sp of map.spikes) boxes.push({ x0: sp.x - sp.w / 2, x1: sp.x + sp.w / 2, y0: sp.y, y1: sp.y + TINE.tip })
  return boxes
}

// Your sight (only you see it, when the host has sights on): dots in the colour of what you're
// throwing, each on a paper disc so they show up on any map, along where it would fly if thrown now (so it grows while you charge), fading a little toward
// the far end, up to the first thing it would hit, where it would fizzle (Vine) or split (Gourd
// Cluster), or off screen (a Boomerang: once it's done curving, since it can come back on).
export function drawSight(ctx, p, aim, map, snap, X, Y, s) {
  const flight = flightOf(p, aim)
  if (!flight) return
  const { x0, y0, dx, dy, speed, gravity, life, radius } = flight
  let end = Math.min(life, 4)
  if (flight.splitAge) end = Math.min(end, Math.max(flight.splitAge, dy * speed / gravity))   // (the top of its arc)
  const boxes = sightObstacles(map, snap, flight.pierces)
  const hits = (x, y) => boxes.some(b => x > b.x0 - radius && x < b.x1 + radius && y > b.y0 - radius && y < b.y1 + radius)

  // walk the arc in small steps (~5 cm), keeping a dot every 0.45 m
  const dots = [], dt = 0.05 / Math.max(speed, 1), launch = { x: dx * speed, y: dy * speed }
  let travelled = 0, nextDot = 0.45, x = x0, y = y0, vx = launch.x, vy = launch.y
  for (let t = dt; t <= end; t += dt) {
    const pull = flight.curve ? boomerangPull(flight.curve, launch, t) : null
    vx += (pull ? pull.x : 0) * dt
    vy += (pull ? pull.y : -gravity) * dt   // (a Boomerang's spin holds it up while it curves)
    const px = x, py = y
    x += vx * dt; y += vy * dt
    if (y < -1) break
    const offScreen = x < -1 || x > CONFIG.view.w + 1
    if (offScreen && !pull) break
    if (hits(x, y)) break
    travelled += Math.hypot(x - px, y - py)
    if (travelled >= nextDot && !offScreen) dots.push([x, y])
    if (travelled >= nextDot) nextDot += 0.45
  }
  dots.forEach(([x, y], i) => {
    ctx.globalAlpha = 0.6 * (1 - 0.35 * i / Math.max(dots.length, 1))   // fading a little along the way
    for (const [color, r] of [[UI.paper, 0.095], [flight.color, 0.075]]) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(X(x), Y(y), r * s, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.globalAlpha = 1
}

// Where a part of a snapshot player is: its [x, y, angle] by name.
const part = (p, name) => p.parts[PART_NAMES.indexOf(name)]

// The limbs in the order they're drawn: the far side (away from the viewer: the L parts when facing
// right) first, in a darker shade, then the torso, then the near legs, then the near arms (in front
// of everything, since that's the hand holding things). [part name, near?]
const LIMB_ORDER = side => {
  const far = side > 0 ? 'L' : 'R', near = side > 0 ? 'R' : 'L'
  return [[`thigh${far}`, false], [`shin${far}`, false], [`arm${far}`, false], [`forearm${far}`, false], ['torso', true],
    [`thigh${near}`, true], [`shin${near}`, true], [`arm${near}`, true], [`forearm${near}`, true]]
}

// A flat stick figure (see docs/RESTYLE_PLAN.md 4.4): round-capped limbs, the far ones darker, a round
// head, and two-tone shading in the map's shade tint (theme.shade); the eye (or X eyes while ragdolled)
// and anything it's wearing go on top, unshaded. Frozen: icy with two frost diamonds on the head;
// glued: goo on the feet; floating: carried off by a balloon.
export function drawPlayer(ctx, p, crowned, theme, X, Y, s) {
  const color = p.frozen ? mixHex(p.color, PLAYER.frozenTint, 0.7) : p.color   // frozen: icy
  const far = mixHex(color, '#000000', 0.18)
  const limbs = LIMB_ORDER(p.facing).map(([name, near]) => [partEnds(part(p, name), PART_HALF_LEN[name]), name === 'torso' ? 0.16 : 0.11, near])
  const [hx, hy] = part(p, 'head')
  const figure = (c, one) => {   // (one: everything in that one color, for the silhouette)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (const [[x1, y1, x2, y2], width, near] of limbs) {
      c.strokeStyle = one || (near ? color : far)
      c.lineWidth = width * s
      c.beginPath()
      c.moveTo(X(x1), Y(y1))
      c.lineTo(X(x2), Y(y2))
      c.stroke()
    }
    c.fillStyle = one || color
    c.beginPath()
    c.arc(X(hx), Y(hy), BODY.headR * s, 0, Math.PI * 2)
    c.fill()
  }
  // the box around it: every limb's ends and the head, plus 0.3 m
  const xs = [hx], ys = [hy]
  for (const [[x1, y1, x2, y2]] of limbs) xs.push(x1, x2), ys.push(y1, y2)
  const pad = 0.3 + BODY.headR
  drawShaded(ctx, {
    draw: c => figure(c),
    silhouette: figure,
    details: c => drawFace(c, p, hx, hy, X, Y, s),
    box: [X(Math.min(...xs) - pad), Y(Math.max(...ys) + pad), X(Math.max(...xs) + pad), Y(Math.min(...ys) - pad)],
    shift: 0.04 * s,
    tint: shadeOf(theme),
  })
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'

  if (p.glued) {   // goo blobs on the feet
    ctx.fillStyle = PUMPKIN_TYPES.pie.color
    for (const name of ['shinL', 'shinR']) {
      const [, , fx, fy] = partEnds(part(p, name), PART_HALF_LEN[name])
      ctx.beginPath()
      ctx.ellipse(X(fx), Y(fy), 0.2 * s, 0.1 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (p.floating) {   // a balloon carrying them off
    ctx.strokeStyle = PLAYER.balloonString
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(hx), Y(hy + BODY.headR))
    ctx.lineTo(X(hx), Y(hy + 0.75))
    ctx.stroke()
    drawPumpkin(ctx, X(hx), Y(hy + 0.95), 0.2 * s, 0, PUMPKIN_TYPES.balloon, null, shadeOf(theme))
  }
  if (crowned) drawCrown(ctx, part(p, 'head'), theme, X, Y, s)
  if (p.pecked) drawPeckingCrow(ctx, p, X, Y, s)
  if (p.dazed) drawDizzyStars(ctx, X(hx), Y(hy + 0.3), s)

  if (p.held) drawHeldPumpkin(ctx, p, X, Y, s, shadeOf(theme))
}

// Which way a player looks: toward where they're aiming (p.aim), on the side they face: [angle above
// level (radians, negative = down), and that as a unit [x, y] (world: y up)]. limits: how far the angle
// may go ([down, up]; the eye stops there so it never ends up on the bottom or top of the head).
const EYE_LIMITS = [-25 * Math.PI / 180, 50 * Math.PI / 180]
function lookDir(p, hx, hy, limits = [-Math.PI / 2, Math.PI / 2]) {
  const dx = p.aim ? p.aim[0] - hx : 1, dy = p.aim ? p.aim[1] - hy : 0
  const a = Math.min(limits[1], Math.max(limits[0], Math.atan2(dy, Math.abs(dx) || 1e-6)))
  return [p.facing * Math.cos(a), Math.sin(a)]
}

// The eye: white with a dark pupil, both looking where they aim: the eye moves around the front of the
// head (up to EYE_LIMITS), the pupil to the eye's edge toward the aim itself (so it still looks right
// down when the eye has stopped). White X eyes while ragdolled. Frozen: two frost diamonds too.
function drawFace(ctx, p, hx, hy, X, Y, s) {
  const [ex0, ey0] = lookDir(p, hx, hy, EYE_LIMITS), [lx, ly] = lookDir(p, hx, hy)
  const ex = X(hx + ex0 * 0.065), ey = Y(hy + 0.015 + ey0 * 0.065)
  if (p.stunned) {
    const d = 0.035 * s
    ctx.strokeStyle = PLAYER.eye
    ctx.lineWidth = 0.03 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d)
    ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d)
    ctx.stroke()
    ctx.lineCap = 'butt'
  } else {
    ctx.fillStyle = PLAYER.eye
    ctx.beginPath()
    ctx.arc(ex, ey, 0.05 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PLAYER.pupil
    ctx.beginPath()
    ctx.arc(ex + lx * 0.018 * s, ey - ly * 0.018 * s, 0.026 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  if (p.frozen) {
    ctx.fillStyle = PLAYER.frost
    for (const [back, up, k] of [[0.09, 0.06, 1], [0.04, -0.08, 0.75]]) {   // (on the back of the head, away from the eye; k: size)
      const x = X(hx - p.facing * back), y = Y(hy + up), w = 0.025 * k * s, h = 0.045 * k * s
      ctx.beginPath()
      ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y)
      ctx.fill()
    }
  }
}

// A little gold crown sitting on a head ([x, y, angle]), tilting with it: flat and shaded, with a jewel.
function drawCrown(ctx, head, theme, X, Y, s) {
  const [hx, hy, a] = head
  const ux = -Math.sin(a), uy = Math.cos(a)   // the head's up direction
  const P = (along, up) => [X(hx + ux * up + uy * along), Y(hy + uy * up - ux * along)]
  const base = BODY.headR - 0.02, w = 0.2, h = 0.22
  const pts = [[-w, base], [-w, base + h], [-w / 2, base + h * 0.55], [0, base + h * 1.1], [w / 2, base + h * 0.55], [w, base + h], [w, base]].map(([al, up]) => P(al, up))
  const shape = (c, color) => {
    c.fillStyle = color
    c.beginPath()
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.closePath()
    c.fill()
  }
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), m = 0.1 * s
  drawShaded(ctx, {
    draw: c => shape(c, PLAYER.crown.gold),
    silhouette: shape,
    details: c => {
      const [jx, jy] = P(0, base + h * 0.32)
      c.fillStyle = PLAYER.crown.jewel
      c.beginPath()
      c.arc(jx, jy, 0.035 * s, 0, Math.PI * 2)
      c.fill()
    },
    box: [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m],
    shift: 0.04 * s,
    tint: shadeOf(theme),
  })
}

// Contact shadows: a flat ellipse in the map's shadow color on the floor under everyone standing (alive
// and not ragdolled): on the highest platform top (or moving platform, where it is now) under their
// lowest foot, if that's within 0.12 m below it. Drawn before the players.
export function drawContactShadows(ctx, snap, map, theme, X, Y, s) {
  const floors = map.platforms.map(({ x, y, w, h }) => ({ x0: x - w / 2, x1: x + w / 2, top: y + h / 2 }))
  map.movers.forEach((m, i) => { const { x, y } = (snap.movers && snap.movers[i]) || m; floors.push({ x0: x - m.w / 2, x1: x + m.w / 2, top: y + m.h / 2 }) })
  ctx.fillStyle = shadowOf(theme)
  for (const p of snap.players) {
    if (p.dead || p.stunned) continue
    const feet = ['shinL', 'shinR'].map(name => partEnds(part(p, name), PART_HALF_LEN[name]).slice(2))
    const [fx, fy] = feet[0][1] < feet[1][1] ? feet[0] : feet[1]
    let top = -Infinity
    for (const f of floors) if (fx >= f.x0 && fx <= f.x1 && f.top <= fy + 0.05 && fy - f.top <= 0.12 && f.top > top) top = f.top
    if (top === -Infinity) continue
    const [, , hipX] = partEnds(part(p, 'torso'), PART_HALF_LEN.torso)
    ctx.beginPath()
    ctx.ellipse(X(hipX), Y(top), 0.3 * s, 0.045 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}
