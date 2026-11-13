# Main menu overhaul plan (written 2026-11-13)

## 0. TL;DR

- **New main menu:** Play / Map Editor / Settings / Feedback, in a **fresh layout** (picked from mockups).
- **Play** opens its own screen: Host / Join / Practice. **Host and Practice get a setup screen first.**
- **Settings** becomes its own tabbed screen: **Gameplay / Controls / Graphics**. Personal settings move out of Match Settings.
- **In-game (Esc) menu splits:** Settings (personal) and Match Settings (host/practice only).
- **Feedback** is an in-game form that posts into a **Google Form → Google Sheet**.
- **Not in scope:** colorblind support (dropped for now), building controller support or graphics settings (placeholders only).

## 1. Ground rules

- **The user commits.** Never commit or push (pushing to main deploys).
- **One step at a time.** Finish a step, check it in the browser, hand it over, wait for the go-ahead.
- **Code style:** deep modules, narrow interfaces. Dispatch on names with **handler maps, not if/else chains** (`ACTIONS` in `menus.js`, `ESC_FROM` in `controls.js`).
- **Comments:** keep each file's plain-English header comment up to date.
- **Look:** flat vector, Pumpkin & Bark tokens (`styles/tokens.css`), Luckiest Guy + Fredoka. No gradients, shine or blurry shadows.

## 2. Decisions (from the user, 2026-11-13)

| Topic | Decision |
|---|---|
| Scope | Layout + placeholders. **No colorblind row at all.** |
| Play | Separate screen (Host / Join / Practice / Back) |
| Host | **Setup screen first** (match settings), then "Open Lobby" makes the code |
| Practice | **Setup screen first** (map, dummies, …), then "Start" |
| Settings layout | **Tabs:** Gameplay / Controls / Graphics |
| Gameplay tab | Damage Numbers, Mouse Lock |
| Controls tab | Key binds (the current Controls list), Controller (**Coming soon**) |
| Graphics tab | **Coming soon** |
| Esc menu | Split: Settings (personal) + Match Settings (not shown to guests) |
| Feedback | In-game form → Google Form → Google Sheet |
| Feedback fields | Category (Bug / Idea / Other), Message, optional Contact, auto-attached info |
| Main menu look | **Stacked, no card** (picked 2026-11-13 from the step 1 mockup). Logo on top; **Play** big; Map Editor; **Settings + Feedback side by side** below. |
| Sub-screens | Centered paper card; the title art's circles and gourds stay visible behind it (no logo). |

## 3. Target menu map

```
Main menu
├─ Play
│   ├─ Host      → Host Setup (match settings) → [Open Lobby] → Lobby (code, copy, play while waiting)
│   ├─ Join      → Join (code entry)
│   ├─ Practice  → Practice Setup (map, dummies, sights, pumpkins) → [Start] → game
│   └─ Back
├─ Map Editor    (unchanged: My Maps, Import, Export)
├─ Settings      → tabs: Gameplay | Controls | Graphics
└─ Feedback      → form → [Send]

Esc menu (in game)
├─ Resume
├─ Settings        (same tabbed screen as above)
├─ Match Settings  (host and practice only; not guests)
└─ Exit
```

**Back / Esc:** every sub-screen backs out one level (Lobby and Join → Play; Play, Settings, Feedback → Main; in-game screens → Esc menu).

## 4. How the menu works today (read these first)

