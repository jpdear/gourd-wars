// Playing alone or online: practice, hosting (friends join with a code) or joining a friend's
// game. Only the host runs the game; a guest sends its input and draws the host's snapshots.
// Everything about which of these we're doing is in here: each frame the app just calls
// advanceSession() for what to draw, and sessionStatus() for what to say about it.
import { Peer } from 'peerjs'
import { CONFIG, MAX_PLAYERS } from '../config.js'
import { playerName } from '../render/gfx.js'
import { addPlayer, queuePlayer, removePlayer, resetRound, setDummies, stepGame } from '../game/game.js'
import { dummyInput } from '../game/input.js'
import { describeSettings, startMatch } from '../game/match.js'
import { makeSnapshot, snapPlayer } from '../game/snapshot.js'
import { startTransition } from '../game/transition.js'
import { MAPS, mapDef } from '../maps/builtin.js'
import { registerMap, sanitizeMap, unregisterMap } from '../maps/mapData.js'
import { GuestLink, HostLink } from '../net/links.js'
import { NET, describePeerError, makeCode } from '../net/protocol.js'
import { GAME_VERSION, compareVersions } from '../version.js'
import { customMaps, endPlaytest, playtestId } from './customMaps.js'
import { dummyCount, matchSettings, practiceMap } from './settings.js'
import { app, now, showMessage } from './state.js'

export let mode = 'practice'      // 'practice' | 'host' | 'guest'
export let hostCode = null
let link = null                   // guest: the GuestLink while connected
const links = new Map()           // host: slot → HostLink, one per friend
let peer = null
let joinTimer = null
let sessionMapIds = []            // guest: the host's custom maps, only for this session
let acc = 0                       // real time not yet run as physics steps (practice and host)
let steps = 0                     // physics steps run while friends are here (they get a snapshot every few)

export const friendCount = () => links.size
export const friendNames = () => [...links.keys()].sort().map(slot => playerName(slot)).join(', ')
export const playingAlone = () => mode === 'practice' || (mode === 'host' && !links.size)
// The game this computer runs (practice and the host), or null (a guest only draws the host's).
export const localGame = () => (mode === 'guest' ? null : app.game)

// Run the session for `elapsed` seconds of real time and return the snapshot to draw (null while a
// guest waits for the first one). Practice and the host run the physics in fixed steps (with your
// friends' input, and sending them snapshots); a guest sends its input and blends the host's snapshots.
//   local: this computer's side: takeInput() → your input for one step; show(events) → put on screen
//   what just happened (splats, KOs...)
export function advanceSession(elapsed, local) {
  const { game } = app
  acc += elapsed
  let snap
  if (mode === 'guest' && link) {
    while (acc >= CONFIG.dt) {
      link.sendInput(local.takeInput())
      acc -= CONFIG.dt
    }
    const out = link.advance(elapsed)
    local.show(out.events)
    snap = out.snap
  } else {
    while (acc >= CONFIG.dt) {
      const inputs = [local.takeInput()]   // by slot: you, your friends, the dummies
      for (const [slot, l] of links) inputs[slot] = l.takeInput()
      for (const p of game.players) if (p.isDummy) inputs[p.index] = dummyInput(game, p)
      stepGame(game, inputs)
      const events = game.events.splice(0)
      local.show(events)
      if (links.size) {
        for (const l of links.values()) l.pendingEvents.push(...events)
        if (++steps % NET.snapshotEvery === 0) {
          const shared = makeSnapshot(game)
          for (const l of links.values()) l.sendSnapshot(shared)
        }
      }
      acc -= CONFIG.dt
    }
    snap = makeSnapshot(game)
  }
  if (link) link.tick(now())
  for (const l of links.values()) l.tick(now())
  return snap
}

// The game holds still (the map editor is open): time that passes now isn't made up for later.
export function holdStill() {
  acc = 0
}

// What to say about the session this frame (snap: the one being drawn; localIndex: which player we are):
//   hud      the line shown outside a match
//   wait     the message in the middle of the screen while a guest can't play yet (else '')
//   debug    [the mode and ping, the guest's snapshot buffer] for the debug overlay
export function sessionStatus(snap, localIndex) {
  const pings = [link, ...links.values()].filter(l => l && l.ping !== null).map(l => l.ping)
  const pingText = pings.length ? ` · ping ${Math.round(Math.max(...pings) * 1000)} ms` : ''
  const myColor = playerName(localIndex)
  const hud = mode === 'host' && !links.size ? `Waiting for friends · code ${hostCode || '…'}` : playtestId ? 'Play test' : 'Practice'
  let wait = ''
  if (mode === 'guest' && !snap) wait = 'Waiting for the host…'
  else if (mode === 'guest' && localIndex > 0 && !snapPlayer(snap, localIndex)) wait = `You'll jump in next round as ${myColor}!`
  return { hud, wait, debug: [`mode ${mode}${pingText}`, `snapshots buffered ${link ? link.snaps.length : 0}`] }
}

