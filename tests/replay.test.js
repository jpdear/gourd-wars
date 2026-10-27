// Plays a scripted 3-minute, 4-player match on every map (plus 30 s of practice) with fixed
// randomness, and checks it plays out exactly the same as the recorded run in
// __snapshots__/replay.json.
//
// It fails whenever anything changes how the game plays, on purpose or not. If you meant to
// change it (new tuning, a new pumpkin, ...), re-record with:  npx vitest run -u
//
// Only on the computer it was recorded on: the physics is chaotic, so the last-bit differences
// in math (sin, cos, ...) between CPUs and Node versions grow into a different match within
// seconds. (Games aren't affected: only the host runs the physics.) So the deploy skips it, and
// after a Node update it may need re-recording.
import { expect, it } from 'vitest'
import { addPlayer, createGame, setDummies, stepGame } from '../src/game/game.js'
import { dummyInput } from '../src/game/input.js'
import { defaultMatchSettings, startMatch } from '../src/game/match.js'
import { PUMPKIN_TYPE_NAMES, defaultSpawnSettings } from '../src/game/pumpkinTypes.js'
import { makeSnapshot } from '../src/game/snapshot.js'
import { mapIds } from '../src/maps/builtin.js'
import { mulberry32, runReplay } from './replay.js'

it.skipIf(process.env.CI)('plays exactly like the recorded run', async () => {   // (CI: set on GitHub's build machines)
  const random = Math.random
  Math.random = mulberry32(42)   // (the game's own randomness: patch timers, pumpkin types, maps)
  try {
    const out = runReplay({
      createGame, stepGame, makeSnapshot, addPlayer, setDummies, startMatch, defaultMatchSettings,
      defaultSpawnSettings, mapIds, dummyInput, pumpkinTypeNames: () => PUMPKIN_TYPE_NAMES,
    })
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__snapshots__/replay.json')
  } finally {
    Math.random = random
  }
})
