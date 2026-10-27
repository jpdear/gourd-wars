// PATCHES — where pumpkins grow.
//   empty → growing (green → orange) → ripe → rotten → pops → empty → ...

import { CONFIG } from '../config.js'
import { PUMPKIN_TYPES, pickPumpkinType } from './pumpkinTypes.js'
import { clamp, lerp, r3 } from '../util/math.js'

export const PATCH_STATES = ['empty', 'growing', 'ripe', 'rotten']   // index = code sent in snapshots

export function createPatches(map) {
  // only: this patch always grows that pumpkin type (custom maps)
  return map.patches.map(p => ({ x: p.x, y: p.y, only: p.only || null, state: 'empty', timer: 0, growth: 0, typeName: p.only || 'classic' }))
}

// Start of a round: every patch about 2 seconds from ripe (each picks a new pumpkin type).
export function resetPatches(game) {
  for (const p of game.patches) {
    p.typeName = p.only || pickPumpkinType(game.spawnSettings)
    p.state = 'growing'
    p.growth = clamp(1 - 2 / CONFIG.patch.growTime, 0, 1)
    p.timer = 0
  }
}

export function updatePatches(game, dt) {
  const P = CONFIG.patch
  for (const p of game.patches) {
    if (p.state === 'empty') {
      p.timer -= dt
      if (p.timer <= 0) { p.state = 'growing'; p.growth = 0; p.typeName = p.only || pickPumpkinType(game.spawnSettings) }
    } else if (p.state === 'growing') {
      p.growth = Math.min(1, p.growth + dt / P.growTime)
      if (p.growth >= 1) { p.state = 'ripe'; p.timer = 0 }
    } else if (p.state === 'ripe') {
      p.timer += dt
      if (p.timer >= P.ripeTime) { p.state = 'rotten'; p.timer = 0 }
    } else if (p.state === 'rotten') {
      p.timer += dt
      if (p.timer >= P.rotTime) splatPatch(game, p)
    }
  }
}

export function emptyPatch(p) {
  p.state = 'empty'
  p.growth = 0
  p.timer = CONFIG.patch.regrowTime * (0.75 + Math.random() * 0.5)
}

// The patch's pumpkin bursts (rotted, or hit by a thrown pumpkin).
export function splatPatch(game, p) {
  const { x, y } = patchPumpkin(p)
  game.events.push({ type: 'splat', x: r3(x), y: r3(y), typeName: p.typeName, ripeness: patchRipeness(p), rot: patchRot(p) })
  emptyPatch(p)
}

// These work on real patches and on the {state, growth, rot} views made from snapshots.
export const canHarvest = p => p.state === 'ripe' || (p.state === 'growing' && p.growth >= CONFIG.patch.minGrowth)
export const patchRipeness = p => (p.state === 'growing' ? p.growth : 1)
export const patchRot = p => (p.state !== 'rotten' ? 0 : p.rot !== undefined ? p.rot : p.timer / CONFIG.patch.rotTime)

export function patchPower(p) {
  if (p.state !== 'growing') return 1
  const [lo, hi] = CONFIG.patch.greenPower
  const t = (p.growth - CONFIG.patch.minGrowth) / (1 - CONFIG.patch.minGrowth)
  return r3(lerp(lo, hi, clamp(t, 0, 1)))
}

// Where the pumpkin on a patch is drawn / can be hit: it grows from a small bump.
export function patchPumpkin(p) {
  const r = PUMPKIN_TYPES[p.typeName].radius * (0.25 + 0.85 * (p.state === 'growing' ? p.growth : 1))
  return { x: p.x, y: p.y + r * 0.95, r }
}
