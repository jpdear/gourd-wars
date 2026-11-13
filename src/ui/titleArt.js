// TITLE ART (the backdrop picture behind the out-of-game menus, and the main menu's logo; browser only)
// A canvas behind the menu card: two big circles and a low mound in a lighter bark, a few gourds sitting
// near the bottom corners (drawn, and two-tone shaded in a tint made from the backdrop, by the game's own
// gourd renderer: they bob gently and the Jack-o'-Boom's fuse sparks), and the "Gourd Wars" logo with
// its intro (see titleLogo.js), which plays once per page load, the first time the main menu shows.
//
// It shows behind every out-of-game ("solid") menu screen: the main menu, Play, Settings from there, the
// map editor list, ...; the logo only on the main menu (the other screens have a card with their title
// there). It's redrawn every frame while it shows, and not at all otherwise. With reduced
// motion on, nothing moves: it's drawn once (and on resize) with the logo already finished.
// Where everything goes is in fractions of the screen (x of the width, y and sizes of the height), so it
// keeps its look at any size. The flat bark backdrop behind it is the menu's own CSS background; the
// shapes' color is the --bark-2 token.

import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { drawPumpkin } from '../render/pumpkins.js'
import { font } from '../render/palette.js'
import { mixHex } from '../util/color.js'
import { LOGO_SETTLED, drawTitleLogo, titleShake } from './titleLogo.js'

const CIRCLES = [[0.05, 0.05, 0.37], [0.98, 0.73, 0.44]]   // [x, y, radius]
const MOUND = { x: 0.5, y: 1.16, rx: 0.6, ry: 0.25 }        // (an ellipse, mostly below the screen: rx of the width, ry of the height)
const GOURDS = [                                            // [type, x, y, radius, tilt (radians)]
  ['boom', 0.125, 0.85, 0.107, 0.1],
  ['bouncy', 0.23, 0.9, 0.065, -0.15],
  ['classic', 0.87, 0.86, 0.113, -0.08],
  ['bouncy', 0.76, 0.91, 0.06, 0.2],
]
const BOB = { period: [3.1, 2.6, 3.4, 2.8], lift: 0.006, rock: 0.04 }   // (each gourd's own period, s; lift: of the height; rock: radians)
const FONT_WAIT = 2   // s: the longest to wait for the logo's font before starting anyway

// Makes the canvas (the first thing in root, behind the rest) and keeps it drawn.
export function createTitleArt(root) {
  const canvas = document.createElement('canvas')
  canvas.className = 'menu-art'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Gourd Wars')
  root.prepend(canvas)
  const ctx = canvas.getContext('2d')
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let fontReady = false, introStart = null, frame = 0

  const draw = now => {
    const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight
    const W = Math.round(w * dpr), H = Math.round(h * dpr)
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
    if (fontReady && introStart === null) introStart = now
    const t = still ? LOGO_SETTLED : introStart === null ? 0 : (now - introStart) / 1000
    const [sx, sy] = titleShake(t)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr)
    const css = getComputedStyle(root), shade = mixHex('#ffffff', css.getPropertyValue('--bark').trim(), 0.3)
    ctx.fillStyle = css.getPropertyValue('--bark-2').trim()
    for (const [x, y, r] of CIRCLES) {
      ctx.beginPath()
      ctx.arc(x * w, y * h, r * h, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.ellipse(MOUND.x * w, MOUND.y * h, MOUND.rx * w, MOUND.ry * h, 0, 0, Math.PI * 2)
    ctx.fill()
    const s = still ? 0 : now / 1000
    GOURDS.forEach(([name, x, y, r, tilt], i) => {
      const type = PUMPKIN_TYPES[name], wave = Math.sin(s / BOB.period[i] * Math.PI * 2 + i * 1.7)
      drawPumpkin(ctx, x * w, (y - BOB.lift * wave) * h, r * h, tilt + BOB.rock * wave, type, type.mark, shade)
    })
    if (fontReady && root.dataset.screen === 'main') drawTitleLogo(ctx, w, h, t, shade)
  }

  // the frame loop runs only while an out-of-game screen shows
  const showing = () => root.classList.contains('open') && root.classList.contains('solid')
  const tick = now => { draw(now); frame = requestAnimationFrame(tick) }
  const update = () => {
    if (still) { if (showing()) draw(performance.now()); return }
    if (showing() && !frame) frame = requestAnimationFrame(tick)
    if (!showing() && frame) { cancelAnimationFrame(frame); frame = 0 }
  }
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['class', 'data-screen'] })
  window.addEventListener('resize', update)

  // the logo waits for its font (so the letters don't drop in as the fallback and then change)
  const ready = () => { if (!fontReady) { fontReady = true; update() } }
  document.fonts.load(font('display', 100)).then(ready, ready)
  setTimeout(ready, FONT_WAIT * 1000)
  update()
}
