// Map looks (built-in maps use these; custom maps pick one by name).
//   sky [top, bottom], ink (text), muted (soft text), platform, platformTop, wall, scenery,
//   smoke (what a blast's puffs cool to)

export const THEMES = {
  paper: { name: 'Paper', sky: ['#f4efe6', '#f4efe6'], ink: '#3b3631', muted: '#8a8073', platform: '#3b3631', platformTop: '#5a8f3c', wall: '#3b3631', scenery: 'hills', smoke: '#eef0ec' },
  barn: { name: 'Barn', sky: ['#e3c393', '#c99a63'], ink: '#3b2a1a', muted: '#7a5a3a', platform: '#7a4f2a', platformTop: '#a8743c', wall: '#5e3b1f', scenery: 'barn', smoke: '#eadcc4' },
  sunset: { name: 'Sunset', sky: ['#f39c5a', '#fde3a7'], ink: '#4a2e1a', muted: '#8a5a3a', platform: '#5c3d24', platformTop: '#c9a227', wall: '#5c3d24', scenery: 'sunset', smoke: '#efd6bd' },
  dusk: { name: 'Dusk', sky: ['#7d8aa3', '#c6cad1'], ink: '#262a33', muted: '#4f5868', platform: '#4a4f57', platformTop: '#7b8a5a', wall: '#4a4f57', scenery: 'rocks', smoke: '#e3d0dc' },
  night: { name: 'Night', sky: ['#121829', '#2b3350'], ink: '#ece5d8', muted: '#a3abc0', platform: '#3a2a1e', platformTop: '#4f6b3a', wall: '#3a2a1e', scenery: 'night', smoke: '#56627e' },
  plain: { name: 'Plain', sky: ['#f4efe6', '#f4efe6'], ink: '#3b3631', muted: '#8a8073', platform: '#3b3631', platformTop: '#5a8f3c', wall: '#3b3631', scenery: null, smoke: '#e3dbcf' },
}
