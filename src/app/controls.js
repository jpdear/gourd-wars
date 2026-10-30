// Keyboard and mouse → the local player's input (see game/input.js), by your keybinds (see
// keybinds.js), plus the keys that aren't for playing: Esc (the menus) and ` (debug).
//
// With Lock Mouse on (Settings; off by default, since the browser shows a notice each time it
// locks), the mouse is locked to the game while you play (pointer lock: the cursor can't wander
// off onto another screen or the taskbar and take the game out of focus) and we draw a crosshair instead
// (see render/render.js). It's locked by the click that starts or resumes play (or the first click
// on the game: that click doesn't throw), and let go whenever a menu, the map editor or the tuning
// panel is up. Esc lets go too (the browser's rule) and opens the pause menu.
import { CONFIG } from '../config.js'
import { emptyInput } from '../game/input.js'
import { RESERVED_KEYS, binds } from './keybinds.js'
import { closeControls, closeMatchSettings, closePumpkinSettings, openPauseMenu } from './menus.js'
import { prefs } from './settings.js'
import { app } from './state.js'

const keys = new Set()     // held: key codes and mouse buttons ('Mouse0'-'Mouse4')
const tapped = new Set()   // pressed since the last physics step (so quick taps aren't missed)
const mouse = { x: 0, y: 0 }
const held = code => keys.has(code) || tapped.has(code)
const press = code => { keys.add(code); tapped.add(code) }

// Waiting for the key (or mouse button) to bind on the Controls screen: called with its code, or
// null if Esc cancelled. The clicks that come with a mouse button bound this way don't count.
let capturing = null
let swallowing = false   // (from that mouse button going down until just after it comes back up)
export function captureBind(done) { capturing = done }
function finishCapture(code) {
  const done = capturing
  capturing = null
  done(code)
}

// Esc in a menu: back out of it
const ESC_FROM = {
  paused: () => app.menu.hide(),
  pumpkins: closePumpkinSettings,
  match: closeMatchSettings,
  controls: closeControls,
}

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
    if (capturing) {
      e.preventDefault()
      if (e.code === 'Escape') finishCapture(null)
      else if (!RESERVED_KEYS.includes(e.code)) finishCapture(e.code)
      return
    }
    if (e.target.closest && e.target.closest('input, textarea, select')) return   // typing a code, a map name, ...
    if (editor.active) { editor.onKey(e); return }
    if (e.code === 'Backquote') {
      ui.debug = !ui.debug
      tuning.setVisible(ui.debug)
    }
    if (e.code === 'Escape') {
      if (performance.now() - unlockedAt < 300) return   // (this Esc let go of the mouse: that already opened the pause menu)
      if (!menu.open) openPauseMenu()
      else if (ESC_FROM[menu.screen]) ESC_FROM[menu.screen]()
    }
    // (no scrolling the page, and no browser shortcuts on your keys while you play; Ctrl/Cmd ones still work)
    const bound = playing() && !e.ctrlKey && !e.metaKey && Object.values(binds).includes(e.code)
    if (bound || ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    press(e.code)
  })
  window.addEventListener('keyup', e => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())
  window.addEventListener('mousemove', e => {
    if (!mouseLocked()) { mouse.x = e.clientX; mouse.y = e.clientY; return }
    const { view } = app   // locked: move our own cursor, kept over the arena
    mouse.x = Math.min(Math.max(mouse.x + e.movementX, view.ox), view.ox + CONFIG.view.w * view.s)
    mouse.y = Math.min(Math.max(mouse.y + e.movementY, view.oy), view.oy + CONFIG.view.h * view.s)
  })
  window.addEventListener('mousedown', e => {
    if (!capturing) return
    e.preventDefault()
    e.stopPropagation()
    swallowing = true
    finishCapture('Mouse' + e.button)
  }, true)
  window.addEventListener('mouseup', () => { if (swallowing) setTimeout(() => { swallowing = false }) }, true)   // (its click comes right after)
  for (const type of ['click', 'auxclick', 'contextmenu']) {
    window.addEventListener(type, e => {
      if (capturing || swallowing) { e.preventDefault(); e.stopPropagation() }
    }, true)
  }
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) e.preventDefault()   // (no middle-click scrolling)
    if (e.button === 0 && canLockMouse() && lockWorks && !mouseLocked() && playing()) return   // (just grabbing the mouse: see the click below)
    press('Mouse' + e.button)
  })
  // a click on the game, or on a menu button that starts or resumes play (its action has run by now)
  window.addEventListener('click', lockMouse)
  document.addEventListener('pointerlockchange', () => {
    if (mouseLocked()) { lockWorks = true; return }
    unlockedAt = performance.now()
    if (playing()) openPauseMenu()   // (Esc, or the window lost focus)
  })
  document.addEventListener('pointerlockerror', () => { lockWorks = false })
  window.addEventListener('mouseup', e => {
    keys.delete('Mouse' + e.button)
    if (e.button === 3 || e.button === 4) e.preventDefault()   // (the side buttons: not back/forward in the browser)
  })
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
    left: held(binds.left),
    right: held(binds.right),
    jump: held(binds.jump),
    crouch: held(binds.crouch),
    throw: held(binds.throw),
    harvest: held(binds.harvest),
    ragdoll: held(binds.ragdoll),
    aimX, aimY,
  }
}
