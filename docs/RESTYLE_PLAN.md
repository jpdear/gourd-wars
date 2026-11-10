# Restyle plan: Gourd Wars → flat vector (written 2026-11-09)

**Read this whole file before you change anything.** It's written for an agent with no memory of the design session. Everything you need is here, in `docs/restyle/mockups/`, and in the code.

---

## 0. TL;DR

- **Goal:** redraw the whole game in the **flat vector** style the user picked, with no changes to gameplay. The look: solid shapes, one hard-edged shadow side ("two-tone"), rounded forms, no outlines, no shine, no gradients.
- **What changes:** in-game art (players, gourds, effects, level pieces, crows), all 6 map themes, 4 new themes (Winter, Lava, Synthwave, Graveyard: themes only, no new levels), the HUD, the menus, the map editor and the tuning panel. Then a final step to fix two open contrast problems.
- **Master reference:** `docs/restyle/mockups/style-guide.html`. Open it in a browser. Every hex code is in this file too (section 4).
- **How to work:** **one step at a time** (section 7). Finish a step, check it in the browser, hand it to the user to try, then **stop and wait** for their go-ahead. **Never commit or push.** The user commits.

---

## 1. Ground rules (from the user; follow exactly)

1. **One step at a time.** Do one step from section 7, verify it, hand it over (each step ends with a "Hand over" note), then **stop**. Start the next step only when the user says so.
2. **Never commit or push.** The user commits themselves, and pushing to main deploys. Don't create branches either unless the user asks.
3. **Ask before deviating.** If a step can't be done as written, or you think the look should differ from the mockups, ask the user first (with a mockup or screenshot when it's visual). Don't make design decisions silently.
4. **Gameplay must not change.** This is a render-only project. The only game-side data that changes is colors: `PLAYER_COLORS` in `src/config.js`, and the `color`/`rib` of Homing and Dizzy Gourd in `src/game/pumpkinTypes.js`. Those colors go into snapshots and events, so the replay test's hashes change; see step 5 and step 6 for how to re-record safely.
5. **Code style** (from `docs/HANDOFF.md`):
   - Follow *A Philosophy of Software Design*: deep modules, narrow interfaces, information hiding.
   - Dispatch on a name with **handler maps, not if/else chains** (`SCENERY[theme.scenery](…)`, `BODIES[mark]`, and so on).
   - Every file keeps a **plain-English header comment** describing what it does. Update it when you change the file.
   - Match the existing code: no semicolons, 2-space indent, short helpers, world units via `X(x)`, `Y(y)` and `s`.
6. **Replies to the user:** the user has ADHD. Answer first, keep it short, use bullets and checklists, **bold** the key info, and end with one clear next step. Keep a short "Parked TODO" list of side issues you notice rather than fixing them unasked.
7. **Keep docs current:** `docs/DESIGN.md` (its **Look** section), `README.md` (its file map) and `docs/HANDOFF.md`. Update them in step 14, plus whenever a step adds a new file.

---

## 2. Context: what was decided and why

