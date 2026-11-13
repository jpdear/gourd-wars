// MENU (the HTML card in #menu, plus the title art behind the out-of-game screens and the main menu's logo:
// see titleArt.js). Builds the rows that come from data (match length, maps, pumpkins, keybinds, feedback
// categories) and shows things; what the buttons do is in app/menus.js.

import { MATCH_MODES } from '../game/match.js'
import { PUMPKIN_TYPES, RATE_LABELS, SPAWNABLE_TYPES, SPAWN_RATES } from '../game/pumpkinTypes.js'
import { BIND_ACTIONS, keyName } from '../app/keybinds.js'
import { CATEGORIES, LIMITS } from '../app/feedback.js'
import { GRAPHICS, canFullscreen } from '../app/graphics.js'
import { BUILTIN_MAP_IDS, MAPS, mapIds } from '../maps/builtin.js'
import { GAME_VERSION } from '../version.js'
import { createTitleArt } from './titleArt.js'

export function createMenu(onAction) {
  const root = document.getElementById('menu')
  createTitleArt(root)
  let screen = 'main'
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]')
    if (btn) { btn.blur(); onAction(btn.dataset.act) }
  })
  // match length block (on the Match Settings screen)
  for (const el of root.querySelectorAll('.match-settings')) {
    el.innerHTML = `<p class="label">Match Length</p>
      <div class="seg"><button data-act="mode:rounds">Rounds</button><button data-act="mode:wins">First To</button><button data-act="mode:endless">Endless</button></div>
      <div class="stepper"><button data-act="num-down">−</button><span data-text="match-num"></span><button data-act="num-up">+</button></div>`
  }
  // pumpkin spawn settings: one row per type, under column headings
  const rates = Object.keys(SPAWN_RATES)
  root.querySelector('.pumpkin-list').innerHTML = '<div class="pk-head"><span class="pk-name"></span><span>Enabled</span><span>Rarity</span></div>' + SPAWNABLE_TYPES.map(k => `
    <div class="pk-row" data-type="${k}">
      <span class="dot" style="background:${PUMPKIN_TYPES[k].color}"></span>
      <span class="pk-name">${PUMPKIN_TYPES[k].name}</span>
      <button class="pk-on" data-act="pk-toggle:${k}">On</button>
      <div class="seg">${rates.map(r => `<button data-act="pk-rate:${k}:${r}">${RATE_LABELS[r]}</button>`).join('')}</div>
    </div>`).join('')
  // keybinds: one row per action
  root.querySelector('.bind-list').innerHTML = BIND_ACTIONS.map(([action, label]) =>
    `<div class="toggle-row"><span>${label}</span><button class="bind" data-act="bind:${action}"></button></div>`).join('')
  // graphics and accessibility settings: one row each on its tab, from GRAPHICS (choices: a segmented row;
  // a slider: a range with its value), plus Fullscreen at the end of Graphics (if the browser can)
  for (const [name, spec] of Object.entries(GRAPHICS)) {
    const control = spec.slider
      ? `<div class="slider"><input type="range" min="${spec.slider.min}" max="${spec.slider.max}" step="${spec.slider.step}" data-gfx="${name}"><span data-text="gfx-${name}"></span></div>`
      : `<div class="seg">${spec.choices.map(([k, label]) => `<button data-act="gfx:${name}:${k}">${label}</button>`).join('')}</div>`
    root.querySelector(`.gfx-list[data-tab=${spec.tab}]`).insertAdjacentHTML('beforeend', `<div class="toggle-row gfx-row"><span>${spec.label}</span>${control}</div>`)
  }
  if (canFullscreen()) root.querySelector('.gfx-list[data-tab=graphics]').insertAdjacentHTML('beforeend', '<div class="toggle-row gfx-row"><span>Fullscreen</span><button data-act="fullscreen" data-text="fullscreen-label">Enter Fullscreen</button></div>')
  for (const input of root.querySelectorAll('input[data-gfx]')) input.addEventListener('input', () => onAction(`gfx:${input.dataset.gfx}:${input.value}`))
  document.addEventListener('fullscreenchange', () => { for (const el of root.querySelectorAll('[data-text=fullscreen-label]')) el.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen' })
  // map buttons (rebuilt whenever custom maps change); maps that can't be played yet are left out
  const buildMapButtons = () => {
    const ids = mapIds().filter(id => MAPS[id].playable !== false)
    const buttons = act => `<div class="map-grid">${ids.map(id => `<button data-act="${act}:${id}"></button>`).join('')}</div>`
    for (const el of root.querySelectorAll('.map-select')) el.innerHTML = `<p class="label">Practice Map</p>${buttons('map')}`
    for (const el of root.querySelectorAll('.map-rotation')) el.innerHTML = `<p class="label">Maps</p>${buttons('rot')}`
    for (const b of root.querySelectorAll('.map-grid button')) b.textContent = MAPS[b.dataset.act.split(':')[1]].name   // (names as plain text)
  }
  buildMapButtons()
  for (const el of root.querySelectorAll('.dummy-select')) {
    el.innerHTML = `<p class="label">Practice Dummies</p>
      <div class="stepper"><button data-act="dummies-down">−</button><span data-text="dummy-count"></span><button data-act="dummies-up">+</button></div>`
  }
  root.querySelector('[data-text=version]').textContent = 'v' + GAME_VERSION
  root.querySelector('.dup-builtin').innerHTML = BUILTIN_MAP_IDS.map(id => `<button data-act="dup:${id}">${MAPS[id].name}</button>`).join('')
  const mapCodeInput = root.querySelector('[data-input=map-code]'), exportInput = root.querySelector('[data-input=export-code]')
  const codeInput = root.querySelector('[data-input=join-code]')
  // Feedback: the category buttons, and the message's character count as you type
  root.querySelector('.feedback-cats').innerHTML = CATEGORIES.map(c => `<button data-act="feedback-cat:${c}">${c}</button>`).join('')
  const messageInput = root.querySelector('[data-input=feedback-message]')
  const nameInput = root.querySelector('[data-input=feedback-name]'), emailInput = root.querySelector('[data-input=feedback-email]')
  const systemInput = root.querySelector('[data-input=feedback-system]')
  const showCount = () => { root.querySelector('[data-text=feedback-count]').textContent = `${messageInput.value.length} / ${LIMITS.message}` }
  messageInput.addEventListener('input', showCount)
  // out of the game: the title art behind the card instead of the arena (screens that can be either,
  // like Settings, are told which by whoever opens them)
  const SOLID_SCREENS = ['main', 'play', 'join', 'feedback', 'maps', 'import', 'export']
  codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAction('connect') })
  return {
    get open() { return root.classList.contains('open') },
    get screen() { return screen },
    get solid() { return root.classList.contains('solid') },
    // title: in place of the screen's own data-title; solid: in place of SOLID_SCREENS
    show(name, { title, solid = SOLID_SCREENS.includes(name) } = {}) {
      screen = name
      root.classList.add('open')
      root.classList.toggle('solid', solid)
      root.dataset.screen = name
      for (const el of root.querySelectorAll('.screen')) {
        el.classList.toggle('active', el.dataset.screen === name)
        if (el.dataset.screen === name) this.setText('menu-title', title || el.dataset.title)
      }
      if (name === 'join') setTimeout(() => codeInput.focus(), 0)
      if (name === 'feedback') setTimeout(() => messageInput.focus(), 0)
      if (name === 'import') { mapCodeInput.value = ''; setTimeout(() => mapCodeInput.focus(), 0) }
    },
    hide() { root.classList.remove('open') },
    setText(key, text) { for (const el of root.querySelectorAll(`[data-text=${key}]`)) el.textContent = text },
    // show/hide elements marked data-show="key"
    setShown(key, shown) { for (const el of root.querySelectorAll(`[data-show=${key}]`)) el.classList.toggle('hidden', !shown) },
    get joinCode() { return codeInput.value.trim().toUpperCase() },
    get mapCode() { return mapCodeInput.value },
    // the Feedback screen: what's typed in it, the picked category, and emptying it after a send
    // (system: whether they ticked Send System Information)
    get feedback() { return { message: messageInput.value, name: nameInput.value, email: emailInput.value, system: systemInput.checked } },
    showFeedbackCategory(cat) {
      for (const b of root.querySelectorAll('[data-act^="feedback-cat:"]')) b.classList.toggle('on', b.dataset.act === 'feedback-cat:' + cat)
    },
    clearFeedback() { messageInput.value = nameInput.value = emailInput.value = ''; showCount() },
    showExportCode(code) { exportInput.value = code; setTimeout(() => exportInput.select(), 0) },
    // the My maps list (names are shown as plain text: they can come from anywhere)
    showMyMaps(defs, confirmDelete) {
      const list = root.querySelector('.my-maps')
      list.replaceChildren()
      for (const d of defs) {
        const row = document.createElement('div')
        row.className = 'my-map'
        const name = document.createElement('div')
        name.className = 'my-map-name'
        name.textContent = d.name + ' '
        const playable = MAPS[d.id] && MAPS[d.id].playable !== false
        if (!playable) name.insertAdjacentHTML('beforeend', '<span class="warn">(needs fixing before it can be played)</span>')
        const buttons = document.createElement('div')
        buttons.className = 'my-map-buttons'
        buttons.innerHTML = `<button data-act="map-play:${d.id}"${playable ? '' : ' disabled'}>Play</button><button data-act="map-edit:${d.id}">Edit</button>` +
          `<button data-act="map-copy:${d.id}">Copy</button><button data-act="map-code:${d.id}">Code</button>` +
          `<button class="danger" data-act="map-delete:${d.id}">${confirmDelete === d.id ? 'Sure?' : 'Delete'}</button>`
        row.append(name, buttons)
        list.appendChild(row)
      }
      if (!defs.length) list.innerHTML = '<p class="label note">No maps yet. Make one!</p>'
    },
    showSettings(settings) {
      for (const mode of MATCH_MODES) {
        for (const b of root.querySelectorAll(`[data-act="mode:${mode}"]`)) b.classList.toggle('on', settings.mode === mode)
      }
      for (const el of root.querySelectorAll('.match-settings .stepper')) el.classList.toggle('hidden', settings.mode === 'endless')
      this.showToggle('order-toggle', settings.shuffle)
      this.showToggle('sights-toggle', settings.sights)
      this.setText('match-num', settings.mode === 'rounds' ? `${settings.rounds} rounds` : `${settings.wins} wins`)
    },
    // an On/Off button
    showToggle(act, on) {
      for (const b of root.querySelectorAll(`[data-act="${act}"]`)) {
        b.classList.toggle('on', on)
        b.textContent = on ? 'On' : 'Off'
      }
    },
    // Settings' Controls tab: each action's key (waiting: the action waiting for its new key)
    showBinds(binds, waiting = null) {
      for (const [action] of BIND_ACTIONS) {
        const b = root.querySelector(`[data-act="bind:${action}"]`)
        b.textContent = action === waiting ? 'Press…' : keyName(binds[action])
        b.classList.toggle('waiting', action === waiting)
        b.classList.toggle('unbound', !binds[action] && action !== waiting)
      }
      // (the hint keeps its space when hidden, so the buttons under it don't jump)
      root.querySelector('[data-text=bind-hint]').style.visibility = waiting ? '' : 'hidden'
    },
    // the graphics and accessibility settings' current choices (values: by name, as app/graphics.js keeps them)
    showGraphics(values) {
      for (const [name, spec] of Object.entries(GRAPHICS)) {
        if (spec.slider) {
          const input = root.querySelector(`input[data-gfx=${name}]`)
          if (Number(input.value) !== values[name]) input.value = values[name]
          this.setText(`gfx-${name}`, `${values[name]}%`)
        } else for (const b of root.querySelectorAll(`[data-act^="gfx:${name}:"]`)) b.classList.toggle('on', b.dataset.act === `gfx:${name}:${values[name]}`)
      }
    },
    // the Settings screen's tabs (gameplay, controls, graphics, accessibility)
    showTab(name) {
      for (const b of root.querySelectorAll('[data-act^="settings-tab:"]')) b.classList.toggle('on', b.dataset.act === 'settings-tab:' + name)
      for (const p of root.querySelectorAll('.tab-panel')) p.classList.toggle('active', p.dataset.tab === name)
    },
    rebuildMaps: buildMapButtons,
    showMap(id) {
      for (const b of root.querySelectorAll('[data-act^="map:"]')) b.classList.toggle('on', b.dataset.act === 'map:' + id)
    },
    showRotation(maps) {
      for (const b of root.querySelectorAll('[data-act^="rot:"]')) b.classList.toggle('on', !!maps[b.dataset.act.slice(4)])
    },
    showSpawnSettings(settings) {
      for (const row of root.querySelectorAll('.pk-row[data-type]')) showRarityRow(row, settings[row.dataset.type])
    },
  }
}

// One row of an Enabled / Rarity table (pumpkins): st = { on, rate }
function showRarityRow(row, st) {
  row.classList.toggle('off', !st.on)
  const toggle = row.querySelector('.pk-on')
  toggle.classList.toggle('on', st.on)
  toggle.textContent = st.on ? 'On' : 'Off'
  for (const b of row.querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.act.endsWith(':' + st.rate))
}
