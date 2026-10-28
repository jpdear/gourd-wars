// TUNING PANEL (opens with the debug overlay)
// Sliders change the values live. Tweaks are saved in this browser so they
// survive a reload; "Copy changes" puts them on the clipboard so you can
// paste them into config.js / pumpkinTypes.js (or into a chat).

import { Vec2 } from 'planck'
import { CONFIG } from '../config.js'
import { PUMPKIN_TYPES } from '../game/pumpkinTypes.js'
import { STORAGE_KEYS, loadJSON, saveJSON } from '../util/storage.js'

const TUNING_ROOTS = { CONFIG, PUMPKIN_TYPES }

// Tabs → collapsible groups → sliders: [path, min, max, step, label (defaults to the last part of the path)]
const T_ = 'PUMPKIN_TYPES.'
const TUNABLES = [
  ['Player', [
    ['World', [
      ['CONFIG.gravity', 5, 60, 0.5],
    ]],
    ['Movement', [
      ['CONFIG.player.moveSpeed', 2, 15, 0.5],
      ['CONFIG.player.groundAccel', 10, 200, 5],
      ['CONFIG.player.airAccel', 0, 100, 5],
      ['CONFIG.player.jumpSpeed', 5, 25, 0.5],
      ['CONFIG.player.coyoteTime', 0, 0.3, 0.01],
    ]],
    ['Wall', [
      ['CONFIG.player.wall.reach', 0.2, 1.2, 0.05, 'reach'],
      ['CONFIG.player.wall.slideSpeed', 0, 15, 0.25, 'slide speed'],
      ['CONFIG.player.wall.grace', 0, 0.4, 0.01, 'jump grace'],
      ['CONFIG.player.wall.jumpUp', 0, 25, 0.5, 'jump up'],
      ['CONFIG.player.wall.jumpAway', 0, 20, 0.5, 'jump away'],
      ['CONFIG.player.wall.steerLock', 0, 0.6, 0.02, 'steer lock'],
    ]],
    ['Crouch', [
      ['CONFIG.player.crouch.lean', -0.5, 1.5, 0.05, 'lean back'],
      ['CONFIG.player.crouch.airFall', 1, 3, 0.05, 'press (fall)'],
      ['CONFIG.player.crouch.firmness', 0, 1, 0.05, 'firmness'],
      ['CONFIG.player.crouch.speed', 0, 1, 0.05, 'scoot speed'],
      ['CONFIG.player.crouch.legsOutTime', 0, 1.5, 0.05, 'legs out time'],
      ['CONFIG.player.crouch.legFriction', 0, 1, 0.05, 'leg friction'],
    ]],
    ['Body', [
      ['CONFIG.player.hoverK', 20, 400, 5],
      ['CONFIG.player.hoverD', 0, 60, 1],
      ['CONFIG.player.uprightK', 10, 400, 5],
      ['CONFIG.player.uprightD', 0, 60, 1],
      ['CONFIG.player.legTorque', 0, 30, 0.5],
      ['CONFIG.player.armTorque', 0, 30, 0.5],
      ['CONFIG.player.limpTorque', 0, 3, 0.05],
      ['CONFIG.player.recoverTime', 0, 2, 0.05],
    ]],
  ]],
  ['Combat', [
    ['Throwing', [
      ['CONFIG.throw.minSpeed', 2, 30, 0.5],
      ['CONFIG.throw.maxSpeed', 5, 50, 0.5],
      ['CONFIG.throw.chargeTime', 0.1, 2, 0.05],
      ['CONFIG.throw.cooldown', 0, 2, 0.05],
    ]],
    ['Punch', [
      ['CONFIG.punch.knockback', 0, 15, 0.5],
      ['CONFIG.punch.damage', 0, 40, 1],
      ['CONFIG.punch.stun', 0, 1.5, 0.05],
      ['CONFIG.punch.cooldown', 0.1, 1.5, 0.05],
    ]],
    ['Damage & stagger', [
      ['CONFIG.player.maxHealth', 10, 200, 5],
      ['CONFIG.damage.staggerAt', 5, 60, 1],
      ['CONFIG.damage.drainDelay', 0, 2, 0.05],
      ['CONFIG.damage.drainRate', 0, 150, 5],
      ['CONFIG.damage.shoveScale', 0, 1, 0.05],
    ]],
  ]],
  ['Level', [
    ['Hay bales', [
      ['CONFIG.level.baleHealth', 5, 200, 5, 'health'],
      ['CONFIG.level.balePunchMultiplier', 0, 10, 0.5, 'punch damage x'],
      ['CONFIG.level.baleBlastMultiplier', 0, 10, 0.5, 'blast damage x'],
      ['CONFIG.level.balePushForce', 0, 400, 10, 'push force'],
      ['CONFIG.level.balePushSpeed', 0.5, 7, 0.1, 'push speed cap'],
    ]],
    ['Hazards', [
      ['CONFIG.level.fireDps', 0, 60, 1, 'fire dmg / sec'],
      ['CONFIG.level.fireHop', 0, 20, 0.5, 'fire hop speed'],
      ['CONFIG.level.spikeDamage', 0, 100, 1, 'pitchfork dmg'],
      ['CONFIG.level.spikeCooldown', 0, 2, 0.05, 'pitchfork cooldown'],
      ['CONFIG.level.spikeBounce', 0, 25, 0.5, 'pitchfork bounce'],
      ['CONFIG.level.scytheTurnTime', 0.5, 10, 0.1, 'scythe turn (s)'],
    ]],
  ]],
  ['Patches', [
    ['Growing', [
      ['CONFIG.patch.growTime', 1, 20, 0.5],
      ['CONFIG.patch.ripeTime', 1, 20, 0.5],
      ['CONFIG.patch.regrowTime', 0, 15, 0.5],
      ['CONFIG.patch.harvestTime', 0.1, 2, 0.05],
    ]],
  ]],
  ['Pumpkins', [
    ['Classic', [
      [T_ + 'classic.damage', 0, 60, 1],
      [T_ + 'classic.knockback', 0, 25, 0.5],
      [T_ + 'classic.stun', 0, 3, 0.05],
    ]],
    ['Bouncy', [
      [T_ + 'bouncy.damage', 0, 60, 1],
      [T_ + 'bouncy.knockback', 0, 25, 0.5],
      [T_ + 'bouncy.restitution', 0, 1, 0.05, 'bounciness'],
      [T_ + 'bouncy.breakAfterHits', 1, 10, 1, 'bounces'],
    ]],
    ["Jack-o'-Boom", [
      [T_ + 'boom.blast.radius', 0.5, 6, 0.1, 'blast radius'],
      [T_ + 'boom.blast.damage', 0, 100, 1, 'blast damage'],
      [T_ + 'boom.blast.knockback', 0, 40, 0.5, 'blast knockback'],
      [T_ + 'boom.blast.stun', 0, 3, 0.05, 'blast ragdoll'],
    ]],
    ['Gourd Cluster', [
      [T_ + 'mini.damage', 0, 40, 1, 'piece damage'],
      [T_ + 'mini.knockback', 0, 20, 0.5, 'piece knockback'],
    ]],
    ['Frost', [
      [T_ + 'frost.damage', 0, 40, 1],
      [T_ + 'frost.freeze', 0, 5, 0.1, 'freeze time'],
    ]],
    ['Splat Pie', [
      [T_ + 'pie.damage', 0, 40, 1],
      [T_ + 'pie.glue', 0, 5, 0.1, 'glue time'],
    ]],
    ['Vine', [
      [T_ + 'vine.damage', 0, 40, 1],
      [T_ + 'vine.yankSpeed', 2, 30, 0.5, 'yank speed'],
      [T_ + 'vine.yankLift', 0, 15, 0.5, 'yank lift'],
      [T_ + 'vine.grapple.speed', 2, 60, 1, 'reel speed'],
      [T_ + 'vine.grapple.accel', 5, 400, 5, 'reel accel'],
      [T_ + 'vine.grapple.reach', 0, 1, 0.05, 'reel reach'],
      [T_ + 'vine.grapple.stopAt', 0.2, 3, 0.05, 'reel stop dist'],
      [T_ + 'vine.grapple.maxTime', 0.1, 3, 0.05, 'reel max time'],
      [T_ + 'vine.grapple.keep', 0, 1, 0.05, 'reel keep speed'],
      [T_ + 'vine.grapple.hop', 0, 20, 0.5, 'reel end hop'],
      [T_ + 'vine.throwSpeed.min', 10, 80, 1, 'tap speed'],
      [T_ + 'vine.throwSpeed.max', 10, 80, 1, 'full speed'],
      [T_ + 'vine.gravityScale', 0, 1, 0.05, 'gravity'],
      [T_ + 'vine.lifetime', 0.1, 3, 0.05, 'range (s)'],
    ]],
    ['Big Gourd', [
      [T_ + 'biggourd.damage', 0, 100, 1],
      [T_ + 'biggourd.knockback', 0, 30, 0.5],
      [T_ + 'biggourd.carry.speed', 0.1, 1, 0.05, 'carry speed'],
      [T_ + 'biggourd.carry.jump', 0.1, 1.5, 0.05, 'carry jump'],
      [T_ + 'biggourd.shieldBlocks', 1, 10, 1, 'shield blocks'],
    ]],
    ['Seed Spitter', [
      [T_ + 'spitter.ammo', 1, 40, 1],
      [T_ + 'spitter.fireInterval', 0.03, 0.5, 0.01, 'fire interval'],
      [T_ + 'spitter.seedSpeed', 5, 40, 1, 'seed speed'],
      [T_ + 'seed.damage', 0, 10, 0.5, 'seed damage'],
      [T_ + 'seed.knockback', 0, 10, 0.1, 'seed knockback'],
    ]],
    ['Balloon Gourd', [
      [T_ + 'balloon.damage', 0, 40, 1],
      [T_ + 'balloon.float', 0, 5, 0.1, 'float time'],
      [T_ + 'balloon.carry.jump', 0.5, 2, 0.05, 'carry jump'],
    ]],
    ['Black Hole', [
      [T_ + 'blackhole.hole.startRadius', 0.05, 1, 0.05, 'start size'],
      [T_ + 'blackhole.hole.maxRadius', 0.2, 10, 0.1, 'max size'],
      [T_ + 'blackhole.hole.growTime', 0.5, 15, 0.5, 'grow time'],
      [T_ + 'blackhole.hole.collapseTime', 0.1, 2, 0.05, 'collapse time'],
      [T_ + 'blackhole.hole.pull', 0, 400, 5, 'pull'],
      [T_ + 'blackhole.hole.maxPull', 10, 400, 5, 'max pull'],
      [T_ + 'blackhole.hole.patchRip', 5, 200, 5, 'patch rip pull'],
      [T_ + 'blackhole.hole.shake', 0, 1, 0.01, 'screen shake'],
    ]],
    ['Airstrike', [
      [T_ + 'airstrike.delay', 0.2, 3, 0.05, 'delay'],
      [T_ + 'airstrike.entrySpeed', 0, 40, 1, 'entry speed'],
      [T_ + 'airdrop.radius', 0.3, 2, 0.05, 'airdrop size'],
      [T_ + 'airdrop.blast.radius', 0.5, 8, 0.1, 'blast radius'],
      [T_ + 'airdrop.blast.damage', 0, 100, 1, 'blast damage'],
      [T_ + 'airdrop.blast.knockback', 0, 60, 0.5, 'blast knockback'],
      [T_ + 'airdrop.blast.stun', 0, 3, 0.05, 'blast ragdoll'],
      [T_ + 'airdrop.shake', 0, 1, 0.01, 'screen shake'],
    ]],
    ['Homing', [
      [T_ + 'homing.damage', 0, 100, 1],
      [T_ + 'homing.knockback', 0, 30, 0.5],
      [T_ + 'homing.homing.delay', 0, 2, 0.05, 'delay'],
      [T_ + 'homing.homing.speed', 2, 50, 0.5, 'speed'],
      [T_ + 'homing.homing.turnRate', 1, 40, 0.5, 'turn rate'],
      [T_ + 'homing.homing.lookAhead', 0, 8, 0.1, 'look ahead'],
      [T_ + 'homing.homing.maxChase', 0.5, 10, 0.1, 'max chase'],
    ]],
  ]],
]

