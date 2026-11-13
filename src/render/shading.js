// SHADING: the flat look's "two-tone" shadow side (see docs/style-guide.html and docs/DESIGN.md → Look).
// Light comes from the top left, so every shaded thing gets a darker crescent along its bottom-right
// edge: its silhouette minus a copy of it shifted toward the light. That crescent is drawn in the map's
// shade tint and multiplied onto the frame, so shadows take on each map's mood (bluish on snow, and
// so on) instead of just going black.
//
// How: one small offscreen layer canvas, as big as the biggest box so far. For each thing, the layer's
// corner is cleared to the thing's box, the silhouette drawn in the tint, the shifted silhouette cut
// back out of it (destination-out), and that box multiplied onto the frame. The layer works in device pixels but
// draws with the caller's own transform (screen scale, screen shake), and the frame keeps its clip.
//
//   drawShaded(ctx, { silhouette, draw, details, box, shift, tint, dir })
//     silhouette(c, color)  draws the whole shape in that one color on c (same coordinates as ctx)
//     draw(c)               draws it for real (on ctx)
//     details(c)            optional: drawn on top, after the shading (eyes, marks)
//     box                   [x0, y0, x1, y1] in ctx's coordinates: the shape plus some margin
//     shift                 how far (px) the cut-out copy moves toward the light
//     tint                  the shadow's color (a map's theme.shade)
//     dir                   which way the shadow side is: [x, y] (default LIGHT; hills use [1, 0])
//   setShadingEnabled(on)   a debug switch (the tuning panel): off draws everything flat

const LIGHT = (() => { const x = 1, y = 1.15, n = Math.hypot(x, y); return [x / n, y / n] })()   // toward the shadow side: down and right

let enabled = true
export const setShadingEnabled = on => { enabled = on }

let layer = null   // (made on first use: the tests run without a DOM)

export function drawShaded(ctx, { silhouette, draw, details, box, shift, tint, dir = LIGHT }) {
  draw(ctx)
  if (enabled && tint && shift > 0) shadeSide(ctx, silhouette, box, shift, tint, dir)
  if (details) details(ctx)
}

function shadeSide(ctx, silhouette, box, shift, tint, dir) {
  const T = ctx.getTransform()
  // the box in device pixels (on the canvas), clamped to it
  const xs = [], ys = []
  for (const [x, y] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
    xs.push(T.a * x + T.c * y + T.e)
    ys.push(T.b * x + T.d * y + T.f)
  }
  const W = ctx.canvas.width, H = ctx.canvas.height
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const x1 = Math.min(W, Math.ceil(Math.max(...xs))), y1 = Math.min(H, Math.ceil(Math.max(...ys)))
  if (x1 <= x0 || y1 <= y0) return
  const w = x1 - x0, h = y1 - y0

  if (!layer) layer = document.createElement('canvas').getContext('2d')
  if (layer.canvas.width < w) layer.canvas.width = w     // (it only grows: resizing a canvas is slow)
  if (layer.canvas.height < h) layer.canvas.height = h
  layer.save()
  layer.setTransform(1, 0, 0, 1, 0, 0)
  layer.clearRect(0, 0, w, h)
  layer.setTransform(T.a, T.b, T.c, T.d, T.e - x0, T.f - y0)   // (the caller's transform, moved so the box starts at the layer's corner)
  silhouette(layer, tint)
  layer.globalCompositeOperation = 'destination-out'
  layer.translate(-shift * dir[0], -shift * dir[1])
  silhouette(layer, '#000')
  layer.restore()

  ctx.save()   // (keeps the frame's clip; the caller's globalAlpha carries over, so see-through things shade see-through)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(layer.canvas, 0, 0, w, h, x0, y0, w, h)
  ctx.restore()
}
