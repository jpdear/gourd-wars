// NETWORK
// The host runs the physics. The guest sends its input; the host sends back
// snapshots. A "link" wraps one connection (a PeerJS DataConnection, or
// anything with send() / on('data' | 'close' | 'error')).
//
// Messages:
//   both:  {t:'hello', version}   {t:'ping', time}   {t:'pong', time}
//          (hello is sent first; the host only lets a guest in once their hello shows the same
//          GAME_VERSION, and either side drops the connection on a mismatch)
//   guest: {t:'input', seq, i}
//   host:  {t:'snap', seq, time, players, pumpkins, events}   {t:'full'}
//          {t:'maps', maps: [custom map, ...]}   (the host's custom maps, so the guest can draw them)
//          {t:'welcome', slot}                    (which player you are: 1-3 = Red, Green, Yellow)
// The host has one HostLink per guest (up to 3).

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // no 0/O or 1/I look-alikes

export function makeCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

export function packInput(i) {
  return {
    l: i.left ? 1 : 0, r: i.right ? 1 : 0, j: i.jump ? 1 : 0, c: i.crouch ? 1 : 0, th: i.throw ? 1 : 0, h: i.harvest ? 1 : 0, rg: i.ragdoll ? 1 : 0,
    ax: Math.round(i.aimX * 100) / 100, ay: Math.round(i.aimY * 100) / 100,
  }
}

export function unpackInput(m) {
  return { left: !!m.l, right: !!m.r, jump: !!m.j, crouch: !!m.c, throw: !!m.th, harvest: !!m.h, ragdoll: !!m.rg, aimX: +m.ax || 0, aimY: +m.ay || 0 }
}

export function describePeerError(err) {
  switch (err.type) {
    case 'peer-unavailable': return 'No game found with that code. Check it and try again.'
    case 'browser-incompatible': return "This browser doesn't support peer-to-peer connections."
    case 'server-error': return 'The matchmaking server had a problem. Try again in a moment.'
    case 'webrtc': return "Couldn't make a direct connection (a strict network may be blocking it)."
    case 'network': case 'socket-error': case 'socket-closed': case 'disconnected':
      return "Couldn't reach the matchmaking server. Check your internet connection."
    default: return `Connection error (${err.type || err.message || err})`
  }
}

export const NET = {
  idPrefix: 'pumpkin-fight-',  // keeps our codes separate from other apps on the PeerJS server
  snapshotEvery: 2,            // host sends a snapshot every N physics steps (2 = 30 per second)
  interpDelay: 0.07,           // guest draws this many seconds behind the newest snapshot
  connectTimeout: 10000,       // ms
  silenceTimeout: 5,           // seconds without any message = connection lost
  helloTimeout: 4000,          // ms the host waits for a guest's hello before giving up on them
}
