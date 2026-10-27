// This browser's custom maps (made in the map editor): the My Maps list, opening the editor,
// play testing, and sharing maps as codes.
import { loadMap, resetRound } from '../game/game.js'
import { MAPS, mapIds } from '../maps/builtin.js'
import {
  MAP_CODE_PREFIX, decodeMapCode, duplicateMap, encodeMapCode, loadCustomMaps, registerMap, sanitizeMap, saveCustomMaps, unregisterMap,
} from '../maps/mapData.js'
import { createEditor } from '../ui/editor/editor.js'
import { resize } from './app.js'
import { clearControls } from './controls.js'
import { leaveSession } from './session.js'
import { changeSettings, chooseMap, matchSettings, practiceMap } from './settings.js'
import { app, showMessage } from './state.js'

export let customMaps = []
export let playtestId = null   // playing a map from the editor (the Esc menu's Exit goes back to the editor)
let deleteArmed = null         // the map whose Delete was clicked once
let exportCode = ''

// Load the saved maps (before the menus are built: the map pickers list them).
export function loadMyMaps() {
  customMaps = loadCustomMaps()
  for (const def of customMaps) registerMap(def)
}

export function createMapEditor() {
  app.editor = createEditor(app.canvas, app.view, {
    onSave: def => storeCustomMap(sanitizeMap(def)),
    onPlaytest: id => startPlaytest(id),
    onExit: () => {
      closeEditor()
      showMyMaps()
    },
  })
}

function refreshMapMenus() {
  app.menu.rebuildMaps()
  app.menu.showMap(practiceMap)
  app.menu.showRotation(matchSettings.maps)
}

// "My map" → "My map (2)" if that name's taken
function uniqueName(name, id) {
  const taken = n => customMaps.some(d => d.name === n && d.id !== id)
  for (let i = 2; taken(name); i++) name = `${name.replace(/ \(\d+\)$/, '').slice(0, 26)} (${i})`
  return name
}

// add or update one of this browser's maps: saved, playable, and (if new) in the rotation
function storeCustomMap(def) {
  const i = customMaps.findIndex(d => d.id === def.id)
  if (i >= 0) customMaps[i] = def
  else customMaps.push(def)
  saveCustomMaps(customMaps)
  registerMap(def)
  if (matchSettings.maps[def.id] === undefined) changeSettings(m => { m.maps[def.id] = true })
  refreshMapMenus()
}

function removeCustomMap(id) {
  customMaps = customMaps.filter(d => d.id !== id)
  saveCustomMaps(customMaps)
  unregisterMap(id)
  changeSettings(m => {
    delete m.maps[id]
    if (!mapIds().some(k => m.maps[k])) m.maps.patch = true   // keep at least one map on
  })
  if (practiceMap === id) chooseMap('patch')
  if (app.game.map === id) { app.game.mapChoice = practiceMap; resetRound(app.game) }
  refreshMapMenus()
}

export function showMyMaps(status = '') {
  deleteArmed = null
  app.menu.showMyMaps(customMaps, null)
  app.menu.setText('maps-status', status)
  app.menu.show('maps')
}

// load a map fresh (it may have been edited since it was last loaded)
function reloadMap(id) {
  app.game.mapChoice = id
  loadMap(app.game, id)
  resetRound(app.game)
}

export function openEditor(id) {
  const def = customMaps.find(d => d.id === id)
  if (!def) { showMyMaps(); return }
  leaveSession()
  app.menu.hide()
  app.editor.open(def)
  resize()
}

function closeEditor() {
  if (!app.editor.active) return
  app.editor.close()
  resize()
  clearControls()
  reloadMap(practiceMap)
}

function startPlaytest(id) {
  if (!MAPS[id] || MAPS[id].playable === false) return
  leaveSession()
  closeEditor()
  playtestId = id
  reloadMap(id)
  app.menu.hide()
  showMessage(`Play testing "${MAPS[id].name}". Press Esc to get back to the editor.`, 4)
}

// Leaving a play test: back to the practice map.
export function endPlaytest() {
  if (playtestId) { playtestId = null; reloadMap(practiceMap) }
}

// --- the Map Editor menu's buttons ---

export function newMap() {
  const def = sanitizeMap({
    name: uniqueName('My map'), theme: 'paper',
    platforms: [{ x: 16, y: 3, w: 24, h: 1 }], spawns: [{ x: 9, y: 3.5 }, { x: 23, y: 3.5 }], patches: [{ x: 16, y: 3.5 }],
  })
  storeCustomMap(def)
  openEditor(def.id)
}

export function importMapCode() {
  const def = decodeMapCode(app.menu.mapCode)
  if (!def) { app.menu.setText('import-status', "That doesn't look like a map code. It should start with " + MAP_CODE_PREFIX); return }
  def.name = uniqueName(def.name)
  storeCustomMap(def)
  showMyMaps(`Imported "${def.name}".`)
}

export function copyExportCode() {
  navigator.clipboard.writeText(exportCode).then(() => app.menu.setText('export-status', 'Copied!'),
    () => app.menu.setText('export-status', 'Select the code above and copy it (Ctrl/Cmd+C).'))
}

// "start from a copy of a built-in map"
export function duplicateBuiltin(id) {
  const def = duplicateMap(id, uniqueName(`${MAPS[id].name} copy`))
  storeCustomMap(def)
  openEditor(def.id)
}

// One of a map's buttons in the My Maps list: map-play, map-edit, map-copy, map-code, map-delete.
export function myMapAction(what, id) {
  const def = customMaps.find(d => d.id === id)
  if (!def) return
  if (what === 'map-play') startPlaytest(id)
  else if (what === 'map-edit') openEditor(id)
  else if (what === 'map-copy') { storeCustomMap(duplicateMap(id, uniqueName(`${def.name.slice(0, 27)} copy`))); showMyMaps() }
  else if (what === 'map-code') {
    exportCode = encodeMapCode(def)
    app.menu.setText('export-title', `Map code for "${def.name}". Anyone can paste it into Map Editor → Import a Map Code.`)
    app.menu.setText('export-status', '')
    app.menu.showExportCode(exportCode)
    app.menu.show('export')
  } else if (what === 'map-delete') {
    if (deleteArmed !== id) { deleteArmed = id; app.menu.showMyMaps(customMaps, id); return }
    removeCustomMap(id)
    showMyMaps(`Deleted "${def.name}".`)
  }
}
