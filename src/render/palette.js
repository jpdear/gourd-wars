// PALETTE: every color (and font) the canvas drawing uses, in one place, grouped by what it colors.
// The render code reads these instead of writing colors inline, so changing the look means changing
// this file. Not in here: each pumpkin type's own colors (PUMPKIN_TYPES in game/pumpkinTypes.js),
// each map's colors, its scenery's and its shading tint included (THEMES in maps/themes.js), and the
// players' colors (PLAYER_COLORS in config.js).
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
// print, the map editor's marks), mono (debug lines). font(role, px) builds a ctx.font string;
// the weight defaults to 500 for text and 400 for the rest.
export const FONT = freeze({
  display: '"Luckiest Guy", "Arial Black", sans-serif',
  text: 'Fredoka, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
})
export const font = (role, px, weight = role === 'text' ? 500 : 400) => `${weight} ${Math.round(px)}px ${FONT[role]}`

// The stick figures and what they wear.
export const PLAYER = freeze({
  eye: '#fff',                          // (also the X eyes)
  pupil: '#1d1a2a',
  outline: '#1c1511',                   // (Player Outlines, and the edge round Colorblind Mode's shapes)
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
  rubberBand: '#f6efe3',                // (round a Bouncing Bomb's middle)
  fuseFlash: { color: '#ffd23f', rib: '#d9a21a' },   // (a ticking Bouncing Bomb, each time it blinks)
  jack: { cut: '#2a0a04', dim: '#ff9a2e', bright: '#ffe08a' },   // (the Fire Gourd's face: each hole's dark cut edge, and its glow flickering dim to bright)
  swirl: '#ffd1ea',                     // (the Teleport gourd's turning spiral)
  snowCap: '#f4fafc',                   // (an Ice Bomb's dripping cap of snow)
  snowSpark: { star: '#bfe8f5', flake: '#ffffff' },   // (its fuse's spark: a pale star with a white snowflake over it)
  iceCube: { body: 'rgba(205, 238, 250, 0.72)', top: 'rgba(255, 255, 255, 0.9)' },   // (round a pumpkin frozen on its patch)
  superRare: { gold: '#ffd54a', sparkle: '#fff6c8' },
  spark: ['#ff9a2e', '#ffe08a', '#ffc94d', '#ffe08a'],   // (a fuse's spark burst: the big star, the small one, the spark lines, the flying dots)
  ice: '#ffffff',
  vine: '#3c7a22',                      // (its curl, and the trail back to the thrower)
  stars: '#f4efe6',
  crosshair: '#d6332a',
  antenna: '#e2381b',                   // (Homing's aerial light, and the ring it sends out)
  string: '#6b6358',
  chomper: { mouth: '#c8383a', tooth: '#f3ecc4', wart: '#7f8a2c' },
  mine: { stem: '#3d4a22', glow: 'rgba(255, 70, 50, 0.35)', lit: '#ff3b2a', unlit: '#6e1f1a', dirt: '#6b4f32' },
  flameTrail: ['#fff3b0', '#ffd23f', '#ff9a2e', '#ff6a1f', '#e2381b'],   // (nearest the gourd first)
  lockOn: '#e2381b',
  airstrike: { shadow: '#14100c', target: '#d6332a' },
  blackHole: { specks: ['#ffffff', '#a46bff'], halo: ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.9)'], core: '#000' },   // (halo: the outer disc, the inner one)
})


