// MAP EDITOR (browser only)
// Edits one custom map (the MAP DATA format) right on the canvas. The map is drawn by the
// normal renderer (no players, nothing moving), and the editor draws its markers, handles
// and the piece being placed on top.

import { PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../../config.js'
import { BALE, TINE } from '../../game/level.js'

export const EDITOR_MAP_ID = '__editor'   // (ids starting with __ stay out of the menus and rotation)
export const EDITOR_TOOLS = [
  { id: 'select', label: 'Select', key: '1', hint: 'Click a piece to select it. Drag it to move it, drag the white handles to resize. Delete removes it, Ctrl+D copies it, arrow keys nudge it.' },
  { id: 'platform', label: 'Platform', key: '2', hint: 'Drag to draw a platform (or click for a small one).' },
  { id: 'wall', label: 'Wall', key: '3', hint: 'Drag to draw a wall or a ceiling. Walls are solid like platforms, but have no grass and don\'t count as floors.' },
  ...PLAYER_COLOR_NAMES.map((color, i) => ({
    id: 'spawn' + i, label: `Spawn ${i + 1}`, key: '4', spawn: i,
    hint: `Click to move ${color}'s spawn (player ${i + 1}). It lands on the platform under the cursor. Press 4 again for the next spawn.`,
  })),
  { id: 'patch', label: 'Patch', key: '5', hint: 'Click to plant a pumpkin patch on a platform. Select it to make it grow just one kind of pumpkin.' },
  { id: 'bale', label: 'Hay Bale', key: '6', hint: 'Click to place a hay bale. Bales stack on top of each other.' },
  { id: 'spikes', label: 'Pitchforks', key: '7', hint: 'Drag along a platform to lay a row of pitchforks (instant knockout).' },
  { id: 'fire', label: 'Bonfire', key: '8', hint: 'Click to place a bonfire on a platform (burns, and hops you out).' },
  { id: 'scythe', label: 'Scarecrow', key: '9', hint: 'Click to place a scarecrow\'s pivot; its pole reaches down to the platform below. The dashed circle is the scythe\'s reach.' },
  { id: 'mover', label: 'Moving Platform', key: 'M', code: 'KeyM', hint: 'Drag to draw a moving platform where it starts. Then drag its see-through copy to where it goes: it slides back and forth between the two.' },
]
export const PIECE_NAMES = { movers: 'Moving platform', platforms: 'Platform', spawns: 'Spawn', patches: 'Patch', bales: 'Hay bale', spikes: 'Pitchforks', fires: 'Bonfire', scythes: 'Scarecrow' }
export const PIECE_KINDS = ['spawns', 'scythes', 'patches', 'bales', 'fires', 'spikes', 'movers', 'platforms']   // click order: top first
export const TOOL_KINDS = { patch: 'patches', bale: 'bales', fire: 'fires', scythe: 'scythes' }
// number fields for the selected piece: [prop, label, min, max]
export const PIECE_FIELDS = {
  platforms: [['x', 'X'], ['y', 'Y'], ['w', 'Width', 0.25, 32], ['h', 'Height', 0.25, 18]],
  spawns: [['x', 'X'], ['y', 'Y']],
  patches: [['x', 'X'], ['y', 'Y']],
  bales: [['x', 'X'], ['y', 'Y']],
  spikes: [['x', 'X'], ['y', 'Y'], ['w', 'Width', 0.3, 32]],
  fires: [['x', 'X'], ['y', 'Y'], ['w', 'Width', 0.4, 6]],
  scythes: [['x', 'X'], ['y', 'Y'], ['length', 'Arm length', 1.4, 6], ['pole', 'Pole', 0, 18], ['turnTime', 'Seconds per turn', 0.5, 10]],
  movers: [['x', 'Start X'], ['y', 'Start Y'], ['x2', 'End X', 0, 32], ['y2', 'End Y', 0, 18], ['w', 'Width', 0.5, 32], ['h', 'Height', 0.25, 4],
    ['speed', 'Speed (m/s)', 0.5, 12], ['pause', 'Wait at ends (s)', 0, 5]],
}
export const moverEnd = m => ({ ...m, x: m.x2, y: m.y2 })   // the platform at the far end of its trip

// Outline of a piece (for clicking it and drawing its selection box).
export function pieceBox(kind, o) {
  switch (kind) {
    case 'platforms': case 'movers': return { x0: o.x - o.w / 2, x1: o.x + o.w / 2, y0: o.y - o.h / 2, y1: o.y + o.h / 2 }
    case 'spawns': return { x0: o.x - 0.4, x1: o.x + 0.4, y0: o.y, y1: o.y + 1.95 }
    case 'patches': return { x0: o.x - 0.5, x1: o.x + 0.5, y0: o.y, y1: o.y + 0.75 }
    case 'bales': return { x0: o.x - BALE.w / 2, x1: o.x + BALE.w / 2, y0: o.y, y1: o.y + BALE.h }
    case 'spikes': return { x0: o.x - o.w / 2, x1: o.x + o.w / 2, y0: o.y, y1: o.y + TINE.tip }
    case 'fires': return { x0: o.x - o.w / 2, x1: o.x + o.w / 2, y0: o.y, y1: o.y + 0.9 }
    case 'scythes': return { x0: o.x - 0.45, x1: o.x + 0.45, y0: o.y - o.pole, y1: o.y + 1.75 }
  }
}

// Resize handles of a piece: [id, x, y, cursor]
export function pieceHandles(kind, o) {
  if (kind === 'movers') return [...pieceHandles('platforms', o), ['end', o.x2, o.y2, 'move']]
  if (kind === 'platforms') {
    const b = pieceBox(kind, o), mx = o.x, my = o.y
    return [['tl', b.x0, b.y1, 'nwse-resize'], ['t', mx, b.y1, 'ns-resize'], ['tr', b.x1, b.y1, 'nesw-resize'], ['r', b.x1, my, 'ew-resize'],
      ['br', b.x1, b.y0, 'nwse-resize'], ['b', mx, b.y0, 'ns-resize'], ['bl', b.x0, b.y0, 'nesw-resize'], ['l', b.x0, my, 'ew-resize']]
  }
  if (kind === 'spikes' || kind === 'fires') return [['l', o.x - o.w / 2, o.y + 0.3, 'ew-resize'], ['r', o.x + o.w / 2, o.y + 0.3, 'ew-resize']]
  if (kind === 'scythes') return [['len', o.x + o.length, o.y, 'ew-resize'], ['pole', o.x, o.y - o.pole, 'ns-resize']]
  return []
}

// A stand-in stick figure where a player starts.
export function drawSpawnMarker(ctx, sp, i, X, Y, s) {
  const color = PLAYER_COLORS[i]
  ctx.strokeStyle = color
  ctx.lineWidth = 0.1 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(X(sp.x - 0.25), Y(sp.y)); ctx.lineTo(X(sp.x), Y(sp.y + 0.75)); ctx.lineTo(X(sp.x + 0.25), Y(sp.y))   // legs
  ctx.moveTo(X(sp.x), Y(sp.y + 0.75)); ctx.lineTo(X(sp.x), Y(sp.y + 1.4))                                      // body
  ctx.moveTo(X(sp.x - 0.3), Y(sp.y + 0.8)); ctx.lineTo(X(sp.x), Y(sp.y + 1.3)); ctx.lineTo(X(sp.x + 0.3), Y(sp.y + 0.8))   // arms
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(X(sp.x), Y(sp.y + 1.62), 0.22 * s, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.font = `bold ${Math.round(0.36 * s)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(String(i + 1), X(sp.x), Y(sp.y + 2.05))
  ctx.lineCap = 'butt'
}
