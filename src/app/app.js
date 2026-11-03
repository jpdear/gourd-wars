// GAME LOOP (browser only): sets everything up, then each frame runs the session (see session.js:
// practice, hosting or joining) and draws what it gives back.
import { CONFIG } from '../config.js'
import { createGame, resetRound } from '../game/game.js'
import { createEffects, spawnEffect, updateEffects } from '../render/effects.js'
import { render } from '../render/render.js'
import { createMenu } from '../ui/menu.js'
import { createTuningPanel } from '../ui/tuning.js'
import { lerp } from '../util/math.js'
import { aimPoint, mouseLocked, setupControls, takeInput, updateMouseLock } from './controls.js'
import { createMapEditor, loadMyMaps } from './customMaps.js'
import { binds, keyName, loadBinds } from './keybinds.js'
import { onMenuAction } from './menus.js'
import { advanceSession, holdStill, localGame, sessionStatus } from './session.js'
import { changeDummies, dummyCount, loadSettings, prefs, showSettings } from './settings.js'
import { app, now } from './state.js'
import { resize } from './view.js'

export function boot() {
  app.canvas = document.getElementById('game')
  app.ctx = app.canvas.getContext('2d')
  const game = app.game = createGame()
  window.game = game   // handy for poking at from the browser dev console
  app.effects = createEffects()
  app.tuning = createTuningPanel(game)

  // (in this order: the saved practice map may be a custom map, and the menus list them)
  loadMyMaps()
  loadSettings(game)
  loadBinds()
  app.menu = createMenu(onMenuAction)
  showSettings()
  resetRound(game)   // load the saved map choice
  changeDummies(dummyCount)
  createMapEditor()

  resize()
  window.addEventListener('resize', resize)
  setupControls()

  requestAnimationFrame(frame)
  // Browsers pause requestAnimationFrame in background tabs. While hidden, a tiny
  // worker keeps the game ticking so an online match doesn't freeze or time out.
  startBackgroundTicker(() => { if (document.hidden) update(performance.now()) })
}

// --- main loop ---
let last = performance.now()

// this computer's side of the session: your input, and showing what happened
const local = {
  takeInput,
  show: events => { for (const ev of events) spawnEffect(app.effects, ev) },
}

function update(ms) {
  const { effects, ui, editor } = app
  const elapsed = Math.min(0.25, (ms - last) / 1000)
  last = ms
  ui.fps = lerp(ui.fps, 1 / Math.max(elapsed, 1e-3), 0.05)
  ui.overlay = editor.active ? editor.drawOverlay : null
  ui.aim = aimPoint()   // (for the aim line)
  updateMouseLock()
  ui.crosshair = mouseLocked()   // (the real cursor is hidden while it's locked)
  ui.damageNumbers = prefs.damageNumbers
  ui.harvestKey = keyName(binds.harvest, true)   // (for the bubble over a patch you could pick)
  if (editor.active) {   // the game holds still while you edit
    holdStill()
    app.snap = editor.snapshot()
    updateEffects(effects, elapsed)
    ui.message = ''
    return
  }

  const snap = app.snap = advanceSession(elapsed, local)
  updateEffects(effects, elapsed * (snap ? snap.timeScale ?? 1 : 1))   // particles slow down in slow motion

  // HUD + debug text
  const status = sessionStatus(snap, ui.localIndex)
  ui.hud = status.hud
  ui.message = now() < app.flash.until ? app.flash.text : status.wait
  const game = ui.game = localGame()
  if (ui.debug) {
    const me = game ? game.players[0] : null
    ui.debugLines = [
      `fps ${ui.fps.toFixed(0)}  ${status.debug[0]}`,
      me ? `grounded ${me.grounded}  groundDist ${me.groundDist === null ? '-' : me.groundDist.toFixed(2)}` : status.debug[1],
      me && game.players[1] ? `stun ${Math.max(0, me.stunTimer).toFixed(2)}  vx ${me.torso.getLinearVelocity().x.toFixed(1)}  ${game.players[1].name} stagger ${game.players[1].staggerMeter.toFixed(0)}/${CONFIG.damage.staggerAt}  dmg ${game.players[1].damageTaken.toFixed(0)}` : '',
      `pumpkins ${snap ? snap.pumpkins.length : 0}  particles ${effects.particles.length}`,
    ]
  }
}

function frame(ms) {
  update(ms)
  render(app.ctx, app.view, app.snap, app.effects, app.ui)
  requestAnimationFrame(frame)
}

function startBackgroundTicker(onTick) {
  try {
    const src = 'setInterval(() => postMessage(0), 1000 / 60)'
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
    worker.onmessage = onTick
  } catch (e) {
    setInterval(onTick, 1000 / 60)   // fallback: slowed down in background tabs, but better than nothing
  }
}
