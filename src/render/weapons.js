// Drawing melee weapons (from snapshot data): in someone's hands, or lying loose in the level.
// How each type looks is in LOOKS, by type name.

import { WEAPON_TYPES } from '../game/weaponTypes.js'

// Each look draws the tool lying along +x from its grip (at 0, 0), in pixels (s per meter).
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
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// A weapon with its grip at world (x, y), pointing along angle (butt → head).
export function drawWeapon(ctx, typeName, x, y, angle, X, Y, s) {
  ctx.save()
  ctx.translate(X(x), Y(y))
  ctx.rotate(-angle)   // (the canvas's y points down)
  LOOKS[typeName](ctx, WEAPON_TYPES[typeName], s)
  ctx.restore()
}

// One lying loose (w: from snapshot.weapons).
export function drawLooseWeapon(ctx, w, X, Y, s) {
  drawWeapon(ctx, w.typeName, w.x, w.y, w.angle, X, Y, s)
}

// The one a player (from the snapshot) is holding.
export function drawHeldWeapon(ctx, p, X, Y, s) {
  const [typeName, x, y, angle] = p.weapon
  drawWeapon(ctx, typeName, x, y, angle, X, Y, s)
}
