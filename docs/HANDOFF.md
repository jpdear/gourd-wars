# Handoff: Gourd Wars melee weapons (as of 2026-11-06)

Read this first, then `docs/DESIGN.md` (the full design: the **Weapons** section, the weapon table and the build order in "Build steps", step 8) and `README.md` (file map).

## The project
- **Gourd Wars**: a browser, peer-to-peer brawler in the style of Stick Fight. The players are ragdoll stick figures who throw pumpkins.
- **Stack:** Planck.js (physics), PeerJS (networking), Vite, vitest.
- **Repo:** `/Users/jdearing/Documents/Personal/p2p_game`, branch **`melee-weapons`**.
- **Commands:**
  - `npx vitest run` runs the tests (76 passing).
  - `npm run build` builds the game.
  - `npx vitest run -u` re-records `tests/__snapshots__/replay.json`. Only do this after confirming gameplay you didn't mean to change is unchanged.
- **Git:** **The user commits themselves.** Never commit or push, because pushing to main deploys. The work below is **uncommitted**.

## How the user wants to work (follow these)
- **One weapon at a time:** build one weapon fully (hold, tap, charged move, throw, art), hand it over to try, then stop. Start the next one only when the user says so.
- **Ask first:** ask that weapon's open design questions before building it.
- **Code style:** follow *A Philosophy of Software Design*: deep modules, narrow interfaces, information hiding. Dispatch on a name with **handler maps, not if/else chains** (e.g. `MOTIONS`, `KNOCK`, `TOUCH`, `FLIGHT`, `HIT`, `THROW_POSES`, `LOOKS`).
- **Comments:** each file keeps a plain-English header comment describing its behavior. Keep those, the weaponTypes field docs and `docs/DESIGN.md` up to date.
- **Checking changes:**
  - Check each change in the browser (Vite dev server plus Chrome tools; the practice map can be switched to Testing Grounds).
  - Add tests per weapon in `tests/<weapon>.test.js`.
  - To prove gameplay didn't change, temporarily hide new types/fields and run the replay test, then re-record.
- **Replies:** the user has ADHD. Answer first, keep it short, use bullets and checklists, bold the key info, and end with one clear next step.

## Build order (step 8 = weapons)
- [x] 8.1 Pitchfork end to end
- [x] 8.2 crows dropping weapons, plus the Weapons settings screen
- [x] 8.3 charged specials (hold to charge), the Throw Weapon key (F), thrown weapons
- [ ] 8.4 Scythe ✅, Shovel ✅ (in feedback), **Rake**, **Sickle**, one at a time
- [ ] 8.5 parries: two swings that meet clang (both stop, both are pushed back, both lose a use)
- [ ] 8.6 tuning panel tab, tests, version bump

