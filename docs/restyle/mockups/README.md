# Restyle mockups (reference only)

These are the browser mockups made during the art-direction session on 2026-11-09. They are **reference material, not game code**. Open any of them straight in a browser (double-click). Everything is drawn on `<canvas>` by the inline script at the bottom of each file.

The plan that uses them is `docs/RESTYLE_PLAN.md`.

| File | What it shows | Use it for |
|---|---|---|
| `style-guide.html` | **The final look.** Every decision: rules, main palette, player and blast colors, two-tone shading, type, UI components, all 10 maps, all 18 gourds. | **The master reference.** If two files disagree, this one wins. |
| `look-builder.html` | The chaos scene with switchable palette, players, shading, shapes, blast and background. | Seeing the picked options next to the ones that were turned down. |
| `main-palette.html` | Four main-palette options on a title screen, a fight HUD, the Esc menu and the end of a round. The user picked **Pumpkin & Bark**. | Exact proportions of the title screen, HUD chip, Esc menu card, banner and score tiles (the `.g-*` CSS). |
| `map-themes.html` | All map themes with A/B colorways, plus the Futuristic options. | The scenery code for every map (`SCENERY`, `TOPS`, `FRONT`). |
| `gourds.html` | Gourd design choices (round 3): the fluted Splat Pie, redesign pitches and the game-size check on every map. | Gourd shapes and marks at real game size. |
| `fonts.html` | Display font and text font pickers. The user picked **Luckiest Guy** (display) and **Fredoka** (text). | Font sizes and weights on each screen. |

## Where things are in `style-guide.html`

Search by name. The line numbers are approximate.

| Name | ~Line | What it is |
|---|---|---|
| `LIGHT`, `layerPass`, `thing` | 401–430 | **The two-tone shading engine.** The silhouette minus a copy shifted toward the light, multiplied with a tint, done on one offscreen layer, clipped to a bounding box. |
| `scene`, `puffsAt`, `chunk` | 349–400 | The animated test scene. `puffsAt(a)` is the **blast cloud** (11 puffs that pop out, cool from hot to smoke and drift up). `chunk` is an irregular pumpkin shard. |
| `PUMPKIN_FORMS`, `pumpkin` | 432–458 | The basic flat lobed pumpkin (`rounded`). |
| `playerBody`, `playerEyes` | 460–500 | **The flat stick figure**: back limbs darker, round caps, the eye with a pupil, X eyes when stunned. |
| `hill`, `cloud` | 505–540 | Shaded hills (shaded sideways only) and flat clouds. |
| `BLASTS.puffs` | 587+ | The picked blast: white flash disc plus heat-colored puffs. |
| `THEMES` (map themes) | 669+ | Every map palette, both colorways. The picks are in `PICKED_MAPS` near the bottom. |
| `pine`, `moon`, `stars`, `wave`, `polyT`, `rectT` | 740–777 | Scenery helpers. |
| `SCENERY` | 778+ | One drawing function per scenery: `hills`, `barn`, `field`, `rocks`, `camp`, `lab` (grid), `winter`, `lava`, `synth`, `graveyard` (`future` and `plab` are unused rejects). |
| `FRONT` | 951+ | Weather drawn over everything: `winter` (snow) and `lava` (embers). |
| `TOPS` | 968+ | Platform tops: `grass`, `wheat`, `snow`, `lava`, `metal`, `planks`, `hazard` (unused), `soil`. |
| `renderTheme` | 1015+ | The draw order for one frame of a map. |
| `lobed`, `BODY`, `MARK` | 1043–1180 | **Every gourd shape** (`BODY`) and decoration (`MARK`), in flat form. |
| `MARK.fuse`, `BODY.pieFluted`, `BODY.rocket` | 1183–1270 | The three new gourd designs: the spark fuse, the fluted pie and the Homing rocket. |
| `drawGourd` | 1285+ | Draws one gourd with two-tone shading. |
| `MAIN`, `PLAYERS`, `FX`, `PICKED_MAPS`, `FINAL_GOURDS` | 1298+ | **The final picks as data.** |

## Units in the mockups

The mockup world is **6 m wide**, with the ground line at **y = 0.6**, y pointing up. `X(x)` and `Y(y)` turn meters into pixels, and `s` is pixels per meter, just like the game. The game's view is **32 × 18 m**, with scenery standing on **y = 0**. See "Porting from the mockups" in the plan for the conversion.
