// PALETTE: every color (and font) the canvas drawing uses, in one place, grouped by what it colors.
// The render code reads these instead of writing colors inline, so changing the look means changing
// this file. Not in here: each pumpkin type's own colors (PUMPKIN_TYPES in game/pumpkinTypes.js),
// each map's colors (THEMES in maps/themes.js) and the players' colors (PLAYER_COLORS in config.js).
// The HTML menus, map editor panel and tuning panel get theirs from styles/tokens.css.

const freeze = o => {
  for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v)
  return Object.freeze(o)
}

// Text and marks over the game (HUD, debug, the crosshair): the main palette, Pumpkin & Bark (the same
// as the menus' in styles/tokens.css), plus a few debug colors.
export const UI = freeze({
  ink: '#2e2620',
  inkEdge: '#16110d',     // (the ledge under ink chips)
  paper: '#f6efe3',
  paperEdge: '#d9cbb5',   // (the ledge under paper chips and tiles)
  pumpkin: '#f28c28',     // (KO!, a draw)
  logoEdge: '#1c1511',    // (the outline and drop under banners)
  hit: '#e8384f',         // (damage numbers)
  healthTrack: 'rgba(59, 54, 49, 0.15)',   // (debug health bars: the empty part)
  crosshair: { edge: 'rgba(30, 24, 20, 0.85)', line: '#fff' },
  debugRay: { hit: '#1a9e3a', miss: '#c33' },
})

// Canvas fonts, by role: display (Luckiest Guy: big text, numbers, banners), text (Fredoka: small
// print), mono (debug lines), system (the map editor's marks). font(role, px) builds a ctx.font string;
// the weight defaults to 500 for text and 400 for the rest.
export const FONT = freeze({
  display: '"Luckiest Guy", "Arial Black", sans-serif',
  text: 'Fredoka, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
  system: 'system-ui, sans-serif',
})
export const font = (role, px, weight = role === 'text' ? 500 : 400) => `${weight} ${Math.round(px)}px ${FONT[role]}`

// The stick figures and what they wear.
export const PLAYER = freeze({
  eye: '#fff',                          // (also the X eyes)
  pupil: '#1d1a2a',
  frozenTint: '#cdeefa',                // mixed into their color while frozen
  frost: '#ffffff',                     // (the diamonds on a frozen head)
  balloonString: '#6b6358',
  crown: { gold: '#f7c531', edge: '#9a6b00', jewel: '#d6303f' },
  grappleVine: '#3c7a22',
})

// Pumpkins: ripeness tints, patches, shared parts and marks, and the extras some types draw.
export const GOURD = freeze({
  unripe: { color: '#76a83f', rib: '#557d2a' },
  rotten: { color: '#7a5a32', rib: '#56401f' },
  patchLeaf: '#4c7a2a',                 // (the leaves on the ground round a patch)
  stem: '#4f8a34',
  leaf: '#76b046',                      // (on the stem; the Vine's too)
  dark: '#3b3631',                      // (a fuse, an antenna, a rocket's nozzle)
  superRare: { gold: '#ffd54a', sparkle: '#fff6c8' },
  spark: ['#ff9a2e', '#ffe08a', '#ffc94d', '#ffe08a'],   // (a fuse's spark burst: the big star, the small one, the spark lines, the flying dots)
  ice: '#ffffff',
  vine: '#3c7a22',                      // (its curl, and the trail back to the thrower)
  stars: '#f4efe6',
  crosshair: '#d6332a',
  antennaBlink: ['#fff3b0', '#ff3b2a'],
  string: '#6b6358',
  chomper: { mouth: '#c8383a', tooth: '#f3ecc4', wart: '#7f8a2c' },
  mine: { stem: '#3d4a22', glow: 'rgba(255, 70, 50, 0.35)', lit: '#ff3b2a', unlit: '#6e1f1a', dirt: '#6b4f32' },
  flameTrail: ['#fff3b0', '#ffd23f', '#ff9a2e', '#ff6a1f', '#e2381b'],   // (nearest the gourd first)
  lockOn: '#e2381b',
  airstrike: { shadow: '#14100c', target: '#d6332a' },
  blackHole: { speck: '#fff', halo: ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)'], core: '#000' },
})

// Until every map has its own shade tint (theme.shade) and contact shadow color (theme.shadow): these.
export const shadeOf = theme => theme.shade || '#d6cfc4'
export const shadowOf = theme => theme.shadow || 'rgba(0, 0, 0, 0.15)'

