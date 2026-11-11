// EFFECTS LAB: THE TRIES (dev only: see lab.html)
// Ideas to compare in the effects lab before one goes into the game, built from emit() and ring()
// (render/effects.js), so a pick moves into the game as it is. The lab also shows "Now": what the game
// does today.
//   VARIANTS  how each gourd could break, by pumpkin type name: a list of { name, about, make(fx, ev,
//             colors) }: make adds the break's particles (and rings) to an effects set; ev is the break
//             ({ x, y }); colors the gourd's { color, rib } right now. (Picks go to BREAKS in effects.js.)
//   FIRING    what a gourd that fires things does at its muzzle each shot, by type name: the same, but
//             ev is the shot ({ x, y, dx, dy }: where it leaves the gourd, and which way it's going).
//             (Picks go to the game's own event for it in effects.js, e.g. `spit`.)
//   ANIMS     other versions of the bits that move on their own (ANIM in render/anims.js), by row: { title,
//             piece (ANIM's name for it), scene (what the lab shows it on: SCENES in lab.js), tries: a list
//             of { name, about, draw } }, where draw takes exactly what that ANIM entry takes.
// A row with no tries just shows the game's look.
//
// Batches 1–3 are done: their picks are in the game (Gourd Cluster, Dizzy, Bouncy and Boomerang kept
// the usual chunks and seeds), and so is the animations batch.

export const VARIANTS = {}

export const FIRING = {}

// The animations batch is picked: its rows show the game's look now (lock-on, patch glows and the mine
// light kept theirs).
export const ANIMS = {
  antenna: { title: 'Homing: the antenna light', piece: 'antennaTip', scene: 'homing', tries: [] },
  flame: { title: 'Homing: the flame trail', piece: 'flameTrail', scene: 'homing', tries: [] },
  hole: { title: 'Black Hole: the specks streaking in', piece: 'holeSpecks', scene: 'hole', tries: [] },
  spin: { title: 'Spin blur (Boomerang, Buzzsaw)', piece: 'spinBlur', scene: 'spin', tries: [] },
}
