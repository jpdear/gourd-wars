// What the app's parts share, set up once by boot() (app.js): the game, the screen, the HTML
// pieces, and the message in the middle of the screen.
export const app = {
  canvas: null,
  ctx: null,
  game: null,      // the simulation (practice and the host; a guest only draws the host's snapshots)
  effects: null,   // particles (see render/effects.js)
  snap: null,      // the snapshot drawn this frame
  view: { s: 1, ox: 0, oy: 0, w: 0, h: 0 },   // where the arena sits on screen: s px per meter, offset (see resize)
  // what render() shows besides the game (see render/render.js)
  ui: { debug: false, fps: 60, localIndex: 0, hud: '', debugLines: [], game: null, message: '', damageNumbers: false, crosshair: false, harvestKey: 'E' },
  menu: null,      // ui/menu.js
  editor: null,    // ui/editor/editor.js
  tuning: null,    // ui/tuning.js
  flash: { text: '', until: 0 },   // see showMessage
}

export const now = () => performance.now() / 1000

// Show a message in the middle of the screen for a few seconds.
export const showMessage = (text, seconds = 3) => { app.flash = { text, until: now() + seconds } }
