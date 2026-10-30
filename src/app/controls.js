// Keyboard and mouse → the local player's input (see game/input.js), plus the keys that aren't
// for playing: Esc (the menus) and ` (debug).
//
// With Lock Mouse on (Settings; off by default, since the browser shows a notice each time it
// locks), the mouse is locked to the game while you play (pointer lock: the cursor can't wander
// off onto another screen or the taskbar and take the game out of focus) and we draw a crosshair instead
// (see render/render.js). It's locked by the click that starts or resumes play (or the first click
// on the game: that click doesn't throw), and let go whenever a menu, the map editor or the tuning
// panel is up. Esc lets go too (the browser's rule) and opens the pause menu.
import { CONFIG } from '../config.js'
import { emptyInput } from '../game/input.js'
import { closeMatchSettings, closePumpkinSettings, openPauseMenu } from './menus.js'
import { prefs } from './settings.js'
import { app } from './state.js'

const keys = new Set()
const tapped = new Set()   // pressed since the last physics step (so quick taps aren't missed)
const mouse = { x: 0, y: 0, down: false }
const held = (...codes) => codes.some(c => keys.has(c) || tapped.has(c))

const canLockMouse = () => prefs.lockMouse && !!app.canvas.requestPointerLock
const playing = () => !app.menu.open && !app.editor.active && !app.ui.debug
export const mouseLocked = () => document.pointerLockElement === app.canvas
let lockWorks = true   // (false after the browser turned us down: clicks throw again, instead of only locking)
let unlockedAt = -Infinity   // (when the browser let go of the mouse: Esc may arrive too, just after)

function lockMouse() {
  if (!canLockMouse() || mouseLocked() || !playing()) return
  const p = app.canvas.requestPointerLock()
  if (p && p.catch) p.catch(() => {})   // (reported by pointerlockerror too)
}

// Each frame: let go of the mouse if a menu (or the editor, or the tuning panel) came up.
export function updateMouseLock() {
  if (mouseLocked() && !(playing() && prefs.lockMouse)) document.exitPointerLock()
}

export function setupControls() {
  const { canvas, ui, menu, editor, tuning } = app
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return   // typing a code, a map name, ...
    if (editor.active) { editor.onKey(e); return }
    if (e.code === 'Backquote') {
      ui.debug = !ui.debug
      tuning.setVisible(ui.debug)
    }
    if (e.code === 'Escape') {
      if (performance.now() - unlockedAt < 300) return   // (this Esc let go of the mouse: that already opened the pause menu)
      if (!menu.open) openPauseMenu()
      else if (menu.screen === 'paused') menu.hide()
      else if (menu.screen === 'pumpkins') closePumpkinSettings()
      else if (menu.screen === 'match') closeMatchSettings()
    }
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    keys.add(e.code)
    tapped.add(e.code)
  })
  window.addEventListener('keyup', e => keys.delete(e.code))
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false })
  window.addEventListener('mousemove', e => {
    if (!mouseLocked()) { mouse.x = e.clientX; mouse.y = e.clientY; return }
    const { view } = app   // locked: move our own cursor, kept over the arena
    mouse.x = Math.min(Math.max(mouse.x + e.movementX, view.ox), view.ox + CONFIG.view.w * view.s)
    mouse.y = Math.min(Math.max(mouse.y + e.movementY, view.oy), view.oy + CONFIG.view.h * view.s)
  })
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    if (canLockMouse() && lockWorks && !mouseLocked() && playing()) return   // (just grabbing the mouse: see the click below)
    mouse.down = true
    tapped.add('Mouse')
  })
  // a click on the game, or on a menu button that starts or resumes play (its action has run by now)
  window.addEventListener('click', lockMouse)
  document.addEventListener('pointerlockchange', () => {
    if (mouseLocked()) { lockWorks = true; return }
    unlockedAt = performance.now()
    mouse.down = false
    if (playing()) openPauseMenu()   // (Esc, or the window lost focus)
  })
  document.addEventListener('pointerlockerror', () => { lockWorks = false })
  window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
}

// Forget what's held (e.g. coming back from the map editor).
export function clearControls() {
  keys.clear()
  tapped.clear()
}

// Call after each physics step: quick taps have been seen.
export function clearTaps() {
  tapped.clear()
}

// Where the mouse points, in arena meters.
export function aimPoint() {
  const { view } = app
  return { x: (mouse.x - view.ox) / view.s, y: CONFIG.view.h - (mouse.y - view.oy) / view.s }
}

export function localInput() {
  const { x: aimX, y: aimY } = aimPoint()
  if (app.menu.open) return { ...emptyInput(), aimX, aimY }   // no controls while the menu is up
  return {
    left: held('KeyA', 'ArrowLeft'),
    right: held('KeyD', 'ArrowRight'),
    jump: held('KeyW', 'Space', 'ArrowUp'),
    crouch: held('KeyS', 'ArrowDown'),
    throw: held('Mouse') || mouse.down,
    harvest: held('KeyE'),
    ragdoll: held('KeyR'),
    aimX, aimY,
  }
}
