// MATCH — rounds and scoring (host only; game.match is null in practice).
//   transition (pan to the map) → fight → roundOver (slow motion, "Blue wins!") →
//   (transition to the next round's map | matchOver → new match)
// Settings (picked by the host): { mode: 'rounds' | 'wins' | 'endless', rounds, wins, maps, shuffle }
//   rounds:  play this many rounds, most wins takes it (tied → sudden-death rounds)
//   wins:    first to this many round wins
//   endless: just keep score
//   maps:    which maps are in the rotation ({ mapId: true/false })
//   shuffle: true → every round is a random one of them, never the same twice in a row;
//            false → they're played in the order the menu lists them, starting from the first

import { CONFIG, MAX_PLAYERS } from '../config.js'
import { startTransition } from './transition.js'
import { MAPS, mapIds } from '../maps/builtin.js'

export const MATCH_MODES = ['rounds', 'wins', 'endless']
export const defaultRotation = () => Object.fromEntries(mapIds().map(id => [id, id !== 'testing']))
export const defaultMatchSettings = () => ({ mode: 'rounds', rounds: 10, wins: 5, maps: defaultRotation(), shuffle: true })

// The next map from the rotation: a random one, not the one just played (unless it's the only
// one on), or in order the one after it (the first one when a match starts).
function pickNextMap(game, first = false) {
  const settings = game.match ? game.match.settings : defaultMatchSettings()
  let options = mapIds().filter(id => settings.maps[id] && MAPS[id].playable !== false)
  if (!options.length) options = ['patch']
  if (!settings.shuffle) return first ? options[0] : options[(options.indexOf(game.map) + 1) % options.length]
  if (options.length > 1) options = options.filter(id => id !== game.map)
  return options[Math.floor(Math.random() * options.length)]
}

export function startMatch(game, settings) {
  game.match = {
    settings,                  // shared with the menu, so the host's changes apply right away
    round: 1, scores: Array(MAX_PLAYERS).fill(0),   // by slot
    phase: 'transition', timer: 0,
    decided: false,            // roundOver: has the winner been announced yet (after the grace)?
    roundWinner: null, matchWinner: null,
  }
  startTransition(game, pickNextMap(game, true))
}

// dt: real seconds (slow motion doesn't stretch the round-over pause)
export function updateMatch(game, dt) {
  const m = game.match
  if (!m) return
  m.timer -= dt
  const M = CONFIG.match
  if (m.phase === 'transition') {
    if (!game.transition) m.phase = 'fight'
  } else if (m.phase === 'fight') {
    if (game.players.filter(p => !p.out).length <= 1) {   // the last blow: slow motion
      m.phase = 'roundOver'
      m.timer = M.roundOverTime
      m.decided = false
      game.timeScale = M.slowMo
    }
  } else if (m.phase === 'roundOver') {
    if (!m.decided && m.timer <= M.roundOverTime - M.lastStandingGrace) {
      const standing = game.players.filter(p => !p.out)
      decideRound(game, standing.length === 1 ? standing[0].index : null)   // all down by now: a draw
    }
    if (m.timer <= 0) {
      if (isMatchOver(m)) {
        m.phase = 'matchOver'
        m.timer = M.matchOverTime
        m.matchWinner = leaders(m.scores)[0]
        game.timeScale = 1
      } else {
        m.round++
        m.phase = 'transition'
        m.roundWinner = null
        m.decided = false
        startTransition(game, pickNextMap(game))
      }
    }
  } else if (m.phase === 'matchOver') {
    if (m.timer <= 0) startMatch(game, m.settings)
  }
}

// the slots with the most wins (none while nobody has scored): they wear the crown
export function leaders(scores) {
  const top = Math.max(...scores)
  return top > 0 ? scores.map((v, slot) => (v === top ? slot : -1)).filter(slot => slot >= 0) : []
}

// winner: player slot, or null for a draw (nobody scores)
function decideRound(game, winner) {
  const m = game.match
  m.decided = true
  m.roundWinner = winner
  if (winner !== null) m.scores[winner]++
}

function isMatchOver(m) {
  const { mode, rounds, wins } = m.settings
  if (mode === 'rounds') return m.round >= rounds && leaders(m.scores).length === 1   // tied for the lead: keep going (sudden death)
  if (mode === 'wins') return Math.max(...m.scores) >= wins
  return false
}

// "Round 3 of 10", "First to 5 · Round 4", ...
export function matchInfoText(m) {
  if (m.mode === 'rounds') return m.round > m.rounds ? `Sudden death · Round ${m.round}` : `Round ${m.round} of ${m.rounds}`
  if (m.mode === 'wins') return `First to ${m.wins} · Round ${m.round}`
  return `Endless · Round ${m.round}`
}

export function describeSettings(settings) {
  if (settings.mode === 'rounds') return `${settings.rounds} rounds`
  if (settings.mode === 'wins') return `first to ${settings.wins} wins`
  return 'endless'
}
