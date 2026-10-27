// MAP DATA — custom maps: checking, cleaning up, saving, sharing as codes.
// A custom map uses the same format as the built-in MAPS (theme by name).

import { CONFIG, MAX_PLAYERS } from '../config.js'
import { BALE } from '../game/level.js'
import { SPAWNABLE_TYPES } from '../game/pumpkinTypes.js'
import { MAPS } from './builtin.js'
import { THEMES } from './themes.js'
import { clamp, r3 } from '../util/math.js'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../util/storage.js'

export const MAP_CODE_PREFIX = 'PFMAP1:'
export const MAP_LIMITS = { platforms: 80, patches: 12, bales: 30, spikes: 20, fires: 10, scythes: 6, movers: 12 }
const newMapId = () => 'c_' + Math.random().toString(36).slice(2, 10)

// Clean up a map from anywhere (storage, an imported code, a host): known fields only,
// numbers kept on screen and sensible, counts capped. Returns null if it isn't a map at all.
export function sanitizeMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const W = CONFIG.view.w, H = CONFIG.view.h
  const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d }
  const list = (a, max) => (Array.isArray(a) ? a.filter(o => o && typeof o === 'object').slice(0, max) : [])
  const pt = o => ({ x: num(o.x, 0, W, W / 2), y: num(o.y, 0, H, 4) })
  const map = {
    id: typeof raw.id === 'string' && /^c_[a-z0-9]{4,16}$/.test(raw.id) ? raw.id : newMapId(),
    custom: true,
    name: String(raw.name || 'Custom map').replace(/[\u0000-\u001f]/g, '').slice(0, 32) || 'Custom map',
    theme: THEMES[raw.theme] ? raw.theme : 'paper',
    platforms: list(raw.platforms, MAP_LIMITS.platforms).map(o => ({
      ...pt(o), w: num(o.w, 0.25, W, 2), h: num(o.h, 0.25, H, 0.5), ...(o.wall ? { wall: true } : {}),
    })),
    spawns: list(raw.spawns, MAX_PLAYERS).map(pt),
    patches: list(raw.patches, MAP_LIMITS.patches).map(o => ({ ...pt(o), ...(SPAWNABLE_TYPES.includes(o.only) ? { only: o.only } : {}) })),
    bales: list(raw.bales, MAP_LIMITS.bales).map(pt),
    spikes: list(raw.spikes, MAP_LIMITS.spikes).map(o => ({ ...pt(o), w: num(o.w, 0.3, W, 2) })),
    fires: list(raw.fires, MAP_LIMITS.fires).map(o => ({ ...pt(o), w: num(o.w, 0.4, 6, 1.4) })),
    scythes: list(raw.scythes, MAP_LIMITS.scythes).map(o => ({
      ...pt(o), length: num(o.length, 1.4, 6, 2.6), pole: num(o.pole, 0, H, 2.6), turnTime: num(o.turnTime, 0.5, 10, 3),
    })),
    movers: list(raw.movers, MAP_LIMITS.movers).map(o => {
      const a = pt(o)
      return {
        ...a, w: num(o.w, 0.5, W, 3), h: num(o.h, 0.25, 4, 0.5), x2: num(o.x2, 0, W, a.x), y2: num(o.y2, 0, H, a.y),
        speed: num(o.speed, 0.5, 12, 3), pause: num(o.pause, 0, 5, 1),
      }
    }),
  }
  if (map.spawns.length) fillSpawns(map)   // (maps from before 4 players had 2 spawns)
  return map
}

// The version the game plays: the theme name becomes the theme itself.
export function toRuntimeMap(def) {
  return { ...def, theme: THEMES[def.theme] || THEMES.paper, playable: checkMap(def).errors.length === 0 }
}

export function encodeMapCode(def) {
  const { custom, ...data } = def
  return MAP_CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(data))))
}

// A map from a pasted code (with a fresh id), or null if the code isn't valid.
export function decodeMapCode(code) {
  try {
    const text = String(code).trim()
    if (!text.startsWith(MAP_CODE_PREFIX)) return null
    const def = sanitizeMap(JSON.parse(decodeURIComponent(escape(atob(text.slice(MAP_CODE_PREFIX.length))))))
    if (def) def.id = newMapId()
    return def
  } catch (e) {
    return null
  }
}