function resolvePath(path) {
  const keys = path.split('.')
  const key = keys.pop()
  return { obj: keys.reduce((o, k) => o[k], TUNING_ROOTS), key }
}

export function createTuningPanel(game) {
  const panel = document.getElementById('tuning')
  const rows = []
  const defaults = {}   // the values written in the code, before any saved tweaks

  const get = path => { const { obj, key } = resolvePath(path); return obj[key] }
  const set = (path, value) => {
    const { obj, key } = resolvePath(path)
    obj[key] = value
    if (path === 'CONFIG.gravity') game.world.setGravity(new Vec2(0, -value))
  }
  const changes = () => rows.filter(r => get(r.path) !== defaults[r.path])
  const save = () => {
    const saved = {}
    for (const r of changes()) saved[r.path] = get(r.path)
    saveJSON(STORAGE_KEYS.tuning, saved)
    refreshBadges()
  }

  // which tab is shown and which groups are expanded (remembered in this browser)
  let view = { tab: TUNABLES[0][0], open: [], ...loadJSON(STORAGE_KEYS.tuningView) }
  const saveView = () => saveJSON(STORAGE_KEYS.tuningView, view)

  panel.innerHTML = '<div class="head"><b>Tuning</b><span>double-click a name to reset it</span></div>' +
    '<div class="note">The host controls physics settings.</div>'
  const tabBar = document.createElement('div')
  tabBar.className = 'tabs'
  panel.appendChild(tabBar)
  const groups = []   // { el, badge, rows }
  const tabs = []     // { name, button, el }
  const showTab = name => {
    view.tab = name
    for (const t of tabs) {
      t.button.classList.toggle('on', t.name === name)
      t.el.hidden = t.name !== name
    }
    saveView()
  }
  const refreshBadges = () => {
    for (const g of groups) {
      const n = g.rows.filter(r => get(r.path) !== defaults[r.path]).length
      g.badge.textContent = n ? `${n} changed` : ''
    }
    for (const t of tabs) t.button.classList.toggle('changed', groups.some(g => g.tab === t.name && g.badge.textContent))
  }

  for (const [tabName, tabGroups] of TUNABLES) {
    const button = document.createElement('button')
    button.textContent = tabName
    button.addEventListener('click', () => { button.blur(); showTab(tabName) })
    tabBar.appendChild(button)
    const tabEl = document.createElement('div')
    panel.appendChild(tabEl)
    tabs.push({ name: tabName, button, el: tabEl })

    for (const [groupName, items] of tabGroups) {
      const key = `${tabName}/${groupName}`
      const groupEl = document.createElement('div')
      groupEl.className = 'group'
      groupEl.classList.toggle('open', view.open.includes(key))
      groupEl.innerHTML = `<button class="group-head"><span>${groupName}</span><span class="badge"></span></button><div class="group-body"></div>`
      const head = groupEl.querySelector('.group-head')
      head.addEventListener('click', () => {
        head.blur()
        const open = groupEl.classList.toggle('open')
        view.open = open ? [...view.open, key] : view.open.filter(k => k !== key)
        saveView()
      })
      tabEl.appendChild(groupEl)
      const group = { tab: tabName, el: groupEl, badge: groupEl.querySelector('.badge'), rows: [] }
      groups.push(group)
      const body = groupEl.querySelector('.group-body')

      for (const [path, min, max, step, labelText] of items) {
        defaults[path] = get(path)
        const decimals = (String(step).split('.')[1] || '').length
        const row = document.createElement('div')
        row.className = 'row'
        row.innerHTML = `<label title="${path}">${labelText || path.split('.').pop()}</label>
          <input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`
        const label = row.querySelector('label')
        const input = row.querySelector('input')
        const val = row.querySelector('.val')
        const r = {
          path,
          refresh() {
            const v = get(path)
            input.value = v
            val.textContent = v.toFixed(decimals)
            row.classList.toggle('changed', v !== defaults[path])
          },
        }
        input.addEventListener('input', () => { set(path, Number(input.value)); r.refresh(); save() })
        input.addEventListener('change', () => input.blur())   // give the keyboard back to the game
        label.addEventListener('dblclick', () => { set(path, defaults[path]); r.refresh(); save() })
        rows.push(r)
        group.rows.push(r)
        body.appendChild(row)
      }
    }
  }
  showTab(tabs.some(t => t.name === view.tab) ? view.tab : tabs[0].name)

  const buttons = document.createElement('div')
  buttons.className = 'buttons'
  buttons.innerHTML = '<button data-act="copy">Copy changes</button><button data-act="reset">Reset all</button>'
  panel.appendChild(buttons)
  const copyBtn = buttons.querySelector('[data-act=copy]')
  copyBtn.addEventListener('click', () => {
    copyBtn.blur()
    const lines = changes().map(r => `${r.path} = ${get(r.path)}`)
    const text = lines.length ? lines.join('\n') : '(no changes from defaults)'
    const flash = msg => { copyBtn.textContent = msg; setTimeout(() => { copyBtn.textContent = 'Copy changes' }, 1200) }
    navigator.clipboard.writeText(text).then(
      () => flash('Copied!'),
      () => { console.log(text); flash('Copy failed (see console)') },
    )
  })
  buttons.querySelector('[data-act=reset]').addEventListener('click', e => {
    e.currentTarget.blur()
    for (const r of rows) { set(r.path, defaults[r.path]); r.refresh() }
    save()
  })

  // load tweaks saved from a previous session
  const saved = loadJSON(STORAGE_KEYS.tuning) || {}
  for (const r of rows) {
    if (typeof saved[r.path] === 'number') set(r.path, saved[r.path])
    r.refresh()
  }
  refreshBadges()

  return {
    setVisible: visible => panel.classList.toggle('open', visible),
    // The guest doesn't run physics, so its sliders would do nothing.
    setEnabled: enabled => {
      panel.classList.toggle('disabled', !enabled)
      for (const el of panel.querySelectorAll('input, [data-act=reset]')) el.disabled = !enabled
    },
  }
}
