// Map looks (built-in maps use these; custom maps pick one by its key, so the keys never change).
// The colorways are the ones picked in docs/restyle/mockups/style-guide.html (see docs/RESTYLE_PLAN.md 4.5).
//   name         what the map editor's theme list calls it
//   scenery      the backdrop drawn behind the map: a key into SCENERY (render/scenery.js)
//   sky          the sky, one flat color; or
//   bands        flat bands from the top of the view down (cut at 0, 20%, 42%, 66% and 100% of its height)
//   ink, muted   text and marks over the map (the editor's grid, mover rails, debug text): strong, soft
//   platform     a platform's body; wall: a wall's
//   platformTop  the strip along a platform's top; top: how that strip is drawn (a key into TOPS: grass,
//                wheat, planks, snow, lava, metal, soil)
//   shade        the tint of everything's two-tone shadow side (see render/shading.js)
//   shadow       the contact shadow under players (an rgba)
//   smoke        what a blast's puffs cool to (see render/effects.js)
//   art          the scenery's own colors (what each SCENERY drawing uses, and its moving parts and weather:
//                ANIMATED and WEATHER in render/scenery.js)

export const THEMES = {
  paper: {
    name: 'Midday', scenery: 'hills', sky: '#cfe8f3', ink: '#2e2620', muted: '#6c7d8a',
    platform: '#5e4636', wall: '#5e4636', platformTop: '#4fa23a', top: 'grass',
    shade: '#b7cdd8', shadow: 'rgba(40, 60, 70, 0.16)', smoke: '#eef0ec',
    art: { sun: '#fff1a8', cloud: '#ffffff', hills: ['#bfe0a3', '#97cc78'] },   // (hills: far, near)
  },
  barn: {
    name: 'Barn', scenery: 'barn', sky: '#e2c79d', ink: '#3b2a1a', muted: '#7a5a3a',
    platform: '#6b4423', wall: '#5e3b1f', platformTop: '#a8743c', top: 'planks',
    shade: '#d9bf9a', shadow: 'rgba(90, 56, 28, 0.22)', smoke: '#eadcc4',
    art: { plank: '#d8ba8c', beam: '#7a4f2a', light: '#fff1c9', hay: '#e9c25a', seam: '#5a381c' },   // (light: the window; seam: the platforms' plank lines)
  },
  sunset: {
    name: 'Sunset', scenery: 'field', bands: ['#f0a07a', '#f5b486', '#f8c796', '#fbdcae'], ink: '#4a2e1a', muted: '#8a5a3a',
    platform: '#5c3d24', wall: '#5c3d24', platformTop: '#c9a227', top: 'wheat',
    shade: '#e3b48f', shadow: 'rgba(92, 61, 36, 0.2)', smoke: '#efd6bd',
    art: { sun: '#fff2c8', hills: ['#c98f5a', '#a8693f'], scarecrow: '#7a4a2c', wheat: '#e0bb45', stem: '#b8942c' },   // (a scarecrow far off in the field)
  },
  dusk: {
    name: 'Dusk', scenery: 'rocks', sky: '#e2c6da', ink: '#262a33', muted: '#6b5f80',
    platform: '#352b4a', wall: '#352b4a', platformTop: '#5b8a63', top: 'grass',
    shade: '#c4aacb', shadow: 'rgba(40, 30, 70, 0.2)', smoke: '#e3d0dc',
    art: { sun: '#ffe0ae', hills: ['#b49ac8', '#8c77b0', '#6c5e98'] },   // (hills: far peaks, near rocks, boulders)
  },
  night: {
    name: 'Night', scenery: 'camp', sky: '#202b46', ink: '#f6efe3', muted: '#a3abc0',
    platform: '#15151f', wall: '#15151f', platformTop: '#3c6a4c', top: 'grass',
    shade: '#8a93b3', shadow: 'rgba(0, 0, 0, 0.32)', smoke: '#56627e',
    art: { moon: '#f2ead2', hills: ['#2f3f63', '#26344f'], pine: '#101a2e' },   // (moon: the stars too)
  },
  plain: {
    name: 'Plain', scenery: 'grid', sky: '#f4efe6', ink: '#3b3631', muted: '#8a8073',
    platform: '#3b3631', wall: '#3b3631', platformTop: '#5a8f3c', top: 'grass',
    shade: '#e0d4c2', shadow: 'rgba(59, 54, 49, 0.16)', smoke: '#e3dbcf',
    art: { grid: '#e6dccb' },
  },
  // (themes with no built-in map yet: for custom maps)
  winter: {
    name: 'Winter', scenery: 'winter', sky: '#cbb7d6', ink: '#2e2620', muted: '#6c6684',
    platform: '#4f4a66', wall: '#4f4a66', platformTop: '#fdfbfd', top: 'snow',
    shade: '#c9b6d6', shadow: 'rgba(60, 50, 90, 0.2)', smoke: '#efe6f2',
    art: { sun: '#ffe6c4', hills: ['#e6d9ec', '#f4eef6', '#fdfbfd'], pine: '#3b4f6b', snow: '#fdfbfd', flakes: '#ffffff' },   // (hills: far mountains, the middle hill, the near one)
  },
  lava: {
    name: 'Lava', scenery: 'lava', bands: ['#262028', '#352a30', '#4a3236', '#6b3e34'], ink: '#f6efe3', muted: '#c09a8a',
    platform: '#2e2019', wall: '#2e2019', platformTop: '#5a4034', top: 'lava',
    shade: '#a07068', shadow: 'rgba(0, 0, 0, 0.35)', smoke: '#5a3a32',
    art: { hills: ['#7a4f45', '#2a1715', '#1f1110'], lit: ['#8f5f50', '#3d221c', '#3a1d16'], lava: '#ff6a1a', hot: '#ffd23f', ember: '#ffb347', ash: '#4a2c26', glow: '#ff7a1a', crack: '#0d0806', molten: '#3a1612', vein: ['#ff6a1a', '#ff8a1f', '#ffd23f'] },   // (hills: the far range, the ridge, the volcano; lit: their lit faces; glow: the smoke as it leaves the crater; hot, ember, lava: the lava from hottest to coolest (ember: the embers too); crack: the cracks in floating platforms; molten: the floor's rock; vein: its glowing cracks: halo, crack, core)
  },
  synthwave: {
    name: 'Synthwave', scenery: 'synth', bands: ['#1a0f3a', '#35185e', '#5e1f78', '#a12f7d'], ink: '#f6efe3', muted: '#b9a3e0',
    platform: '#3a2a78', wall: '#3a2a78', platformTop: '#2ef2ff', top: 'metal',
    shade: '#a58ad0', shadow: 'rgba(0, 0, 0, 0.35)', smoke: '#6a4f8f',
    art: { star: '#f6d6ff', sun: '#ffd23f', sunStripes: '#ff5f8f', hills: ['#2a1250', '#3c1a6b'], floor: '#150a2e', grid: '#ff3fa4', seam: '#241a52', frame: '#1d1238' },   // (seam: the dark band under the platforms' glowing strip; frame: the dark edge round their sides and bottom)
  },
  graveyard: {
    name: 'Graveyard', scenery: 'graveyard', sky: '#3a2f4f', ink: '#f6efe3', muted: '#9a8fb3',
    platform: '#241c2e', wall: '#241c2e', platformTop: '#4f6b3a', top: 'soil',
    shade: '#9a8fb3', shadow: 'rgba(0, 0, 0, 0.3)', smoke: '#6a5f84',
    art: { moon: '#f2ead2', hills: ['#4b3d63', '#43375a'], tree: '#1f1830', stone: '#6c6184', fence: '#1c1528', cloud: ['#271e3a', '#5a4d77'] },   // (cloud: dark, its moonlit rim)
  },
}

// One color for a theme's whole sky (its flat sky, or its top band): for things that need just one,
// like whether the HUD should be light or dark on it.
export const skyColor = theme => theme.sky || theme.bands[0]
