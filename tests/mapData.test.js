import { expect, it } from 'vitest'
import { CONFIG, MAX_PLAYERS } from '../src/config.js'
import { MAPS } from '../src/maps/builtin.js'
import { MAP_CODE_PREFIX, MAP_LIMITS, checkMap, decodeMapCode, duplicateMap, encodeMapCode, sanitizeMap } from '../src/maps/mapData.js'

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

it('passes the checks for every built-in map', () => {
  for (const id of Object.keys(MAPS)) {
    expect(checkMap(duplicateMap(id, id)).errors, id).toEqual([])
  }
})
