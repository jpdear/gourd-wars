// What the menu buttons do (ui/menu.js reports each click as an action name), and the menus
// whose contents depend on what's going on: the Esc menu, Match Settings and Settings.
//
// Match Settings is one screen shown in three contexts (MATCH_CONTEXTS): Host Setup and Practice Setup
// (from the Play screen, before the game starts) and in game (from the Esc menu or the host's lobby).
// Settings (your own: gameplay toggles, keybinds) opens from the main menu or the Esc menu.
import { resetRound } from '../game/game.js'
import { startMatch } from '../game/match.js'
import { mapIds } from '../maps/builtin.js'
import { GAME_URL, GAME_VERSION } from '../version.js'
import {
  copyExportCode, duplicateBuiltin, importMapCode, myMapAction, newMap, openEditor, playtestId, showMyMaps,
} from './customMaps.js'
import { describeSession, friendCount, hostCode, joinGame, leaveSession, mode, playingAlone, startHosting } from './session.js'
import { captureBind } from './controls.js'
import { feedbackReady, feedbackWait, sendFeedback } from './feedback.js'
import { binds, resetBinds, setBind } from './keybinds.js'
import { changeDummies, changeSettings, changeSpawns, chooseMap, dummyCount, matchSettings, togglePref } from './settings.js'
import { app } from './state.js'

let listReturnTo = 'main'       // the menu screen Pumpkins' "Done" goes back to
let matchReturnTo = 'host'      // (same for Match Settings in game)
let settingsReturnTo = 'main'   // (same for Settings)
let matchContext = 'in-game'    // which MATCH_CONTEXTS Match Settings is showing
let settingsTab = 'gameplay'    // Settings' open tab (kept while the page is open)
let feedbackCategory = 'Bug'    // Feedback's picked category

// what the Feedback screen says after Send, by sendFeedback's status
const FEEDBACK_TEXT = {
  sent: () => 'Thanks! We got it.',
  empty: () => 'Write something first.',
  wait: () => `You can send more in ${feedbackWait()} s.`,
  busy: () => 'Sending…',
  offline: () => "Couldn't send. Check your connection.",
  'not-set-up': () => "Feedback isn't set up yet.",
}

// Every button's action, by name. A button's data-act is the name plus any arguments, separated
// by colons ("map:hayloft", "pk-rate:frost:superrare"); they're handed to the action.
const ACTIONS = {
  // main menu, Play (host, join, practice)
  'show-play': () => app.menu.show('play'),
  'play-back': () => { app.menu.show('main'); app.menu.setText('main-status', '') },
  'host-setup': () => openMatchSettings('host-setup'),
  'practice-setup': () => openMatchSettings('practice-setup'),
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
  leave: () => { leaveSession(); app.menu.show('play') },   // (Back from hosting or joining)
  exit: () => {   // (a play test goes back to the editor)
    if (playtestId) { const id = playtestId; leaveSession(); openEditor(id) }
    else { leaveSession(); app.menu.show('main'); app.menu.setText('main-status', '') }
  },
  'copy-code': () => { if (hostCode) navigator.clipboard.writeText(hostCode).catch(() => {}) },

  // Match Settings
  'show-match': () => { matchReturnTo = app.menu.screen; openMatchSettings('in-game') },
  'match-primary': () => MATCH_CONTEXTS[matchContext].go(),
  'match-back': () => closeMatchSettings(),
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
    if (mode !== 'host' || !friendCount()) return
    startMatch(app.game, matchSettings)
    app.menu.hide()
  },

  // Pumpkins
  'show-pumpkins': () => { listReturnTo = app.menu.screen; app.menu.show('pumpkins', { solid: app.menu.solid }) },
  'pumpkins-done': () => closeListSettings(),

  // Settings (yours): Gameplay, Controls (keybinds), Graphics
  'show-settings': () => {
    settingsReturnTo = app.menu.screen
    app.menu.show('settings', { solid: app.menu.solid })
    app.menu.showTab(settingsTab)
    app.menu.showBinds(binds)
  },
  'settings-tab': name => { settingsTab = name; app.menu.showTab(name) },
  'settings-done': () => closeSettings(),
  'pref-toggle': name => togglePref(name),
  bind: action => {
    app.menu.showBinds(binds, action)
    captureBind(code => {
      if (code) setBind(action, code)
      app.menu.showBinds(binds)
    })
  },
  'reset-binds': () => { resetBinds(); app.menu.showBinds(binds) },
  'pk-toggle': k => changeSpawns(st => { st[k].on = !st[k].on }),
  'pk-rate': (k, rate) => changeSpawns(st => { st[k].rate = rate }),

  // Feedback
  'show-feedback': () => {
    app.menu.show('feedback')
    app.menu.showFeedbackCategory(feedbackCategory)
    app.menu.setText('feedback-status', feedbackReady() ? '' : FEEDBACK_TEXT['not-set-up']())
  },
  'feedback-cat': cat => { feedbackCategory = cat; app.menu.showFeedbackCategory(cat) },
  'feedback-send': () => {
    const { menu } = app
    menu.setText('feedback-status', FEEDBACK_TEXT.busy())
    const info = `v${GAME_VERSION} | ${mode} | ${innerWidth}x${innerHeight} | ${navigator.userAgent}`
    sendFeedback({ category: feedbackCategory, ...menu.feedback }, info).then(status => {
      menu.setText('feedback-status', FEEDBACK_TEXT[status]())
      if (status === 'sent') menu.clearFeedback()
    })
  },
  'feedback-back': () => app.menu.show('main'),

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

