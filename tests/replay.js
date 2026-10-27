// A scripted, seeded run of the game simulation (see replay.test.js). Returns a hash of the
// whole game state for every second of game time, so any change in how the game plays shows up.
// api: the game functions it drives (passed in so this file stays independent of the modules).
import { createHash } from 'node:crypto'

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Bot "players": wander, jump, harvest, throw at whoever is nearest.
function makeBots(rand) {
  const bots = {}
  return (game, slot, step) => {
    const me = game.players.find(p => p.index === slot)
    const b = bots[slot] ||= { dir: 0, next: 0, throwFor: 0, harvestFor: 0 }
    if (step >= b.next) { b.dir = [-1, 0, 1][Math.floor(rand() * 3)]; b.next = step + 10 + Math.floor(rand() * 40) }
    // empty-handed: head for the nearest patch and pull on it
    if (me && !me.held && game.patches.length && rand() < 0.7) {
      const c = me.torso.getPosition()
      const patch = game.patches.reduce((a, p) => (Math.abs(p.x - c.x) < Math.abs(a.x - c.x) ? p : a))
      const dx = patch.x - c.x
      if (Math.abs(dx) > 0.5) b.dir = Math.sign(dx)
      else { b.dir = 0; b.harvestFor = Math.max(b.harvestFor, 2) }
    }
    if (b.throwFor <= 0 && rand() < 0.02) b.throwFor = 5 + Math.floor(rand() * 40)
    if (b.harvestFor <= 0 && rand() < 0.01) b.harvestFor = 40
    const jump = rand() < 0.03, ragdoll = rand() < 0.001
    const nx = (rand() - 0.5) * 2, ny = (rand() - 0.5) * 2
    let aimX = 16, aimY = 6
    if (me) {
      const c = me.torso.getPosition()
      const others = game.players.filter(p => p !== me)
      const t = others.length ? others.reduce((a, p) => {
        const q = p.torso.getPosition()
        return Math.hypot(q.x - c.x, q.y - c.y) < Math.hypot(a.x - c.x, a.y - c.y) ? q : a
      }, others[0].torso.getPosition()) : { x: c.x + 5, y: c.y + 1 }
      aimX = t.x + nx; aimY = t.y + ny
    }
    const input = { left: b.dir < 0, right: b.dir > 0, jump, throw: b.throwFor > 0, harvest: b.harvestFor > 0, ragdoll, aimX, aimY }
    b.throwFor--; b.harvestFor--
    return input
  }
}

export function runReplay(api, { seconds = 180, practiceSeconds = 30 } = {}) {
  const out = []
  const hashStep = (game, events) => createHash('sha1').update(JSON.stringify(api.makeSnapshot(game))).update(JSON.stringify(events)).digest('hex').slice(0, 16)

  // 1) a 4-player match on every map, every pumpkin type common
  {
    const bot = makeBots(mulberry32(1234))
    const game = api.createGame()
    api.setDummies(game, 0)
    for (const slot of [1, 2, 3]) api.addPlayer(game, slot)
    const spawns = api.defaultSpawnSettings()
    for (const k of Object.keys(spawns)) spawns[k] = { on: true, rate: 'common' }
    game.spawnSettings = spawns
    const settings = api.defaultMatchSettings()
    for (const id of api.mapIds()) settings.maps[id] = true
    settings.rounds = 99
    api.startMatch(game, settings)
    let events = []
    const types = api.pumpkinTypeNames().filter(k => k !== 'mini')
    let nextType = 0
    for (let step = 1; step <= seconds * 60; step++) {
      // every 2 s, hand the next pumpkin type to someone empty-handed (so every type gets thrown)
      if (step % 120 === 0) {
        const p = game.players.find(q => !q.held && !q.dead && !q.ko)
        if (p) p.held = { typeName: types[nextType++ % types.length], power: 1, ripeness: 1, ammo: 12, blocks: 0 }
      }
      const inputs = [0, 1, 2, 3].map(slot => bot(game, slot, step))
      api.stepGame(game, inputs)
      events.push(...game.events.splice(0))
      if (step % 60 === 0) { out.push('m' + step / 60 + ':' + hashStep(game, events)); events = [] }
    }
    out.push('match:' + JSON.stringify({ round: game.match.round, scores: game.match.scores, map: game.map }))
  }

  // 2) practice: you + 3 dummies
  {
    const bot = makeBots(mulberry32(99))
    const game = api.createGame()
    api.setDummies(game, 3)
    let events = []
    for (let step = 1; step <= practiceSeconds * 60; step++) {
      const inputs = [bot(game, 0, step)]
      for (const p of game.players) if (p.isDummy) inputs[p.index] = api.dummyInput(game, p)
      api.stepGame(game, inputs)
      events.push(...game.events.splice(0))
      if (step % 60 === 0) { out.push('p' + step / 60 + ':' + hashStep(game, events)); events = [] }
    }
  }
  return out
}
