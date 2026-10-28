// MENU (the HTML card in #menu)

import { MATCH_MODES } from '../game/match.js'
import { PUMPKIN_TYPES, RATE_LABELS, SPAWNABLE_TYPES, SPAWN_RATES } from '../game/pumpkinTypes.js'
import { BUILTIN_MAP_IDS, MAPS, mapIds } from '../maps/builtin.js'
import { GAME_VERSION } from '../version.js'

export function createMenu(onAction) {
  const root = document.getElementById('menu')
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
  // the logo: one span per letter so they can drop in one after another
  const LOGO = 'Gourd Wars', dropDelay = i => 0.1 + i * 0.06, DROP_TIME = 0.8   // (DROP_TIME: logo-drop's length)
  const landed = dropDelay(LOGO.length - 1) + DROP_TIME, SWAY_IN = 0.9   // (SWAY_IN: logo-sway-in's length)
  root.querySelector('.logo').innerHTML = `<span class="wobble" style="animation-delay:${landed}s, ${landed + SWAY_IN}s">` + [...LOGO].map((ch, i) =>
    ch === ' ' ? '<span class="gap"></span>' : `<span class="ch" style="animation-delay:${dropDelay(i)}s">${ch}</span>`).join('') + '</span>'
  // pumpkin spawn settings: one row per type, under column headings
  const rates = Object.keys(SPAWN_RATES)
  root.querySelector('.pumpkin-list').innerHTML = '<div class="pk-head"><span class="pk-name"></span><span>Enabled</span><span>Rarity</span></div>' + SPAWNABLE_TYPES.map(k => `
    <div class="pk-row" data-type="${k}">
      <span class="dot" style="background:${PUMPKIN_TYPES[k].color}"></span>
      <span class="pk-name">${PUMPKIN_TYPES[k].name}</span>
      <button class="pk-on" data-act="pk-toggle:${k}">On</button>
      <div class="seg">${rates.map(r => `<button data-act="pk-rate:${k}:${r}">${RATE_LABELS[r]}</button>`).join('')}</div>
    </div>`).join('')
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
  const SOLID_SCREENS = ['main', 'join', 'maps', 'import', 'export']   // out of the game: no arena behind the card
  codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAction('connect') })
  return {
    get open() { return root.classList.contains('open') },
    get screen() { return screen },
    // title: in place of the screen's own data-title
    show(name, title) {
      screen = name
      root.classList.add('open')
      root.classList.toggle('solid', SOLID_SCREENS.includes(name))
      root.dataset.screen = name
      for (const el of root.querySelectorAll('.screen')) {
        el.classList.toggle('active', el.dataset.screen === name)
        if (el.dataset.screen === name) this.setText('menu-title', title || el.dataset.title)
      }
      if (name === 'join') setTimeout(() => codeInput.focus(), 0)
      if (name === 'import') { mapCodeInput.value = ''; setTimeout(() => mapCodeInput.focus(), 0) }
    },
    hide() { root.classList.remove('open') },
    setText(key, text) { for (const el of root.querySelectorAll(`[data-text=${key}]`)) el.textContent = text },
    // show/hide elements marked data-show="key"
    setShown(key, shown) { for (const el of root.querySelectorAll(`[data-show=${key}]`)) el.classList.toggle('hidden', !shown) },
    get joinCode() { return codeInput.value.trim().toUpperCase() },
    get mapCode() { return mapCodeInput.value },
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
      for (const [act, on] of [['order-toggle', settings.shuffle], ['sights-toggle', settings.sights]]) {
        for (const b of root.querySelectorAll(`[data-act=${act}]`)) {
          b.classList.toggle('on', on)
          b.textContent = on ? 'On' : 'Off'
        }
      }
      this.setText('match-num', settings.mode === 'rounds' ? `${settings.rounds} rounds` : `${settings.wins} wins`)
    },
    rebuildMaps: buildMapButtons,
    showMap(id) {
      for (const b of root.querySelectorAll('[data-act^="map:"]')) b.classList.toggle('on', b.dataset.act === 'map:' + id)
    },
    showRotation(maps) {
      for (const b of root.querySelectorAll('[data-act^="rot:"]')) b.classList.toggle('on', !!maps[b.dataset.act.slice(4)])
    },
    showSpawnSettings(settings) {
      for (const row of root.querySelectorAll('.pk-row')) {
        const st = settings[row.dataset.type]
        row.classList.toggle('off', !st.on)
        const toggle = row.querySelector('.pk-on')
        toggle.classList.toggle('on', st.on)
        toggle.textContent = st.on ? 'On' : 'Off'
        for (const b of row.querySelectorAll('.seg button')) b.classList.toggle('on', b.dataset.act.endsWith(':' + st.rate))
      }
    },
  }
}
