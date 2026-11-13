// Graphics and accessibility settings (Settings → Graphics / Accessibility): your own choices (this
// browser; guests too), saved, and applied to the drawing knobs (render/gfx.js), the canvas (Brightness,
// Sharpness) and the menus (UI Size). Drawing only: the game itself never changes.
//
//   GRAPHICS                    every setting: its tab, label, choices (or slider) and default (the
//                               normal look). The menu builds its rows from this (ui/menu.js).
//   graphics                    the current choices, by name
//   loadGraphics(saved?)        load the saved choices (anything missing or not valid: its default) and apply them
//   changeGraphics(name, value) change one (ignored if not valid), save, apply, show it in the menu
//   validGraphic(name, value)   whether a value is one of a setting's choices (a slider's: a number in range)
//   toggleFullscreen()          the browser's fullscreen (not a saved setting: browsers only allow it from a click)
import { gfx } from '../render/gfx.js'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../util/storage.js'
import { app } from './state.js'
import { resize } from './view.js'

const choices = (...pairs) => pairs.map(p => p.split(':'))   // ('off:Off', ...) → [['off', 'Off'], ...]
export const GRAPHICS = {
  // Accessibility
  colorblind: { tab: 'accessibility', label: 'Colorblind Mode', choices: choices('off:Off', 'redgreen:Red-Green', 'blueyellow:Blue-Yellow'), value: 'off' },
  shake: { tab: 'accessibility', label: 'Screen Shake', choices: choices('on:On', 'low:Low', 'off:Off'), value: 'on' },
  flashes: { tab: 'accessibility', label: 'Flashes', choices: choices('on:On', 'off:Off'), value: 'on' },
  motion: { tab: 'accessibility', label: 'Reduced Motion', choices: choices('auto:Auto', 'on:On', 'off:Off'), value: 'auto' },
  outlines: { tab: 'accessibility', label: 'Player Outlines', choices: choices('off:Off', 'on:On'), value: 'off' },
  sights: { tab: 'accessibility', label: 'Sight Dots', choices: choices('normal:Normal', 'large:Large'), value: 'normal' },
  // Graphics
  effects: { tab: 'graphics', label: 'Effects', choices: choices('full:Full', 'reduced:Reduced'), value: 'full' },
  background: { tab: 'graphics', label: 'Background', choices: choices('full:Full', 'simple:Simple'), value: 'full' },
  glow: { tab: 'graphics', label: 'Gourd Glow', choices: choices('full:Full', 'subtle:Subtle'), value: 'full' },
  brightness: { tab: 'graphics', label: 'Brightness', slider: { min: 70, max: 130, step: 5 }, value: 100 },
  sharpness: { tab: 'graphics', label: 'Sharpness', choices: choices('auto:Auto', 'performance:Performance'), value: 'auto' },
  uiSize: { tab: 'graphics', label: 'UI Size', choices: choices('small:Small', 'normal:Normal', 'large:Large'), value: 'normal' },
}

export const graphics = {}

// The computer's own reduced-motion setting (what Reduced Motion's Auto follows).
const systemMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

// How each setting takes effect, by name.
const APPLY = {
  colorblind: v => { gfx.colorblind = v },
  shake: v => { gfx.shake = { on: 1, low: 0.4, off: 0 }[v] },
  flashes: v => { gfx.flashes = v === 'on' },
  motion: v => { gfx.reducedMotion = v === 'auto' ? !!systemMotion?.matches : v === 'on' },
  outlines: v => { gfx.outlines = v === 'on' },
  sights: v => { gfx.sightScale = v === 'large' ? 1.6 : 1 },
  effects: v => { gfx.effects = v === 'reduced' ? 0.5 : 1 },
  background: v => { gfx.simpleBackground = v === 'simple' },
  glow: v => { gfx.glow = v === 'subtle' ? 0.5 : 1 },
  brightness: v => { if (app.canvas) app.canvas.style.filter = v === 100 ? '' : `brightness(${v / 100})` },
  sharpness: v => { gfx.pixelCap = v === 'performance' ? 1 : Infinity; if (app.editor) resize() },
  uiSize: v => {
    gfx.uiScale = { small: 0.85, normal: 1, large: 1.2 }[v]
    if (typeof document !== 'undefined') document.documentElement.style.setProperty('--ui-scale', String(gfx.uiScale))
  },
}

export function validGraphic(name, value) {
  const spec = GRAPHICS[name]
  if (!spec) return false
  if (spec.slider) return typeof value === 'number' && Number.isFinite(value) && value >= spec.slider.min && value <= spec.slider.max
  return spec.choices.some(([k]) => k === value)
}

export function loadGraphics(saved = loadJSON(STORAGE_KEYS.graphics)) {
  const s = saved && typeof saved === 'object' ? saved : {}
  for (const name in GRAPHICS) {
    graphics[name] = validGraphic(name, s[name]) ? s[name] : GRAPHICS[name].value
    APPLY[name](graphics[name])
  }
  systemMotion?.addEventListener?.('change', () => APPLY.motion(graphics.motion))
}

export function changeGraphics(name, value) {
  if (GRAPHICS[name]?.slider) value = Number(value)
  if (!validGraphic(name, value)) return
  graphics[name] = value
  saveJSON(STORAGE_KEYS.graphics, graphics)
  APPLY[name](value)
  app.menu?.showGraphics(graphics)
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  else document.documentElement.requestFullscreen?.().catch(() => {})
}
export const canFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenEnabled
