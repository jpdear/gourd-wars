// Links: one per connection (see the messages in protocol.js).

import { MAX_PLAYERS } from '../config.js'
import { emptyInput } from '../game/input.js'
import { interpolateSnapshots, makeSnapshot } from '../game/snapshot.js'
import { NET, packInput, unpackInput } from './protocol.js'
import { GAME_VERSION } from '../version.js'

class Link {
  constructor(conn, handlers, time) {
    this.conn = conn
    this.handlers = handlers
    this.time = time
    this.lastHeard = time
    this.lastPing = -Infinity
    this.ping = null           // round-trip time in seconds
    this.closed = false
    conn.on('data', msg => {
      if (this.closed || !msg || typeof msg !== 'object') return
      this.lastHeard = this.time
      if (msg.t === 'hello') {
        this.handlers.onHello?.(msg.version)
      } else if (msg.t === 'ping') {
        this.send({ t: 'pong', time: msg.time })
      } else if (msg.t === 'pong') {
        this.ping = this.time - msg.time
      } else {
        this.onMessage(msg)
      }
    })
    conn.on('close', () => this.close())
    conn.on('error', err => console.warn('connection error', err))
    this.send({ t: 'hello', version: GAME_VERSION })
  }

  send(msg) {
    if (this.closed) return
    try { this.conn.send(msg) } catch (e) { console.warn('send failed', e) }
  }

  // Call every frame with the current time in seconds: sends pings and notices dead connections.
  tick(time) {
    this.time = time
    if (time - this.lastPing >= 1) {
      this.lastPing = time
      this.send({ t: 'ping', time })
    }
    if (time - this.lastHeard > NET.silenceTimeout) this.close()
  }

  close() {
    if (this.closed) return
    this.closed = true
    try { this.conn.close() } catch (e) {}
    this.handlers.onClose?.()
  }
}

// Host side: collects the guest's input and sends snapshots.
export class HostLink extends Link {
  constructor(conn, handlers, time) {
    super(conn, handlers, time)
    this.input = emptyInput()
    this.taps = {}             // presses seen since the last physics step, so quick taps aren't lost
    this.inputSeq = -1
    this.snapSeq = 0
    this.pendingEvents = []
  }

  onMessage(msg) {
    if (msg.t !== 'input' || msg.seq <= this.inputSeq) return   // ignore old/out-of-order input
    this.inputSeq = msg.seq
    this.input = unpackInput(msg.i)
    for (const k of ['jump', 'throw', 'ragdoll']) if (this.input[k]) this.taps[k] = true
  }

  // The guest's input for this physics step.
  takeInput() {
    const input = { ...this.input, ...this.taps }
    this.taps = {}
    return input
  }

  sendSnapshot(game, snap = makeSnapshot(game)) {   // (the host makes one snapshot for everyone)
    this.send({ t: 'snap', seq: ++this.snapSeq, ...snap, events: this.pendingEvents })
    this.pendingEvents = []
  }
}

// Guest side: sends input, buffers snapshots, and picks what to draw.
export class GuestLink extends Link {
  constructor(conn, handlers, time) {
    super(conn, handlers, time)
    this.snaps = []            // received snapshots, oldest first
    this.snapSeq = 0
    this.inputSeq = 0
    this.clock = null          // our estimate of the host's game time
    this.events = []           // [{time, ev}] waiting until we draw that moment
  }

  onMessage(msg) {
    if (msg.t === 'full') { this.handlers.onFull?.(); return }
    if (msg.t === 'maps') { this.handlers.onMaps?.(msg.maps); return }
    if (msg.t === 'welcome') { if (msg.slot >= 1 && msg.slot < MAX_PLAYERS) this.handlers.onWelcome?.(msg.slot); return }
    if (msg.t !== 'snap' || msg.seq <= this.snapSeq) return
    this.snapSeq = msg.seq
    this.snaps.push(msg)
    for (const ev of msg.events || []) this.events.push({ time: msg.time, ev })
    // keep our clock close to the host's
    if (this.clock === null || Math.abs(msg.time - this.clock) > 0.25) this.clock = msg.time
    else this.clock += (msg.time - this.clock) * 0.1
  }

  sendInput(input) {
    this.send({ t: 'input', seq: ++this.inputSeq, i: packInput(input) })
  }

  // Advance by dt seconds. Returns the snapshot to draw (or null) and any events that are now due.
  advance(dt) {
    if (this.clock === null) return { snap: null, events: [] }
    this.clock += dt
    const renderTime = this.clock - NET.interpDelay
    while (this.snaps.length >= 2 && this.snaps[1].time <= renderTime) this.snaps.shift()
    const [a, b] = this.snaps
    let snap = a
    if (b && renderTime > a.time) snap = interpolateSnapshots(a, b, Math.min(1, (renderTime - a.time) / (b.time - a.time)))
    const due = this.events.filter(e => e.time <= renderTime).map(e => e.ev)
    this.events = this.events.filter(e => e.time > renderTime)
    return { snap, events: due }
  }
}