// A built-in or custom map as an editable custom map.
export function duplicateMap(id, name) {
  const src = MAPS[id]
  const themeName = Object.keys(THEMES).find(k => THEMES[k] === src.theme)
  return sanitizeMap({ ...JSON.parse(JSON.stringify({ ...src, theme: null })), theme: themeName, id: null, name })
}

const mapTop = p => p.y + p.h / 2
const onTopOf = (pt, p) => Math.abs(mapTop(p) - pt.y) < 0.06 && pt.x > p.x - p.w / 2 && pt.x < p.x + p.w / 2
const insideOf = (pt, p) => Math.abs(pt.x - p.x) < p.w / 2 && Math.abs(pt.y - p.y) < p.h / 2
// is pt within pad meters of a pitchfork row, a bonfire or a scythe's reach?
const mapHazardAt = (def, pt, pad) =>
  def.spikes.some(sp => pt.x > sp.x - sp.w / 2 - pad && pt.x < sp.x + sp.w / 2 + pad && pt.y > sp.y - pad && pt.y < sp.y + 0.6 + pad) ||
  def.fires.some(f => pt.x > f.x - f.w / 2 - pad && pt.x < f.x + f.w / 2 + pad && pt.y > f.y - pad && pt.y < f.y + 0.9 + pad) ||
  def.scythes.some(sc => Math.hypot(pt.x - sc.x, pt.y - sc.y) < sc.length + 0.3 + pad)

// What you can get to from the spawns: jump up/across, drop down, or ride a moving platform.
// Returns { nodes, seen }: nodes = floors (plus both ends of each mover), seen = the reachable ones.
const JUMP_UP = 3.8, JUMP_ACROSS = 4.6, DROP_ACROSS = 6.5   // what a jump can reach (a bit under the max)
function mapReach(def) {
  // (a floor that's all pitchforks doesn't count; one with a few on it still does)
  const spikeFloor = p => def.spikes.filter(sp => Math.abs(mapTop(p) - sp.y) < 0.05)
    .reduce((sum, sp) => sum + Math.max(0, Math.min(p.x + p.w / 2, sp.x + sp.w / 2) - Math.max(p.x - p.w / 2, sp.x - sp.w / 2)), 0) > p.w - 1
  const nodes = def.platforms.filter(p => !p.wall && !spikeFloor(p))
  // a moving platform counts as a platform at both ends of its trip (and riding it links them)
  def.movers.forEach((m, index) => {
    const a = { x: m.x, y: m.y, w: m.w, h: m.h, mover: index, start: true }, b = { x: m.x2, y: m.y2, w: m.w, h: m.h, mover: index }
    a.pair = b; b.pair = a
    nodes.push(a, b)
  })
  const gap = (a, b) => Math.max(0, Math.max(a.x - a.w / 2, b.x - b.w / 2) - Math.min(a.x + a.w / 2, b.x + b.w / 2))
  const seen = new Set(def.spawns.map(sp => nodes.find(p => onTopOf(sp, p))).filter(Boolean))
  for (const p of [...seen]) if (p.pair) seen.add(p.pair)
  for (let grew = true; grew;) {
    grew = false
    for (const q of [...seen]) for (const p of nodes) {
      if (seen.has(p)) continue
      const dy = mapTop(p) - mapTop(q)
      if ((dy <= JUMP_UP && dy >= -0.01 && gap(p, q) <= JUMP_ACROSS) || (dy < 0 && gap(p, q) <= DROP_ACROSS)) {
        seen.add(p)
        if (p.pair) seen.add(p.pair)
        grew = true
      }
    }
  }
  return { nodes, seen }
}

// Is this a good place for a player to start? (on a floor, room to stand, away from hazards)
const goodSpawnSpot = (def, sp) => {
  const body = { x: sp.x, y: sp.y + 1 }
  return def.platforms.some(p => !p.wall && onTopOf(sp, p)) &&
    ![body, { x: sp.x, y: sp.y + 1.9 }].some(q => def.platforms.some(p => insideOf(q, p)) || def.movers.some(m => insideOf(q, m))) &&
    !mapHazardAt(def, body, 1.5) && !mapHazardAt(def, sp, 1.5)
}

