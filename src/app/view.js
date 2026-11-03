// Where the arena goes on the screen.
import { CONFIG } from '../config.js'
import { app } from './state.js'

// Fit the arena (CONFIG.view, in meters) into the window, next to the map editor's toolbar and panel.
// (Call it whenever either changes size.)
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
