// TITLE ART (the main menu's backdrop picture, browser only)
// A canvas behind the main menu: two big circles and a low mound in a lighter bark, and a few gourds
// sitting near the bottom corners, drawn by the game's own gourd renderer. It doesn't move, so it's
// drawn once and again whenever the window is resized. Where everything goes is in fractions of the
// screen (x of the width, y and sizes of the height), so it keeps its look at any size. The flat bark
// backdrop behind it is the menu's own CSS background; the shapes' color is the --bark-2 token.

import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { drawPumpkin } from '../render/pumpkins.js'

const CIRCLES = [[0.05, 0.05, 0.37], [0.98, 0.73, 0.44]]   // [x, y, radius]
const MOUND = { x: 0.5, y: 1.16, rx: 0.6, ry: 0.25 }        // (an ellipse, mostly below the screen: rx of the width, ry of the height)
const GOURDS = [                                            // [type, x, y, radius, tilt (radians)]
  ['boom', 0.125, 0.85, 0.107, 0.1],
  ['bouncy', 0.23, 0.9, 0.065, -0.15],
  ['classic', 0.87, 0.86, 0.113, -0.08],
  ['bouncy', 0.76, 0.91, 0.06, 0.2],
]

// Makes the canvas (the first thing in root, behind the rest) and keeps it drawn.
export function createTitleArt(root) {
  const canvas = document.createElement('canvas')
  canvas.className = 'menu-art'
  canvas.setAttribute('aria-hidden', 'true')
  root.prepend(canvas)
  const draw = () => {
    const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = getComputedStyle(root).getPropertyValue('--bark-2').trim()
    for (const [x, y, r] of CIRCLES) {
      ctx.beginPath()
      ctx.arc(x * w, y * h, r * h, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.ellipse(MOUND.x * w, MOUND.y * h, MOUND.rx * w, MOUND.ry * h, 0, 0, Math.PI * 2)
    ctx.fill()
    for (const [name, x, y, r, tilt] of GOURDS) {
      const type = PUMPKIN_TYPES[name]
      drawPumpkin(ctx, x * w, y * h, r * h, tilt, type, type.mark)
    }
  }
  draw()
  window.addEventListener('resize', draw)
}