// One line about what's going on, for the Esc menu.
export function describeSession() {
  const { snap, ui } = app
  if (mode === 'guest') return `Playing online as ${playerName(ui.localIndex)}.${snap && snap.match ? ` Match: ${describeSettings(snap.match)}.` : ''}${snap ? ` Map: ${mapDef(snap.map).name}.` : ''}`
  if (mode === 'host') return links.size ? `Hosting as Blue with ${friendNames()} (code ${hostCode}).` : `Hosting with code ${hostCode || '…'}. Waiting for friends.`
  if (playtestId) return `Play testing "${mapDef(playtestId).name}".`
  return 'Practice mode.'
}

// The host's custom maps, on the guest: only for this session (cleaned up like any other map).
function addSessionMaps(maps) {
  for (const raw of Array.isArray(maps) ? maps.slice(0, 50) : []) {
    const def = sanitizeMap(raw)
    if (!def || (MAPS[def.id] && !sessionMapIds.includes(def.id))) continue   // (never replace our own maps)
    registerMap(def)
    sessionMapIds.push(def.id)
  }
}

// Back to practice: drops any connection, the friends' players and their maps.
export function leaveSession() {
  const { game } = app
  endPlaytest()
  for (const id of sessionMapIds) unregisterMap(id)
  sessionMapIds = []
  clearTimeout(joinTimer)
  const oldLinks = [link, ...links.values()].filter(Boolean)
  link = null              // cleared first so the links' onClose handlers know we meant it
  links.clear()
  for (const l of oldLinks) l.close()
  if (peer) peer.destroy()
  peer = null
  hostCode = null
  mode = 'practice'
  game.match = null
  game.mapChoice = practiceMap
  app.ui.localIndex = 0
  for (const p of [...game.players]) if (p.index !== 0) removePlayer(game, p.index)
  setDummies(game, dummyCount)
  app.tuning.setEnabled(true)
}

export function startHosting() {
  const { menu } = app
  leaveSession()
  resetRound(app.game)
  mode = 'host'
  menu.show('host')
  menu.setText('host-code', '····')
  menu.setText('host-status', 'Getting a code…')
  const open = () => {
    const code = makeCode()
    const p = peer = new Peer(NET.idPrefix + code, { debug: 1 })
    p.on('open', () => {
      hostCode = code
      menu.setText('host-code', code)
      showHostStatus()
    })
    p.on('connection', onGuestConnection)
    // lost the matchmaking server (not your friend): reconnect so people can still join
    p.on('disconnected', () => { if (peer === p) p.reconnect() })
    p.on('error', err => {
      if (peer !== p) return
      if (err.type === 'unavailable-id') { p.destroy(); open(); return }   // code taken, pick another
      if (links.size) { console.warn('peer error while playing', err); return }
      menu.setText('host-status', describePeerError(err))
    })
  }
  open()
}

function showHostStatus() {
  if (!hostCode) return
  app.menu.setText('host-status', links.size
    ? `Playing with ${friendNames()}. ${links.size < MAX_PLAYERS - 1 ? 'More friends can join with the same code.' : 'The game is full.'}`
    : '')
}

// A friend connects: once their hello shows the same version as ours, they get the first free
// color. (A different version is turned away: they're told ours by our own hello.)
function onGuestConnection(conn) {
  conn.on('open', () => {
    if (mode !== 'host') { conn.close(); return }
    let admitted = false
    const l = new HostLink(conn, {
      onHello: version => {
        if (admitted) return
        if (version !== GAME_VERSION) {
          const cmp = compareVersions(version, GAME_VERSION)
          const text = cmp > 0 ? `A friend tried to join with a newer version (${version}, you have ${GAME_VERSION}). Refresh this page to update!`
            : cmp < 0 ? `A friend tried to join with an older version (${version}). They need to refresh their page.`
            : `A friend tried to join with a different build (${version}, you have ${GAME_VERSION}).`
          showMessage(text, 8)
          app.menu.setText('host-status', text)   // (also on the host screen, where the card covers the message)
          setTimeout(() => l.close(), 500)   // (time for our hello to reach them, so they know why)
          return
        }
        const slot = [1, 2, 3].find(k => !links.has(k))
        if (slot === undefined) { l.send({ t: 'full' }); setTimeout(() => l.close(), 500); return }
        admitted = true
        admitGuest(l, slot)
      },
      onClose: () => l.handlers.onLeave?.(),
      onWarning: text => showMessage(text, 8),
    }, now())
    setTimeout(() => { if (!admitted) l.close() }, NET.helloTimeout)
  })
}

