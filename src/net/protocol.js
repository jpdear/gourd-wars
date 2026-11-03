// NETWORK
// The host runs the physics. The guest sends its input; the host sends back
// snapshots. A "link" wraps one connection (a PeerJS DataConnection, or
// anything with send() / on('data' | 'close' | 'error')).
//
// Messages:
//   both:  {t:'hello', version}   {t:'ping', time}   {t:'pong', time}
//          (hello is sent first; the host only lets a guest in once their hello shows the same
//          GAME_VERSION, and either side drops the connection on a mismatch)
//   guest: {t:'input', seq, i}             (i: packInput)
//   host:  {t:'snap', seq, events, ...}    (...: the snapshot, packed by packSnapshot)   {t:'full'}
//          {t:'maps', maps: [custom map, ...]}   (the host's custom maps, so the guest can draw them)
//          {t:'welcome', slot}                    (which player you are: 1-3 = Red, Green, Yellow)
// The host has one HostLink per guest (up to 3).

import { PATCH_STATES } from '../game/patches.js'
import { PUMPKIN_TYPE_NAMES } from '../game/pumpkinTypes.js'
import { WEAPON_TYPE_NAMES } from '../game/weaponTypes.js'

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

// Snapshots (see game/snapshot.js) go 30 times a second, so their lists of things go as arrays
// instead of objects: each item's fields in a fixed order, without their names. (Everything else
// in a snapshot goes as it is.) Each list: how to pack an item and unpack it again.
const fields = (...names) => ({ pack: o => names.map(k => o[k]), unpack: a => Object.fromEntries(names.map((k, i) => [k, a[i]])) })
const SNAPSHOT_LISTS = {
  pumpkins: fields('id', 'x', 'y', 'angle', 'typeName', 'ripeness', 'owner', 'radius', 'heading'),
  bales: {   // (its effects as bit flags: 1 frozen, 2 sticky, 4 floating)
    pack: b => [b.id, b.x, b.y, b.angle, b.health, (b.frozen ? 1 : 0) | (b.sticky ? 2 : 0) | (b.floating ? 4 : 0)],
    unpack: ([id, x, y, angle, health, flags]) => ({ id, x, y, angle, health, frozen: !!(flags & 1), sticky: !!(flags & 2), floating: !!(flags & 4) }),
  },
  holes: fields('id', 'x', 'y', 'r'),
  crows: {   // (down as 0/1; what it carries by number, -1: nothing)
    pack: c => [c.id, c.x, c.y, c.angle, c.down ? 1 : 0, c.carry ? WEAPON_TYPE_NAMES.indexOf(c.carry) : -1, c.dir],
    unpack: ([id, x, y, angle, down, carry, dir]) => ({ id, x, y, angle, down: !!down, carry: WEAPON_TYPE_NAMES[carry] ?? null, dir }),
  },
  weapons: {   // (its type by number)
    pack: w => [w.id, WEAPON_TYPE_NAMES.indexOf(w.typeName), w.x, w.y, w.angle],
    unpack: ([id, type, x, y, angle]) => ({ id, typeName: WEAPON_TYPE_NAMES[type], x, y, angle }),
  },
  strikes: fields('id', 'x', 'y', 't', 'r'),
  movers: fields('x', 'y'),
  patches: {   // (its state and pumpkin type by number)
    pack: p => [PATCH_STATES.indexOf(p.state), p.growth, p.rot, PUMPKIN_TYPE_NAMES.indexOf(p.typeName), p.superRare ? 1 : 0],
    unpack: ([state, growth, rot, type, superRare]) => ({ state: PATCH_STATES[state], growth, rot, typeName: PUMPKIN_TYPE_NAMES[type], superRare: !!superRare }),
  },
}
const convertLists = (snap, how) =>
  Object.fromEntries(Object.entries(SNAPSHOT_LISTS).map(([name, list]) => [name, snap[name].map(list[how])]))

export const packSnapshot = snap => ({ ...snap, ...convertLists(snap, 'pack') })
export const unpackSnapshot = packed => ({ ...packed, ...convertLists(packed, 'unpack') })

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
