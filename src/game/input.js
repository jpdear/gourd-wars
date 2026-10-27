// INPUT
// Every player is controlled by a plain input object. The local keyboard,
// the dummy, and (later) the network all produce this same shape.

export function emptyInput() {
  return { left: false, right: false, jump: false, throw: false, harvest: false, ragdoll: false, aimX: 0, aimY: 0 }
}

// A practice dummy just stands there, looking at the nearest real player.
export function dummyInput(game, dummy) {
  const me = dummy ? dummy.torso.getPosition() : null
  let target = null, best = Infinity
  for (const p of game.players) {
    if (p.isDummy || p === dummy) continue
    const q = p.torso.getPosition(), d = me ? Math.hypot(q.x - me.x, q.y - me.y) : 0
    if (d < best) { best = d; target = q }
  }
  return target ? { ...emptyInput(), aimX: target.x, aimY: target.y } : emptyInput()
}
