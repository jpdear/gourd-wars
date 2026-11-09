// Your keybinds (this browser; guests too): one key or mouse button per action, set on the
// Controls screen (Settings → Controls). Bindings are KeyboardEvent codes ('KeyA', 'Space',
// 'ArrowLeft', ...; where the key is, not what it types) or 'Mouse0'-'Mouse4' (left, middle, right,
// back, forward), or null when an action has none (its key was moved to another action).
// Esc (menus) and ` (debug) are fixed.
import { STORAGE_KEYS, loadJSON, saveJSON } from '../util/storage.js'

// the actions, in the order the Controls screen lists them: [action, label, default]
export const BIND_ACTIONS = [
  ['left', 'Move Left', 'KeyA'],
  ['right', 'Move Right', 'KeyD'],
  ['jump', 'Jump', 'KeyW'],
  ['crouch', 'Crouch', 'KeyS'],
  ['throw', 'Throw / Punch', 'Mouse0'],
  ['harvest', 'Harvest', 'KeyE'],
  ['ragdoll', 'Ragdoll', 'KeyR'],
]
export const RESERVED_KEYS = ['Escape', 'Backquote']   // (can't be bound)

const defaults = () => Object.fromEntries(BIND_ACTIONS.map(([action, , code]) => [action, code]))
export const binds = defaults()

export function loadBinds() {
  const saved = loadJSON(STORAGE_KEYS.keybinds) || {}
  for (const action in binds) {
    const code = saved[action]
    if (code === null || (typeof code === 'string' && !RESERVED_KEYS.includes(code))) binds[action] = code
  }
}

// Bind a key to an action; whichever action had it loses it (left with none, so you notice).
export function setBind(action, code) {
  for (const other in binds) if (binds[other] === code) binds[other] = null
  binds[action] = code
  saveJSON(STORAGE_KEYS.keybinds, binds)
}

export function resetBinds() {
  Object.assign(binds, defaults())
  saveJSON(STORAGE_KEYS.keybinds, binds)
}

// --- names to show ---
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOUSE_NAMES = ['Left Click', 'Middle Click', 'Right Click', 'Mouse 4', 'Mouse 5']
const MOUSE_SHORT = ['LMB', 'MMB', 'RMB', 'M4', 'M5']
const KEY_NAMES = {
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', CapsLock: 'Caps Lock', Delete: 'Delete',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\',
  Home: 'Home', End: 'End', PageUp: 'Page Up', PageDown: 'Page Down', Insert: 'Insert',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .', NumpadEnter: 'Num Enter',
}
const MODIFIERS = { Shift: 'Shift', Control: 'Ctrl', Alt: isMac ? 'Option' : 'Alt', Meta: isMac ? 'Cmd' : 'Win' }

// e.g. 'A', 'Space', 'Left Shift', 'Right Click'; short: as small as it goes (for the harvest bubble)
export function keyName(code, short = false) {
  if (!code) return short ? '?' : '—'
  if (code.startsWith('Mouse')) return (short ? MOUSE_SHORT : MOUSE_NAMES)[Number(code.slice(5))] || code
  if (KEY_NAMES[code]) return KEY_NAMES[code]
  let m
  if ((m = code.match(/^Key([A-Z])$/)) || (m = code.match(/^Digit(\d)$/)) || (m = code.match(/^(F\d+)$/))) return m[1]
  if ((m = code.match(/^Numpad(\d)$/))) return 'Num ' + m[1]
  if ((m = code.match(/^(Shift|Control|Alt|Meta)(Left|Right)$/))) return (short ? '' : m[2] + ' ') + MODIFIERS[m[1]]
  return code
}
