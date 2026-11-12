# Handoff: Gourd Wars (weapon abilities → gourds as of 2026-11-09; restyle done 2026-11-12)

Read this first, then `docs/DESIGN.md` (the full design: the **Pumpkins** table, **Crows**, and the build order, step 9) and `README.md` (file map).

## The project
- **Gourd Wars**: a browser, peer-to-peer brawler in the style of Stick Fight. The players are ragdoll stick figures who throw pumpkins.
- **Stack:** Planck.js (physics), PeerJS (networking), Vite, vitest.
- **Repo:** `/Users/jdearing/Documents/Personal/p2p_game`, branch **`remove-melee-weapons`**.
- **Commands:**
  - `npx vitest run` runs the tests.
  - `npm run build` builds the game.
  - `npx vitest run -u` re-records `tests/__snapshots__/replay.json`. Only do this after confirming gameplay you didn't mean to change is unchanged.
- **Git:** **The user commits themselves.** Never commit or push, because pushing to main deploys.

## How the user wants to work (follow these)
- **One gourd at a time:** build one fully (behavior, art, sights, tuning, tests), hand it over to try, then stop. Start the next one only when the user says so.
- **Ask first:** ask that gourd's open design questions before building it.
- **Code style:** follow *A Philosophy of Software Design*: deep modules, narrow interfaces, information hiding. Dispatch on a name with **handler maps, not if/else chains**.
- **Comments:** each file keeps a plain-English header comment describing its behavior. Keep those, the `pumpkinTypes.js` field docs and `docs/DESIGN.md` up to date.
- **Checking changes:** check each change in the browser (Vite dev server plus Chrome tools; the practice map can be switched to Testing Grounds). Add tests. To prove gameplay didn't change, temporarily hide new types and run the replay test, then re-record.
- **Replies:** the user has ADHD. Answer first, keep it short, use bullets and checklists, bold the key info, and end with one clear next step.

## Melee weapons: removed (2026-11-09)
- The user decided the melee weapons (Pitchfork, Scythe, Shovel, Rake, Sickles) didn't fit the game's vibe.
- **Archive:** a full copy of the game with them in is at `/Users/jdearing/Documents/Personal/p2p_game_melee_archive/` (see its `ARCHIVE_README.md`, and its `docs/HANDOFF.md` for how they worked). They're also in git history (branch `melee-weapons`).
- **Crows** stayed for a while, carrying nothing, then were **removed too (2026-11-12)**, along with their Crows match setting.

