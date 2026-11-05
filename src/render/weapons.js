// Drawing melee weapons (from snapshot data): in someone's hands, or lying loose in the level.
// How each type looks is in LOOKS, by type name.

import { WEAPON_TYPES } from '../game/weaponTypes.js'

// Each look draws the tool in its own frame (see A WEAPON'S SHAPE in weaponTypes.js), in pixels (s per
// meter): lying along +x from its grip at (0, 0), +y to its left (up, when it points right), its
// lopsided head (if any) toward -y. (Mirrored for its side by drawWeapon.)
const LOOKS = {
  pitchfork: (ctx, type, s) => {
    const neck = type.length - type.grip - type.blade   // where the handle meets the metal
    ctx.lineCap = 'round'
    ctx.strokeStyle = type.color   // the wooden handle
    ctx.lineWidth = 0.06 * s
    line(ctx, -type.grip * s, 0, neck * s, 0)
    ctx.strokeStyle = type.metal   // the socket, the crossbar and three tines
    ctx.lineWidth = 0.045 * s
    line(ctx, (neck - 0.1) * s, 0, neck * s, 0)
    ctx.lineWidth = 0.035 * s
    line(ctx, neck * s, -0.11 * s, neck * s, 0.11 * s)
    ctx.lineWidth = 0.028 * s
    for (const side of [-0.1, 0, 0.1]) line(ctx, neck * s, side * s, (neck + type.blade) * s, side * s)
    ctx.lineCap = 'butt'
  },
  shovel: (ctx, type, s) => {
    const neck = type.length - type.grip - type.blade, tip = type.length - type.grip, w = type.headWidth / 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = type.color   // the handle, with a D grip on the end
    ctx.lineWidth = 0.055 * s
    line(ctx, -type.grip * s, 0, (neck - 0.04) * s, 0)
    ctx.lineWidth = 0.035 * s
    ctx.beginPath()
    ctx.moveTo(-type.grip * s, -0.07 * s)
    ctx.lineTo(-type.grip * s, 0.07 * s)
    ctx.lineTo((-type.grip - 0.12) * s, 0.06 * s)
    ctx.lineTo((-type.grip - 0.12) * s, -0.06 * s)
    ctx.closePath()
    ctx.stroke()
    ctx.strokeStyle = type.metal   // the socket up the handle
    ctx.lineWidth = 0.05 * s
    line(ctx, (neck - 0.12) * s, 0, neck * s, 0)
    // the blade: a spade, square at the top with a rounded point, a ridge down the middle
    ctx.fillStyle = type.metal
    ctx.beginPath()
    ctx.moveTo(neck * s, -w * s)
    ctx.lineTo((tip - 0.1) * s, -w * s)
    ctx.quadraticCurveTo(tip * s, -w * 0.7 * s, tip * s, 0)
    ctx.quadraticCurveTo(tip * s, w * 0.7 * s, (tip - 0.1) * s, w * s)
    ctx.lineTo(neck * s, w * s)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#5c646b'
    ctx.lineWidth = 0.012 * s
    ctx.stroke()
    line(ctx, neck * s, 0, (tip - 0.06) * s, 0)
    ctx.lineCap = 'butt'
  },
  scythe: (ctx, type, s) => {
    const end = type.length - type.grip   // (the top of the snath)
    ctx.lineCap = 'round'
    ctx.strokeStyle = type.color   // the snath, bowing a little, and the nib (the front hand's handle) sticking up off it
    ctx.lineWidth = 0.055 * s
    ctx.beginPath()
    ctx.moveTo(-type.grip * s, 0)
    ctx.quadraticCurveTo(end * 0.5 * s, 0.07 * s, end * s, 0)
    ctx.stroke()
    ctx.lineWidth = 0.04 * s
    line(ctx, type.handGap * s, 0.04 * s, (type.handGap + 0.03) * s, 0.17 * s)
    ctx.strokeStyle = '#5b5f63'   // the collar holding the blade on
    ctx.lineWidth = 0.07 * s
    line(ctx, (end - 0.07) * s, 0, end * s, 0)
    // the blade: a long thin crescent, down off the end and curving back toward you, its edge on the inside
    const [px, py] = type.head.point
    ctx.fillStyle = type.metal
    ctx.beginPath()
    ctx.moveTo((end + 0.04) * s, 0.03 * s)                                                        // the heel, at the snath
    ctx.quadraticCurveTo((end + 0.06) * s, (py * 0.6) * s, px * s, py * s)                        // the back, out to the point
    ctx.quadraticCurveTo((end - 0.05) * s, (py * 0.45) * s, (end - 0.03) * s, -0.06 * s)           // the edge, back up inside
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#dfe5ea'   // a bright line along the sharp edge
    ctx.lineWidth = 0.012 * s
    ctx.beginPath()
    ctx.moveTo((end - 0.03) * s, -0.07 * s)
    ctx.quadraticCurveTo((end - 0.04) * s, (py * 0.45) * s, (px + 0.02) * s, (py + 0.03) * s)
    ctx.stroke()
    ctx.lineCap = 'butt'
  },
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// A weapon with its grip at world (x, y), pointing along angle (butt → head), its head on `side`.
export function drawWeapon(ctx, typeName, x, y, angle, side, X, Y, s) {
  ctx.save()
  ctx.translate(X(x), Y(y))
  ctx.rotate(-angle)       // (the canvas's y points down...)
  ctx.scale(1, -side)      // (...so +y is the tool's left; mirrored for side -1)
  LOOKS[typeName](ctx, WEAPON_TYPES[typeName], s)
  ctx.restore()
}

// One lying loose (w: from snapshot.weapons).
export function drawLooseWeapon(ctx, w, X, Y, s) {
  drawWeapon(ctx, w.typeName, w.x, w.y, w.angle, w.side, X, Y, s)
}

// The one a player (from the snapshot) is holding.
export function drawHeldWeapon(ctx, p, X, Y, s) {
  const [typeName, x, y, angle, , side] = p.weapon
  drawWeapon(ctx, typeName, x, y, angle, side, X, Y, s)
}
