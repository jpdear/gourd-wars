// The player's saved choices (this browser): which pumpkins grow, the practice map, the match
// settings and the practice dummies. Changing one saves it and updates the menus.
import { MAX_PLAYERS } from '../config.js'
import { setDummies } from '../game/game.js'
import { MATCH_MODES, defaultMatchSettings, defaultRotation } from '../game/match.js'
import { SPAWNABLE_TYPES, SPAWN_RATES, defaultSpawnSettings } from '../game/pumpkinTypes.js'
import { startTransition } from '../game/transition.js'
import { MAPS } from '../maps/builtin.js'
import { clamp } from '../util/math.js'
import { STORAGE_KEYS, loadJSON, loadText, saveJSON, saveText } from '../util/storage.js'
import { playingAlone } from './session.js'
import { app } from './state.js'

// which pumpkins grow and how often: the host's choice (also used in practice)
export const spawnSettings = defaultSpawnSettings()
// the practice map (practice and waiting for a friend); matches use the rotation instead
export let practiceMap = 'patch'
// the host's choice; game.match.settings points at this (filled in by loadSettings)
export const matchSettings = {}
// practice dummies (0-3, your choice): around while you play alone, gone once a friend joins
export let dummyCount = 1

// Load the saved choices. (After the custom maps are registered: the practice map may be one.)
export function loadSettings(game) {
  const spawns = loadJSON(STORAGE_KEYS.spawns) || {}
  for (const k of SPAWNABLE_TYPES) {
    if (spawns[k]) spawnSettings[k] = { on: !!spawns[k].on, rate: SPAWN_RATES[spawns[k].rate] ? spawns[k].rate : spawnSettings[k].rate }
  }
  game.spawnSettings = spawnSettings

  const map = loadText(STORAGE_KEYS.practiceMap)
  if (MAPS[map]) practiceMap = map
  game.mapChoice = practiceMap

  Object.assign(matchSettings, defaultMatchSettings(), loadJSON(STORAGE_KEYS.match) || {})
  if (!MATCH_MODES.includes(matchSettings.mode)) matchSettings.mode = 'rounds'
  matchSettings.shuffle = matchSettings.shuffle !== false
  matchSettings.maps = { ...defaultRotation(), ...(matchSettings.maps || {}) }   // (new maps start on)

  const dummies = loadText(STORAGE_KEYS.dummies)
  if (dummies !== null && Number.isFinite(Number(dummies))) dummyCount = clamp(Math.round(Number(dummies)), 0, MAX_PLAYERS - 1)
}

// Show them all in the menus (once those exist).
export function showSettings() {
  const { menu } = app
  menu.showSettings(matchSettings)
  menu.showRotation(matchSettings.maps)
  menu.showSpawnSettings(spawnSettings)
  menu.showMap(practiceMap)
}

export function changeSpawns(fn) {
  fn(spawnSettings)
  saveJSON(STORAGE_KEYS.spawns, spawnSettings)
  app.menu.showSpawnSettings(spawnSettings)
}

export function chooseMap(id) {
  practiceMap = id
  saveText(STORAGE_KEYS.practiceMap, id)
  app.menu.showMap(id)
  if (!app.game.match && id !== app.game.map) startTransition(app.game, id)   // pan over to it right away
}

export function changeSettings(fn) {
  fn(matchSettings)
  matchSettings.rounds = clamp(Math.round(matchSettings.rounds), 1, 99)
  matchSettings.wins = clamp(Math.round(matchSettings.wins), 1, 50)
  saveJSON(STORAGE_KEYS.match, matchSettings)
  app.menu.showSettings(matchSettings)
  app.menu.showRotation(matchSettings.maps)
}

export function changeDummies(n) {
  dummyCount = clamp(n, 0, MAX_PLAYERS - 1)
  saveText(STORAGE_KEYS.dummies, String(dummyCount))
  app.menu.setText('dummy-count', String(dummyCount))
  app.menu.setText('wait-play', dummyCount ? 'Play vs Dummies While Waiting' : 'Play While Waiting')
  if (playingAlone()) setDummies(app.game, dummyCount)
}
