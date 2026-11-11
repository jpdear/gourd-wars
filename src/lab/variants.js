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
//   ANIMS     other versions of a piece of the game's drawing that can be swapped (ANIM in render/anims.js,
//             or LOOKS in render/statusLooks.js with table: 'LOOKS'), by row: { title, piece (its name in
//             that table), table?, scene (what the lab shows it on: SCENES in lab.js), tries: a list of
//             { name, about, draw } }, where draw is exactly what that entry is (a function, or for
//             playerFrozen an object).
//   CANNON    what a gourd cannon does at its muzzle when it fires: { name, about, make(fx, ev) }, ev being
//             the game's `cannon` event ({ x, y, angle }: its muzzle, and the way it's aimed).
//   BALE      how a hay bale breaks, by the game's event for it ({ x, y }: its middle): { name, about, make(fx, ev) }.
// A row with no tries just shows the game's look.
//
// Every batch so far is picked and in the game (the rows with no tries show the game's look for the
// last ones). Nothing being tried right now.

export const VARIANTS = {}

export const FIRING = {}

export const ANIMS = {
  baleBody: { title: 'Hay bale: broken (healthy, damaged, nearly broken)', piece: 'baleBody', table: 'LOOKS', scene: 'baleDamage', tries: [] },
  baleFrozen: { title: 'Hay bale: frozen', piece: 'baleFrozen', table: 'LOOKS', scene: 'baleFrozen', tries: [] },
  playerFrozen: { title: 'Player: frozen', piece: 'playerFrozen', table: 'LOOKS', scene: 'playerFrozen', tries: [] },
  playerGlued: { title: 'Player: glued', piece: 'playerGlued', table: 'LOOKS', scene: 'playerGlued', tries: [] },
  baleGlued: { title: 'Hay bale: sticky', piece: 'baleGlued', table: 'LOOKS', scene: 'baleGlued', tries: [] },
}

export const CANNON = []


// By the game's event for how it broke: straw (damage, pitchforks, a Black Hole) and burn (a bonfire):
// both picked and in the game.
export const BALE = { straw: [], burn: [] }
