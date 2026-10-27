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

export function onMenuAction(act) {
  const { menu, game } = app
  if (act === 'host') startHosting()
  else if (act === 'show-join') { menu.show('join'); menu.setText('join-status', ''); menu.setShown('update', false) }
  else if (act === 'update') {
    // the hosted page: fetch it fresh (so the reload can't come from the browser's cache) and reload;
    // a downloaded copy can't update itself, so open the hosted one
    if (location.protocol === 'file:') location.href = GAME_URL
    else fetch(location.href, { cache: 'reload' }).catch(() => {}).finally(() => location.reload())
  }
  else if (act === 'connect') joinGame(menu.joinCode)
  else if (act === 'practice') { leaveSession(); resetRound(game); menu.hide() }
  else if (act === 'resume') menu.hide()
  else if (act === 'leave') { leaveSession(); menu.show('main'); menu.setText('main-status', '') }
  else if (act === 'copy-code' && hostCode) navigator.clipboard.writeText(hostCode).catch(() => {})
  else if (act.startsWith('mode-')) changeSettings(m => { m.mode = act.slice(5) })
  else if (act === 'num-down' || act === 'num-up') {
    const d = act === 'num-up' ? 1 : -1
    changeSettings(m => { if (m.mode === 'rounds') m.rounds += d; else m.wins += d })
  } else if (act === 'restart' && mode === 'host' && links.size) { startMatch(game, matchSettings); menu.hide() }
  else if (act === 'dummies-down' || act === 'dummies-up') changeDummies(dummyCount + (act === 'dummies-up' ? 1 : -1))
  else if (act === 'order-toggle') changeSettings(m => { m.shuffle = !m.shuffle })
  else if (act === 'show-match') { matchReturnTo = menu.screen; openSettings() }
  else if (act === 'match-done') closeMatchSettings()
  else if (act === 'show-pumpkins') { pumpkinsReturnTo = menu.screen; menu.show('pumpkins') }
  else if (act === 'pumpkins-done') closePumpkinSettings()
  else if (act.startsWith('map:')) chooseMap(act.slice(4))
  else if (act.startsWith('rot:')) {
    const id = act.slice(4)
    changeSettings(m => {
      m.maps[id] = !m.maps[id]
      if (!mapIds().some(k => m.maps[k])) m.maps[id] = true   // keep at least one map on
    })
  }
  else if (act === 'show-maps') showMyMaps()
  else if (act === 'maps-back') menu.show('main')
  else if (act === 'map-new') newMap()
  else if (act === 'show-import') { menu.show('import'); menu.setText('import-status', '') }
  else if (act === 'map-import') importMapCode()
  else if (act === 'export-copy') copyExportCode()
  else if (act === 'exit') {   // (a play test goes back to the editor)
    if (playtestId) { const id = playtestId; leaveSession(); openEditor(id) }
    else { leaveSession(); menu.show('main'); menu.setText('main-status', '') }
  }
  else if (act.startsWith('dup:')) duplicateBuiltin(act.slice(4))
  else if (act.startsWith('map-')) myMapAction(...act.split(':'))
  else if (act.startsWith('pk-toggle:')) changeSpawns(st => { const k = act.split(':')[1]; st[k].on = !st[k].on })
  else if (act.startsWith('pk-rate:')) changeSpawns(st => { const [, k, rate] = act.split(':'); st[k].rate = rate })
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
