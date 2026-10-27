# Gourd Wars

A 2–4 player, Stick Fight-style physics brawler: stick figures fighting with pumpkins that grow
out of the ground. Friends connect peer-to-peer. Desktop browsers only.

**Play:** https://jpdear.github.io/gourd-wars/

How the game works (rules, pumpkins, maps, menus) is in [docs/DESIGN.md](docs/DESIGN.md).

## Running it locally

Needs [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install      # once
npm run dev      # opens a local copy that reloads when you save a file
```

Two tabs of the dev server can play each other (host in one, join with the code in the other).
A dev copy can't join the live game (or the other way around): its version ends in `-dev`.

```bash
npm test         # the tests (also run before every deploy)
npm run build    # the site, as published, in dist/  (npm run preview serves it)
```

## Releasing

Push to `main`. GitHub runs the tests, builds the site and publishes it, usually within a minute
(see the repo's Actions tab). If the tests fail, nothing is published.

**Versions** look like `0.19.4`. You choose the first two numbers in `src/version.js`
(`VERSION`); the third counts commits since you last changed it, so every push gets a new
number on its own. Friends can only play together on the exact same version, so after a push,
anyone with the game open is asked to refresh. Change `VERSION` when you want to mark a
milestone (`0.20`, … and `1.0` for the first full release).

## The code

Plain JavaScript modules, built with [Vite](https://vite.dev). Physics:
[Planck.js](https://piqnt.com/planck.js/); networking: [PeerJS](https://peerjs.com).

```
index.html            the page: canvas, menu screens, editor shell
styles/               base, menus (and the logo), map editor, tuning panel
src/
  main.js             starts the app
  version.js          the version (see Releasing)
  config.js           CONFIG: the numbers that set how the game feels
  game/               the game itself: physics and rules. No DOM, so the tests can run it.
    game.js             create the world, step it, players coming and going, round resets
    player.js           the active ragdoll stick figure
    pumpkinTypes.js     every pumpkin's numbers + spawn rates
    pumpkins.js         throwing, hits, knockback        powers.js   what the specials do
    level.js            hay bales, pitchforks, scarecrows, bonfires, moving platforms
    patches.js, match.js, transition.js (the map pan), input.js, snapshot.js
  maps/               built-in maps and themes; custom maps (clean-up, checks, map codes)
  render/             draws a frame from a snapshot (the same on the host and guests)
  net/                connections (links.js) and the message format (protocol.js)
  ui/                 the HTML parts: menu, tuning panel, map editor
  app/                runs it all in the page:
    app.js              startup + the frame loop          session.js  practice / host / join
    settings.js         saved choices (pumpkins, maps…)   menus.js    what the buttons do
    customMaps.js       My Maps, editor, play tests       controls.js keyboard + mouse
  util/               math, colors, saved data (storage.js has every key the game saves)
tests/
  replay.test.js      plays a scripted 3-minute match with fixed randomness and checks it
                      plays out exactly as recorded (catches any change in how the game plays).
                      Local only: other CPUs/Node versions do math a hair differently, and the
                      physics turns that into a different match, so the deploy skips it.
  …                   versions, map codes, the network format
```

**When the replay test fails:** something changed how the game plays. If that was the point
(new tuning, a new pumpkin), re-record it with `npx vitest run -u`; if not, it caught a bug.
It can also fail after you update Node (different math, same game): re-record then too.
