# Handoff: Gourd Wars, weapon abilities → gourds (as of 2026-11-09)

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
- **Crows stay**, carrying nothing: knock one down with a pumpkin, pick it up, throw it for a pecking frenzy. Host setting **Crows** (Off / Rare / Normal / Often) on Match Settings (`matchSettings.crows` → `game.crowRate`).
- Kept for the gourds: `Player.daze(seconds)` / `dazed` (stars circling the head; `drawDizzyStars` in `render/crows.js`).

## Build order (step 9)
- [x] 9.1 **Buzzsaw** (Pierce; built 2026-11-09, the user hasn't tried it yet): pattypan saw, flat & fast (⅓ gravity, 18–30 m/s), 15 dmg to each person it goes through, cuts through bales, knocks crows down, breaks on anything else. Code: `pierces` + `spin` fields, `PIERCES` / `piercesThrough` in pumpkins.js (also used by game.js pre-solve), `drawSawSquash` in render/pumpkins.js, sight skips bales, a `pierce` event per cut (chip spray in render/effects.js). Tests: `tests/buzzsaw.test.js`.
- [ ] 9.2 **Daze** (from the Bonk): knocks the target limp with stars circling their head; breaks on the hit (**no bounce**)
- [ ] 9.3 **Bear Trap** (from the Rake's Trap): lands and sits armed; snaps shut on whoever steps on it
- [ ] 9.4 **Landmine** (from the Rake's Trap): lands and sits armed; blows up whoever steps on it

## Open questions in the design doc (not urgent)
- Should a fully charged Classic hit be able to knock someone off from the middle of a platform?
- Art style: stay with the light paper look, or a darker night theme?
- Game name.