// The first friend starts a match; anyone after that jumps in at the start of the next round.
function admitGuest(l, slot) {
  const { game } = app
  const name = playerName(slot)
  l.handlers.onLeave = () => {
    if (links.get(slot) !== l) return
    links.delete(slot)
    removePlayer(game, slot)
    showHostStatus()
    if (!links.size) {   // everyone left: back to playing alone
      game.match = null
      setDummies(game, dummyCount)
      startTransition(game, practiceMap)
      showMessage(`${name} left. Code ${hostCode} still works if anyone wants to join.`, 5)
    } else showMessage(`${name} left.`)
  }
  links.set(slot, l)
  l.send({ t: 'maps', maps: customMaps })   // before any snapshot can use one
  l.send({ t: 'welcome', slot })
  if (!game.match) {
    setDummies(game, 0)
    addPlayer(game, slot)
    startMatch(game, matchSettings)
    app.menu.hide()
    showMessage(`${name} joined!`)
  } else {
    queuePlayer(game, slot)
    showMessage(`${name} joined! They'll jump in next round.`)
  }
  showHostStatus()
}

export function joinGame(code) {
  const { menu, ui } = app
  leaveSession()
  menu.show('join')
  menu.setShown('update', false)
  if (!/^[A-Z0-9]{4}$/.test(code)) { menu.setText('join-status', 'Codes are 4 letters/numbers.'); return }
  menu.setText('join-status', 'Connecting…')
  const p = peer = new Peer({ debug: 1 })
  const fail = text => {
    if (peer !== p) return
    leaveSession()
    menu.show('join')
    menu.setText('join-status', text)
  }
  joinTimer = setTimeout(() => fail("Couldn't connect in time. Check the code and try again."), NET.connectTimeout)
  p.on('error', err => {
    if (link) { console.warn('peer error while playing', err); return }
    fail(describePeerError(err))
  })
  p.on('open', () => {
    const conn = p.connect(NET.idPrefix + code, { reliable: true, serialization: 'json' })
    conn.on('open', () => {
      if (peer !== p) { conn.close(); return }
      clearTimeout(joinTimer)
      joinTimer = setTimeout(() => fail("The host didn't let us in. Try again."), NET.connectTimeout)
      mode = 'guest'
      ui.localIndex = -1   // (until the host says which player we are)
      app.tuning.setEnabled(false)
      const l = link = new GuestLink(conn, {
        onHello: version => {
          if (version === GAME_VERSION) return
          const cmp = compareVersions(version, GAME_VERSION)
          if (cmp > 0) {
            fail(`The host has a newer version of Gourd Wars (${version}, you have ${GAME_VERSION}). Update, then join again.`)
            menu.setShown('update', true)
          } else if (cmp < 0) {
            fail(`The host has an older version of Gourd Wars (${version || 'unknown'}, you have ${GAME_VERSION}). Ask them to refresh their page, then try again.`)
          } else {
            fail(`The host is running a different build of Gourd Wars (${version}, you have ${GAME_VERSION}).`)
          }
        },
        onClose: () => {
          if (link !== l) return
          if (ui.localIndex < 0) { fail("Couldn't join that game. Try again."); return }   // (never let in)
          leaveSession()
          menu.show('main')
          menu.setText('main-status', 'Lost connection to the host.')
        },
        onFull: () => fail(`That game is full (${MAX_PLAYERS} players).`),
        onWarning: text => showMessage(text, 8),
        onMaps: maps => addSessionMaps(maps),
        onWelcome: slot => {   // we're in
          clearTimeout(joinTimer)
          ui.localIndex = slot
          menu.hide()
          showMessage(`You're ${playerName(slot)}!`)
        },
      }, now())
    })
  })
}