- `index.html`: every screen is a `<div class="screen" data-screen="…">` inside `#menu .card`. Buttons use `data-act="name:arg"`.
- `src/ui/menu.js`: builds the dynamic rows, `show(name, title)`, `setShown(key)`, `showToggle`, `showBinds`. `SOLID_SCREENS` = screens with the flat bark backdrop (no arena behind).
- `src/app/menus.js`: the `ACTIONS` map (every button's behavior), `openSettings()` (decides which Match Settings rows show), the return-to tracking (`listReturnTo`, `matchReturnTo`).
- `src/app/controls.js`: `ESC_FROM` map (what Esc does on each screen).
- `src/app/settings.js`: saved choices, `prefs` (damageNumbers, lockMouse), `PREF_BUTTONS`.
- `src/app/session.js`: `startHosting()`, `joinGame()`, `leaveSession()`.
- `src/ui/titleArt.js` + `titleLogo.js`: the main menu's canvas art and animated logo (positions are screen fractions).
- `styles/menu.css`: card, pill buttons, `.seg`, `.toggle-row`, inputs.

## 5. The steps

### Step 1: Layout mockups (no game code)

- [x] Make `docs/menu/mockups/main-menu.html`. It draws the logo and gourds with the game's own code, so open it through the Vite dev server: `http://localhost:5173/docs/menu/mockups/main-menu.html` (not by double-click).
- [x] Show two options with a switcher:
  - **Side column:** logo + buttons in a column on the left; title art fills the right.
  - **Stacked, no card:** today's vertical stack, buttons float over the art with no card box.
- [x] In each option, also show the sub-screens (Play, Settings with tabs, Feedback) so the user sees how they sit.
- [x] **Ask the user to pick.** Picked: **Stacked** (2026-11-13). Recorded in §2.

### Step 2: New main menu + Play screen (structure only) ✅ done 2026-11-13

- [x] `index.html`: main screen → **Play** (primary, `.big`) / **Map Editor** / a `.pair` row with **Settings** + **Feedback** (the pair is `hidden` until steps 3 and 6).
- [x] New `play` screen: Host / Join / Practice / Back.
- [x] Host and Practice keep today's behavior (straight in) until step 4.
- [x] `menus.js` `ACTIONS`: `show-play`, `play-back`. `leave` (Back from Join and the Lobby) → Play screen.
- [x] `controls.js` `ESC_FROM`: `play` → Main, `join` → Play. **Not `host`:** backing out of the Lobby closes the game you're hosting (and kicks friends), so only its Back button does that.
- [x] `menu.js` `SOLID_SCREENS`: added `play`.
- [x] `menu.css`: the Stacked main-menu sizes (`.big`, `.pair`, card 320px at 20vh), done early because the new buttons looked off without them.
- [x] Checked in browser: Play → Join → Esc → Esc; Play → Practice → Esc → Exit → Main. No console errors. Tests pass.

### Step 3: Settings screen with tabs ✅ done 2026-11-13

- [x] New `settings` screen: `.seg.tabs` row + one `.tab-panel` per tab (fixed min-height so Done doesn't jump).
  - **Gameplay:** Damage Numbers, Lock Mouse (moved out of Match Settings).
  - **Controls:** bind list, hint, Reset to Defaults (the old `controls` screen is gone), disabled **Controller: Coming soon** row.
  - **Graphics:** "Coming soon" note.
- [x] `menu.js`: `showTab(name)`; `show(name, { title, solid })` (was `show(name, title)`), plus a `solid` getter.
- [x] `menus.js`: `show-settings`, `settings-tab:<name>` (last tab remembered while the page is open), `settings-done`, `closeSettings`. Removed `show-controls` / `controls-done` / `closeControls`.
- [x] Settings and Pumpkins **inherit solidity** from the screen they're opened from (title art from the main menu, the arena from in game).
- [x] Esc menu: Resume / Settings / **Match Settings** (hidden for guests: `data-show="match-menu"`) / Exit.
- [x] Main menu **Settings** button visible (Feedback still hidden in the pair).

### Step 4: One Match Settings screen, three contexts ✅ done 2026-11-13

- [x] `MATCH_CONTEXTS` in `menus.js`: `host-setup` (Open Lobby → `startHosting()`, Back → Play, solid), `practice-setup` (Start → practice, Back → Play, solid: the user wants the game hidden until Start, like Host), `in-game` (Done → where it was opened from: Esc menu or Lobby; rows by mode, as before).
  - Change from the plan: in-game host and in-game practice are **one context** whose rows depend on the mode (same logic as before), not two.
- [x] The primary button's label comes from the context (`data-act="match-primary"`, `data-text="match-primary"`); a quiet Back shows for the setups.
- [x] Play screen: Host → Host Setup, Practice → Practice Setup.
- [x] Checked: Host Setup → Open Lobby → Match Settings → Esc → Lobby → Back → Play; Practice Setup (map pans, dummies change) → Start → Esc menu → Match Settings / Settings → Esc. No console errors.

### Step 5: Apply the Stacked layout ✅ done 2026-11-13

- [x] `menu.css`: main card 320px at 20vh, Play `.big`, `.pair` row (done in step 2).
- [x] `titleArt.js`: draws on **every solid screen**; the logo only on `main`. CSS: `#menu.solid .menu-art { display: block }`.
- [x] Sub-screens: today's centered paper card over the art.

### Step 6: Feedback form

**6a. The user sets up the Google Form (one time, ~5 min):**
1. Create a Google Form with 5 questions: **Category** (multiple choice: Bug, Idea, Other), **Message** (paragraph), **Name** (short answer), **Email** (short answer), **Info** (paragraph).
2. Responses tab → **Link to Sheets**.
3. ⋮ → **Get pre-filled link**, fill each field, copy the link. It contains the form id and each question's `entry.<number>`.
4. Give those to Claude (they're not secret: anyone can see them in the game's code).

**6b. Code:** ✅ built and hooked up 2026-11-13
- [x] `src/app/feedback.js`: `FEEDBACK_FORM` (**empty until 6a**), `prepareFeedback` (pure, tested), `sendFeedback` (statuses: sent, empty, wait, busy, offline, not-set-up), `feedbackReady`, `feedbackWait`. 60 s cooldown, 1000 / 100 character limits.
- [x] Auto-attached info: version, session mode, window size, browser (`navigator.userAgent`). (The user asked to drop the on-screen note about it.)
- [x] `feedback` screen: category buttons (Bug / Idea / Other), message box with a counter, **Name (Optional)** and **Email (Optional)** boxes with labels, Send, status, Back. Solid (title art behind it).
- [x] `menus.js`: `show-feedback`, `feedback-cat`, `feedback-send`, `feedback-back`, status text by a `FEEDBACK_TEXT` map. `controls.js` `ESC_FROM.feedback`.
- [x] `menu.css`: the big input style is now only on `[data-input=join-code]`; `.field` for plain text boxes.
- [x] With no form set up, the screen says "Feedback isn't set up yet."
- [x] `tests/feedback.test.js` (4 tests).
- [x] **`FEEDBACK_FORM` filled in** (2026-11-13). First test was dropped: the form (made on a BYU account) was **restricted to signed-in BYU users** (the public page gave 401). The user turned that off; a test post then got "Your response has been recorded".
- [x] The user sent one from the game and saw it in the Sheet.

### Step 7: Final pass ✅ done 2026-11-13

- [x] Every path checked in the browser across steps 2–7 (main → each screen → back; Esc on each; Host Setup → Lobby → Match Settings; Practice Setup → Start → Esc menu; Feedback send + cooldown). No console errors.
- [x] Esc now backs out of a menu screen even with the cursor in a text box (Join code, Feedback); `controls.js`.
- [x] `npx vitest run`: 111 pass (4 new in `tests/feedback.test.js`). `npm run build` works.
- [x] Docs: `docs/DESIGN.md` Menus section, `README.md` file map (`feedback.js`), `docs/HANDOFF.md` menus line. Header comments: `menu.js`, `menus.js`, `titleArt.js`, `controls.js`, `keybinds.js`.
- [x] The user confirmed feedback arrives in the Sheet.

## 6. Risks and notes

- **The form must stay public:** Settings → Responses → "Restrict to users in BYU…" off, Collect email addresses off, Limit to 1 response off. If any gets turned back on, sends silently stop working (the game can't see Google's reply). Check: the form's viewform link opens in a private window without a login.

- **Feedback spam:** the form URL is public, so anyone could post junk to the Sheet. Low risk for a small game; the cooldown stops accidental repeats. If it becomes a problem, move to a Cloudflare Worker with a captcha.
- **Google may change the formResponse endpoint.** If sends start failing, fall back to opening the form in a new tab.
- **Privacy:** the attached info is shown to the player before they send; contact is optional.
- **No protocol change:** menus only, so friends on the same version still connect. No version bump needed.

## 7. Parked (later, not this plan)

- [x] ~~Esc while typing in a menu text box did nothing~~: fixed in step 7 (Esc now backs out of Join and Feedback even with the cursor in a box).

- [ ] Colorblind support (dropped from this overhaul)
- [ ] Controller support (placeholder only here)
- [ ] Graphics settings (placeholder only here; decide what they are first)
