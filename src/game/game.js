// WORLD & LEVEL — creating the game world, stepping it, players coming and going, loading
// maps and resetting rounds.

import * as planck from 'planck'
import { Vec2 } from 'planck'
import { CONFIG, MAX_PLAYERS, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../config.js'
import { emptyInput } from './input.js'
import { SCYTHE_START, buildMover, buildPitchforks, buildScythe, recordHazardContact, resetBales, updateBales, updateHazards, updateMovers } from './level.js'
import { updateMatch } from './match.js'
import { createPatches, resetPatches, updatePatches } from './patches.js'
import { Player } from './player.js'
import { updateAirstrikes, updateBlackHoles } from './powers.js'
import { handlePumpkinContacts, recordPumpkinContact, updatePumpkins } from './pumpkins.js'
import { defaultSpawnSettings } from './pumpkinTypes.js'
import { updateTransition } from './transition.js'
import { MAPS, mapDef } from '../maps/builtin.js'

export function createGame() {
  const world = new planck.World({ gravity: new Vec2(0, -CONFIG.gravity) })
  // events: things that happened this step that the screen should show (e.g. splats)
  // match: null = practice rules (nobody dies, no rounds); see match.js
  // spawnSettings: which pumpkin types grow and how often (the host's menu replaces this object)
  // map: the loaded map; mapChoice: the one to load at the next round reset (set from the menu)
  // roundTime: seconds since the round started (scarecrows spin with it)
  // movers: moving platforms { def, body }; moverTime: how far along their trips they are
  // holes: open Black Holes; strikes: Airstrike targets waiting for their airdrop (see powers.js)
  const game = {
    world, time: 0, players: [], pumpkins: [], patches: [], bales: [], holes: [], strikes: [], contacts: [], events: [],
    nextPumpkinId: 1, nextBaleId: 1, nextHoleId: 1, nextStrikeId: 1, match: null, spawnSettings: defaultSpawnSettings(), sights: false,
    map: null, mapChoice: 'patch', mapBodies: [], scythes: [], movers: [], moverTime: 0, hazardHits: [], roundTime: 0,
    timeScale: 1,       // < 1 = slow motion (after a round's last knockout)
    joining: [],        // slots waiting to jump in at the start of the next round
    transition: null,   // the pan to a new map: { from, elapsed, duration, starts }
  }

  addPlayer(game, 0)
  addPlayer(game, 1, { dummy: true })

  // Can't change bodies in the middle of a physics step, so just record contacts here.
  world.on('begin-contact', contact => {
    recordPumpkinContact(game, contact.getFixtureA(), contact.getFixtureB())
    recordPumpkinContact(game, contact.getFixtureB(), contact.getFixtureA())
    recordHazardContact(game, contact.getFixtureA(), contact.getFixtureB())
    recordHazardContact(game, contact.getFixtureB(), contact.getFixtureA())
  })
  // Pumpkins don't physically shove players; the knockback comes only from applyHit(),
  // so it follows our numbers (damage, stagger, ripeness) instead of raw collision physics.
  world.on('pre-solve', contact => {
    const a = contact.getFixtureA().getBody().getUserData(), b = contact.getFixtureB().getBody().getUserData()
    const pk = a && a.kind === 'pumpkin' ? a.pumpkin : b && b.kind === 'pumpkin' ? b.pumpkin : null
    const other = pk && (a.kind === 'pumpkin' ? b : a)
    if (pk && other && other.kind === 'player') contact.setEnabled(false)
  })
  resetRound(game)
  return game
}

// ---------------------------------------------------------------------
// PLAYERS COMING AND GOING — game.players holds whoever is here, sorted by slot.
// ---------------------------------------------------------------------
export const spawnFor = (map, slot) => map.spawns[slot] || map.spawns[slot % 2] || map.spawns[0]
const playerInSlot = (game, slot) => game.players.find(p => p.index === slot)

export function addPlayer(game, slot, opts = {}) {
  if (playerInSlot(game, slot)) return playerInSlot(game, slot)
  const p = new Player(game.world, { index: slot, name: PLAYER_COLOR_NAMES[slot], color: PLAYER_COLORS[slot], spawn: spawnFor(currentMap(game), slot) })
  p.isDummy = !!opts.dummy
  game.players.push(p)
  game.players.sort((a, b) => a.index - b.index)
  if (game.match) game.match.scores[slot] = 0   // (a fresh start)
  return p
}

export function removePlayer(game, slot) {
  game.joining = game.joining.filter(s => s !== slot)
  const p = playerInSlot(game, slot)
  if (!p) return
  for (const part of p.parts) game.world.destroyBody(part.body)   // (takes the joints with it)
  p.dead = p.removed = true
  p.held = null
  game.players = game.players.filter(q => q !== p)
  for (const pk of game.pumpkins) if (pk.owner === p) pk.owner = null
  const isMine = body => { const ud = body.getUserData(); return ud && ud.player === p }
  game.hazardHits = game.hazardHits.filter(h => !isMine(h.body))
  game.contacts = game.contacts.filter(c => !isMine(c.other))
  if (game.match) game.match.scores[slot] = 0
}

// Someone joins: right away outside a match, otherwise at the start of the next round.
export function queuePlayer(game, slot) {
  if (!game.match) addPlayer(game, slot)
  else if (!game.joining.includes(slot) && !playerInSlot(game, slot)) game.joining.push(slot)
}

// Practice: n dummies in slots 1..n.
export function setDummies(game, n) {
  for (const p of game.players.filter(p => p.isDummy)) removePlayer(game, p.index)
  for (let slot = 1; slot <= n && slot < MAX_PLAYERS; slot++) if (!playerInSlot(game, slot)) addPlayer(game, slot, { dummy: true })
}

// Swap the level: platforms, pitchforks, scarecrows, patches and spawn points (bales come with resetRound).
export function loadMap(game, id) {
  if (!MAPS[id]) id = 'patch'
  const map = MAPS[id]
  for (const body of game.mapBodies) game.world.destroyBody(body)
  game.mapBodies = map.platforms.map(p => {
    const body = game.world.createBody({ type: 'static', position: new Vec2(p.x, p.y) })
    body.createFixture(new planck.Box(p.w / 2, p.h / 2), { friction: 0.8 })
    body.setUserData({ kind: 'platform', ...p })
    return body
  })
  for (const sp of map.spikes) game.mapBodies.push(buildPitchforks(game, sp))
  game.scythes = map.scythes.map(def => ({ def, body: buildScythe(game, def) }))
  game.mapBodies.push(...game.scythes.map(sc => sc.body))
  game.movers = map.movers.map(def => ({ def, body: buildMover(game, def) }))
  game.mapBodies.push(...game.movers.map(m => m.body))
  game.map = id
  game.patches = createPatches(map)
  for (const p of game.players) p.spawn = spawnFor(map, p.index)
}

export const currentMap = game => mapDef(game.map)

// Fresh start: (the chosen map), everyone back at their spawn with empty hands, bales rebuilt,
// patches almost ripe.
export function resetRound(game) {
  if (game.map !== game.mapChoice) loadMap(game, game.mapChoice)
  for (const pk of game.pumpkins) game.world.destroyBody(pk.body)
  game.pumpkins = []
  game.holes = []
  game.strikes = []
  resetBales(game)
  game.roundTime = 0
  for (const sc of game.scythes) sc.body.setTransform(new Vec2(sc.def.x, sc.def.y), SCYTHE_START)
  game.moverTime = 0
  for (const m of game.movers) { m.body.setTransform(new Vec2(m.def.x, m.def.y), 0); m.body.setLinearVelocity(new Vec2(0, 0)) }
  for (const p of game.players) p.respawn()
  resetPatches(game)
}

export function stepGame(game, inputs) {
  game.time += CONFIG.dt                  // real time (also the network clock)
  const dt = CONFIG.dt * game.timeScale   // game time (slower during slow motion)
  game.roundTime += dt
  // being carried to the next map: you can aim but not move or attack
  if (game.transition) inputs = inputs.map(i => ({ ...emptyInput(), aimX: i.aimX, aimY: i.aimY }))
  for (const p of game.players) p.update(inputs[p.index] || emptyInput(), dt, game)   // (inputs by slot)
  updateTransition(game, CONFIG.dt)
  for (const sc of game.scythes) sc.body.setAngularVelocity(-2 * Math.PI / (sc.def.turnTime || CONFIG.level.scytheTurnTime))   // clockwise
  updateMovers(game, dt)
  updateBlackHoles(game, dt)
  updateAirstrikes(game, dt)
  game.world.step(dt, 10, 8)
  handlePumpkinContacts(game)
  updatePumpkins(game, dt)
  updateHazards(game, dt)
  updateBales(game, dt)
  updatePatches(game, dt)
  for (const p of game.players) p.checkDeath(dt, game)
  updateMatch(game, CONFIG.dt)
}