// Effects, by game event (see EFFECTS in effects.js).
export const FX = freeze({
  boom: { burst: ['#ff9a2e', '#e2571b', '#3b3631', '#ffd36b'], ring: '#e2571b' },
  pierce: { rind: '#4f6a24', flesh: '#f6f1cf' },   // (with the type's own rib and color)
  snap: ['#b9c24a', '#6b7524', '#c8383a', '#f3ecc4'],
  wilt: ['#9a9a3e', '#6b6a2c', '#a07a3a'],
  hole: ['#4b2c84', '#a46bff', '#0b0614'],
  swallow: ['#a46bff', '#0b0614', '#f4efe6'],
  collapse: { burst: ['#a46bff', '#f4efe6', '#4b2c84'], ring: '#a46bff' },
  seed: '#f6e7c1',                                 // (seeds in a splat or a pop)
  cannon: { flash: ['#ffd23f', '#ff8a1f'], smoke: ['#d8d4cc', '#b9b4aa', '#8f8a80'] },
  block: ['#d9b25c', '#9c7a2e', '#3b3631'],
  freeze: ['#ffffff', '#dff4fc', '#9fd8f0'],
  straw: ['#e2b84a', '#c9982f', '#f3d77a', '#8a5a2b'],
  burn: { small: ['#ff8a1f', '#ffd23f'], big: ['#ff8a1f', '#ffd23f', '#e2481b', '#3b3631'] },
  dust: ['#c9bfb2', '#9a8f80'],
  yank: ['#5fae3c', '#3c7a22'],
  hit: { spark: '#f08a1c', dark: '#3b3631' },
})

// Level pieces (level.js).
export const LEVEL = freeze({
  bale: {
    straw: '#e2b84a', edge: '#a87b26', lines: '#c9982f', twine: '#8a5a2b', crack: '#6b4a1f',
    ice: 'rgba(190, 232, 250, 0.6)', iceEdge: 'rgba(255, 255, 255, 0.95)', balloonString: '#6b6358',
  },
  pitchfork: { bar: '#6b4a2b', tine: '#a3a9ae', tineEdge: '#5f656a' },
  bonfire: { log: '#5b3a1e', glow: ['rgba(255, 160, 60, 0.35)', 'rgba(255, 160, 60, 0)'], flames: ['#e2481b', '#ff8a1f', '#ffd23f'] },
  scarecrow: {
    pole: '#6b4a2b', body: '#b5894d', head: '#d9b77a', hat: '#3b3631', arm: '#7a5530',
    blade: '#c9ced2', bladeEdge: '#5f656a', hub: '#3b3631',
  },
  cannon: {
    mount: '#6b4a2b', strap: '#3c3f44', barrel: '#2f3338', band: '#4a4f55', muzzle: '#f28c28',
    pin: '#4a4f55', spark: '#ffd23f', sparkCore: '#ff8a1f',
  },
})

// Each map's backdrop scenery, by its theme's scenery name (scenery.js).
export const BACKDROP = freeze({
  hills: { hill: 'rgba(90, 143, 60, 0.12)' },
  barn: { planks: 'rgba(94, 59, 31, 0.18)', rafters: 'rgba(94, 59, 31, 0.45)' },
  sunset: { sun: 'rgba(255, 236, 170, 0.85)', hills: 'rgba(160, 110, 50, 0.35)' },
  rocks: { rocks: 'rgba(70, 78, 92, 0.35)' },
  night: { stars: 'rgba(255, 255, 255, 0.8)', moon: '#f3ecd2', pines: 'rgba(8, 12, 22, 0.75)' },
  wheat: { stem: '#b8942c', head: '#e0bb45' },
})

// Crows (crows.js).
export const CROW = freeze({
  ink: '#1a191f', far: '#34313c', edge: '#2a2830',
  xEye: '#f4efe6', eyeRing: '#4a4652', pupil: '#060608', glint: '#ffffff',
  quill: '#5a5563',
})

// Stars circling something dazed (a crow, a player).
export const DIZZY = freeze({ star: '#f7c531' })

// The main menu's logo (ui/titleLogo.js): the splat behind the pumpkin that hit it, the puffs round it
// (by heat, like a blast's: see docs/RESTYLE_PLAN.md 4.4) and its seeds.
export const TITLE = freeze({
  splat: '#c4630f',
  puff: { hot: '#ffe08a', warm: '#ffb347', cool: '#ff7f3f' },
  seed: '#f6e7c1',
})

// The map editor's marks over the map (ui/editor).
export const EDITOR = freeze({
  scytheReach: 'rgba(200, 40, 40, 0.55)',
  warning: '#e89a1c',
  error: '#e0302a',
  hover: 'rgba(43, 155, 255, 0.6)',
  select: '#2b9bff',
  handle: '#fff',
  handleEdge: '#1d6fb8',
  cannonPath: { strong: 'rgba(242, 140, 40, 0.9)', faint: 'rgba(242, 140, 40, 0.45)' },
})