// Add the missing spawns (up to 4): the good spot on a reachable floor farthest from the
// spawns already there. Always picks the same spots for the same map.
export function fillSpawns(def) {
  const { seen } = mapReach(def)
  const floors = def.platforms.filter(p => seen.has(p))
  while (def.spawns.length < MAX_PLAYERS) {
    let best = null, bestDist = 1.5
    for (const p of floors) {
      for (let x = p.x - p.w / 2 + 0.6; x <= p.x + p.w / 2 - 0.6; x += 0.5) {
        const sp = { x: r3(x), y: r3(mapTop(p)) }
        const dist = Math.min(...def.spawns.map(o => Math.hypot(o.x - sp.x, o.y - sp.y)))
        if (dist > bestDist + 1e-6 && goodSpawnSpot(def, sp)) { best = sp; bestDist = dist }
      }
    }
    if (!best) break   // no room: the checks will ask for it
    def.spawns.push(best)
  }
  return def
}

// Problems with a map. errors = must fix before it can be played; warnings = worth a look.
// Each problem: { msg, kind, index } (kind/index point at the piece, for the editor to select).
export function checkMap(def) {
  const errors = [], warnings = []
  const hazardAt = (pt, pad) => mapHazardAt(def, pt, pad)

  if (def.spawns.length < MAX_PLAYERS) {
    const missing = Array.from({ length: MAX_PLAYERS - def.spawns.length }, (_, k) => def.spawns.length + k + 1)
    errors.push({ msg: `Place spawn${missing.length > 1 ? 's' : ''} ${missing.join(', ')}.`, kind: 'spawns', index: def.spawns.length })
  }
  def.spawns.forEach((sp, i) => {
    const body = { x: sp.x, y: sp.y + 1 }   // middle of a standing stick figure
    if (!def.platforms.some(p => onTopOf(sp, p))) errors.push({ msg: `Spawn ${i + 1} isn't standing on a platform.`, kind: 'spawns', index: i })
    else if (def.platforms.some(p => insideOf(body, p)) || def.movers.some(m => insideOf(body, m))) errors.push({ msg: `Spawn ${i + 1} is inside a platform or wall.`, kind: 'spawns', index: i })
    if (hazardAt(body, 0.2) || hazardAt(sp, 0.2)) errors.push({ msg: `Spawn ${i + 1} is in a hazard.`, kind: 'spawns', index: i })
    else if (hazardAt(body, 1.5)) warnings.push({ msg: `Spawn ${i + 1} is right next to a hazard.`, kind: 'spawns', index: i })
    def.spawns.forEach((o, j) => {
      if (j > i && Math.hypot(o.x - sp.x, o.y - sp.y) < 1.2) warnings.push({ msg: `Spawns ${i + 1} and ${j + 1} are on top of each other.`, kind: 'spawns', index: j })
    })
  })
  if (!def.patches.length) warnings.push({ msg: 'No pumpkin patches: only punches!', kind: null, index: -1 })
  def.patches.forEach((pt, i) => {
    if (!def.platforms.some(p => onTopOf(pt, p))) warnings.push({ msg: `Patch ${i + 1} isn't on a platform.`, kind: 'patches', index: i })
    else if (def.platforms.some(p => insideOf({ x: pt.x, y: pt.y + 0.3 }, p))) warnings.push({ msg: `Patch ${i + 1} is buried in a platform or wall.`, kind: 'patches', index: i })
  })
  def.bales.forEach((b, i) => {
    const c = { x: b.x, y: b.y + BALE.h / 2 }
    if (def.platforms.some(p => insideOf(c, p))) warnings.push({ msg: `Hay bale ${i + 1} is stuck inside a platform.`, kind: 'bales', index: i })
  })

  const { nodes, seen } = mapReach(def)
  if (seen.size) {
    nodes.forEach(p => {
      if (seen.has(p)) return
      if (p.mover === undefined) warnings.push({ msg: 'A platform is out of jumping reach.', kind: 'platforms', index: def.platforms.indexOf(p) })
      else if (p.start) warnings.push({ msg: 'A moving platform is out of jumping reach.', kind: 'movers', index: p.mover })   // (once per mover)
    })
  }
  return { errors, warnings }
}

// Saved custom maps (this browser).
export function loadCustomMaps() {
  try {
    return (loadJSON(STORAGE_KEYS.customMaps) || []).map(sanitizeMap).filter(Boolean)
  } catch (e) {
    return []   // (not a list)
  }
}
export function saveCustomMaps(defs) {
  saveJSON(STORAGE_KEYS.customMaps, defs)
}
export const registerMap = def => { MAPS[def.id] = toRuntimeMap(def) }
export const unregisterMap = id => { if (MAPS[id] && MAPS[id].custom) delete MAPS[id] }