## Build order (step 9)
- [x] 9.1 **Buzzsaw** (Pierce; built 2026-11-09, the user hasn't tried it yet): pattypan saw, flat & fast (⅓ gravity, 18–30 m/s), 15 dmg to each person it goes through, cuts through bales, knocks crows down, breaks on anything else. Code: `pierces` + `spin` fields, `PIERCES` / `piercesThrough` in pumpkins.js (also used by game.js pre-solve), `drawSawSquash` in render/pumpkins.js, sight skips bales, a `pierce` event per cut (chip spray in render/effects.js). Tests: `tests/buzzsaw.test.js`.
- [x] 9.2 **Dizzy Gourd** (Daze; built 2026-11-09, the user hasn't tried it yet): tan bottle gourd, 10 dmg, limp 0.6 s then dizzy 1.5 s (left/right swapped, swaying), head hits ×2, breaks on the hit. Code: `daze` type (`daze: { limp, dizzy, head }`), `Player.daze(limp, dizzy)` / `dazed` / `dizzy`, `CONFIG.player.dizzy` (sway), `drawBottleGourd`. Tests: `tests/daze.test.js`.
- [x] 9.3 **Chomper** (Bear Trap; built 2026-11-09 as a Flytrap, then restyled at the user's request to look more like a gourd: a warty yellow-green gourd split lengthwise, carved teeth along the cut; planted, its two halves fall out flat on the ground, red mouths and teeth up. The user rejected a clam-hinge version: they want it lying open flat): plants on floors (platforms, movers, bales: rides along), opens in 0.4 s; anyone touching it (thrower too) is bitten (10 dmg) and stuck 2 s (can still aim/throw/punch); a direct hit only does the bite damage (no hold: the user wants only stepping in one to restrict movement); shrivels after 15 s unused. Code: `src/game/traps.js` (`game.traps`, `plantTrap`, `biteWith`, `updateTraps`), `Player.trap()` / `trapped` / `stuck` (shared with the Splat Pie's glue), snapshot/protocol `traps`, `drawChomper` / `chomperShape`, 'snap' + 'wilt' effects. Tests: `tests/chomper.test.js`.
- [x] 9.4 **Landmine** (built 2026-11-09, the user hasn't tried it yet): squat dark gourd, sinks halfway into the floor (0.6 s), stem light blinks red once set; stepped on (anyone, instantly): a 1.8 m blast from 0.5 m up (up to 25 dmg) plus an 8 m/s launch for the stepper; thrown pumpkins (flying into it or breaking right by it) and any blast set it off (chain reactions); a direct hit is a small pop (8 dmg); fizzles after 20 s. Code: `traps.js` is now all planted gourds, by kind (`KINDS` map: `touched`, `explosive`; `detonate`, `blastTraps` called from `explode`, `pumpkinBroke` called from `breakPumpkin`); `drawTrap` dispatches on `TRAP_LOOKS`; snapshot/protocol traps carry `kind`. Tests: `tests/landmine.test.js`.

## New gourds after the restyle
- [x] **Bouncing Bomb** (built 2026-11-12, the user hasn't tried it yet; picked from mockups: design A Rubber Ball, flash A2 + A4): see DESIGN.md's Pumpkins table. Code: `bouncebomb` type (`fuse`, `chainDelay`, `blast`, `goOff`), `fuseLeft` / `rebound` / `fusePickups` in pumpkins.js (fused gourds only break when they go off; pickups.js gained an `above` field so they can be caught mid-air), `Player.holdPumpkin(..., fuseLeft)` / `heldGoesOff`, chain reactions in `explode`, snapshot `fuse` (pumpkins) and `heldFuse` (players), protocol lists drop trailing empty fields, `rubberball` body + mark and `fusedLook` (the flash + swell) in render/pumpkins.js, tuning group. Tests: `tests/bouncebomb.test.js`. Replay re-recorded (proved unchanged with the type hidden first).
- [x] **Ice Bomb** (built 2026-11-12, the user hasn't tried it yet; look: E Frost Fuse's shape and snowflake fuse in A's teal with A's snow cap): see DESIGN.md. Code: `icebomb` type (`chill`), `freezeBlast` in powers.js, `freezePatch` / patch `frozenTimer` (paused, can't harvest) in patches.js, icy floor `game.ice` / `iceOver` / `onIce` / `updateIce` in level.js, `Player.onIce` + `CONFIG.player.iceGrip` (walking and sliding), snapshot `ice` and patch `frozen` (only when present, so old replays hash the same), `icefuse` body + mark, the frozen patch's ice block, `drawIce` (render/level.js), the cold `iceburst` cloud (clouds take a color `look`), tuning group. Tests: `tests/icebomb.test.js`. Replay re-recorded (proved unchanged with the type hidden first). Follow-ups (user feedback): ice slipperier (`iceGrip` 0.05; the whole body is slick on ice: `GRIPS` in player.js, `iceFriction`), and gourd cannons freeze (Frost on mount or barrel, or an Ice Bomb in reach: 5 s, countdown paused; `freezeCannon` / `cannonTouching` / `cannonOfBody` / `cannonDistance` in cannons.js, snapshot `frozenCannons`, `thaw` event, `drawFrozenBarrel`; look = mockup C without the mount's snow). Tests in `tests/cannons.test.js`.


## Restyle: done (2026-11-10 → 2026-11-12)
The whole game moved to one **flat vector** look: solid flat shapes, one hard shadow side, no outlines, gradients or shine. The plan, with every value and each step's notes, is `docs/RESTYLE_PLAN.md`; the style guide is `docs/restyle/mockups/style-guide.html`; the short version is `docs/DESIGN.md` → **Look**.
- **Palette and fonts:** Pumpkin & Bark (CSS: `styles/tokens.css`; canvas: `src/render/palette.js`); Luckiest Guy for display, Fredoka for text (loaded in `index.html`).
- **Menus and HUD:** `styles/menu.css`, `src/render/hud.js` (chips ink on light maps, paper on dark ones, fading during a pan: `hudSurface`); the animated title logo: `src/ui/titleLogo.js`, `titleArt.js`.
- **Two-tone shading:** `src/render/shading.js` (`drawShaded`; a Shading toggle in the tuning panel). Used by players, gourds, level pieces and the scenery, tinted by each map's `shade`.
- **Players and gourds:** `src/render/players.js`, `pumpkins.js`; gourd parts that move on their own: `anims.js`; frozen, glued and damaged looks: `statusLooks.js`.
- **Effects:** `src/render/effects.js` (flat particles in shapes; blast clouds of puffs; each gourd's own break in `BREAKS`).
- **Maps:** `src/maps/themes.js` (10 themes: the 6 built-in maps' plus Winter, Lava, Synthwave, Graveyard for custom maps) and `src/render/scenery.js` (backdrops cached per theme, moving parts like Lava's crater and flow, Synthwave's grid, weather, platform tops).
- **Map editor and tuning panel:** `styles/editor.css`, `styles/tuning.css`, and the editor's overlay in `src/ui/editor/editor.js`.
- **The effects lab** (`lab.html`, `src/lab/`): side-by-side tries for anything visual; every pick so far is built in.
- **Gameplay changes made along the way (each with the replay re-recorded):** the scarecrow's scythe removed (it's a small backdrop scarecrow now), pitchfork tines centered, Hay Loft's walls reach the floor, a `spit` event per Seed Spitter shot, swallowed bales fire `straw`, crows removed.
- **Performance:** 60 fps in a busy scene (4 players, 10 gourds, a blast, snow). `render()` itself takes about 5.6 ms of CPU with shading on, 0.2 ms with it off (Retina, 2940×1684).

## Open questions in the design doc (not urgent)
- Should a fully charged Classic hit be able to knock someone off from the middle of a platform?
- Game name.
