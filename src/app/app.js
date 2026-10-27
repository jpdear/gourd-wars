// GAME LOOP (browser only): sets everything up, then each frame runs the physics in fixed steps
// (practice and the host; a guest sends its input and blends the host's snapshots) and draws.
import { CONFIG, PLAYER_COLOR_NAMES } from '../config.js'
import { createGame, resetRound, stepGame } from '../game/game.js'
import { dummyInput } from '../game/input.js'
import { makeSnapshot, snapPlayer } from '../game/snapshot.js'
import { NET } from '../net/protocol.js'
import { createEffects, spawnEffect, updateEffects } from '../render/effects.js'
import { render } from '../render/render.js'
import { createMenu } from '../ui/menu.js'
import { createTuningPanel } from '../ui/tuning.js'
import { lerp } from '../util/math.js'
import { aimPoint, clearTaps, localInput, setupControls } from './controls.js'
import { createMapEditor, loadMyMaps, playtestId } from './customMaps.js'
import { onMenuAction } from './menus.js'
import { hostCode, link, links, mode } from './session.js'
import { changeDummies, dummyCount, loadSettings, showSettings } from './settings.js'
import { app, now } from './state.js'

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

// Fit the arena (CONFIG.view, in meters) into the window, next to the map editor's toolbar and panel.
export function resize() {
  const { canvas, ctx, view } = app
  const dpr = window.devicePixelRatio || 1
  view.w = window.innerWidth
  view.h = window.innerHeight
  canvas.width = view.w * dpr
  canvas.height = view.h * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const inset = app.editor.insets()
  const w = view.w - inset.right, h = view.h - inset.top
  view.s = Math.min(w / CONFIG.view.w, h / CONFIG.view.h)
  view.ox = (w - CONFIG.view.w * view.s) / 2
  view.oy = inset.top + (h - CONFIG.view.h * view.s) / 2
}

// --- main loop ---
let last = performance.now()
let acc = 0
let steps = 0

function update(ms) {
  const { game, effects, ui, editor } = app
  const elapsed = Math.min(0.25, (ms - last) / 1000)
  last = ms
  ui.fps = lerp(ui.fps, 1 / Math.max(elapsed, 1e-3), 0.05)
  ui.overlay = editor.active ? editor.drawOverlay : null
  ui.aim = aimPoint()   // (for the aim line)
  if (editor.active) {   // the game holds still while you edit
    acc = 0
    app.snap = editor.snapshot()
    updateEffects(effects, elapsed)
    ui.message = ''
    return
  }
  acc += elapsed

  if (mode === 'guest' && link) {
    while (acc >= CONFIG.dt) {
      link.sendInput(localInput())
      clearTaps()
      acc -= CONFIG.dt
    }
    const out = link.advance(elapsed)
    for (const ev of out.events) spawnEffect(effects, ev)
    app.snap = out.snap
  } else {
    while (acc >= CONFIG.dt) {
      const inputs = [localInput()]   // by slot: you, your friends, the dummies
      for (const [slot, l] of links) inputs[slot] = l.takeInput()
      for (const p of game.players) if (p.isDummy) inputs[p.index] = dummyInput(game, p)
      stepGame(game, inputs)
      clearTaps()
      const events = game.events.splice(0)
      for (const ev of events) spawnEffect(effects, ev)
      if (links.size) {
        for (const l of links.values()) l.pendingEvents.push(...events)
        if (++steps % NET.snapshotEvery === 0) {
          const shared = makeSnapshot(game)
          for (const l of links.values()) l.sendSnapshot(game, shared)
        }
      }
      acc -= CONFIG.dt
    }
    app.snap = makeSnapshot(game)
  }
  const snap = app.snap
  if (link) link.tick(now())
  for (const l of links.values()) l.tick(now())
  updateEffects(effects, elapsed * (snap ? snap.timeScale ?? 1 : 1))   // particles slow down in slow motion

  // HUD + debug text
  const pings = [link, ...links.values()].filter(l => l && l.ping !== null).map(l => l.ping)
  const pingText = pings.length ? ` · ping ${Math.round(Math.max(...pings) * 1000)} ms` : ''
  const myColor = PLAYER_COLOR_NAMES[ui.localIndex] || '…'
  ui.hud = mode === 'host' && !links.size ? `Waiting for friends · code ${hostCode || '…'}` : playtestId ? 'Play test' : 'Practice'
  let waitText = ''
  if (mode === 'guest' && !snap) waitText = 'Waiting for the host…'
  else if (mode === 'guest' && ui.localIndex > 0 && !snapPlayer(snap, ui.localIndex)) waitText = `You'll jump in next round as ${myColor}!`
  ui.message = now() < app.flash.until ? app.flash.text : waitText
  ui.game = mode === 'guest' ? null : game
  if (ui.debug) {
    const me = mode === 'guest' ? null : game.players[0]
    ui.debugLines = [
      `fps ${ui.fps.toFixed(0)}  mode ${mode}${pingText}`,
      me ? `grounded ${me.grounded}  groundDist ${me.groundDist === null ? '-' : me.groundDist.toFixed(2)}` : `snapshots buffered ${link ? link.snaps.length : 0}`,
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
