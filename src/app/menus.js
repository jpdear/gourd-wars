// What the menu buttons do (ui/menu.js reports each click as an action name), and the menus
// whose contents depend on what's going on: the Esc menu and Settings.
import { PLAYER_COLOR_NAMES } from '../config.js'
import { resetRound } from '../game/game.js'
import { describeSettings, startMatch } from '../game/match.js'
import { mapDef, mapIds } from '../maps/builtin.js'
import { GAME_URL } from '../version.js'
import {
  copyExportCode, duplicateBuiltin, importMapCode, myMapAction, newMap, openEditor, playtestId, showMyMaps,
} from './customMaps.js'
import { friendNames, hostCode, joinGame, leaveSession, links, mode, playingAlone, startHosting } from './session.js'
import { changeDummies, changeSettings, changeSpawns, chooseMap, dummyCount, matchSettings } from './settings.js'
import { app } from './state.js'

let pumpkinsReturnTo = 'main'   // the menu screen "Done" goes back to
let matchReturnTo = 'host'      // (same for Match Settings)

// Every button's action, by name. A button's data-act is the name plus any arguments, separated
// by colons ("map:hayloft", "pk-rate:frost:rare"); they're handed to the action.
const ACTIONS = {
  // main menu, hosting and joining
  host: () => startHosting(),
  'show-join': () => { app.menu.show('join'); app.menu.setText('join-status', ''); app.menu.setShown('update', false) },
  connect: () => joinGame(app.menu.joinCode),
  update: () => {
    // the hosted page: fetch it fresh (so the reload can't come from the browser's cache) and reload;
    // a downloaded copy can't update itself, so open the hosted one
    if (location.protocol === 'file:') location.href = GAME_URL
    else fetch(location.href, { cache: 'reload' }).catch(() => {}).finally(() => location.reload())
  },
  practice: () => { leaveSession(); resetRound(app.game); app.menu.hide() },
  resume: () => app.menu.hide(),
  leave: () => { leaveSession(); app.menu.show('main'); app.menu.setText('main-status', '') },
  exit: () => {   // (a play test goes back to the editor)
    if (playtestId) { const id = playtestId; leaveSession(); openEditor(id) }
    else { leaveSession(); app.menu.show('main'); app.menu.setText('main-status', '') }
  },
  'copy-code': () => { if (hostCode) navigator.clipboard.writeText(hostCode).catch(() => {}) },

  // Match Settings / Settings
  'show-match': () => { matchReturnTo = app.menu.screen; openSettings() },
  'match-done': () => closeMatchSettings(),
  mode: mode => changeSettings(m => { m.mode = mode }),
  'num-down': () => changeSettings(m => { if (m.mode === 'rounds') m.rounds--; else m.wins-- }),
  'num-up': () => changeSettings(m => { if (m.mode === 'rounds') m.rounds++; else m.wins++ }),
  rot: id => changeSettings(m => {
    m.maps[id] = !m.maps[id]
    if (!mapIds().some(k => m.maps[k])) m.maps[id] = true   // keep at least one map on
  }),
  'order-toggle': () => changeSettings(m => { m.shuffle = !m.shuffle }),
  'sights-toggle': () => changeSettings(m => { m.sights = !m.sights }),
  map: id => chooseMap(id),
  'dummies-down': () => changeDummies(dummyCount - 1),
  'dummies-up': () => changeDummies(dummyCount + 1),
  restart: () => {
    if (mode !== 'host' || !links.size) return
    startMatch(app.game, matchSettings)
    app.menu.hide()
  },

  // Pumpkins
  'show-pumpkins': () => { pumpkinsReturnTo = app.menu.screen; app.menu.show('pumpkins') },
  'pumpkins-done': () => closePumpkinSettings(),
  'pk-toggle': k => changeSpawns(st => { st[k].on = !st[k].on }),
  'pk-rate': (k, rate) => changeSpawns(st => { st[k].rate = rate }),

  // Map Editor (My Maps)
  'show-maps': () => showMyMaps(),
  'maps-back': () => app.menu.show('main'),
  'map-new': () => newMap(),
  'show-import': () => { app.menu.show('import'); app.menu.setText('import-status', '') },
  'map-import': () => importMapCode(),
  'export-copy': () => copyExportCode(),
  dup: id => duplicateBuiltin(id),
  'map-play': id => myMapAction('map-play', id),
  'map-edit': id => myMapAction('map-edit', id),
  'map-copy': id => myMapAction('map-copy', id),
  'map-code': id => myMapAction('map-code', id),
  'map-delete': id => myMapAction('map-delete', id),
}

export function onMenuAction(act) {
  const [name, ...args] = act.split(':')
  if (ACTIONS[name]) ACTIONS[name](...args)
  else if (import.meta.env.DEV) console.warn(`No menu action called "${name}" (data-act="${act}")`)
}

// One line about what's going on, for the Esc menu.
function describeSession() {
  const { snap, ui } = app
  if (mode === 'guest') return `Playing online as ${PLAYER_COLOR_NAMES[ui.localIndex] || '…'}.${snap && snap.match ? ` Match: ${describeSettings(snap.match)}.` : ''}${snap ? ` Map: ${mapDef(snap.map).name}.` : ''}`
  if (mode === 'host') return links.size ? `Hosting as Blue with ${friendNames()} (code ${hostCode}).` : `Hosting with code ${hostCode || '…'}. Waiting for friends.`
  if (playtestId) return `Play testing "${mapDef(playtestId).name}".`
  return 'Practice mode.'
}

export function openPauseMenu() {
  const { menu } = app
  menu.show('paused')
  menu.setText('paused-info', describeSession())
  menu.setShown('settings', mode !== 'guest')   // (guests play by the host's settings)
  menu.setText('exit-label', playtestId ? 'Exit to Editor' : 'Exit')
}

// Match Settings (from the host screen) / Settings (from the Esc menu): just the parts that apply right now
function openSettings() {
  const { menu } = app
  menu.show('match', matchReturnTo === 'paused' ? 'Settings' : 'Match Settings')
  menu.setShown('match-length', mode === 'host')
  menu.setShown('rotation', mode === 'host')
  menu.setShown('practice-map', playingAlone() && !playtestId)
  menu.setShown('dummies', playingAlone() && !playtestId)
  menu.setShown('restart', mode === 'host' && links.size > 0)
}

export const closePumpkinSettings = () => (pumpkinsReturnTo === 'match' ? openSettings() : app.menu.show(pumpkinsReturnTo))
export const closeMatchSettings = () => (matchReturnTo === 'paused' ? openPauseMenu() : app.menu.show(matchReturnTo))
