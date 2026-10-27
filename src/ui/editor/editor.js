// MAP EDITOR — the editor itself (tools and piece shapes are in tools.js).
// hooks: onSave(def), onPlaytest(id), onExit()

import { CONFIG, MAX_PLAYERS, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../../config.js'
import { BALE, SCYTHE_START } from '../../game/level.js'
import { PATCH_STATES } from '../../game/patches.js'
import { PUMPKIN_TYPES, PUMPKIN_TYPE_NAMES, SPAWNABLE_TYPES } from '../../game/pumpkinTypes.js'
import { MAPS } from '../../maps/builtin.js'
import { MAP_LIMITS, checkMap, fillSpawns, toRuntimeMap } from '../../maps/mapData.js'
import { THEMES } from '../../maps/themes.js'
import { drawBale, drawBonfire, drawPitchforks, drawScarecrow } from '../../render/level.js'
import { drawPumpkin } from '../../render/pumpkins.js'
import { EDITOR_MAP_ID, EDITOR_TOOLS, PIECE_FIELDS, PIECE_KINDS, PIECE_NAMES, TOOL_KINDS, drawSpawnMarker, moverEnd, pieceBox, pieceHandles } from './tools.js'
import { hexA } from '../../util/color.js'
import { clamp, r3 } from '../../util/math.js'

export function createEditor(canvas, view, hooks) {
  const root = document.getElementById('editor')
  const W = CONFIG.view.w, H = CONFIG.view.h
  let def = null            // the map being edited
  let savedJson = ''        // what was last saved (to warn about unsaved changes)
  let tool = 'select'
  let sel = null            // selected piece { kind, index }
  let hover = null          // piece or handle under the cursor (select tool)
  let drag = null           // what the mouse is doing while held down
  let cursor = null         // { x, y, free } in meters
  let undo = [], redo = []  // map data as JSON
  let exitArmed = false     // Exit clicked once with unsaved changes
  let problems = { errors: [], warnings: [] }
  let selKey = ''           // which piece the property panel was built for

  root.innerHTML = `
    <div class="bar">
      ${EDITOR_TOOLS.map(t => t.spawn === undefined ? `<button data-tool="${t.id}" title="${t.label} (${t.key})">${t.label}</button>`
        : `${t.spawn ? '' : '<span class="label">Spawns</span>'}<button class="spawn" data-tool="${t.id}" title="${t.label}: ${PLAYER_COLOR_NAMES[t.spawn]} (4)"><span class="dot" style="background:${PLAYER_COLORS[t.spawn]}"></span>${t.spawn + 1}</button>`).join('')}
      <span class="gap"></span>
      <button data-ed="undo" title="Undo (Ctrl+Z)">Undo</button>
      <button data-ed="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
      <button data-ed="save" title="Save (Ctrl+S)">Save</button>
      <button data-ed="playtest" class="primary">Play Test</button>
      <button data-ed="exit">Exit</button>
    </div>
    <div class="panel">
      <h3>Map</h3>
      <label class="field">Name <input data-map="name" type="text" maxlength="32" spellcheck="false"></label>
      <label class="field">Theme <select data-map="theme">${Object.keys(THEMES).map(k => `<option value="${k}">${THEMES[k].name}</option>`).join('')}</select></label>
      <p class="status" data-ref="status"></p>
      <h3 data-ref="props-title"></h3>
      <div data-ref="props"></div>
      <h3>Checks</h3>
      <div data-ref="problems"></div>
    </div>`
  const bar = root.querySelector('.bar'), panel = root.querySelector('.panel')
  const ref = name => root.querySelector(`[data-ref=${name}]`)
  const nameInput = root.querySelector('[data-map=name]'), themeSelect = root.querySelector('[data-map=theme]')

  // --- editing the map (every change goes through here, for undo) ---
  const json = () => JSON.stringify(def)
  const piece = p => p && def[p.kind] && def[p.kind][p.index]
  function commit(before) {
    if (before !== json()) {
      undo.push(before)
      if (undo.length > 200) undo.shift()
      redo = []
      exitArmed = false
    }
    refresh()
  }
  const change = fn => { const before = json(); fn(); commit(before) }
  // after any change: rebuild the drawn map and the checks
  function refresh() {
    MAPS[EDITOR_MAP_ID] = toRuntimeMap(def)
    problems = checkMap(def)
    if (sel && !piece(sel)) sel = null
    updatePanel()
  }
  function restore(from, to) {
    if (!from.length) return
    to.push(json())
    def = JSON.parse(from.pop())
    exitArmed = false
    refresh()
  }
  let statusTimer = 0
  function setStatus(text, bad) {
    const el = ref('status')
    el.textContent = text
    el.classList.toggle('bad', !!bad)
    clearTimeout(statusTimer)
    if (text) statusTimer = setTimeout(() => { el.textContent = '' }, 5000)
  }

  // --- snapping ---
  const snap = (v, free) => { const g = free ? 0.05 : 0.25; return r3(Math.round(v / g) * g) }
  // the highest surface at x at or just below y (platform tops; other bales too, for stacking bales)
  function groundAt(x, y, kind, skip) {
    let best = null
    const consider = (left, right, top) => { if (x > left && x < right && top <= y + 0.5 && (best === null || top > best)) best = top }
    for (const p of def.platforms) consider(p.x - p.w / 2, p.x + p.w / 2, r3(p.y + p.h / 2))
    if (kind === 'bales') {
      def.bales.forEach((b, i) => { if (i !== skip) consider(b.x - BALE.w / 2, b.x + BALE.w / 2, r3(b.y + BALE.h)) })
      for (const m of def.movers) consider(m.x - m.w / 2, m.x + m.w / 2, r3(m.y + m.h / 2))   // (rides along)
    }
    return best
  }
  // put a piece that stands on the ground at (x, y): on the surface below, or in the air if there's none
  function placeOnGround(kind, o, x, y, free, skip) {
    o.x = clamp(snap(x, free), 0, W)
    const g = groundAt(o.x, y, kind, skip)
    o.y = clamp(g !== null ? g : snap(y, free), 0, H)
  }
  function placePiece(kind, o, x, y, free, index) {
    if (kind === 'platforms' || kind === 'movers') {   // keep the edges on the grid
      o.x = r3(snap(x - o.w / 2, free) + o.w / 2)
      o.y = r3(snap(y - o.h / 2, free) + o.h / 2)
    } else if (kind === 'scythes') {
      o.x = clamp(snap(x, free), 0, W)
      o.y = clamp(snap(y, free), 0, H)
    } else placeOnGround(kind, o, x, y, free, index)
  }

  // --- what's under the cursor ---
  function hitPiece(x, y) {
    for (const kind of PIECE_KINDS) {
      let best = null, bestArea = Infinity
      def[kind].forEach((o, index) => {
        const b = pieceBox(kind, o)
        const area = (b.x1 - b.x0) * (b.y1 - b.y0)
        // (smallest first, so a ledge in front of a big wall is easy to pick)
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && area <= bestArea) { best = { kind, index }; bestArea = area }
      })
      if (best) return best
    }
    return null
  }
  function hitHandle(x, y) {
    const o = piece(sel)
    if (!o) return null
    const r = 9 / view.s
    const h = pieceHandles(sel.kind, o).find(([, hx, hy]) => Math.abs(x - hx) < r && Math.abs(y - hy) < r)
    if (h) return { id: h[0], cursor: h[3] }
    if (sel.kind === 'movers' && inPieceBox('movers', moverEnd(o), x, y)) return { id: 'end', cursor: 'move' }
    return null
  }
  const inPieceBox = (kind, o, x, y) => { const b = pieceBox(kind, o); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 }
  function dragHandle(o, orig, id, x, y, free, start) {
    if (id === 'end') {   // a mover's far end (keeping its edges on the grid, like the start)
      o.x2 = clamp(r3(snap(orig.x2 + x - start.x - o.w / 2, free) + o.w / 2), 0, W)
      o.y2 = clamp(r3(snap(orig.y2 + y - start.y - o.h / 2, free) + o.h / 2), 0, H)
    } else if (sel.kind === 'platforms' || sel.kind === 'movers') {
      let x0 = orig.x - orig.w / 2, x1 = orig.x + orig.w / 2, y0 = orig.y - orig.h / 2, y1 = orig.y + orig.h / 2
      const sx = snap(x, free), sy = snap(y, free)
      if (id.includes('l')) x0 = Math.min(sx, x1 - 0.25)
      if (id.includes('r')) x1 = Math.max(sx, x0 + 0.25)
      if (id.includes('b')) y0 = Math.min(sy, y1 - 0.25)
      if (id.includes('t')) y1 = Math.max(sy, y0 + 0.25)
      Object.assign(o, { x: r3((x0 + x1) / 2), y: r3((y0 + y1) / 2), w: r3(x1 - x0), h: r3(y1 - y0) })
    } else if (sel.kind === 'spikes' || sel.kind === 'fires') {
      const [lo, hi] = sel.kind === 'fires' ? [0.4, 6] : [0.3, W]
      let x0 = orig.x - orig.w / 2, x1 = orig.x + orig.w / 2
      if (id === 'l') x0 = clamp(snap(x, free), x1 - hi, x1 - lo)
      else x1 = clamp(snap(x, free), x0 + lo, x0 + hi)
      Object.assign(o, { x: r3((x0 + x1) / 2), w: r3(x1 - x0) })
    } else if (sel.kind === 'scythes') {
      if (id === 'len') o.length = clamp(snap(Math.hypot(x - o.x, y - o.y), free), 1.4, 6)
      else o.pole = clamp(snap(o.y - y, free), 0, H)
    }
  }

  // --- mouse ---
  const worldAt = e => ({ x: (e.clientX - view.ox) / view.s, y: H - (e.clientY - view.oy) / view.s, free: e.shiftKey })
  function onDown(e) {
    if (!api.active || e.button !== 0) return
    const m = worldAt(e)
    const before = json()
    if (tool === 'select') {
      const h = hitHandle(m.x, m.y)
      if (h) { drag = { type: 'handle', id: h.id, before, orig: { ...piece(sel) }, start: m }; return }
      sel = hitPiece(m.x, m.y)
      if (!sel) {   // grabbing a mover's see-through end copy moves its end
        const i = def.movers.findIndex(o => inPieceBox('movers', moverEnd(o), m.x, m.y))
        if (i >= 0) {
          sel = { kind: 'movers', index: i }
          drag = { type: 'handle', id: 'end', before, orig: { ...def.movers[i] }, start: m }
          updatePanel()
          return
        }
      }
      updatePanel()
      if (sel) drag = { type: 'move', before, start: m, orig: { ...piece(sel) } }
      return
    }
    if (tool === 'platform' || tool === 'wall' || tool === 'mover') { drag = { type: 'rect', before, x0: snap(m.x, m.free), y0: snap(m.y, m.free), x1: snap(m.x, m.free), y1: snap(m.y, m.free) }; return }
    if (tool === 'spikes') {
      if (def.spikes.length >= MAP_LIMITS.spikes) { setStatus('That\'s as many pitchfork rows as a map can have.', true); return }
      const g = groundAt(snap(m.x, m.free), m.y)
      drag = { type: 'spikes', before, x0: snap(m.x, m.free), x1: snap(m.x, m.free), y: g !== null ? g : snap(m.y, m.free) }
      return
    }
    // click-to-place pieces: place it, then keep dragging it around until the mouse comes up
    let kind, index
    if (tool.startsWith('spawn')) { kind = 'spawns'; index = Number(tool.slice(5)) }
    else {
      kind = TOOL_KINDS[tool]
      if (def[kind].length >= MAP_LIMITS[kind]) { setStatus(`That's as many ${PIECE_NAMES[kind].toLowerCase()}s as a map can have.`, true); return }
      const o = kind === 'fires' ? { w: 1.4 } : kind === 'scythes' ? { length: 2.6, turnTime: CONFIG.level.scytheTurnTime } : {}
      index = def[kind].push(o) - 1
    }
    const o = def[kind][index]
    placePiece(kind, o, m.x, m.y, m.free, index)
    if (kind === 'scythes') { const g = groundAt(o.x, o.y - 0.3); o.pole = g !== null ? r3(o.y - g) : 2.6 }
    sel = { kind, index }
    drag = { type: 'move', before, start: m, orig: { ...o } }
    refresh()
  }
  function onMove(e) {
    if (!api.active) return
    const m = cursor = worldAt(e)
    if (drag) {
      if (drag.type === 'move') {
        const o = piece(sel)
        placePiece(sel.kind, o, drag.orig.x + m.x - drag.start.x, drag.orig.y + m.y - drag.start.y, m.free, sel.index)
        if (sel.kind === 'movers') moveEnd(o, drag.orig)
        refresh()
      } else if (drag.type === 'handle') {
        dragHandle(piece(sel), drag.orig, drag.id, m.x, m.y, m.free, drag.start)
        refresh()
      } else if (drag.type === 'rect') { drag.x1 = snap(m.x, m.free); drag.y1 = snap(m.y, m.free) }
      else if (drag.type === 'spikes') drag.x1 = snap(m.x, m.free)
    }
    // cursor shape
    let c = 'crosshair'
    if (tool === 'select') {
      const h = !drag && hitHandle(m.x, m.y)
      hover = drag ? null : h ? null : hitPiece(m.x, m.y)
      c = drag && drag.type === 'move' ? 'grabbing' : h ? h.cursor : hover ? 'grab' : 'default'
    }
    canvas.style.cursor = c
  }
  // moving a mover moves its whole trip
  const moveEnd = (o, orig) => {
    o.x2 = clamp(r3(orig.x2 + o.x - orig.x), 0, W)
    o.y2 = clamp(r3(orig.y2 + o.y - orig.y), 0, H)
  }
  function onUp(e) {
    if (!api.active || !drag || e.button !== 0) return
    const d = drag
    drag = null
    if (d.type === 'rect' && tool === 'mover') {
      if (def.movers.length >= MAP_LIMITS.movers) { setStatus('That\'s as many moving platforms as a map can have.', true); return }
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1)
      const m = x1 - x0 >= 0.5 && y1 - y0 >= 0.25 ? { x: r3((x0 + x1) / 2), y: r3((y0 + y1) / 2), w: r3(x1 - x0), h: r3(Math.min(4, y1 - y0)) }
        : { x: d.x0, y: r3(d.y0 - 0.25), w: 3, h: 0.5 }
      // it starts out going 5 m sideways (toward the middle); drag its end copy to change that
      Object.assign(m, { x2: r3(m.x + (m.x < W / 2 ? 5 : -5)), y2: m.y, speed: 3, pause: 1 })
      def.movers.push(m)
      setTool('select')   // (so its end copy can be dragged right away)
      sel = { kind: 'movers', index: def.movers.length - 1 }
      setStatus('Now drag the see-through copy to where it should go.')
    } else if (d.type === 'rect') {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1)
      const wall = tool === 'wall'
      if (def.platforms.length >= MAP_LIMITS.platforms) { setStatus('That\'s as many platforms as a map can have.', true); return }
      let p
      if (x1 - x0 >= 0.25 && y1 - y0 >= 0.25) p = { x: r3((x0 + x1) / 2), y: r3((y0 + y1) / 2), w: r3(x1 - x0), h: r3(y1 - y0) }
      else if (wall) p = { x: d.x0, y: r3(d.y0 - 2), w: 0.8, h: 4 }                  // just a click: a standard wall
      else p = { x: d.x0, y: r3(d.y0 - 0.25), w: 4, h: 0.5 }                         // or a ledge with its top at the click
      if (wall) p.wall = true
      sel = { kind: 'platforms', index: def.platforms.push(p) - 1 }
    } else if (d.type === 'spikes') {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1)
      const sp = x1 - x0 >= 0.3 ? { x: r3((x0 + x1) / 2), y: d.y, w: r3(x1 - x0) } : { x: d.x0, y: d.y, w: 2 }
      sel = { kind: 'spikes', index: def.spikes.push(sp) - 1 }
    }
    commit(d.before)
  }
  canvas.addEventListener('mousedown', onDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  canvas.addEventListener('mouseleave', () => { cursor = null; hover = null })

  // --- keys (all keys go here while editing) ---
  function onKey(e) {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) restore(redo, undo); else restore(undo, redo); return }
    if (mod && e.code === 'KeyY') { e.preventDefault(); restore(redo, undo); return }
    if (mod && e.code === 'KeyS') { e.preventDefault(); save(); return }
    if (mod && e.code === 'KeyD') { e.preventDefault(); duplicateSelected(); return }
    if (mod) return
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSelected(); return }
    if (e.code === 'Escape') {
      if (drag) { def = JSON.parse(drag.before); drag = null; refresh() }
      else if (sel) { sel = null; updatePanel() }
      else setTool('select')
      return
    }
    const group = EDITOR_TOOLS.filter(t => (t.code || 'Digit' + t.key) === e.code)   // (4 = the spawns, again for the next one)
    if (group.length) { const i = group.findIndex(t => t.id === tool); setTool(group[(i + 1) % group.length].id); return }
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.code]
    if (nudge && piece(sel)) {
      e.preventDefault()
      const step = e.shiftKey ? 0.05 : 0.25
      change(() => {
        const o = piece(sel), orig = { ...o }
        o.x = r3(clamp(o.x + nudge[0] * step, 0, W))
        o.y = r3(clamp(o.y + nudge[1] * step, 0, H))
        if (sel.kind === 'movers') moveEnd(o, orig)
      })
    }
  }
  function deleteSelected() {
    if (!piece(sel)) return
    if (sel.kind === 'spawns') { setStatus('Spawns can\'t be deleted, just moved.', true); return }
    change(() => { def[sel.kind].splice(sel.index, 1); sel = null })
  }
  function duplicateSelected() {
    const o = piece(sel)
    if (!o || sel.kind === 'spawns') return
    if (def[sel.kind].length >= MAP_LIMITS[sel.kind]) { setStatus('That map has as many of those as it can.', true); return }
    const copy = { ...o, x: r3(Math.min(W, o.x + 1)) }
    if (sel.kind === 'movers') moveEnd(copy, o)
    change(() => { sel = { kind: sel.kind, index: def[sel.kind].push(copy) - 1 } })
  }
  function setTool(id) {
    tool = id
    hover = null
    if (id !== 'select') sel = null
    updatePanel()
  }

  // --- toolbar + panel ---
  // buttons with data-ed="..." (tools have data-tool, problems in the Checks list data-problem)
  const buttonActions = {
    undo: () => restore(undo, redo),
    redo: () => restore(redo, undo),
    save: () => save(),
    playtest: () => {
      if (problems.errors.length) { setStatus('Fix the problems marked in red first.', true); return }
      save()
      hooks.onPlaytest(def.id)
    },
    exit: () => {
      if (json() !== savedJson && !exitArmed) { exitArmed = true; updatePanel(); setStatus('You have unsaved changes. Click "Discard changes" to leave without saving.', true); return }
      hooks.onExit()
    },
    'delete-piece': () => deleteSelected(),
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    b.blur()
    if (b.dataset.tool) setTool(b.dataset.tool)
    if (b.dataset.ed) buttonActions[b.dataset.ed]?.()
    else if (b.dataset.problem) {
      const [kind, index] = b.dataset.problem.split(':')
      setTool('select')
      sel = { kind, index: Number(index) }
      updatePanel()
    }
  })
  nameInput.addEventListener('change', () => change(() => { def.name = nameInput.value.replace(/[\u0000-\u001f]/g, '').slice(0, 32).trim() || 'Custom map' }))
  themeSelect.addEventListener('change', () => change(() => { def.theme = themeSelect.value }))
  panel.addEventListener('change', e => {
    const el = e.target, o = piece(sel)
    if (!o || !el.dataset.prop) return
    const prop = el.dataset.prop
    change(() => {
      if (prop === 'only') { if (el.value) o.only = el.value; else delete o.only; return }
      if (prop === 'wall') { if (el.checked) o.wall = true; else delete o.wall; return }
      const f = PIECE_FIELDS[sel.kind].find(f => f[0] === prop)
      const v = Number(el.value)
      if (Number.isFinite(v)) o[prop] = r3(clamp(v, f[2] ?? 0, f[3] ?? (prop === 'x' ? W : H)))
    })
  })

  function save() {
    def.name = def.name || 'Custom map'
    hooks.onSave(JSON.parse(json()))
    savedJson = json()
    exitArmed = false
    updatePanel()
    setStatus(problems.errors.length ? 'Saved. It can\'t be played until the red problems are fixed.' : 'Saved!')
  }

  function updatePanel() {
    for (const b of bar.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === tool)
    bar.querySelector('[data-ed=undo]').disabled = !undo.length
    bar.querySelector('[data-ed=redo]').disabled = !redo.length
    bar.querySelector('[data-ed=save]').textContent = json() === savedJson ? 'Saved' : 'Save'
    const exit = bar.querySelector('[data-ed=exit]')
    exit.textContent = exitArmed ? 'Discard changes' : 'Exit'
    exit.classList.toggle('danger', exitArmed)
    if (document.activeElement !== nameInput) nameInput.value = def.name
    themeSelect.value = def.theme

    // the selected piece's properties (rebuilt only when the selection changes, so typing isn't interrupted)
    const o = piece(sel)
    const key = o ? `${sel.kind}:${sel.index}` : 'tool:' + tool
    if (key !== selKey) {
      selKey = key
      const props = ref('props')
      if (!o) {
        const t = EDITOR_TOOLS.find(t => t.id === tool)
        ref('props-title').textContent = t.label + ' tool'
        props.innerHTML = '<p class="hint"></p>'
        props.firstChild.textContent = t.hint
      } else {
        ref('props-title').textContent = sel.kind === 'spawns' ? `Spawn ${sel.index + 1} (${PLAYER_COLOR_NAMES[sel.index]})` : PIECE_NAMES[sel.kind]
        let html = `<div class="nums">${PIECE_FIELDS[sel.kind].map(([prop, label]) =>
          `<label>${label}<input type="number" step="0.25" data-prop="${prop}"></label>`).join('')}</div>`
        if (sel.kind === 'platforms') html += '<label class="check"><input type="checkbox" data-prop="wall"> Wall / ceiling</label>'
        if (sel.kind === 'patches') {
          html += `<label class="field">Grows <select data-prop="only"><option value="">Any (see Pumpkins)</option>${
            SPAWNABLE_TYPES.map(k => `<option value="${k}">Only ${PUMPKIN_TYPES[k].name}</option>`).join('')}</select></label>`
        }
        if (sel.kind !== 'spawns') html += '<button data-ed="delete-piece" class="danger">Delete</button>'
        props.innerHTML = html
      }
    }
    if (o) {
      for (const el of ref('props').querySelectorAll('[data-prop]')) {
        if (el === document.activeElement) continue
        if (el.type === 'checkbox') el.checked = !!o[el.dataset.prop]
        else if (el.tagName === 'SELECT') el.value = o.only || ''
        else el.value = o[el.dataset.prop]
      }
    }

    // checks
    const list = ref('problems')
    list.replaceChildren()
    const add = (p, cls) => {
      const b = document.createElement(p.kind && p.index >= 0 && def[p.kind][p.index] ? 'button' : 'p')
      b.className = 'problem ' + cls
      b.textContent = p.msg
      if (b.tagName === 'BUTTON') b.dataset.problem = `${p.kind}:${p.index}`
      list.appendChild(b)
    }
    problems.errors.forEach(p => add(p, 'err'))
    problems.warnings.forEach(p => add(p, 'warn'))
    if (!list.childElementCount) {
      const p = document.createElement('p')
      p.className = 'problem ok'
      p.textContent = 'All good: ready to play!'
      list.appendChild(p)
    }
  }

  // --- drawing on top of the map ---
  function drawOverlay(ctx, X, Y, s) {
    const theme = THEMES[def.theme]
    // grid: a line every meter, stronger every 4
    ctx.lineWidth = 1
    for (let i = 0; i <= W; i++) {
      ctx.strokeStyle = hexA(theme.ink, i % 4 ? 0.06 : 0.14)
      ctx.beginPath(); ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i), Y(H)); ctx.stroke()
    }
    for (let j = 0; j <= H; j++) {
      ctx.strokeStyle = hexA(theme.ink, j % 4 ? 0.06 : 0.14)
      ctx.beginPath(); ctx.moveTo(X(0), Y(j)); ctx.lineTo(X(W), Y(j)); ctx.stroke()
    }
    // markers: spawns, scythe reach, what a patch grows
    def.spawns.forEach((sp, i) => drawSpawnMarker(ctx, sp, i, X, Y, s))
    ctx.setLineDash([6, 5])
    ctx.strokeStyle = 'rgba(200, 40, 40, 0.55)'
    ctx.lineWidth = 1.5
    for (const sc of def.scythes) { ctx.beginPath(); ctx.arc(X(sc.x), Y(sc.y), sc.length * s, 0, Math.PI * 2); ctx.stroke() }
    ctx.setLineDash([])
    for (const m of def.movers) {   // where each moving platform goes: a see-through copy + an arrow
      const e = moverEnd(m)
      ctx.fillStyle = hexA(theme.platform, 0.3)
      ctx.fillRect(X(e.x - e.w / 2), Y(e.y + e.h / 2), e.w * s, e.h * s)
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = hexA(theme.ink, 0.6)
      ctx.lineWidth = 1.5
      ctx.strokeRect(X(e.x - e.w / 2), Y(e.y + e.h / 2), e.w * s, e.h * s)
      ctx.setLineDash([])
      const len = Math.hypot(m.x2 - m.x, m.y2 - m.y)
      if (len > 0.6) {
        const ux = (m.x2 - m.x) / len, uy = (m.y2 - m.y) / len, hx = m.x2 - ux * 0.15, hy = m.y2 - uy * 0.15
        ctx.strokeStyle = ctx.fillStyle = hexA(theme.ink, 0.7)
        ctx.beginPath(); ctx.moveTo(X(m.x), Y(m.y)); ctx.lineTo(X(hx), Y(hy)); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(X(hx), Y(hy))
        ctx.lineTo(X(hx - ux * 0.45 - uy * 0.25), Y(hy - uy * 0.45 + ux * 0.25))
        ctx.lineTo(X(hx - ux * 0.45 + uy * 0.25), Y(hy - uy * 0.45 - ux * 0.25))
        ctx.fill()
      }
    }
    ctx.font = `bold ${Math.round(0.28 * s)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    for (const pt of def.patches) {
      if (!pt.only) continue
      ctx.fillStyle = theme.ink
      ctx.fillText(PUMPKIN_TYPES[pt.only].name, X(pt.x), Y(pt.y + 1.05))
    }
    // problems: red/amber outlines on the pieces they're about
    const outline = (kind, index, color, dash, pad = 0.08) => {
      const o = def[kind] && def[kind][index]
      if (!o) return
      const b = pieceBox(kind, o)
      ctx.setLineDash(dash)
      ctx.strokeStyle = color
      ctx.strokeRect(X(b.x0 - pad), Y(b.y1 + pad), (b.x1 - b.x0 + 2 * pad) * s, (b.y1 - b.y0 + 2 * pad) * s)
      ctx.setLineDash([])
    }
    ctx.lineWidth = 2
    for (const p of problems.warnings) outline(p.kind, p.index, '#e89a1c', [5, 4])
    for (const p of problems.errors) outline(p.kind, p.index, '#e0302a', [5, 4])
    if (hover && !(sel && hover.kind === sel.kind && hover.index === sel.index)) { ctx.lineWidth = 1.5; outline(hover.kind, hover.index, 'rgba(43, 155, 255, 0.6)', []) }
    // selection + handles
    const o = piece(sel)
    if (o) {
      ctx.lineWidth = 2
      outline(sel.kind, sel.index, '#2b9bff', [], 0.1)
      if (sel.kind === 'scythes') {   // the arm the length handle sits on
        ctx.strokeStyle = '#2b9bff'
        ctx.beginPath(); ctx.moveTo(X(o.x), Y(o.y)); ctx.lineTo(X(o.x + o.length), Y(o.y)); ctx.stroke()
      }
      for (const [, hx, hy] of pieceHandles(sel.kind, o)) {
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = '#1d6fb8'
        ctx.lineWidth = 1.5
        ctx.fillRect(X(hx) - 5, Y(hy) - 5, 10, 10)
        ctx.strokeRect(X(hx) - 5, Y(hy) - 5, 10, 10)
      }
    }
    // the piece being drawn
    if (drag && drag.type === 'rect') {
      const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1), y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1)
      ctx.fillStyle = hexA(tool === 'wall' ? theme.wall : theme.platform, 0.55)
      ctx.fillRect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * s)
      ctx.strokeStyle = '#2b9bff'
      ctx.lineWidth = 2
      ctx.strokeRect(X(x0), Y(y1), (x1 - x0) * s, (y1 - y0) * s)
    } else if (drag && drag.type === 'spikes') {
      const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1)
      ctx.globalAlpha = 0.6
      drawPitchforks(ctx, { x: (x0 + x1) / 2, y: drag.y, w: Math.max(0.3, x1 - x0) }, X, Y, s)
      ctx.globalAlpha = 1
    } else if (!drag && cursor && tool !== 'select') {
      // where a click would put it
      const ghost = { w: 1.4, length: 2.6 }
      const kind = tool.startsWith('spawn') ? 'spawns' : TOOL_KINDS[tool]
      if (kind) {
        placePiece(kind, ghost, cursor.x, cursor.y, cursor.free, -1)
        ctx.globalAlpha = 0.5
        if (kind === 'spawns') drawSpawnMarker(ctx, ghost, Number(tool.slice(5)), X, Y, s)
        else if (kind === 'patches') drawPumpkin(ctx, X(ghost.x), Y(ghost.y + 0.32), 0.3 * s, 0, PUMPKIN_TYPES.classic)
        else if (kind === 'bales') drawBale(ctx, ghost.x, ghost.y + BALE.h / 2, 0, 1, 0, X, Y, s)
        else if (kind === 'fires') { drawBonfire(ctx, ghost, X, Y, s, false); drawBonfire(ctx, ghost, X, Y, s, true) }
        else if (kind === 'scythes') { const g = groundAt(ghost.x, ghost.y - 0.3); ghost.pole = g !== null ? ghost.y - g : 2.6; drawScarecrow(ctx, ghost, SCYTHE_START, X, Y, s) }
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = '#2b9bff'
        ctx.beginPath(); ctx.arc(X(snap(cursor.x, cursor.free)), Y(snap(cursor.y, cursor.free)), 4, 0, Math.PI * 2); ctx.fill()
      }
    }
    // help + where the cursor is, along the bottom
    ctx.font = `${Math.round(0.32 * s)}px system-ui, sans-serif`
    ctx.fillStyle = theme.muted
    ctx.strokeStyle = theme.sky[1]
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    const outlined = (text, x, align) => { ctx.textAlign = align; ctx.strokeText(text, X(x), Y(0.35)); ctx.fillText(text, X(x), Y(0.35)) }
    outlined('Snaps to a 0.25 m grid (hold Shift for fine placement) · 1–9, M tools · Ctrl+Z undo · Del delete · Esc deselect', 0.4, 'left')
    if (cursor && cursor.x >= 0 && cursor.x <= W && cursor.y >= 0 && cursor.y <= H) outlined(`x ${cursor.x.toFixed(2)}  y ${cursor.y.toFixed(2)}`, W - 0.4, 'right')
  }

  const api = {
    active: false,
    get dirty() { return json() !== savedJson },
    open(d) {
      def = JSON.parse(JSON.stringify(d))
      fillSpawns(def)   // (always all four, so they can't go missing)
      while (def.spawns.length < MAX_PLAYERS) def.spawns.push({ x: 5 + 7 * def.spawns.length, y: 4 })
      savedJson = json()
      tool = 'select'; sel = null; hover = null; drag = null; undo = []; redo = []; exitArmed = false; selKey = ''
      api.active = true
      root.classList.add('open')
      setStatus('')
      refresh()
    },
    close() {
      api.active = false
      root.classList.remove('open')
      canvas.style.cursor = ''
      delete MAPS[EDITOR_MAP_ID]
    },
    // room the toolbar and panel take up (the map is fit into the rest)
    insets() {
      if (!api.active) return { top: 0, right: 0 }
      panel.style.top = bar.offsetHeight + 'px'
      return { top: bar.offsetHeight, right: panel.offsetWidth }
    },
    // what render() draws: the map with its bales and ripe patches, no players
    snapshot() {
      return {
        time: 0, map: EDITOR_MAP_ID, players: [], pumpkins: [], scythes: [], movers: def.movers.map(m => [m.x, m.y]),
        bales: def.bales.map((b, i) => [i, b.x, b.y + BALE.h / 2, 0, 1, 0]),
        patches: def.patches.map(p => [PATCH_STATES.indexOf('ripe'), 1, 0, PUMPKIN_TYPE_NAMES.indexOf(p.only || 'classic')]),
        timeScale: 1, transition: null, match: null,
      }
    },
    drawOverlay,
    onKey,
  }
  return api
}