- **Gourd Wars** is a browser, peer-to-peer brawler. Up to 4 ragdoll stick figures throw pumpkins and gourds at each other. The stack is Planck.js (physics), PeerJS (networking), Vite and vitest. The canvas is drawn procedurally; there are no image files.
- **The user's goal for the look:** "a goofy, chaotic, fun party game", with a more polished feel than the current look. They tried about 12 styles (cel-shaded, flat vector, paper cutout, pixel art, rubber-hose, felt, cross-stitch, origami, comic, "party cartoon" and others) and picked **plain flat vector**.
- **Explicitly rejected (don't bring these back):**
  - Glossy highlights or "glistening" on gourds or heads
  - Cartoony extras: googly eyes, faces on pumpkins, party hats, KABOOM text
  - Outlines (ink lines around shapes)
  - The tin-and-whipped-cream and lattice pie designs
  - Redesigns for Frost, Black Hole, Dizzy Gourd, Landmine and Seed Spitter (they keep their current designs)
- **Picked**, all in one place in section 4:
  - Main palette: **Pumpkin & Bark**
  - Player colors: **Bright**
  - Shading: **Two-tone**
  - Shapes: **Rounded**
  - Blast: **Puffs**
  - Background: **Simple** (per map, see section 4.5)
  - A palette for each of the 10 maps
  - Gourd colors and designs: **Homing** becomes a steel-blue **Rocket**, **Dizzy Gourd** goes darker brown, **Splat Pie** gets a **fluted edge**, and **Jack-o'-Boom**'s fuse **throws sparks**
  - Fonts: **Luckiest Guy** (display) and **Fredoka** (text)
- **Open issues:** dark gourds (Landmine, Black Hole) are hard to see on dark maps, and orange gourds could blend into the warm maps (Golden hour, Inferno). The user turned down redesigns that would have fixed the first. Step 13 handles both by mocking up options and asking.

---

## 3. The rules of the look (apply them to anything not covered below)

| Do | Don't |
|---|---|
| **Solid flat shapes.** Every shape is one color. Detail comes from more shapes (like a pumpkin's darker side lobes), not from lines. | **No outlines.** No `stroke()` around a filled shape to edge it. |
| **One hard shadow side** (two-tone, see 4.3) on players, gourds, hills and level props. | **No shine.** No highlights, specular dots or glossy ellipses. |
| **Rounded forms.** Round limb caps, round heads, lobed pumpkins, soft hills and clouds. | **No gradients.** Replace every `createLinearGradient` and `createRadialGradient` with flat shapes: flat bands for skies, stacked translucent discs for glows. |
| **A calm world and loud action.** Map colors stay softer than players, gourds and blasts. | **No cartoony extras** (see section 2). |
| **HUD text on paper.** Text over the game sits on a paper chip or has a paper outline, so it reads on every map. | Don't change sizes or hitboxes. Art must keep the same footprint as the physics shapes. |

**Thin detail strokes are allowed** when the stroke *is* the shape: a fuse, an antenna, a balloon string, a vine, a crosshair, the grapple vine, the mover rail, the sight. They are not outlines. **UI elements** (the crosshair, lock-on brackets, the airstrike target) stay as strokes.

---

## 4. The target look: every value

### 4.1 Main palette: Pumpkin & Bark (menus, logo, HUD; the same on every map)

| Token | Hex | Job |
|---|---|---|
| `bark` | `#2e2620` | The menu backdrop |
| `bark2` | `#3a3029` | Raised panels on bark; decorative circles on the title screen |
| `bark3` | `#463a31` | Hover and buttons on bark panels (editor, tuning) |
| `ink` | `#2e2620` | Text and dark buttons |
| `inkEdge` | `#16110d` | The ledge under dark buttons |
| `paper` | `#f6efe3` | Cards, light buttons, HUD chips, outlines around text over the game |
| `paperEdge` | `#d9cbb5` | The ledge under paper |
| `muted` | `#8a7b69` | Labels and small print on paper |
| `mutedOnBark` | `#b6a895` | Small print on bark |
| `pumpkin` | `#f28c28` | The logo, the main button, KO! |
| `pumpkinEdge` | `#b05a10` | The ledge under the main button |
| `logoEdge` | `#1c1511` | The stroke and drop under the logo, headings and banners |
| `accent` | `#5fae3c` | Toggles that are on |
| `accentEdge` | `#3c7a22` | The ledge under toggles |
| `hit` | `#e8384f` | Damage numbers; danger buttons |
| `hitEdge` | `#a22737` | The ledge under danger buttons |
| `scrim` | `rgba(46, 38, 32, 0.55)` | Dims the game behind the Esc menu |

**Buttons:** pills (`border-radius: 999px`) with no border and no gradient. Each sits on a ledge (`box-shadow: 0 4px 0 <edge>`), rises on hover (`translateY(-1px)`, ledge 5px), and presses into it on click (`translateY(3px)`, ledge 1px). The menu CSS already does this; keep the behavior and change only the colors.
- Main button: `pumpkin` with white text and a `pumpkinEdge` ledge
- Regular button: `ink` with `paper` text and an `inkEdge` ledge
- Light button (on bark): `paper` with `ink` text and a `paperEdge` ledge
- Toggle that's on: `accent` with white text and an `accentEdge` ledge
- Danger button: `hit` with white text and a `hitEdge` ledge

**Logo, headings and banners:** Luckiest Guy with a `0.08em` stroke in `logoEdge` (`-webkit-text-stroke` plus `paint-order: stroke fill`) and a `0.07em` drop (`text-shadow: 0 0.07em 0 logoEdge`). The logo fill is `pumpkin`.

### 4.2 Fonts

| Role | Font | Weight | Where |
|---|---|---|---|
| **Display** | **Luckiest Guy** | 400 | The logo, card titles, buttons, banners ("Blue wins!"), score tiles, KO!, damage numbers, the round chip, toggle pills, the harvest-key bubble |
| **Text** | **Fredoka** | 500 (600 for emphasis) | Labels ("Damage Numbers", "Join Code"), status lines, small print ("Next map in 3…", the version), editor and tuning panels |
| Debug | `ui-monospace, monospace` | 400 | Debug lines only (unchanged) |

- Load both from Google Fonts in `index.html`: `family=Luckiest+Guy&family=Fredoka:wght@400;500;600;700&display=swap`.
- Luckiest Guy letter-spacing: `0.03em` for the logo and banners, `0.04em` for buttons and labels.
- Canvas text uses the same families: `400 <px>px "Luckiest Guy", "Arial Black", sans-serif` and `500 <px>px Fredoka, system-ui, sans-serif`.

### 4.3 Two-tone shading (the core technique)

**Port this from `thing` and `layerPass` in `style-guide.html`.**

- **Light comes from the top left.** The direction is `LIGHT = normalize(1, 1.15)` in canvas pixels (x right, y down), which points toward the shadow side at the bottom right.
- **The shadow shape** is the object's silhouette minus a copy of it shifted toward the light by `shift` pixels. That leaves a crescent on the bottom-right edge.
- **The shadow color:** fill that crescent with the **map's shade tint** (`theme.shade`) and composite it onto the frame with `globalCompositeOperation = 'multiply'`. The shadows take on the map's mood, for example blue on Winter's snow.
- **How:** use one offscreen layer canvas, cleared and clipped to the object's bounding box. Draw the silhouette in the tint, then switch to `destination-out` and draw the silhouette again, shifted by `(-shift·LIGHT.x, -shift·LIGHT.y)`. Finally `drawImage` that box onto the main canvas with `multiply`.

**Shift amounts:**

| Object | Shift | Direction |
|---|---|---|
| Players | `0.04 m` (× `s`) | `LIGHT` |
| Gourds | `20%` of the drawn radius | `LIGHT` |
| Hills and mountains | `0.16 m` in mockup units (≈ `0.85 m` in game units) | sideways only: `[1, 0]` |
| Scenery props (trees, tombstones, rocks, buildings, bales, scarecrow) | `0.03–0.06 m` mockup (≈ `0.15–0.3 m` game) | `LIGHT` |

- **Details go on top, unshaded.** These are the eyes, a gourd's marks (fuse, bands, crosshair) and its stem leaf. Draw them after the shading pass (`after` in the mockup).
- **Contact shadows:** a flat ellipse in `theme.shadow` (an rgba string), `0.34 m` × `0.045 m` in mockup units (≈ `0.6 m` × `0.09 m` game). Draw it on the surface under anyone standing (step 5).
- **No drop shadows.** The user picked two-tone only.

### 4.4 Players and effects (the same on every map)

**Player colors: Bright.** This replaces `PLAYER_COLORS` in `src/config.js`. The names stay Blue, Red, Green and Yellow.

| Slot | Name | Hex (was) |
|---|---|---|
| 0 | Blue | `#1f8bff` (`#2b6cff`) |
| 1 | Red | `#ff3d5e` (`#e8384f`) |
| 2 | Green | `#16c46c` (`#1fa35c`) |
| 3 | Yellow | `#ffc21a` (`#e0a800`) |

**The flat stick figure** (port `playerBody` and `playerEyes`):
- **Limbs:**
  - Round caps and round joins.
  - Widths as now: torso `0.16 m`, the rest `0.11 m`.
  - **Back limbs** (the side away from the viewer) are the player color mixed **18% toward black**, drawn first.
  - The **front** side is the `R` parts when `p.facing > 0` and the `L` parts when `p.facing < 0`. This matches `handOf()`, which treats `forearmR` as the front hand when facing right.
  - Draw order: back thigh, shin, arm and forearm; then the torso; then the front thigh and shin; then the front arm and forearm; then the head.
- **Head:** a circle of radius `BODY.headR` (0.17 m) in the player color.
- **Eye:**
  - A white dot (`#ffffff`) of radius `0.05 m`, set forward `0.07 m` along `facing` and up `0.03 m` from the head center.
  - A **pupil** (`#1d1a2a`) of radius `0.026 m`, nudged another `0.018 m` forward.
  - **Stunned:** white X eyes (two strokes, width `0.025–0.03 m`, half-size `0.035 m`), as now.
- **States** (all flat, no outlines):
  - **Frozen:** the color mixed 70% toward `#cdeefa`, as now. Remove the white stroked outline and add two small white diamonds on the head instead (like the Frost gourd's mark).
  - **Glued:** goo blobs in the Splat Pie color on the feet, as now.
  - **Floating:** a balloon string plus a Balloon Gourd drawn with the new gourd renderer.
  - **Crown:** a flat `#f7c531` crown. Remove the `#9a6b00` stroke; it gets two-tone shading instead, and keeps the `#d6303f` jewel.
  - **Dizzy stars:** flat `#f7c531` stars with no stroke.

**Blast colors:**

| Name | Hex | Use |
|---|---|---|
| Flash | `#ffffff` at 80%, fading | An expanding filled disc for the first 0.35 s |
| Hot | `#ffe08a` | The newest puffs (heat > 0.66) |
| Warm | `#ffb347` | Cooling puffs (> 0.33) |
| Cool | `#ff7f3f` | Almost out (> 0.12) |
| Smoke | `theme.smoke` (per map) | Burnt-out puffs |
| Seed | `#f6e7c1` | Seeds in a splat |

### 4.5 Map themes (10)

Theme **keys stay the same** for the 6 existing themes, because custom maps store them by name. 4 new keys are added. `name` is what the map editor's dropdown shows.

**Fields every theme has** (the new schema, used in step 9):
- `name`, `scenery` (a key into `SCENERY`)
- `sky` (one flat color) or `bands` (flat bands from top to bottom, cut at 0, 20%, 42%, 66% and 100% of the view's height)
- `ink` and `muted` (editor grid, mover rails, debug text)
- `platform`, `platformTop`, `wall`, `top` (a key into `TOPS`)
- `shade` (the two-tone tint), `shadow` (the contact shadow rgba) and `smoke` (burnt-out blast puffs)
- `art`: scenery-specific colors

| Key | Map | `name` | `scenery` | Sky | Hills / art | `platform` | `platformTop` / `top` | `shade` | `shadow` | `smoke` | `ink` / `muted` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `paper` | The Patch | **Midday** | `hills` | `#cfe8f3` | sun `#fff1a8`, clouds `#ffffff`, hills far `#bfe0a3`, near `#97cc78` | `#5e4636` | `#4fa23a` / `grass` | `#b7cdd8` | `rgba(40,60,70,0.16)` | `#eef0ec` | `#2e2620` / `#6c7d8a` |
| `barn` | Hay Loft | Barn | `barn` | wall `#e2c79d` | planks `#d8ba8c`, beams `#7a4f2a`, window light `#fff1c9`, hay `#e9c25a` | `#6b4423` | `#a8743c` / `planks` (seams `#5a381c`) | `#d9bf9a` | `rgba(90,56,28,0.22)` | `#eadcc4` | `#3b2a1a` / `#7a5a3a` |
| `sunset` | Scarecrow Field | Sunset | `field` | bands `#f0a07a`, `#f5b486`, `#f8c796`, `#fbdcae` | big low sun `#fff2c8`, far field `#c98f5a`, near field `#a8693f`, scarecrow silhouette `#7a4a2c` | `#5c3d24` | `#c9a227` / `wheat` (heads `#e0bb45`, stems `#b8942c`) | `#e3b48f` | `rgba(92,61,36,0.2)` | `#efd6bd` | `#4a2e1a` / `#8a5a3a` |
| `dusk` | Pitchfork Pit | Dusk | `rocks` | `#e2c6da` | pale sun `#ffe0ae`, far peaks `#b49ac8`, near rocks `#8c77b0`, boulders `#6c5e98` | `#352b4a` | `#5b8a63` / `grass` | `#c4aacb` | `rgba(40,30,70,0.2)` | `#e3d0dc` | `#262a33` / `#6b5f80` |
| `night` | Bonfire Camp | Night | `camp` | `#202b46` | stars and crescent moon `#f2ead2`, hills far `#2f3f63`, near `#26344f`, pines `#101a2e` | `#15151f` | `#3c6a4c` / `grass` | `#8a93b3` | `rgba(0,0,0,0.32)` | `#56627e` | `#f6efe3` / `#a3abc0` |
| `plain` | Testing Grounds | Plain | `grid` | `#f4efe6` | grid lines `#e6dccb` (thin every 1 m, thick every 4 m) | `#3b3631` | `#5a8f3c` / `grass` | `#e0d4c2` | `rgba(59,54,49,0.16)` | `#e3dbcf` | `#3b3631` / `#8a8073` |
| `winter` *(new)* | (none built in) | Winter | `winter` | `#cbb7d6` | sun `#ffe6c4`, far mountains `#e6d9ec`, mid hill `#f4eef6`, near hill `#fdfbfd`, pines `#3b4f6b` with snow caps `#fdfbfd`, falling snow `#ffffff` | `#4f4a66` | `#fdfbfd` / `snow` | `#c9b6d6` | `rgba(60,50,90,0.2)` | `#efe6f2` | `#2e2620` / `#6c6684` |
| `lava` *(new)* | (none built in) | Lava | `lava` | bands `#240c0a`, `#331310`, `#481a12`, `#6a2614` | far ridge `#1e0b09`, volcano `#2b110d`, lava `#ff6a1a`, lava crests `#ffb347`, embers `#ffb347`, crater smoke `#4a2c26` | `#2b1d1a` | `#4a2e26` / `lava` (cracks `#ff7a1a`) | `#a07068` | `rgba(0,0,0,0.35)` | `#5a3a32` | `#f6efe3` / `#c09a8a` |
| `synthwave` *(new)* | (none built in) | Synthwave | `synth` | bands `#1a0f3a`, `#35185e`, `#5e1f78`, `#a12f7d` | stars `#f6d6ff`, sun top `#ffd23f`, sun stripes `#ff5f8f`, peaks far `#2a1250`, near `#3c1a6b`, grid floor `#150a2e`, grid lines `#ff3fa4` | `#1d1238` | `#2ef2ff` / `metal` (seams `#120a26`) | `#a58ad0` | `rgba(0,0,0,0.35)` | `#6a4f8f` | `#f6efe3` / `#b9a3e0` |
| `graveyard` *(new)* | (none built in) | Graveyard | `graveyard` | `#3a2f4f` | moon `#f2ead2`, hills far `#4b3d63`, near `#43375a`, bare tree `#1f1830`, tombstones `#6c6184`, iron fence `#1c1528`, fog `#5d5279` | `#241c2e` | `#4f6b3a` / `soil` | `#9a8fb3` | `rgba(0,0,0,0.3)` | `#6a5f84` | `#f6efe3` / `#9a8fb3` |

- **`wall`:** use the theme's `platform` color, except `barn`, which keeps `#5e3b1f`.
- **The scenery drawings** are the `SCENERY.<name>` functions in `style-guide.html`, using the colorways in `PICKED_MAPS`. The grid scenery is `SCENERY.lab` there.

### 4.6 Gourds (18 spawnable, plus Mini, Seed, Airdrop and Crow)

Body `color` and `rib` are in `src/game/pumpkinTypes.js`. **Only Homing and Dizzy Gourd change.** In flat style, `rib` is used for the **side lobes** (the color mixed 45% toward the rib) and for details, not for stroked rib lines.

| Type key | Name | `color` | `rib` | Flat shape (port from `BODY` / `MARK` in `style-guide.html`) |
|---|---|---|---|---|
| `classic` | Classic | `#f28c28` | `#c4630f` | `lobed` |
| `bouncy` | Bouncy | `#ffb84a` | `#d98a1c` | `lobed` plus `MARK.bands` (two rib-colored bands clipped to the body) |
| `boom` | Jack-o'-Boom | `#e2571b` | `#8c2f0b` | `lobed` plus **new `MARK.fuse`**: a curved dark fuse ending in a **spark burst** (7-point stars `#ff9a2e` and `#ffe08a`, spark lines `#ffc94d`, 3 flying dots `#ffe08a`). **Animate it in game:** rotate and flicker the stars with `Date.now()`. |
| `cluster` | Gourd Cluster | `#d6a03a` | `#8f6a1f` | `BODY.cluster` (three small lobed gourds) |
| `mini` | Mini | `#d6a03a` | `#8f6a1f` | `lobed` |
| `frost` | Frost | `#9fd8f0` | `#5aa9cc` | `lobed` plus `MARK.ice` (white diamonds); the current design |
| `pie` | Splat Pie | `#f3dfb0` | `#c79a54` | **New `BODY.pieFluted`**: the flat oval, rib-colored crust with **18 scallops** around the edge, the filling in `color`, three slits (the rib mixed 10% toward black) |
| `vine` | Vine | `#5fae3c` | `#3c7a22` | `lobed` plus `MARK.vine` (a curl stroke and a leaf) |
| `biggourd` | Big Gourd | `#d9b25c` | `#9c7a2e` | `BODY.gourd` (wide, 4 lobes) |
| `spitter` | Seed Spitter | `#a8c94a` | `#6f8f2a` | `lobed` plus `MARK.speckle`; the current design |
| `seed` | Seed | `#3d2f14` | `#fff6dc` | A dark ellipse on a slightly bigger cream ellipse. That's a filled rim kept for visibility, which is allowed. |
| `balloon` | Balloon Gourd | `#c7a8e8` | `#8e6cc0` | `lobed` plus `MARK.string` |
| `blackhole` | Black Hole | `#4b2c84` | `#2a1752` | `lobed` plus `MARK.stars`; the current design. Its visibility gets fixed in step 13. |
| `airstrike` | Airstrike | `#6b7a3a` | `#47522a` | `lobed` plus `MARK.crosshair` |
| `airdrop` | Airdrop | `#6b7a3a` | `#47522a` | `lobed` plus `MARK.crosshair` (radius 0.9) |
| `homing` | Homing | **`#4f7fc4`** (was `#d83a2c`) | **`#2f5590`** (was `#9a2219`) | **New `BODY.rocket`**: two rib-colored tail fins, a dark nozzle and a stemless `lobed` body, plus `MARK.antenna` |
| `boomerang` | Boomerang | `#f2c230` | `#b88a12` | `BODY.boomerang`, filled: the neck, bulb and tip in `color`, the ridge as a darker filled band, and a stroked stem |
| `buzzsaw` | Buzzsaw | `#d4e38f` | `#7d9343` | `BODY.saw`: the tooth ring in `color`, a scalloped inner ring (the color mixed 40% toward the rib), the center disc and a stem nub |
| `dizzy` | Dizzy Gourd | **`#a8693a`** (was `#c99a5b`) | **`#6e4220`** (was `#86602f`) | `BODY.bottle`: a big bulb with lobe shading and a small bulb on top; the current design |
| `chomper` | Chomper | `#b9c24a` | `#6b7524` | `BODY.chomper` (shut). The planted **open** state must be redrawn flat to match (step 6). Warts `#7f8a2c`, mouth `#c8383a`, teeth `#f3ecc4`. |
| `landmine` | Landmine | `#4f5530` | `#2c301a` | `BODY.mine`: a squat body, lobes, knobs, a stem and a dark light (`#6e1f1a`); the current design. Its visibility gets fixed in step 13. |
| `crow` | Crow | `#2d2a33` | `#141218` | Drawn by `crows.js` (step 8) |

- **Shared gourd colors:** stem `#4f8a34`, leaf `#76b046`, fuse and antenna `#3b3631`, string `#6b6358`.
- **Ripeness tint:** `pumpkinColors()` keeps mixing unripe green `#76a83f` / `#557d2a` and rotten brown `#7a5a32` / `#56401f`, as now.

---

## 5. How the current renderer works (read these files)

| File | Lines | What it draws | Hard-coded colors |
|---|---|---|---|
| `src/render/render.js` | 125 | **The frame.** It sets up `X`, `Y` and `XS`, the arena clip and the shake, then calls everything in order: map, cannons, bales, patches, crows, pickup hints, airstrike targets, traps, flying pumpkins, players, holes, sight, scarecrows, fire flames, particles, birds, feathers, rings, popups, HUD, banner, message, crosshair. | It draws popups in `system-ui` with `theme.ink` |
| `src/render/scenery.js` | 131 | `drawMapBase`: a **gradient sky** plus scenery picked by an `if` chain (`hills`, `barn`, `sunset`, `rocks`, `night`), platforms (`theme.platform`, `platformTop`, `wall`), mover rails and wheat | 12 |
| `src/render/players.js` | 211 | Players (stroked limbs, head, eye), the grapple vine, the sight, the crown | 10 |
| `src/render/pumpkins.js` | 623 | Gourds: `roundPumpkin`, `BODIES`, `MARKS`, `IN_FLIGHT`, `HELD`, patches with **radial-gradient glows**, the Super Rare glow, the boomerang, chomper, mine, bottle and saw shapes, spin blur, flame trail, lock-on, airstrike target, black hole (**gradient halo**) | 48 |
| `src/render/effects.js` | 167 | The effect state (`particles`, `popups`, `rings`, `birds`, `feathers`, `shake`), the `EFFECTS` map by event type, `updateEffects` | 54 |
| `src/render/level.js` | 224 | Bales, pitchforks, the bonfire (**gradient glow**), the scarecrow, cannons | 33 |
| `src/render/crows.js` | 273 | Crows (stroked edges), dizzy stars (stroked), the pecking crow, flying-off birds, feathers | 10 |
| `src/render/hud.js` | 124 | Match info, scores, the banner (stroked in `theme.sky[1]`), the crosshair, debug | 5 |
| `src/render/pickups.js` | 35 | The harvest ring and the key bubble | 3 |
| `src/maps/themes.js` | 11 | `THEMES` (6) | (theme data) |
| `src/ui/editor/editor.js` | 653 | The map editor. Its canvas grid and previews use `theme.ink`, `platform`, `wall`, `muted` and `sky[1]`. | 13 |
| `styles/menu.css`, `editor.css`, `tuning.css`, `base.css` | 125 / 44 / 39 / 3 | Menus (radial-gradient backdrop, cream card, pill buttons with ledges, the Luckiest Guy logo), the editor UI, the tuning panel | 62 / 32 / 18 / 1 |
| `index.html` | | The menu markup and the Google Fonts link (Luckiest Guy only) | |
| `src/ui/menu.js` | 154 | Builds the menu: the logo letters' drop-and-wobble, the pumpkin list and so on | |

**Key facts:**
- **The canvas has a DPR transform.** `src/app/view.js` sets `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`, so `X()` and `Y()` return **CSS pixels**. The shading layer must work in device pixels (see step 5).
- **`render()` translates for screen shake** (`ctx.translate(...)`) and clips to the arena. The shading module must respect the current transform, which `ctx.getTransform()` gives you.
- **World:** the view is `CONFIG.view = { w: 32, h: 18 }` meters with y pointing up. `Y(y) = oy + (18 - y)·s`. Scenery currently stands on `y = 0`, the bottom of the view.
- **Map transitions** draw the old map one screen to the left (`XO = x => X(x - MAP_SHIFT)`) while the camera pans. Everything in `drawMapBase` must work with any `X`.
- **Colors that reach the game state:**
  - `p.color` (from `PLAYER_COLORS`) goes into snapshots (`src/game/snapshot.js:19`).
  - Pop events carry `color: type.color` (`src/game/pumpkins.js:138`, `src/game/pumpkinTypes.js:265`).
  - The replay test hashes snapshots and events, so **changing these colors changes `tests/__snapshots__/replay.json`.**

---

## 6. Porting from the mockups (read before steps 5–10)

- The mockup code is **prototype code**. Port its *shapes, numbers and draw order*, not its structure. Then fit it to the game's conventions: file headers, handler maps, world units through `X`, `Y` and `s`, and no stray globals.
- **Gourds and players** are drawn in pixels around a center, in the same frame of reference as the game (`ctx.translate(x, y); ctx.rotate(-angle)`, canvas y down, negative y is the top of the gourd). Their shape functions port almost unchanged.
- **Scenery units.** The mockups use a **6 m wide** world with the ground line at **y = 0.6**; the game's scenery stands on **y = 0** in a 32 × 18 m view. **Run the mockup scenery code through a converted view** rather than rewriting its numbers:

  ```js
  // k: mockup meters → game meters (the same composition the user approved, scaled to the game's width)
  const K = 32 / 6
  const mockView = (X, Y, s) => ({ s: s * K, X: mx => X(mx * K), Y: my => Y((my - 0.6) * K), /* w, h: see below */ })
  ```

  With this, `SCENERY.hills(ctx, mockView(...), …)` draws the approved composition across the game's 32 m.
  - The game's view is taller than the mockups' (18 m is 3.375 mockup units above the ground line, against 3.0 in the mockups). The extra strip at the top is plain sky, so make sure `bands` and the stars cover it.
  - The mockup scenery fills the sky with `ctx.fillRect(0, 0, v.w, v.h)`. In the game, fill the **arena rectangle** (`X(0)`, `Y(18)`, `32·s`, `18·s`) instead.
  - **Ground-level pieces don't line up with the game's platforms.** Place these in game meters by hand, not through `mockView`:
    - the lava sea (`lava`): its top at about `y = 1.2 m`, so it shows in the pits but stays below the floors
    - the synth grid floor (`synth`): the horizon at about `y = 3 m`, with the grid between it and the bottom of the view
    - the fog bank (`graveyard`): about `y = 0.3–1.2 m`
  - Then check each map in the browser against its mockup.
- **Platform tops (`TOPS`) are in game meters.** Don't scale them with `K`, or a grass strip would come out almost 1 m thick. Use these sizes:

  | Top | Spec |
  |---|---|
  | `grass` | A `platformTop` strip `0.14 m` tall |
  | `wheat` | A grass strip `0.12 m` tall, plus the current `drawWheat` made flat: stems `0.025 m` wide in `#b8942c`, heads as ellipses `0.035 × 0.08 m` in `#e0bb45`, every `0.35 m` |
  | `planks` | A strip `0.12 m` tall, plus seam lines in `#5a381c`, `0.025 m` wide, across the face every `0.3 m` down, with short vertical joints staggered every `1.2 m` |
  | `snow` | A snow strip `0.16 m` tall, plus drips: circles of radius `0.06–0.1 m` hanging from the strip's bottom edge every `0.35 m` |
  | `lava` | A strip `0.12 m` tall, plus glowing cracks: zigzag polylines `0.04 m` wide in `#ff7a1a` on the platform face (a few per platform, placed from a deterministic hash of the platform's x) |
  | `metal` | A glow strip `0.07 m` tall, a dark band `0.04 m` under it in the seam color, and vertical seams `0.03 m` wide every `1.2 m` |
  | `soil` | A strip `0.1 m` tall, plus grass tufts (small triangles `0.08–0.14 m` tall) every `0.45 m` |

- **Randomness:** the mockups use a deterministic `rnd(n)`. Keep backdrops deterministic so they don't flicker; seed by index or position. The game's effects can keep using `Math.random()`, since they're per-computer visuals.
- **Time:** the mockups animate with their own `t`. In the game, animated art uses `Date.now() / 1000`, like the existing code does (flames, the black hole, the spark fuse).

---

## 7. The steps

Every step has the same parts: **Goal**, **Files**, **Do**, **Don't**, **Check** and **Hand over**. Use the checklists. In every step, "check in the browser" means everything in section 8.

### Step 0: Get oriented (no code changes)

**Goal:** understand the code and the target, and record a baseline.

**Do:**
- [ ] Read `docs/HANDOFF.md`, `docs/DESIGN.md`, `README.md` and this file.
- [ ] Open `docs/restyle/mockups/style-guide.html` in a browser and read it top to bottom. Skim the other mockups (`docs/restyle/mockups/README.md` says what each is for).
- [ ] Read every file in section 5's table.
- [ ] Run `npx vitest run` and `npm run build`. Both must pass before you start. If they don't, stop and tell the user.
- [ ] Run `git status`. If there's uncommitted work that isn't yours (for example the Landmine gourd), **tell the user and ask them to commit it first**, so the restyle diff stays separate.
- [ ] Take **baseline screenshots**: the main menu, Match Settings, the Esc menu, every built-in map in practice with 3 dummies, a Jack-o'-Boom blast, the map editor and the tuning panel. Save them outside the repo (for example `/tmp/gourd-wars-baseline/`).

**Hand over:** a 3-line summary: tests and build pass, the baseline is taken, and anything odd you noticed. Ask to start step 1.

---

### Step 1: One palette file (no visual change)

**Goal:** move every hard-coded color out of the render code and CSS into one place, **with exactly the same values**, so later steps change the look by editing the palette. The game must look **pixel-identical** afterward.

**Files:**
- New: `src/render/palette.js` and `styles/tokens.css`.
- Edited: every `src/render/*.js` file, `src/ui/editor/editor.js`, `styles/menu.css`, `styles/editor.css`, `styles/tuning.css`, `styles/base.css` and `index.html` (which loads `tokens.css` first).

**Do:**
1. Create `src/render/palette.js` with a header comment. It exports plain frozen objects grouped by what they color, holding the **current** values:
   - `UI`: menu and HUD colors (paper `#f4efe6`, ink `#3b3631` and so on, as the code has them today)
   - `FONT`: the current canvas font stacks
   - `PLAYER`: the eye white, the frozen tint `#cdeefa`, the crown, the jewel, the grapple vine
   - `GOURD`: the stem, the ripeness green and brown, the mark colors (fuse, ice, vine, speckle, stars, crosshair, antenna, string), the glow gold, the flame trail colors, the lock-on, the airstrike target, the black hole
   - `FX`: every color used in `effects.js`, keyed by event name (for example `FX.boom = ['#ff9a2e', …]`, `FX.hit = …`)
   - `LEVEL`: bale, pitchfork, bonfire, scarecrow and cannon colors
   - `CROW`: `INK`, `FAR`, `EDGE` and the rest
   - `PICKUP`: the ring and the bubble
2. Leave **pumpkin type colors in `pumpkinTypes.js`** and **theme colors in `themes.js`**. Those are per-type and per-map data, and they already live in one place each.
3. Replace each literal in the render files with the palette field. Keep the names meaningful (`LEVEL.bale.straw`, not `C17`).
4. Create `styles/tokens.css` with `:root` custom properties for the current menu, editor and tuning colors and fonts (for example `--paper: #f4efe6; --ink: #3b3631; --font-display: 'Luckiest Guy', …`). Make the three stylesheets use `var(--…)`. Link `tokens.css` in `index.html` **before** the other stylesheets.
5. Update the header comments of the files you touched.

**Don't:** change any value. Don't restructure drawing code yet.

**Check:**
- [ ] `grep -rnE "#[0-9a-fA-F]{3,6}\b|rgba?\(" src/render src/ui styles` finds colors only in `palette.js`, `tokens.css`, `themes.js` and `pumpkinTypes.js`. Explain any you leave behind in the hand-over (for example the gradient stops that step 7 removes).
- [ ] `npx vitest run` passes with the **replay unchanged**, and `npm run build` passes.
- [ ] Screenshots match the baseline exactly. Compare each map, the menus, the editor and the tuning panel.

**Hand over:** "**Step 1 done: all colors now live in `palette.js` and `tokens.css`. Nothing looks different.**" Then list the file counts.

---

### Step 2: Fonts (Fredoka in; canvas text on the new fonts)

**Goal:** Luckiest Guy for display and Fredoka for text, everywhere. This step changes only fonts, not colors.

**Files:** `index.html`, `styles/tokens.css`, `styles/menu.css`, `src/render/palette.js` (`FONT`), `src/render/render.js`, `hud.js` and `pickups.js`.

**Do:**
1. In `index.html`, change the Google Fonts link to `family=Luckiest+Guy&family=Fredoka:wght@400;500;600;700&display=swap`.
2. In `tokens.css`, set `--font-display: 'Luckiest Guy', 'Arial Black', Impact, sans-serif;` and `--font-text: 'Fredoka', system-ui, sans-serif;`.
3. In `menu.css`:
   - `#menu`'s base font becomes `500 15px var(--font-text)`.
   - Keep the display font on: the logo, `h1` card titles, buttons, `.code` (the join code), the stepper numbers and the join-code `input`.
   - Switch the text font (Fredoka, 600 weight) on: `.label`, `.toggle-row` labels, `.pk-head`, `.status`, `.version` and `.note`.
   - Toggle pills and segmented buttons are buttons, so they stay in the display font.
4. In `palette.js`:

   ```js
   export const FONT = {
     display: '"Luckiest Guy", "Arial Black", sans-serif',
     text: 'Fredoka, system-ui, sans-serif',
     mono: 'ui-monospace, monospace',
   }
   export const font = (role, px, weight = role === 'text' ? 500 : 400) => `${weight} ${Math.round(px)}px ${FONT[role]}`
   ```

5. Canvas text:
   - Popups (KO! and damage numbers), the banner, scores, the round-info line, `ui.message` and the harvest-key bubble switch to `font('display', …)`.
   - The banner's sub-line ("new match in 3…") switches to `font('text', …)`.
   - Debug lines stay monospace.
6. Make sure the canvas waits for the fonts: in `src/app/app.js` at startup, call `document.fonts.load('400 20px "Luckiest Guy"')` and `document.fonts.load('500 20px Fredoka')`. These are fire-and-forget; the render loop picks the fonts up once they load.

**Don't:** change colors or sizes yet, except where a font swap needs a small size tweak to keep the same visual size. Luckiest Guy runs wider than bold `system-ui`, so check that nothing overflows.

**Check:**
- [ ] Every menu screen (main, host, join, Esc, Match Settings, Controls, Pumpkins, Map Editor list, Import, Export) in the browser. No overflowing text.
- [ ] In game: a damage number (turn Damage Numbers on), KO!, a round banner, the scores at the end of a match, the harvest bubble.
- [ ] Tests and build pass.

**Hand over:** screenshots of the main menu, the Esc menu and an in-game banner. Ask to start step 3.

---

### Step 3: Main palette in the menus (Pumpkin & Bark)

**Goal:** the HTML menus use Pumpkin & Bark (4.1), with a flat backdrop. Reference: the title and Esc screens in `main-palette.html` (pick **Pumpkin & Bark**) and the "Components" section of `style-guide.html`.

**Files:** `styles/tokens.css`, `styles/menu.css`, `index.html`, and `src/ui/menu.js` for the title art.

**Do:**
1. In `tokens.css`, set every 4.1 token as a custom property: `--bark`, `--bark-2`, `--bark-3`, `--ink`, `--ink-edge`, `--paper`, `--paper-edge`, `--muted`, `--muted-on-bark`, `--pumpkin`, `--pumpkin-edge`, `--logo-edge`, `--accent`, `--accent-edge`, `--hit`, `--hit-edge` and `--scrim`.
2. In `menu.css`:
   - `#menu.solid` (outside the game) becomes **flat** `var(--bark)` with no radial gradient.
   - `#menu` over the game uses `var(--scrim)`.
   - The card is `var(--paper)`, `border-radius: 14px`, with a `0 8px 0 var(--paper-edge)` ledge instead of the blurry `box-shadow`.
   - Card titles (`h1`): `pumpkin` with a `logo-edge` stroke and drop (4.1).
   - Buttons use the 4.1 button table. The current `#3b3631`/`#1a1612` dark buttons become `ink`/`ink-edge`, the primary becomes `pumpkin`/`pumpkin-edge`, `.danger` becomes `hit`/`hit-edge`, and `.pk-on.on` becomes `accent`/`accent-edge`.
   - Main-menu buttons on bark are light buttons (`paper` and `ink`); the primary is `pumpkin`.
   - Segmented buttons and the map grid: off is `paper-edge` with `ink` text and a darker ledge; on is `ink` with `paper` text.
   - Inputs and textareas: `paper` background with a `2px var(--paper-edge)` border that turns `pumpkin` on focus.
   - Text colors: `muted` on paper; `muted-on-bark` for the main menu's `.status` and `.version`.
   - Remove the `rgba(0,0,0,0.35)` blurry shadow.
3. **Title art (main menu only)**, matching `drawTitleArt` in `main-palette.html`:
   - Add a `<canvas class="menu-art" aria-hidden="true">` as the first child of `#menu`, filling it (`position: absolute; inset: 0; z-index: 0`). Shown only on `[data-screen=main]`.
   - Draw on it with the **game's own gourd renderer** (import `drawPumpkin` from `src/render/pumpkins.js` once step 6 has made it flat; until then use the current one). Draw:
     - Two `bark2` circles: one centered at 5% from the left and 5% from the top with a radius of 37% of the height; one at 98% from the left and 73% from the top with a radius of 44% of the height.
     - A `bark2` mound: an ellipse centered at 50% from the left and 116% from the top, 60% of the width wide and 25% of the height tall.
     - Four gourds near the bottom corners. Positions are x and y as % of width and height, and r as % of height:
       - Jack-o'-Boom at (12.5%, 85%), r 10.7%
       - Bouncy at (23%, 90%), r 6.5%
       - Classic at (87%, 86%), r 11.3%
       - Bouncy at (76%, 91%), r 6%
   - Redraw on resize. Respect `prefers-reduced-motion` (it's static anyway).
4. The logo keeps its drop-and-wobble animation; only its colors change (`pumpkin` with a `logo-edge` stroke and drop).

**Don't:** touch canvas HUD colors (that's step 4). Don't change the menu layout or behavior.

**Check:**
- [ ] Every menu screen in the browser. Compare the main menu and the Esc menu with `main-palette.html` (Pumpkin & Bark).
- [ ] Hover, active and focus states on buttons.
- [ ] Danger, toggle and segmented states.
- [ ] Phone width (about 400 px): nothing overflows.
- [ ] Tests and build pass.

**Hand over:** screenshots of the main menu, Match Settings and the Esc menu over a game. Ask to start step 4.

---

### Step 4: HUD and in-game text on the main palette

**Goal:** everything drawn over the game uses Pumpkin & Bark and **sits on paper**, so it reads on every map. Reference: the "fight", "round" and "pause" screens in `main-palette.html`, and "Components" in `style-guide.html`.

**Files:** `src/render/hud.js`, `render.js`, `pickups.js` and `palette.js` (`UI` gets the 4.1 values).

**Do:**
1. Set `UI` in `palette.js` to the 4.1 values.
2. Add small drawing helpers in `hud.js` (or a new `src/render/ui.js` if they're shared; give it a header comment). Sizes are in meters, times `s`:
   - **`chip(text, x, y)`:** a `paper` pill with a `0.07 m` `paperEdge` ledge under it and `ink` text in Luckiest Guy `0.4 m` (letter-spacing ≈ 0.04em; draw it letter by letter, or skip the spacing if that's simpler). Padding: `0.28 m` on the sides, `0.12 m` top and bottom.
   - **`outlinedText(text, x, y, fill, size, outline = UI.paper)`:** a stroke `0.14em` wide in the outline color (`lineJoin: 'round'`), then the fill.
   - **`bannerText(text, x, y, fill, size)`:** a drop copy offset `0.07em` down in `logoEdge`, then a `logoEdge` stroke `0.16em` wide (`lineJoin: 'round'`), then the fill.
   - **`tile(text, x, y, color)`:** a `paper` rounded square (corner radius `0.2 m`) with a `0.08 m` `paperEdge` ledge and the number in Luckiest Guy `0.7 m` in `color`.
3. Apply them:
   - **Match info** (`matchInfoText`, at `Y(16.1)`) and the outside-a-match `ui.hud` text both become a `chip`.
   - **The banner** ("Blue wins!", "Draw!", "X wins the match!") uses `bannerText` in the winner's color (Draw: `pumpkin`) at the current size and position. The sub-line ("new match in 3…") is Fredoka 600 in `paper` with an `ink` outline.
   - **Scores** (`drawScores`) become `tile`s in a row with a `0.25 m` gap, at the same heights as now.
   - **Damage numbers** use `outlinedText` in `UI.hit`, Luckiest Guy.
   - **KO!** uses `bannerText` in `UI.pumpkin`.
   - Popups with no color use `UI.ink` with a paper outline, instead of `theme.ink`.
   - **`ui.message`** becomes a `chip`.
   - **The harvest-key bubble** (`pickups.js`): an `ink` pill with `paper` Luckiest Guy text. Its ring stays an `ink` stroke, since the ring is the UI.
   - **The crosshair** stays as is (it's UI).
4. The HUD **no longer reads `theme.ink`, `theme.muted` or `theme.sky`.** `ui.theme` is still set in `render.js`, because other code may use it, but HUD colors come from `UI`.

**Don't:** change positions or font sizes beyond what the chips need. Don't touch the art.

**Check:**
- [ ] On **every built-in map**: a match in progress (the chip), damage numbers, a KO!, a round win (banner and scores), a match win (banner, sub-line and tiles). Everything must be readable on light maps (Plain, Midday) and dark ones (Night).
- [ ] Practice mode (the outside-a-match HUD text), the harvest bubble, the editor (no HUD; its overlay is unchanged).
- [ ] Tests and build pass.

**Hand over:** screenshots of the end of a round on The Patch and on Bonfire Camp. Ask to start step 5.

---

### Step 5: The shading engine, plus players

**Goal:** the two-tone shading module, used first on players. Players also switch to the Bright colors and the flat figure (4.4). Reference: `thing` and `layerPass`, `playerBody`, `playerEyes`, and the shading demo in `style-guide.html`.

**Files:** new `src/render/shading.js`; edited `src/render/players.js`, `src/config.js` (`PLAYER_COLORS`), `palette.js`, `src/ui/tuning.js` (a debug toggle) and `tests/__snapshots__/replay.json` (re-recorded; see below).

**Do:**
1. **`src/render/shading.js`**, a deep module with a narrow interface. Write a header comment explaining the technique (4.3).

   ```js
   // drawShaded(ctx, { silhouette, draw, details, box, shift, tint, dir })
   //   silhouette(c, fill): draws the whole shape in one color on context c (same coordinates as ctx)
   //   draw(c):             draws it for real (on ctx)
   //   details(c):          optional; drawn on top after shading (eyes, marks)
   //   box: [x0, y0, x1, y1] in ctx's current user space (CSS px): the shape plus some margin
   //   shift: px toward the light; tint: the theme's shade color; dir: [x, y] (default LIGHT)
   export function drawShaded(ctx, opts) { … }
   export const LIGHT = …
   export function setShadingEnabled(on) { … }   // a debug switch (tuning panel)
   ```

   **Implementation notes:**
   - Keep one module-level offscreen `<canvas>`. Grow it to `ctx.canvas.width` × `ctx.canvas.height` when it's smaller.
   - Get `T = ctx.getTransform()`. It includes the DPR and the shake translate. Convert `box` to device pixels with `T`, then clamp it to the canvas and skip it if empty.
   - On the layer: `setTransform(1,0,0,1,0,0)`, clip to the device box, `clearRect` it, then `setTransform(T)`. Call `silhouette(layer, tint)`, then `globalCompositeOperation = 'destination-out'`, then `translate(-shift·dir[0], -shift·dir[1])`, then `silhouette(layer, '#000')`. Restore the layer's state.
   - On `ctx`: `save()`, `setTransform(1,0,0,1,0,0)`, `globalCompositeOperation = 'multiply'`, and keep the caller's `globalAlpha`, so semi-transparent drawings such as the spin blur shade correctly. Then `drawImage(layer, box…, box…)` and `restore()`.
   - Order: `draw(ctx)`, then the shading pass, then `details(ctx)`.
   - When shading is disabled, call `draw` and `details` only.
   - `render()` clips to the arena; keep that clip while compositing (don't reset the clip; only `setTransform`).
2. **Debug toggle:** add a "Shading" on/off checkbox to the tuning panel (`src/ui/tuning.js`) that calls `setShadingEnabled`, defaulting to on. You'll use it for performance checks.
3. **Players** (`drawPlayer` in `players.js`), following 4.4:
   - Replace the limb loop with: back limbs (darker), then the torso, then the front limbs, using round caps and joins.
   - The head and eye as specified. Put the eye, pupil and X eyes in `details`.
   - `silhouette` draws all limbs plus the head in one fill. `box` is the bounding box of all the part endpoints and the head, plus `0.3 m`. `shift` is `0.04·s`. `tint` is `theme.shade`. **Pass the theme in:** `render.js` already has `theme`, so add it to `drawPlayer`'s arguments.
   - **Until step 9 adds `theme.shade`**, fall back to a neutral tint (`'#d6cfc4'`) when the theme has no `shade`, and note the fallback in a comment.
   - States: frozen (no white stroke; the tint mix plus two white diamonds), glued and floating as in 4.4. Floating uses `drawPumpkin` for the balloon. The crown is flat and shaded (`silhouette` is its polygon; `details` is the jewel). Dizzy stars are flat fills (in `crows.js`: remove the stroke from `star()`'s use there).
   - **The sight dots** (`drawSight`): replace the dark stroked edge with a `paper` disc `0.095 m` across under each `0.075 m` colored dot (HUD on paper). Keep the alpha fade.
   - **Contact shadows:** for each living, non-ragdolled player, find the highest platform top (from `map.platforms` and the current mover positions) whose x range contains the player's lowest foot, within `0.12 m` below it. Draw a `theme.shadow` ellipse there (`0.6 × 0.09 m`, centered under the hip x) **before** the players are drawn. Put this in a small helper in `players.js` called from `render.js`.
4. **Player colors:** set `PLAYER_COLORS = ['#1f8bff', '#ff3d5e', '#16c46c', '#ffc21a']` in `src/config.js`. Then update `docs/DESIGN.md`'s note that players are never orange; that's still true.
5. **Re-recording the replay.** The colors are in snapshots, so the replay test will fail. Prove that's the only reason:
   - (a) Temporarily put the old colors back. `npx vitest run` must pass.
   - (b) Put the new colors back. Run `npx vitest run -u` to re-record `tests/__snapshots__/replay.json`.
   - (c) Run `npx vitest run` again; it must pass. Mention this in the hand-over.

**Don't:** shade anything other than players yet. Don't change limb widths, part positions or the head radius.

**Check:**
- [ ] Practice with 3 dummies on every map: shading on the bottom-right side, back limbs darker, eyes facing the right way, X eyes on a ragdolled player, the crown on the leader, frozen (a Frost hit), glued (a Splat Pie hit), floating (a Balloon Gourd hit), dizzy (a Dizzy Gourd hit), pecked (a crow).
- [ ] Turn shading off and on in the tuning panel.
- [ ] Compare against the `style-guide.html` hero.
- [ ] **Performance:** with 4 players, check the frame time (the browser's Performance panel or `ui.fps`) with shading on and off. Note both numbers in the hand-over.
- [ ] Tests (re-recorded as above) and build pass.

**Hand over:** screenshots of players on The Patch and on Bonfire Camp, the frame-time numbers, and a note that the replay was re-recorded because the colors changed (the proof is step 5's (a)–(c)). Ask to start step 6.

---

### Step 6: Gourds

**Goal:** every gourd drawn flat, with two-tone shading, matching 4.6 and the `BODY`/`MARK` code in `style-guide.html`. Includes the three new designs (spark fuse, fluted pie, rocket), the two color changes, and patches, held gourds, in-flight extras and traps.

**Files:** `src/render/pumpkins.js` (most of the work), `src/game/pumpkinTypes.js` (Homing and Dizzy colors, plus their field docs), `palette.js` (`GOURD`), and `tests/__snapshots__/replay.json` if the hash changes.

**Do:**
1. **The round body:** replace `roundPumpkin` with the flat `lobed` shape. Its parameters (`w`, `h`, `wide`, `stem`) cover the current `{ w, h, ribs, stem }` options:
   - The default stays about `1.08 × 1` r wide.
   - Big Gourd uses `wide` (4 lobes, `w = 1.12`, `h = 0.95`).
   - Homing uses no stem.
   - The stem is a rounded rect in `#4f8a34` plus a leaf ellipse in `#76b046`. The leaf is a detail.
2. **`BODIES`:** port each to flat fills, as in 4.6 (`seed`, `boomerang`, `saw`, `bottle`, `mine`, `chomper`, `cluster`, `pie` (now `pieFluted`), `gourd`, `antenna` (now `rocket`)). `crow` keeps delegating to `crows.js`. The mark names in `pumpkinTypes.js` stay the same (`pie`, `antenna`, …); only what they draw changes.
3. **`MARKS`:** port each (`bands`, `fuse` (the **spark** version, animated with `Date.now()`: the star rotation is `t·6`, the size flickers `±15%` at about 12 Hz, and the spark lines alternate), `ice`, `vine`, `speckle`, `stars`, `crosshair`, `antenna` (the tip blinks as now), `string`). Marks are `details`, drawn after shading.
4. **`drawPumpkin(ctx, x, y, r, angle, colors, mark, shade)`:** add one optional argument, the shade tint. When it's given, draw through `drawShaded` with `shift = 0.2·r` and `box = ±2.2r` around the center; when it isn't, draw flat. Callers pass `theme.shade`. Thread it through `drawFlyingPumpkin`, `drawHeldPumpkin`, `drawPatches`, `drawTrap`, the bale's balloon and the player's floating balloon. Keep the interface narrow: one tint value.
5. **Patches:**
   - Leaves are flat `#4c7a2a` ellipses, as now.
   - **The special glow** loses its radial gradient. Draw two concentric translucent discs in the type color instead: radius `r + 0.6 m` at alpha `0.18·pulse` and radius `r + 0.3 m` at alpha `0.28·pulse`.
   - **The Super Rare glow:** the same idea in gold `#ffd54a` (plus the type color at the heart), with the four sparkles kept as flat fills.
6. **In flight:**
   - The spin blur stays (alpha copies).
   - The flame trail is already flat discs; keep it.
   - The vine trail stays as a stroke.
   - Held cracks (Big Gourd) become thin lines in the rib mixed 40% toward black.
7. **Traps:**
   - The planted **Chomper** (`chomperShape` with `open` from 0 to 1) is redrawn flat to match the shut `BODY.chomper` look: rind lobes from fills instead of rib strokes, warts as fills, teeth as flat cream triangles with no stroke, and the red mouth as a flat fill. Keep the exact geometry of the halves and hinge so the open animation still lines up.
   - The planted **Landmine:** the dirt mound is a flat `#6b4f32` fill; the light blinks `#ff3b2a` with a flat translucent `rgba(255,70,50,0.35)` disc instead of a gradient.
8. **Colors:** set Homing to `#4f7fc4` / `#2f5590` and Dizzy Gourd to `#a8693a` / `#6e4220` in `pumpkinTypes.js`. **Replay:** pop events carry type colors. If the replay hash changes, do the same proof as in step 5 (old colors pass, then re-record).
9. **Don't change radii.** Every shape stays inside its current footprint, which is about `1.15·r`, except fuses, stems, strings and antennas, which stick out as now.

**Check:**
- [ ] Use Match Settings → **Pumpkins** to enable one type at a time with a high rarity, and check each type: on its patch (unripe, ripe, rotten), held, charging (it grows), thrown (the spin blur and flame trail), and broken (the splat).
- [ ] Planted Chomper (opening, biting) and Landmine (sinking, blinking).
- [ ] A Super Rare.
- [ ] Compare with `gourds.html` and the "Gourds" section of `style-guide.html`.
- [ ] Performance with about 10 gourds in the air: frame time with shading on and off.
- [ ] Tests and build pass (re-recorded if needed, with proof).

**Hand over:** a screenshot of all patches in practice (enable every type), plus close-ups of the rocket, the fluted pie and the spark fuse. Ask to start step 7.

---

### Step 7: Effects

**Goal:** blasts, splats and particles in the flat style: the puff cloud from the mockups, flat shards, no fading blobs, and no gradients anywhere.

**Files:** `src/render/effects.js`, `render.js` (drawing particles, rings and the new clouds), `pumpkins.js` (black hole, airstrike target, lock-on), `level.js` (the bonfire glow) and `palette.js`.

**Do:**
1. **The blast cloud** (Jack-o'-Boom, Airdrop, Landmine, chain reactions: every `boom` event). Port `puffsAt` from `style-guide.html`.
   - Add `clouds: []` to `createEffects()`. On `boom`, push `{ x, y, r: ev.r, age: 0, life: 1.6, puffs }`.
   - `puffs` holds 11 entries, built like `PUFFS` in the mockup but with `Math.random()`: the first puff is at the center with `hot = 1`; the others get a random angle, `d = 0.15 + rand·0.45`, `r = 0.22 + rand·0.2`, and `hot = 1 − 0.6·rand`.
   - **Scale:** multiply every mockup distance and radius by `k = ev.r / 1.25`. Jack-o'-Boom (2.5 m) gets ×2 and the Airdrop (5 m) gets ×4. Check it with the user; it's a starting point.
   - Draw it with `puffsAt`'s math, where `a` is the cloud's age: each puff's color comes from its heat (Hot, Warm, Cool, then `theme.smoke`), as **flat circles, no alpha**, sorted coolest first.
   - **The flash:** for the first 0.35 s, a filled white disc at alpha `(1 − a/0.35)·0.8` with radius `lerp(0.15·k, 1.15·k, √(a/0.35))` m. It replaces the orange stroked ring for `boom` (other ring events keep their rings).
   - Keep the `boom` burst particles, but restyle them as below.
2. **Particles:**
   - Stop fading with `globalAlpha`; instead **shrink**: the radius becomes `r·(1 − age/life)^0.6`.
   - **Splat chunks** (the non-seed particles of `splat`) get `shape: 'chunk'` and a random `spin`, and are drawn with the mockup's `chunk()` polygon (5 points, deterministic per particle from a stored seed) rotated by `spin·age`. Seeds stay small ellipses.
   - Other events keep their colors and circles (with shrinking), plus `pierce` chips as chunks.
3. **Rings** (collapse and others): keep the strokes but drop the `+1` minimum alpha pop; the fade is fine.
4. **The black hole** (`drawBlackHole`): replace the radial-gradient halo with flat discs: white at radius `1.35r` and alpha 0.35, then white at `1.15r` and alpha 0.9, then the black core. Keep the streaking specks (strokes are fine; they're motion lines).
5. **The bonfire glow** (`level.js`): replace the radial gradient with three translucent discs: `rgba(255,160,60,0.10)` at `1.6 m`, `0.12` at `1.1 m` and `0.14` at `0.7 m`.
6. **The airstrike target, lock-on and crosshair:** unchanged (they're UI), except that colors come from `palette.js`.
7. **Popups:** already handled in step 4.

**Check:**
- [ ] Jack-o'-Boom on The Patch and on Bonfire Camp: compare with the `style-guide.html` hero (the puffs pop out, cool down, turn to the map's smoke and drift up).
- [ ] Airstrike (the big blast), Landmine, chained mines, Classic splats, a Buzzsaw cutting through someone, a Black Hole, the bonfire, Frost, a Chomper snap.
- [ ] `grep -rn "Gradient" src/render` finds **nothing**.
- [ ] Performance during a big blast.
- [ ] Tests and build pass (the replay is unchanged; effects aren't in snapshots).

**Hand over:** a short screen recording or 3 screenshots of a Jack-o'-Boom sequence, plus a note that the cloud scale `k` is a starting point the user can tune. Ask to start step 8.

---

### Step 8: Level pieces and crows

**Goal:** bales, pitchforks, the bonfire, the scarecrow, cannons, crows, feathers, the grapple vine and the pickup ring, all flat and shaded where they're objects. There are no mockups for these, so **apply the rules (section 3)** and show the user before finishing.

**Files:** `src/render/level.js`, `crows.js` and `palette.js`.

**Do:**
1. **Bale:**
   - A flat straw box (`#e2b84a`) with no stroke, shaded with `drawShaded` (shift `0.05 m`).
   - The straw lines become 2–3 thin darker **filled** bands (`#c9982f`, `0.03 m`).
   - The twine is two filled `#8a5a2b` bands, `0.05 m` wide.
   - Damage cracks become dark filled wedges (`#6b4a1f`) instead of strokes.
   - **Frozen:** an icy overlay (`rgba(190,232,250,0.6)`) plus a flat white frost cap across the top with 3–4 drips, like the Frost gourd's look; no white stroke.
   - **Sticky:** goo blobs as now.
   - **Floating:** the balloon as now, with the new gourd renderer.
2. **Pitchforks:** a flat wooden bar (`#6b4a2b`) and flat steel tines (`#a3a9ae`) with no strokes. Shade the bar and tines with `drawShaded` as one silhouette (shift `0.04 m`).
3. **Bonfire:**
   - The logs are flat fills, shaded.
   - The glow comes from step 7.
   - The flames are already flat; keep them. Use the blast colors: `#e2481b` outer, `#ff9a2e` middle, `#ffe08a` core.
4. **Scarecrow:**
   - A flat pole, burlap body, head and hat with no strokes, shaded as one silhouette.
   - The blade is flat steel (`#c9ced2`) with no stroke and a darker `#9aa1a6` back edge band, shaded.
   - The hub is flat.
5. **Cannon:** already mostly flat. Remove any strokes, shade the mount and barrel (as separate silhouettes), and keep the orange muzzle ring and fuse sparks. Reuse the gourd spark-burst look for the fuse.
6. **Crows** (`crows.js`):
   - Remove the `EDGE` strokes. Make the body, wings, head and legs flat fills: `INK` for the near side and `FAR` for the far wing.
   - The beak split becomes a thin filled wedge, not a stroke.
   - The eye stays white and dark.
   - No two-tone on crows (they're near-black, so the shading wouldn't show and would cost frame time).
   - The pecking crow, the flying-off birds and feathers: flat fills. Each feather's quill can stay a thin stroke (that stroke is the shape).
7. **The grapple vine and the pickup ring:** strokes are fine (thin lines are the shape). Colors come from the palette.
8. **Mover rails:** keep the dashed rail and bolts in `theme.muted`.

**Check:**
- [ ] Hay Loft (bales: damaged, frozen, sticky, floating), Pitchfork Pit, Bonfire Camp, Scarecrow Field, and Testing Grounds (everything, including cannons).
- [ ] Crows: flying, knocked down, held, thrown, pecking, flying off.
- [ ] Screenshots to the user before calling the step done (no mockups exist for these). Ask if anything should change.
- [ ] Tests and build pass.

**Hand over:** screenshots of Testing Grounds and Hay Loft, plus a crow close-up. Ask to start step 9.

---

### Step 9: Map themes, part 1: the new theme schema, the backdrop renderer, and the 6 existing maps

**Goal:** the 6 existing themes drawn exactly like their picked mockup colorways (4.5), with the new theme schema, flat skies and cached backdrops.

**Files:** `src/maps/themes.js`, `src/render/scenery.js` (a rewrite), `render.js` (passing the theme), `src/ui/editor/editor.js` (its uses of `theme.sky[1]` and other changed fields), and `tests/mapData.test.js` (new checks).

**Do:**
1. **`themes.js`:** rewrite the 6 entries with the 4.5 schema and values. Keep the keys. `paper` gets `name: 'Midday'`; the others keep their names. Document every field in the header comment. Then search the code for every use of the old fields (`theme.sky[0]`, `theme.sky[1]`, …) and update each one. The editor's `theme.sky[1]` stroke becomes `theme.bands ? theme.bands.at(-1) : theme.sky`, or better, a `skyColor(theme)` helper.
2. **`scenery.js`:** rewrite `drawMapBase` as follows.
   - **`drawSky`:** a flat `sky`, or flat `bands`, over the arena rectangle. No gradient.
   - **`SCENERY`:** a handler map, by `theme.scenery`, porting `hills`, `barn`, `field`, `rocks`, `camp` and `lab` (as `grid`) from `style-guide.html`. Run them through `mockView` (section 6), using `drawShaded` for the shaded pieces (hills sideways `[1, 0]` with a mockup shift of `0.16`, and props) with `theme.shade`.
   - **Grid:** draw it in game meters, with thin lines every 1 m at `theme.art.grid` and thicker ones every 4 m. Don't use `mockView` for it.
   - **`TOPS`:** a handler map by `theme.top`, in game meters (section 6's table). `drawPlatform` draws the body in `platform` (or `wall`), then `TOPS[theme.top]`. Walls get no top.
   - **`ANIMATED`:** a handler map for scenery that moves and must be drawn every frame. None of these 6 themes need one, so create the map empty. Step 10 adds snow, embers, lava waves, the synth grid and fog.
3. **Backdrop cache:** drawing scenery with shading every frame is wasteful because it doesn't move.
   - Cache `drawSky` + `SCENERY` into an offscreen canvas per `(theme key, arena size in device px, s)`.
   - In `drawMapBase`, `drawImage` the cache at the arena position, then draw `ANIMATED`, platforms, movers, pitchforks and bonfire logs live.
   - Rebuild the cache on resize and theme change.
   - During a map transition, both maps' caches are drawn, the old one offset by `MAP_SHIFT`. Make sure the cache is drawn through `X()` so the pan still works.
   - Keep the cache code inside `scenery.js` (information hiding).
4. **Wheat** (`field`): the flat `drawWheat` via the `wheat` top.
5. **Everything shaded reads its tint from the theme.** Remove the step 5 fallback tint once every theme has `shade`.
6. **Tests** (`tests/mapData.test.js`): every theme has the required fields with valid colors; `sanitizeMap` keeps a known theme key and still falls back to `paper` for an unknown one.

**Check:**
- [ ] Each of the 6 built-in maps next to its mockup colorway in `style-guide.html` (The Patch = Midday, Hay Loft = Pine wood, Scarecrow Field = Golden hour, Pitchfork Pit = Lavender, Bonfire Camp = Midnight blue, Testing Grounds = Graph paper). The composition should match the mockup scaled to 32 m, and the platforms should read clearly in front.
- [ ] A map transition (finish a round in a match with map rotation on): the pan stays smooth and both backdrops show.
- [ ] Resize the window: the cache rebuilds and nothing is stretched.
- [ ] Frame time is the same or better than before this step (thanks to the cache).
- [ ] The editor still works (theme dropdown, grid, previews).
- [ ] Tests and build pass.

**Hand over:** a screenshot of each of the 6 maps. Ask the user whether any composition needs adjusting before step 10.

---

### Step 10: Map themes, part 2: Winter, Lava, Synthwave and Graveyard (themes only)

**Goal:** 4 new themes the map editor can pick, drawn like their mockups. **No new built-in levels.**

**Files:** `src/maps/themes.js`, `src/render/scenery.js`, `tests/mapData.test.js`, `README.md` and `docs/DESIGN.md`.

**Do:**
1. Add `winter`, `lava`, `synthwave` and `graveyard` to `THEMES` with the 4.5 values.
2. Port `SCENERY.winter`, `lava`, `synth` and `graveyard` from `style-guide.html` through `mockView`, except the ground-level pieces in section 6:
   - **The lava sea:** its top at `y ≈ 1.2 m`, filling the arena width down to the bottom, with crests every `1.7 m` drifting at `0.3 m/s`. It's animated, so draw it in `ANIMATED`.
   - **The synth grid floor:** the horizon at `y ≈ 3 m`. The grid lines run to the bottom of the view, and the horizontal lines scroll toward the viewer. It's animated.
   - **The graveyard fog:** a band from about `y = 0.3` to `1.2 m` with bumps, drifting `±0.6 m` slowly. It's animated, drawn behind the platforms.
3. **`ANIMATED`** (drawn every frame, after the cached backdrop):
   - Winter: falling snow, port `FRONT.winter`. Draw it **in front of everything** at the end of the frame, using about 140 flakes across 32 m.
   - Lava: embers, port `FRONT.lava`, also in front, using about 70 embers; plus the lava sea and the crater smoke.
   - Synthwave: the grid floor.
   - Graveyard: the fog.
   - Add a "front" hook in `render.js` that calls `drawWeather(ctx, theme, X, Y, s)` (exported from `scenery.js`) after the effects and before the HUD.
4. Add the new `TOPS`: `snow`, `lava`, `metal` and `soil`.
5. Make sure the editor's theme dropdown lists the new themes (it's built from `THEMES`) and that a custom map saved with one loads correctly. Add tests for the new keys in `sanitizeMap`.
6. Document the new themes in `docs/DESIGN.md` (the Maps section) and the new fields in `themes.js`'s header.

**Check:**
- [ ] For each new theme: open the map editor, make a quick test map with a few platforms and a pit, set the theme, play it, and compare with `style-guide.html`.
- [ ] Gourds and players read clearly on each one (this feeds step 13).
- [ ] Frame time with snow or embers running.
- [ ] Tests and build pass.

**Hand over:** screenshots of the 4 new themes in a test map. Ask to start step 11.

---

### Step 11: Map editor

**Goal:** the editor's UI in Pumpkin & Bark with the new fonts. The editor's arena already uses the game renderer, so it picks up steps 5–10 automatically.

**Files:** `styles/editor.css` and `src/ui/editor/editor.js` (its canvas overlay colors).

**Do:**
- **Bars and panels:** `bark` / `bark2` backgrounds; the line between them is `bark3` (a flat 1 px edge, no shadow).
- **Text:** Fredoka 500 13 px in `paper`. Labels are in `muted-on-bark`. Section headings (`h3`) are Fredoka 600, uppercase, in `pumpkin`, letter-spaced `0.06em`.
- **Buttons** (compact, so they stay square-ish and small):
  - `bark3` with `paper` text, `border-radius: 8px`, and a `0 2px 0 var(--ink-edge)` ledge
  - `.on`: `pumpkin` with `ink` text and a `pumpkin-edge` ledge
  - `.primary`: `pumpkin` with white text
  - `.danger`: `hit` with a `hit-edge` ledge
  - Disabled: `opacity: 0.4`
- **Inputs and selects:** a `bark` fill with a `bark3` border that turns `pumpkin` on focus.
- **Canvas overlay** (`editor.js`): the grid uses `theme.ink` at the current alphas (fine with the new per-theme `ink`). The selection, markers and handles use the `UI` colors (`pumpkin` for the selection, `paper` with an `ink` edge for handles). Remove strokes only where they edge a filled shape; handles and guides are UI, so they keep their strokes.

**Check:**
- [ ] Every editor tool, the panel, saving and loading, import and export, on a light theme and a dark theme.
- [ ] Tests and build pass.

**Hand over:** screenshots of the editor. Ask to start step 12.

---

### Step 12: Tuning panel

**Goal:** the debug and tuning panel in Pumpkin & Bark with Fredoka. Only the user sees it, so keep it compact and plain.

**Files:** `styles/tuning.css`.

**Do:**
- A `bark2` panel; tabs in `bark3`; the active tab in `pumpkin` with `ink` text.
- The "changed" marker: an inset bottom border in `#ffcf6e`, or `pumpkin` mixed toward paper.
- Group dividers: `bark3`.
- Text: Fredoka 500 12 px in `paper`, labels in `muted-on-bark`, numbers in `ui-monospace`.
- Sliders: `accent-color: var(--pumpkin)`.
- Check the new "Shading" toggle from step 5 is here and works.

**Check:**
- [ ] Every tab and control.
- [ ] Tests and build pass.

**Hand over:** a screenshot. Ask to start step 13.

---

### Step 13: Open issues (mock up fixes, then ask)

**Goal:** fix the two known contrast problems. **The user decides.** Make options, show them, and wait.

1. **Dark gourds on dark maps.** Landmine and Black Hole are hard to see on Lava, Bonfire Camp, Synthwave and Graveyard. The user kept their designs (they turned down a hazard band and a swirl with a glow), so the fix must not change the designs. Mock up 3 options in the game (behind a temporary debug toggle, or as screenshots):
   - (a) A faint flat halo disc behind dark gourds, only on dark themes: the theme's `ink`, which is light on dark maps, at alpha 0.25, radius `1.35r`.
   - (b) A lighter rib or lobe color on dark themes only.
   - (c) A thin paper rim, which bends the no-outline rule, so ask about it explicitly.

   Show each option on all 4 dark maps, at game size and zoomed in. **Ask the user to pick one, or none.**
2. **Orange gourds on warm maps.** Scarecrow Field (Golden hour) and Lava (Inferno). Play a few rounds and screenshot gourds in the air against the sky bands and the lava. If they blend in, mock up options: (a) slightly cooler or desaturated sky bands where the gourds fly, (b) the same faint halo as above, or (c) leave it. **Ask.**
3. Implement only what the user picks.

**Hand over:** the options as screenshots, plus a clear question. Then stop.

---

### Step 14: Final pass

**Goal:** clean up, measure, document and hand over.

**Do:**
- [ ] `grep` for leftover hard-coded colors outside `palette.js`, `tokens.css`, `themes.js` and `pumpkinTypes.js`, for `Gradient`, and for strokes that outline filled shapes. Fix or explain each.
- [ ] Remove dead code: the old `roundPumpkin` rib strokes, `drawWheat`'s old version, unused palette entries, the step 5 fallback tint.
- [ ] **Performance:** record the frame time in a busy scene (4 players, about 10 gourds, a blast, snow) with shading on and off. If the render takes more than about 4 ms per frame on the user's machine, tell the user and suggest skipping shading on particles or small gourds when the frame time is high.
- [ ] **Docs:**
  - `docs/DESIGN.md` **Look** section: replace it with a short summary of the new style (section 3), the main palette, the fonts, and a pointer to `docs/restyle/mockups/style-guide.html`.
  - `README.md`: the file map (`palette.js`, `shading.js`, `tokens.css`, `docs/restyle/`).
  - `docs/HANDOFF.md`: a "Restyle: done" section listing what changed and where.
  - Every touched file's header comment.
- [ ] Full checklist in the browser (section 8) on every map and theme.
- [ ] Tests and build pass.

**Hand over:** a short summary (what changed, the performance numbers, any parked items), plus side-by-side screenshots of before (the step 0 baseline) and after for 3 maps and the main menu.

---

## 8. How to check your work in the browser

- **Run:** `npm run dev`, open the URL Vite prints (Chrome), and use Chrome DevTools or your browser tools for screenshots, the console and performance.
- **Practice:** main menu → **Practice**. Esc → **Settings** → **Practice Map** switches maps, and **Practice Dummies** adds dummies (use 3).
- **One gourd type at a time:** Esc → Settings → **Pumpkins**. Turn everything off except the type you're checking, and set its rarity high.
- **Damage numbers:** Esc → Settings → **Damage Numbers** on.
- **Debug mode and the tuning panel:** press **`** (backquote). Debug mode also turns on testing keys (see `src/app/controls.js`, for example **T** sends a crow). After step 5, the tuning panel has the Shading toggle.
- **A match with rounds and transitions:** **Host Game** → **Play vs Dummies While Waiting**, with map rotation on (Match Settings).
- **The map editor:** main menu → **Map Editor**. Make a map, set its theme, and press Play.
- **Every step:** check the console for errors, try a light map and a dark map, and try resizing the window.

---

## 9. Done means

- [ ] Every item in section 4 is implemented and matches `style-guide.html`.
- [ ] There are no gradients, no outlines on filled shapes and no shine anywhere in the render code or the CSS.
- [ ] All 10 themes can be picked in the editor; the 6 built-in maps use their picked colorways.
- [ ] The menus, HUD, map editor and tuning panel use Pumpkin & Bark with Luckiest Guy and Fredoka.
- [ ] The open issues are resolved the way the user chose in step 13.
- [ ] Gameplay is unchanged. The replay test passes, and was re-recorded only for color changes, with proof.
- [ ] `npx vitest run` and `npm run build` pass.
- [ ] The docs are updated (step 14).
- [ ] Nothing has been committed. The user reviews and commits.
