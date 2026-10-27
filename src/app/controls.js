// Keyboard and mouse → the local player's input (see game/input.js), plus the keys that aren't
// for playing: Esc (the menus) and ` (debug).
import { CONFIG } from '../config.js'
import { emptyInput } from '../game/input.js'
import { closeMatchSettings, closePumpkinSettings, openPauseMenu } from './menus.js'
import { app } from './state.js'

const keys = new Set()
const tapped = new Set()   // pressed since the last physics step (so quick taps aren't missed)
const mouse = { x: 0, y: 0, down: false }
const held = (...codes) => codes.some(c => keys.has(c) || tapped.has(c))

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
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY })
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    mouse.down = true
    tapped.add('Mouse')
  })
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
