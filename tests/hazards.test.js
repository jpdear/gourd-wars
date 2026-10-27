import { expect, it } from 'vitest'
import { CONFIG } from '../src/config.js'
import { addPlayer, createGame, setDummies, stepGame } from '../src/game/game.js'
import { emptyInput } from '../src/game/input.js'
import { defaultMatchSettings, startMatch } from '../src/game/match.js'
import { MAPS } from '../src/maps/builtin.js'

// A match on Pitchfork Pit, with the round under way.
function pitMatch() {
  const game = createGame()
  setDummies(game, 0)
  addPlayer(game, 1)
  const settings = defaultMatchSettings()
  settings.maps = { pit: true }
  startMatch(game, settings)
  for (let i = 0; i < 200 && game.match.phase !== 'fight'; i++) stepGame(game, [])
  return game
}

// Put a player's torso at (x, y), standing still.
function moveTo(p, x, y) {
  const c = p.torso.getPosition()
  for (const part of p.parts) {
    const q = part.body.getPosition()
    part.body.setTransform({ x: q.x + x - c.x, y: q.y + y - c.y }, 0)
    part.body.setLinearVelocity({ x: 0, y: 0 })
  }
}

it('pitchforks hurt (with a cooldown) and bounce you up; two touches knock you out', () => {
  const game = pitMatch()
  expect(game.map).toBe('pit')
  const me = game.players[0], fork = MAPS.pit.spikes[0], L = CONFIG.level
  const full = me.health
  moveTo(me, fork.x, fork.y + 1.6)
  let steps = 0
  while (me.spikeTimer === 0 && steps++ < 120) stepGame(game, [emptyInput()])
  expect(me.health).toBe(full - L.spikeDamage)
  expect(me.torso.getLinearVelocity().y).toBeGreaterThan(0)   // popped up
  expect(me.out).toBe(false)

  // still on them within the cooldown: no more damage
  for (let i = 0; i < Math.floor(L.spikeCooldown * 60) - 2; i++) stepGame(game, [emptyInput()])
  expect(me.health).toBe(full - L.spikeDamage)

  // land on them again after it: knocked out
  for (let i = 0; i < 240 && !me.out; i++) stepGame(game, [emptyInput()])
  expect(me.out).toBe(true)
})
