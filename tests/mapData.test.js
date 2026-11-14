import { expect, it } from 'vitest'
import { CONFIG, MAX_PLAYERS } from '../src/config.js'
import { MAPS } from '../src/maps/builtin.js'
import { MAP_CODE_PREFIX, MAP_LIMITS, SPAWN_ROOM, checkMap, decodeMapCode, duplicateMap, encodeMapCode, sanitizeMap, spawnBlocked } from '../src/maps/mapData.js'
import { createGame, resetRound, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { registerMap, unregisterMap } from '../src/maps/mapData.js'
import { THEMES } from '../src/maps/themes.js'

it('turns a map into a code and back', () => {
  const def = duplicateMap('patch', 'Pumpkin Hill ☺')   // (non-ASCII names survive)
  const code = encodeMapCode(def)
  expect(code.startsWith(MAP_CODE_PREFIX)).toBe(true)
  const back = decodeMapCode(code)
  expect(back.name).toBe('Pumpkin Hill ☺')
  expect(back.id).not.toBe(def.id)   // (an import is a new map)
  expect({ ...back, id: def.id }).toEqual(def)
})

it('rejects things that are not map codes', () => {
  for (const junk of ['', 'hello', MAP_CODE_PREFIX, MAP_CODE_PREFIX + '!!!', MAP_CODE_PREFIX + btoa('[1,2]'), null]) {
    expect(decodeMapCode(junk)).toBeNull()
  }
})

it('cleans up whatever it is given', () => {
  expect(sanitizeMap(null)).toBeNull()
  expect(sanitizeMap('a map')).toBeNull()
  const def = sanitizeMap({
    id: '<script>', name: 'x'.repeat(100) + '\u0007', theme: 'nope', extra: 'dropped',
    platforms: Array.from({ length: 200 }, () => ({ x: 1e9, y: -5, w: 'wide', h: 1 })),
    spawns: [{ x: 9, y: 3.5 }, { x: 23, y: 3.5 }],
  })
  expect(def.id).toMatch(/^c_[a-z0-9]+$/)
  expect(def.name.length).toBe(32)
  expect(def.theme).toBe('paper')
  expect(def.extra).toBeUndefined()
  expect(def.platforms.length).toBe(MAP_LIMITS.platforms)
  expect(def.platforms[0]).toEqual({ x: CONFIG.view.w, y: 0, w: 2, h: 1 })   // kept on screen; bad numbers get defaults
})

it('fills in spawns 3-4 for maps made before 4 players', () => {
  const old = { ...duplicateMap('patch', 'Old map'), spawns: MAPS.patch.spawns.slice(0, 2) }
  const def = sanitizeMap(old)
  expect(def.spawns.length).toBe(MAX_PLAYERS)
  expect(checkMap(def).errors).toEqual([])
})

it('slides a spawn jammed against a wall along its floor until there\'s room to stand', () => {
  const def = duplicateMap('patch', 'Walled')
  const sp = def.spawns[0], wall = { x: sp.x + 0.3, y: sp.y + 2, w: 0.5, h: 4, wall: true }   // (right up against spawn 1)
  def.platforms.push(wall)
  expect(spawnBlocked(def, sp)).toBe(true)
  expect(checkMap(def).errors.map(e => e.msg).join()).toMatch(/Spawn 1 has no room/)
  const fixed = sanitizeMap(def)
  const moved = fixed.spawns[0]
  expect(moved.y).toBe(sp.y)
  expect(moved.x).toBeLessThan(wall.x - wall.w / 2 - SPAWN_ROOM.halfW + 1e-6)   // (off to the open side, clear of the wall)
  expect(moved.x).toBeGreaterThan(wall.x - wall.w / 2 - SPAWN_ROOM.halfW - 0.1)   // (only as far as it had to)
  expect(checkMap(fixed).errors).toEqual([])
})

it('starts a player at a nudged spawn without any part of them inside the wall', () => {
  const def = duplicateMap('patch', 'Walled')
  const sp = def.spawns[0], wall = { x: sp.x - 0.25, y: sp.y + 2, w: 0.5, h: 4, wall: true }
  def.platforms.push(wall)
  const fixed = sanitizeMap(def)
  registerMap(fixed)
  const game = createGame()
  game.mapChoice = fixed.id
  resetRound(game)
  stepGame(game, [emptyInput()])   // (so the physics knows where everything is now)
  const me = game.players[0]
  for (const part of me.parts) for (let f = part.body.getFixtureList(); f; f = f.getNext()) {
    expect(f.getAABB(0).lowerBound.x).toBeGreaterThan(wall.x + wall.w / 2)
  }
  unregisterMap(fixed.id)
})

it('passes the checks for every built-in map', () => {
  for (const id of Object.keys(MAPS)) {
    expect(checkMap(duplicateMap(id, id)).errors, id).toEqual([])
  }
})

it('gives every theme what the drawing needs, in colors that parse', () => {
  const hex = /^#[0-9a-f]{6}$/i, rgba = /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*(0|1|0?\.\d+)\)$/
  const color = c => hex.test(c) || rgba.test(c)
  const colorsIn = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(colorsIn) : Object.values(v).flatMap(colorsIn))
  for (const [key, t] of Object.entries(THEMES)) {
    for (const field of ['name', 'scenery', 'ink', 'muted', 'platform', 'platformTop', 'wall', 'top', 'shade', 'shadow', 'smoke', 'art']) expect(t[field], `${key}.${field}`).toBeTruthy()
    expect(Boolean(t.sky) !== Boolean(t.bands), `${key}: a sky or bands (one of them)`).toBe(true)
    if (t.bands) expect(t.bands.length, `${key}.bands`).toBe(4)
    for (const c of [t.sky, ...(t.bands || []), t.ink, t.muted, t.platform, t.platformTop, t.wall, t.shade, t.shadow, t.smoke, ...colorsIn(t.art)].filter(Boolean)) expect(color(c), `${key}: ${c}`).toBe(true)
  }
})

it('keeps a map\'s theme when it knows it, and falls back to paper when it doesn\'t', () => {
  const base = duplicateMap('patch', 'Themed')
  for (const key of Object.keys(THEMES)) expect(sanitizeMap({ ...base, theme: key }).theme).toBe(key)
  expect(sanitizeMap({ ...base, theme: 'nope' }).theme).toBe('paper')
  expect(sanitizeMap({ ...base, theme: 'toString' }).theme).toBe('paper')   // (not fooled by what every object has)
  for (const key of ['winter', 'lava', 'synthwave', 'graveyard']) expect(sanitizeMap({ ...base, theme: key }).theme).toBe(key)   // (the themes with no built-in map: custom maps only)
})