// Effects, by game event (see EFFECTS in effects.js).
export const FX = freeze({
  boom: {                                          // (a blast: its flash, its puffs by heat, then the map's theme.smoke)
    burst: ['#ff9a2e', '#e2571b', '#3b3631', '#ffd36b'], flash: '#ffffff', sparks: ['#fff3b0', '#ffd23f'],
    puff: { hot: '#ffe08a', warm: '#ffb347', cool: '#ff7f3f' },
  },
  pierce: { rind: '#4f6a24', flesh: '#f6f1cf' },   // (with the type's own rib and color)
  snap: ['#b9c24a', '#6b7524', '#c8383a', '#f3ecc4'],
  wilt: ['#9a9a3e', '#6b6a2c', '#a07a3a'],
  hole: ['#4b2c84', '#a46bff', '#0b0614'],
  swallow: ['#a46bff', '#0b0614', '#f4efe6'],
  collapse: { burst: ['#a46bff', '#f4efe6', '#4b2c84'], ring: '#a46bff' },
  seed: '#f6e7c1',                                 // (seeds in a splat or a pop)
  frost: { ice: '#ffffff', pale: '#dff4fc' },      // (gourds' own breaks, with their own colors: see BREAKS in effects.js)
  pie: { cream: '#fff6e0' },
  balloon: { string: '#6b6358' },
  vine: { leaf: '#76b046' },
  buzzsaw: { pale: '#eef3c8' },
  homing: { nozzle: '#3b3631' },
  blackhole: { dust: ['#a46bff', '#f4efe6', '#4b2c84'] },
  airstrike: { smoke: ['#e2481b', '#ff7f3f', '#ffb347'] },
  spit: { pale: '#ffffff' },                        // (a Seed Spitter's puff: its color, mixed this way)
  cannon: { smoke: ['#d8d4cc', '#b9b4aa', '#8f8a80'] },   // (and the blast's hot colors, boom.puff)
  block: ['#d9b25c', '#9c7a2e', '#3b3631'],
  freeze: ['#ffffff', '#dff4fc', '#9fd8f0'],
  warp: ['#4a1a5e', '#7a1f5c', '#d0479a', '#f29ad0'],   // (a Teleport: specks of deep purple, plum, magenta and pink)
  glueburst: { flash: '#f0ffd0', puff: { hot: '#d8ff7a', warm: '#9be000', cool: '#7cb800' }, drops: ['#9be000', '#5c9100'] },   // (a Sticky Bomb bursting: a cloud of slime puffs and flung drops)
  iceburst: { flash: '#ffffff', puff: { hot: '#ffffff', warm: '#e3f6fc', cool: '#bfe8f5' }, shards: ['#ffffff', '#bfe8f5', '#8fd3ea'] },   // (an Ice Bomb: a cold puff cloud, white to pale blue, and ice shards)
  straw: { straws: ['#e2b84a', '#c9982f', '#f3d77a'], twine: '#8a5a2b' },
  burn: {                                          // (small: a player burning; the rest: a hay bale burning up)
    small: ['#ff8a1f', '#ffd23f'],
    flames: ['#e2481b', '#ff9a2e', '#ffe08a'], embers: ['#ff8a1f', '#ffd23f', '#ff6a1f'], char: ['#3b2a1a', '#5b3a1e', '#2a201a'],
  },
  dust: ['#c9bfb2', '#9a8f80'],
  yank: ['#5fae3c', '#3c7a22'],
  hit: { spark: '#f08a1c', dark: '#3b3631' },
})

// Bales and players frozen or glued (statusLooks.js): frozen ones turn icy blue with frost spots, glue
// is Splat Pie filling.
export const STATUS = freeze({
  ice: '#6fc3ea',                       // (a frozen bale's straw takes this hue)
  iceWash: 'rgba(255, 255, 255, 0.35)', // (over it, paling it)
  frozen: '#bfe6f7',                    // (a frozen player's color, mixed most of the way to this)
  frost: '#ffffff',                     // (the spots)
  goo: '#f3dfb0', gooDark: '#e2c68e',   // (gooDark: the puddle's lower edge)
  goos: { pie: { goo: '#f3dfb0', dark: '#e2c68e' }, sticky: { goo: '#9be000', dark: '#5c9100', lip: '#e6ff9c' } },   // (lip: drawn two-tone, see fillGoo)   // (glue by whose it is: a Splat Pie's filling, a Sticky Bomb's slime)
})

// Level pieces (level.js).
export const LEVEL = freeze({
  bale: {
    straw: '#e2b84a', bands: '#c9982f', twine: '#8a5a2b', crack: '#6b4a1f',
    char: '#3a2418',   // (on fire: how dark it chars by the time it burns away)
    balloonString: '#6b6358',
  },
  pitchfork: { bar: '#6b4a2b', tine: '#a3a9ae' },
  ice: { top: '#dff3fa', edge: '#a9dcee', glint: '#ffffff' },   // (an Ice Bomb's icy floor: the sheet, its darker lower edge and icicles, glints)
  bonfire: { log: '#5b3a1e', glow: ['rgba(255, 160, 60, 0.10)', 'rgba(255, 160, 60, 0.12)', 'rgba(255, 160, 60, 0.14)'], flames: ['#e2481b', '#ff9a2e', '#ffe08a'] },   // (glow: outermost disc first; flames: outer, middle, core)
  cannon: {
    mount: '#6b4a2b', strap: '#3c3f44', barrel: '#2f3338', band: '#4a4f55', muzzle: '#f28c28',
    pin: '#4a4f55',   // (its fuse sparks like a Jack-o'-Boom's: GOURD.spark)
    ice: { snow: '#dff3fa', icicle: '#bfe8f5', plug: '#cdeefa', glint: '#ffffff' },   // (frozen: snow along the barrel, icicles under it, a plug of ice in the muzzle)
  },
})

// Stars circling a dazed player.
export const DIZZY = freeze({ star: '#f7c531' })

// The main menu's logo (ui/titleLogo.js): the splat behind the pumpkin that hit it, the puffs round it
// (by heat, like a blast's: see docs/style-guide.html) and its seeds.
export const TITLE = freeze({
  splat: '#c4630f',
  puff: FX.boom.puff,
  seed: FX.seed,
})

// The map editor's marks over the map (ui/editor), in the main palette: the selection pumpkin, handles
// paper with an ink edge, problems yellow (a warning) or red (an error).
export const EDITOR = freeze({
  warning: '#f7c531',
  error: '#e8384f',
  hover: 'rgba(242, 140, 40, 0.55)',
  select: UI.pumpkin,
  handle: UI.paper,
  handleEdge: UI.ink,
  cannonPath: { strong: 'rgba(242, 140, 40, 0.9)', faint: 'rgba(242, 140, 40, 0.45)' },
})