## What exists (key files)
- **`src/game/weaponTypes.js`**: every weapon's numbers and shape. The top comment documents every field.
  - Shape helpers: `headOf`, `toWorld`, `pointOf`, `fallAngle`, `addWeaponFixtures`.
  - Lopsided heads (like the Scythe's blade) are mirrored by `side`.
- **`src/game/weapons.js`**: `HeldWeapon`, a weapon in someone's hands.
  - **Driving it:** a **MotorJoint** pulls the weapon from a kinematic anchor body that follows the torso, so the weapon never tugs its holder around. `perStep(snap, dt)` keeps the snap consistent in slow motion.
    - In a swing, the angle target is fed forward by `want.turn` so the swing doesn't lag behind.
    - Swings use the continuous angle, so they can wind more than half a turn.
    - It **slips** (passes through everything but players) if its grip gets out of arm's reach (`SNAG`).
  - **Swing motions** are in the `MOTIONS` map (`thrust`, `snap`, `reap`, `whirl`); each returns `{angle, extend, live}`.
  - **What hits:** only the `live` part of a swing hits. The rest bumps (clanks into the level, ignoring what it was already resting on at swing start) and passes through people.
    - **Ghost** moves (the Whirl) pass through the level.
    - A held weapon that isn't swinging passes through gourds.
  - **Strikes:**
    - A strike = a sweep along the blade's edge points (shields, then pumpkins, then patches), then physics contacts (the `TOUCH` map).
    - Knock direction comes from the `KNOCK` map: `along`, `aim`, `toward`, `away`.
    - `fullLaunch` always launches at full knockback.
  - **Batting (Shovel):**
    - Any part of the tool bats, using `batPoints` (points along the shaft plus the blade's edge).
    - A batted gourd goes along your aim and becomes yours (`batPumpkin`).
    - Grace: `bats.reach` adds extra radius, and `bats.grace` keeps batting for that many seconds after the swing passes (`this.late`, `batLate`).
  - **Wear:** a swing that touches anything costs its uses once (`wear(game, player, p, swing)`); hitting 0 uses snaps it.
  - **Guard:** charging a move with a `guard` (Home Run) holds the weapon up as a shield (`shield()`, used by `Player.shield()`).
  - **Throwing:** throw poses are in `THROW_POSES`. A `point` weapon draws back like a javelin; a `spinning` one goes back over the shoulder.
  - **Pressing attack:** a press starts charging; letting go before full charge = the tap, at full charge = the special. Holding never fires the tap.
- **`src/game/looseWeapons.js`**: dropped and thrown weapons.
  - The `FLIGHT` map has `point` (sticks where its head hits) and `spinning` (bounces off floors and ceilings, sticks only in walls or once slower than 5 m/s).
  - `HIT` handlers decide what a thrown weapon does to what it hits; `through` (passes through people and bales), `rebound` and `daze` are per-weapon options.
  - Weapons settle at rest.
- **`src/game/crows.js`**: crows carry weapons in and drop them.
- **`src/game/pumpkins.js`**: `batPumpkin`, `cutPumpkin`.
- **`src/game/player.js`**: `daze()` / `dazed` (stars), `shield()`, `tryBlock`.
- **`src/game/cannons.js`** (new): the **gourd cannon** map piece.
  - It mounts on a floor, wall or ceiling, never floating, and is solid and unbreakable.
  - It fires an ownerless Classic gourd every `every` s after `delay`. It doesn't fire during map transitions.
  - Map definition: `{x, y, face, aim (deg, clamped ±80° from straight out), speed, every, delay}`.
  - Testing Grounds has 2 cannons aimed at the left ground, for practicing batting.
- **Editor** (`src/ui/editor/tools.js`, `src/ui/editor/editor.js`):
  - The cannon tool is key **C**: click next to a surface to mount it, then drag its handle to aim (distance sets speed).
  - A dotted line shows the path; the panel has fields for aim, speed, every and delay.
  - The map checks warn about an unmounted cannon.
- **Map data:** `src/maps/mapData.js` sanitizes cannons and allows at most 8.
- **Rendering:**
  - `src/render/weapons.js`: the `LOOKS` map, one art function per weapon.
  - `src/render/level.js`: `drawCannon`.
  - `src/render/effects.js`: the 'cannon' effect.
- **Networking:** the snapshot (`src/game/snapshot.js`) carries the held weapon `[type, x, y, angle, throwCharge, side]`, the loose weapon's `side`, the player's `dazed`, and `cannons` timers. `src/net/protocol.js` packs `side`.
- **Tuning panel:** `src/ui/tuning.js` has a Weapons tab with Pitchfork, Scythe and Shovel groups.
- **Debug:** the T/Y keys cycle weapons (`src/app/controls.js`).

## Weapons done

| Weapon | Tap | Charged | Thrown | Notes |
|---|---|---|---|---|
| **Pitchfork** | thrust + lunge | **Skewer**: catch on the tines, carry, click to fling | **Javelin**: point first, sticks | |
| **Scythe** | **Reap**: `reap` motion, hooks people toward you, the whole tool hits (`handleHits`) | **Whirl**: 2 full turns, ghost move, flings away | **Buzzsaw**: spinning, passes `through` people and bales | heavy carry, no holding onto walls |
| **Shovel** | **Smack**: `reap` motion, full launch along your aim, **bats gourds** | **Home Run**: guard held up in front (a shield) while charging, then a big smack | **Bonk**: spinning, dazes (stars), rebounds off them | |

## Most recent change (the Shovel batting feedback; the user hasn't tried it yet)
- **The problem:** the user found gourds too hard to hit. The changes:
  1. Any part of the shovel bats, handle included (gourds only).
  2. Grace for gourds: `bats.reach` 0.15 m extra radius and `bats.grace` 0.1 s late window.
  3. **Reap swings are the same size wherever you aim** (Shovel tap and Home Run, Scythe tap): new field `arc` (degrees, default **90**) back from the aim, plus `follow` past it. It replaces the old `raise`.
     - Aiming ahead, the swing comes down from overhead; aiming up, it winds back over the shoulder; aiming down, it starts in front.
     - `clearOfFloor()` makes sure the wind-up never swings down through the floor.
- **Sliders:** the tuning panel has arc sliders (smack, Home Run, reap) and bat reach and grace sliders.
- **Tests:**
  - `tests/scythe.test.js` checks that the swing is the same size at any aim.
  - `tests/shovel.test.js` checks that the handle bats and that the grace window works and then ends.
- **Next:** wait for the user's feedback on how batting feels. Not checked in the browser yet.

## Planned: Rake (next weapon, ask its questions first)
- **From the design table:**
  - **Feel:** trip and drag. **Uses:** 7. **Carrying it:** normal speed.
  - **Tap:** a low sweep along the floor trips them (like a slide tackle), 6 dmg, and pulls them about 1 m in.
  - **Charged, Long Pull:** hooks the first player, bale or loose weapon about 3.5 m out and hauls it all the way in.
  - **Thrown, Trap:** lands tines up. Stepping on it makes the handle smack you: 15 dmg, stagger, knocked back.
- **Already decided:** the trap triggers on **anyone, the thrower included**.
- **Still to ask:** the rest of its questions. Earlier weapons asked about things like the swing's shape, what a hit does, how it looks when held, charging and throwing poses, and its art.

## Planned: Sickle (after the Rake)
- **From the design table:**
  - **Feel:** quick. **Uses:** 14. **Carrying it:** light, 110% speed.
  - **Tap:** very fast slashes (5 dmg) that alternate direction. Every 3rd slash in a row is an uppercut (pops them up, 8 dmg).
  - **Charged, Flurry:** a burst of rapid slashes.
  - **Thrown:** a fast, flat spin, 14 dmg, bounces once off a wall.
- **Already decided:** it's **one-handed** (`handGap` / hand posing will need a one-hand mode).

## Then
- **8.5 parries:** two live swings that meet clang. Both stop, both are pushed back, and both lose a use.
- **8.6:**
  - Finish the tuning panel groups for the Rake and Sickle.
  - Fill test gaps.
  - **Version bump.**
  - Update the step 8 checklist in `docs/DESIGN.md`.

## Open questions in the design doc (not urgent)
- Should a fully charged Classic hit be able to knock someone off from the middle of a platform?
- Art style: stay with the light paper look, or a darker night theme?
- Game name.
