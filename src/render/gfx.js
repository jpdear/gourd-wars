// GFX: the player's graphics and accessibility choices, as the drawing code sees them (knobs, not the
// menu's words: those are app/graphics.js, which sets these). Drawing only, on this computer: nothing
// here changes the game or goes to friends. The defaults are the game's normal look (the map editor and
// the effects lab never change them).
//
//   gfx                       the knobs (below), read by the drawing code
//   playerColor(slot, color)  a player's color as drawn (color: theirs from the snapshot)
//   playerName(slot)          "Red", or "Red (Triangle)" with Colorblind Mode on
//   playerShape(slot)         the shape floating over them with Colorblind Mode on ('circle', ...), or null
//   gourdColors(colors)       a gourd's { color, rib } as drawn (recolored ones that clash for this type)
//   recolor(hex)              one gourd color as drawn (for particles and sights)
//   motionTime(t)             t, or 0 with Reduced Motion on (for decoration that moves with the clock)
//   pixelRatio()              device pixels per CSS pixel to draw at (Sharpness)
//
// Colorblind palettes (picked 2026-11-13 by simulating each type: Machado 2009 model, CIELAB distances;
// today's Red vs Green under deuteranopia was 9 apart, these players are 46+ apart): the players' colors stay recognizably Blue / Red / Green / Yellow,
// and only the gourds that became hard to tell apart change, a little (they also differ in shape).

import { PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../config.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { GOURD } from './palette.js'
import { mixHex } from '../util/color.js'

export const gfx = {
  colorblind: 'off',     // 'off' | 'redgreen' | 'blueyellow'
  shake: 1,              // screen shake strength (1, 0.4 or 0)
  flashes: true,         // blasts' white flash
  reducedMotion: false,  // decoration holds still; map pans become a fade
  outlines: false,       // a dark ring round each player
  sightScale: 1,         // aim dots' size
  effects: 1,            // share of particles kept (1 or 0.5); fewer blast puffs below 1
  simpleBackground: false,   // the map's flat sky only (no scenery or weather)
  glow: 1,               // special and Super Rare glows' strength
  uiScale: 1,            // HUD text, chips and banners
  pixelCap: Infinity,    // the most device pixels per CSS pixel to draw at
}

const PALETTES = {
  redgreen: {
    players: ['#1f56c0', '#d4361a', '#20d9b0', '#ffe41f'],
    gourds: { vine: '#2f8a6a', spitter: '#8fd6b4', chomper: '#a0c080', daze: '#c88d5c', landmine: '#57594c', teleport: '#e05ad0', bouncebomb: '#e8456a' },
    unripe: '#4f9e8c',   // (unripe green looked like a ripe Classic)
  },
  blueyellow: {
    players: ['#2a1fc0', '#ec2a26', '#1ccc52', '#fdb81e'],
    gourds: { bouncebomb: '#d93f7a', biggourd: '#b48a46', boomerang: '#f7d84a' },
    unripe: null,
  },
}
const SHAPES = ['circle', 'triangle', 'square', 'diamond']
const SHAPE_NAMES = { circle: 'Circle', triangle: 'Triangle', square: 'Square', diamond: 'Diamond' }

// Each palette's gourd recoloring as one lookup, old hex → new hex (a type's rib follows its color, as
// dark as it was: its rib's darkness is kept). Built once.
const darkness = (color, rib) => { const L = h => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) }; return Math.min(0.6, Math.max(0.15, 1 - L(rib) / Math.max(1, L(color)))) }
const REMAPS = Object.fromEntries(Object.entries(PALETTES).map(([mode, p]) => {
  const map = new Map()
  const add = (from, to) => { map.set(from.color.toLowerCase(), to); map.set(from.rib.toLowerCase(), mixHex(to, '#000000', darkness(from.color, from.rib))) }
  for (const [name, color] of Object.entries(p.gourds)) {
    add(PUMPKIN_TYPES[name], color)
    for (const k in PUMPKIN_TYPES) if (k !== name && PUMPKIN_TYPES[k].color === PUMPKIN_TYPES[name].color) add(PUMPKIN_TYPES[k], color)   // (Airdrop with Airstrike, ...)
  }
  if (p.unripe) add(GOURD.unripe, p.unripe)
  return [mode, map]
}))

const on = () => gfx.colorblind !== 'off' && !!PALETTES[gfx.colorblind]

export const playerColor = (slot, color = PLAYER_COLORS[slot]) => (on() ? PALETTES[gfx.colorblind].players[slot] ?? color : color)
export const playerShape = slot => (on() ? SHAPES[slot] ?? null : null)
export function playerName(slot) {
  const name = PLAYER_COLOR_NAMES[slot] ?? '…', shape = playerShape(slot)
  return shape ? `${name} (${SHAPE_NAMES[shape]})` : name
}

export function recolor(hex) {
  if (!on() || typeof hex !== 'string') return hex
  return REMAPS[gfx.colorblind].get(hex.toLowerCase()) ?? hex
}
export function gourdColors(colors) {
  if (!on() || !colors) return colors
  const color = recolor(colors.color), rib = recolor(colors.rib)
  return color === colors.color && rib === colors.rib ? colors : { ...colors, color, rib }
}

export const motionTime = t => (gfx.reducedMotion ? 0 : t)
export const pixelRatio = () => Math.min(gfx.pixelCap, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