export function openPauseMenu() {
  const { menu } = app
  menu.show('paused')
  menu.setText('paused-info', describeSession())
  menu.setText('exit-label', playtestId ? 'Exit to Editor' : 'Exit')
  menu.setShown('match-menu', mode !== 'guest')   // (a guest plays by the host's match settings)
}

// Match Settings' contexts: its title, whether it's out of the game (the title art behind it, not the
// arena), its main button (label and what it does), where Back (and Esc) go, and which parts show
// (the data-show keys in index.html).
const MATCH_CONTEXTS = {
  'host-setup': {
    title: 'Host Game', solid: true, primary: 'Open Lobby',
    go: () => startHosting(),
    back: () => app.menu.show('play'),
    shown: () => ['match-length', 'rotation', 'host-settings', 'match-back'],
  },
  'practice-setup': {
    title: 'Practice', solid: true, primary: 'Start',
    go: () => ACTIONS.practice(),
    back: () => app.menu.show('play'),
    shown: () => ['practice-map', 'dummies', 'host-settings', 'match-back'],
  },
  // from the Esc menu or the host's lobby: just the parts that apply right now
  'in-game': {
    title: 'Match Settings', solid: undefined, primary: 'Done',
    go: () => closeMatchSettings(),
    back: () => (matchReturnTo === 'paused' ? openPauseMenu() : app.menu.show(matchReturnTo)),
    shown: () => [
      mode === 'host' && 'match-length', mode === 'host' && 'rotation',
      playingAlone() && !playtestId && 'practice-map', playingAlone() && !playtestId && 'dummies',
      mode !== 'guest' && 'host-settings', mode === 'host' && friendCount() > 0 && 'restart',
    ],
  },
}
const MATCH_PARTS = ['match-length', 'rotation', 'practice-map', 'dummies', 'host-settings', 'restart', 'match-back']

function openMatchSettings(context) {
  const { menu } = app, c = MATCH_CONTEXTS[context], shown = c.shown()
  matchContext = context
  menu.show('match', { title: c.title, solid: c.solid })
  for (const key of MATCH_PARTS) menu.setShown(key, shown.includes(key))
  menu.setText('match-primary', c.primary)
}

// Done / Back / Esc: back to where they were opened from
export const closeListSettings = () => (listReturnTo === 'match' ? openMatchSettings(matchContext) : app.menu.show(listReturnTo))
export const closeMatchSettings = () => MATCH_CONTEXTS[matchContext].back()
export const closeSettings = () => (settingsReturnTo === 'paused' ? openPauseMenu() : app.menu.show(settingsReturnTo))
