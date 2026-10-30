# Gourd Wars: Design Doc

A 2–4 player, Stick Fight-style physics brawler. You fight with pumpkins that grow out of the ground. It's a website (https://jpdear.github.io/gourd-wars/); friends connect peer-to-peer with PeerJS. Desktop browsers only.

## Core loop
- **Up to 4 players, free-for-all:** Blue (the host), Red, Green, Yellow, colors given out in join order (a newcomer gets the first free one). No name labels, and no text along the bottom during play (no controls line, no "you are …"); a guest gets a short "You're Red!" when they join, and the Esc menu says which color you are.
- Last stick figure standing wins the round. **The last blow puts the game in slow motion** (¼ speed) for ~1.8 s with "**Blue wins!**" (etc.) in the winner's color (the last ones all down within 0.5 s = "Draw!", no point).
- **Scores:** whoever's in the lead wears a **gold crown** (everyone tied for the lead does; nobody at 0). No numbers during a round; everyone's score shows in a colored row during the pan to the next map and on the match-over screen.
- **Joining and leaving:** friends can join anytime with the same code. The first one starts a match; anyone after that waits and jumps in at the start of the next round (carried in with everyone, 0 points). Someone leaving just disappears (their points go with them; rejoining is a fresh start); the match goes on while 2+ players are left, and if everyone leaves the host is back to waiting.
- **Map pan between rounds:** the old map slides off to the left as the next one slides in, and each player is picked up (dangling) from where they were and carried to their new spawn (1.5 s, controls frozen, they pass through everything). When they're set down, the round has started — no countdown. Changing the practice map plays the same pan.
- **Match length is set by the host:** a fixed number of rounds (default 10; a tie for the lead at the end → sudden-death rounds), first to N wins (default 5), or endless. A new match starts automatically 5 s after one ends. The host changes it under **Match Settings** (on the host screen, or Esc menu → Settings, which also has Restart Match).
- Health: 50 each (2 full-power ripe pumpkins, ~7 punches). At 0 you're knocked out (limp ragdoll) until the next round; falling off also puts you out.
- **Hidden health:** nobody sees health bars during play (more tension); they only appear in debug mode (`` ` ``), for tuning. Damage numbers (a red "-25" popping up over whoever's hit) are off too, unless you turn on **Damage Numbers** in Settings: each player's own choice, guests included, saved in their browser. Debug mode always shows them.
- Practice (and the host waiting for friends): no rounds, 0–3 dummies (your choice, under Match Settings / Esc menu → Settings) that refill instead of dying, you respawn after falling. The dummies leave when a friend joins.
- *Later:* the map changes between rounds.
- You're out for the round by falling off the map, touching the scarecrow's scythe, or **running out of health** (pitchforks hurt too) (pumpkins and punches both do damage).
- You carry one pumpkin at a time, and can only harvest with empty hands (throw what you're holding first).
- You keep your pumpkin when you get hit; you lose it when you die.
- Hold to charge a throw, release to throw. Aim with the mouse.
- **Controls** (Settings → Controls, each player's own, saved in their browser; guests too): one key or mouse button per action. Defaults: A / D move, W jump, S crouch, left click throw/punch, E harvest, R ragdoll. Click an action, then press its new key or mouse button (left, middle, right, back, forward); Esc cancels. A key another action had moves over, leaving that action with none (a red "—") so you notice. Reset to Defaults puts them all back. Esc (menus) and `` ` `` (debug) can't be rebound. The harvest bubble over a patch shows your harvest key. While you play, your keys don't scroll the page or trigger the browser's own shortcuts (Ctrl/Cmd ones still work), and the mouse's side buttons don't go back/forward.
- **Lock Mouse** (Settings, each player's own choice, off by default since the browser shows a notice every time it locks the mouse): while you play, the mouse is locked to the game (it can't drift onto another screen or the taskbar and take the game out of focus) and a white crosshair with a dark edge shows where you're aiming, kept over the arena. The click that starts or resumes play locks it (or, failing that, your first click on the game, which doesn't throw). Menus, the map editor and the tuning panel let go of it; Esc lets go and opens the pause menu. If the browser won't lock it, the normal cursor is used and clicks throw as usual.
- **Punch** when your hands are empty: click to swing a punch toward the mouse, alternating left and right arms. 8 damage, 0.2 s cooldown, short reach (~1.15 m body to body).
- **Wall slide & wall jump:** in the air, hold toward a wall (any vertical side: walls, the ends of platforms, moving platforms; not hay bales) to grab it: you slide down slowly (2.5 m/s at most; a moving platform carries you), one hand up the wall, feet against it, dust puffing off. Let go of the direction key and you drop off. Jump (up to 0.12 s after letting go still counts) to kick off: up (12 m/s) and away (4 m/s); for 0.2 s steering back toward the wall is weak, then pushing back in grabs it again, so you can climb by kicking off over and over (no limit). You can throw and punch while on a wall. Any hit knocks you off; carrying a Big Gourd you're too heavy to hold on. All in the tuning panel (Player → Wall).
- **Crouch (S by default, hold):** you go soft (legs, head and free arms floppy; arms holding a pumpkin, harvesting or punching stay firm) and press your body down: you fall 1.5× as fast, starting the moment you press it. On the ground the hover spring lets go and you drop straight onto your butt: no hop, a bit janky on purpose. The legs swing out in front and go slippery so they slide out from under you, and you lean back ~30° away from your aim. You can scoot along slowly, jump straight out of it, throw, punch and harvest. Pressing down on a wall lets go of it. Let go of the key and the hover spring stands you back up. All in the tuning panel (Player → Crouch).
- **Slide (crouch while running):** sit down while going at least 5.5 m/s along the ground (pressing crouch, or landing with it held) and you power slide instead: low and in control (head at ~1.1 m instead of ~1.75, so head-high throws and punches can miss), torso leaning back ~46°, front leg out with the knee a little up, back leg folded under (knee and shin on the floor), back hand reaching down, front arm forward and ready, dust kicking up. Starting a slide adds +4 m/s (never past 11 m/s, at most once a second; a slide in between keeps your speed). It doesn't cap your speed, so momentum from a vine reel, a wall jump or a blast carries through. It slows at 8 m/s² (30 holding the other way) and under 3 m/s it's over and you're sitting; from a run that's ~1 s. Let go of crouch to stand up still moving. **Jumping out of a slide keeps its speed**, and so does sliding off an edge: in the air after one, holding forward (or nothing) doesn't slow you down past running speed, only holding back does, so slide → jump → land sliding chains hold speed. You can throw and punch while sliding. **Slide tackle:** your front foot trips anyone it reaches (no damage: their legs get swept out your way, they pop up and go limp for 0.6 s, then can't be tripped again for 1 s); you keep 70% of your speed. Any hit ends a slide; you can't slide carrying a Big Gourd. All in the tuning panel (Player → Slide).
- **Arms:** empty-handed, they hang at your sides and swing opposite your legs while walking. Holding a pumpkin, both arms point it at the mouse.
- **Damage & stagger:** every hit deals damage onto a hidden stagger meter. Reaching 20 knocks you into a ragdoll (and resets the meter); below that, a hit is just a small shove (40% knockback) and you stay on your feet. The meter drains (40/s) once you go 0.4 s without being hit, so damage only builds up from hits in quick succession. A full-power ripe pumpkin does 25 (instant stagger), a quick-tap ripe throw ~14, a green one ~10, a punch 8 (three quick punches stagger).
- Pumpkins don't physically shove players; all knockback comes from the damage/stagger rules.

## Pumpkin growth
- Each map has fixed pumpkin patches (3 on the current map: middle of the main platform + each side ledge).
- Empty → sprout grows green → orange over ~4 s → ripe for ~8 s → rots (brown) for 2 s → pops → empty ~2 s → regrows.
- Pick it early (40–75% power, greener = weaker) or wait for ripe (100%). Power scales knockback and stun. Rotten pumpkins can't be picked.
- Harvesting = hold E (your harvest key) for 0.5 s next to the patch. Walking away, letting go, or getting stunned cancels it. A bubble with the key's name shows when you're in reach.
- You can knock a pumpkin off the vine by hitting it with a thrown pumpkin (both splat, the patch starts over).
- Each round (and when a friend joins) starts with patches ~2 s from ripe.
- *Later:* rare pumpkins glow while growing, so both players can see them coming.

## Pumpkins
Each type has its own rules (`PUMPKIN_TYPES` in `src/game/pumpkinTypes.js`). Picking green = weaker; hits feed the stagger meter; **your own pumpkins can hit you** (after a 0.25 s grace period leaving your hand). Specials **glow while growing** on their patch.

| Pumpkin | What it does |
|---|---|
| **Classic** | 25 dmg at full power; breaks on any hit. |
| **Bouncy** | Bounces, breaks on the 4th bounce or a player hit. 15 dmg. |
| **Jack-o'-Boom** | **Direct hit = instant KO.** Explodes on impact: 2.5 m blast, up to 40 dmg falling off with distance. Everything in it (players, thrower too, bales, pumpkins) is blown **straight outward** — up to 30 m/s at the center, less further out — and players go ragdoll. Splats patch pumpkins. |
| **Gourd Cluster** | Splits into 3 minis (10 dmg each) at the top of its arc; bursts if it hits something first. |
| **Frost** | 8 dmg + frozen stiff for 2 s (joints lock, no control, tips over and slides). |
| **Splat Pie** | 8 dmg + glued to the floor 1.5 s (no walking/jumping; applies on landing if hit midair). |
| **Vine** | **Shot, not tossed:** still charged, but even a tap fires it fast (34 m/s, 42 charged) and nearly straight (¼ gravity); fizzles after ~19 m (~23 m charged). With **Sights** on, its sight shows its path to where it would hit or fizzle. Yank: hits a player → they fly toward you (5 dmg, short flop); hits the level (platforms, walls, moving platforms) → you're **reeled in** along a straight line, all the way to where it stuck (the vine stays drawn taut from your hand). It lets go when you get there, when something blocks you, after 0.7 s, if you're hit, or when you press jump; you keep a bit of your speed plus a small hop up (enough to climb onto a ledge whose side you grabbed). Every part of the reel (speed, how much of the way, stop distance, max time, kept speed, hop) and the yank on players/bales (speed, lift) is in the tuning panel's Vine section. |
| **Big Gourd** | Carrying: 55% speed, 70% jump, can't hold onto walls or slide. Short lob only; smashes on the first thing it hits (35 dmg crush). Also a shield: blocks pumpkins and punches, cracks after 3 blocks (blasts aren't blocked). |
| **Seed Spitter** | Hold click to spray 15 dark, easy-to-see seeds, fast (one every 0.06 s, 32 m/s; 2 dmg each, a small push); 10 in a row stagger. |
| **Balloon Gourd** | Held: glide (fall ~3–4 m/s) and jump 25% higher. Thrown: target floats helplessly up for 2 s, then drops. |
| **Black Hole** | Deep purple with little stars. Wherever it breaks (first thing it touches, a player too: no damage, the hole just opens on them) a **black hole** opens and stays put: its core grows from 0.8 m to 12 m across over 3.5 s, then collapses (a purple pulse); the screen shakes while it's open, harder as it grows. It **pulls on everything anywhere on the map** (players, thrower too, flying pumpkins, hay bales), harder the closer and the bigger it is (pull × radius / distance): at full size you can't outrun it from within ~13 m of its center, and further out it slows you and curves throws. Whatever reaches the core is **swallowed**: players are gone like falling off (practice: back at your spawn), pumpkins break (a Jack-o'-Boom goes off), bales are eaten; pumpkins still on a patch get ripped off (splat) once it's close. Picked green: smaller and shorter-lived. Every number is in the tuning panel. |
| **Airstrike** | Olive drab with a red crosshair. Wherever it breaks (first thing it touches) a pulsing red **target** appears, and **1.25 s later a giant Airstrike gourd lands on it** from above the screen; a dark shadow spreads under the target as it gets close. Hit a player directly and it does no damage: the target goes on the ground below them (or right where they were, over the void). The giant gourd is a real falling body: it smashes on the **first thing in its way** (take cover under a platform; whoever's above the target takes the hit instead), and goes right through Big Gourd shields. Whoever it lands on is **instantly KO'd**, then it explodes: 5 m blast, up to 50 dmg falling off with distance, everyone in it goes ragdoll, and the screen shakes. Picked green: a smaller gourd, smaller blast, less damage. Every number is in the tuning panel. |
| **Homing** | Bright red with a little blinking antenna for a stem. Thrown like any pumpkin; **0.5 s** later it locks onto whoever is **nearest the gourd** (never you, never anyone knocked out) and a red lock-on reticle appears on them for everyone to see. Then it's a **missile**: 20 m/s, no gravity, a flame trail out the back, hits like a Classic (25 dmg). It looks ahead and steers around platforms, walls and bales, but never more than 60° off the line to its target, so it doesn't circle: if they're hidden behind cover, it smashes into the cover. It smashes on the first thing it touches (any player in the way gets hit), and a Big Gourd shield blocks it. If its target is knocked out or falls off, it doesn't pick a new one: it flies on like a Classic (same with nobody to chase). Smashes after 3 s of chasing. Picked green: less damage, slower and turns less sharply. Every number is in the tuning panel. |
| **Boomerang** | Crookneck yellow, shaped like a boomerang: a round bulb with its neck bent over into a curled stem. Thrown like any pumpkin, spinning fast (a faint blur). It leaves straight, slows to a stop **15 m out** on a full-charge throw (a tap: ~7.5 m), and whips around in a sharp hook that **swings out underneath** (~5 m out at the widest, a tap about half), then comes back **along the line it left on**, as fast as it left, right through your hand. No gravity while it's curving (its spin holds it up). It **never touches you** (passes right through you and your own Big Gourd shield) and flies on past, straight, with light gravity (0.12×), until it hits something, so it catches people behind you. Hits like a Classic (25 dmg; the slow moment at the turn hits softer) and smashes on the first thing it touches. Picked green: less damage, same path. With **Sights** on, the sight shows the whole hook. Every number is in the tuning panel. |

**Spawning (host setting, also used in practice):** every type can be turned on/off and set to Common / Normal / Rare / Super Rare (weights 20 / 5 / 1 / 0.25). Default: Classic common, Black Hole and Airstrike super rare, all other specials rare. **Super Rare** pumpkins glow gold (bigger, faster pulse, with sparkles circling them) while growing, instead of the usual special glow. The **Pumpkins** screen is under Match Settings (Esc menu → Settings in practice).

## Maps
- Stick Fight-style platform levels: floating platforms over empty space, always one screen.
- **Moving platforms:** slide back and forth between two spots (gliding in and out of each stop), waiting a moment at each end. A faint dashed rail shows the route. You ride along (you hover, so the platform's speed is added to yours); bales and pumpkins ride on friction. They start over every round and wait at the start during the pan. They pass through walls, and squash whatever's in the way.
- **Hay bales:** heavy physics blocks (1 × 0.8 m). Stand and stack on them; walk into one to shove it along. 100 health: a ripe Classic does 25 (4 to break), punches do 3× (7 punches), blasts 5× (a close Jack-o'-Boom wrecks one). Broken bales are gone until the next round.
- **Pumpkins vs bales:** every hit shoves a bale with the same push it would give a player (so a heavy bale moves less: a Classic ~4 m/s, a seed ~0.5). Special effects: **Balloon** floats the bale up for 2 s; **Vine** yanks the bale toward you; **Frost** makes it a slippery ice block for 3 s (no friction, slides far); **Splat Pie** makes it gooey for 5 s (anyone touching it gets glued); **Jack-o'-Boom** blasts it outward.
- **Pitchforks:** solid tines; touching them does 25 damage (half your health: two touches knock you out) and pops you up off them (12 m/s), with no stagger. Then no more pitchfork damage for 0.5 s, however many tines you touch. All three numbers are in the tuning panel (Level → Hazards). **Scarecrow scythe:** a solid blade spinning a full circle every 3 s; it shoves whatever it hits and touching it is an instant KO. In practice you get back up after 1.2 s.
- **Bonfires:** 15 damage/sec while in the flames, plus a hop out (10 m/s); no burn after you leave.
- Hazards also destroy pumpkins (a Jack-o'-Boom goes off) and hay bales (bonfires burn them).
- **Testing Grounds** (temporary map with one of everything) is off in the rotation by default; turn it on under Match Settings → Maps, or pick it as the practice map.
- **Maps**, each with its own sky and scenery:
  - **The Patch** — the original: floating platforms, soft hills.
  - **Hay Loft** — inside a barn: walls and a ceiling, lofts and shelves, lots of hay bales; the only way out is the hole in the middle of the floor.
  - **Scarecrow Field** — sunset; two fields and a raised mound swept by a big scarecrow's scythe; a high perch out of its reach.
  - **Pitchfork Pit** — little platforms over a floor of pitchforks.
  - **Bonfire Camp** — night; a long campground with a big bonfire in the middle, log platforms above.
  - **Testing Grounds** — one of everything, including a moving-platform ferry over the pitchfork pit (off in the rotation by default).
- **Rotation:** the host picks which maps are in it (Match Settings → **Maps**) and **Random Order** on (default: every round is a random map from the rotation, never the same twice in a row) or off (the order they're listed, starting from the first each match).
- **Every map has 4 spawns** (one per color). Custom maps from before 4 players get spawns 3–4 filled in automatically (on reachable floors, away from hazards, as far from the others as possible).
- **Practice / waiting for friends:** you pick one map ("Practice Map" under Match Settings / Esc menu → Settings) and stay on it.
- No low-gravity or moon map.

## Custom maps + map editor
- **Main menu → Map Editor → My maps:** your maps, each with Play · Edit · Copy · Code · Delete (click twice). **New map** starts with a floor, two spawns and a patch. **Import a map code**. Or start from a copy of any built-in map.
- **Editor:** the map drawn by the real renderer at full size with a grid; the toolbar on top, a panel on the right.
  - **Tools (keys 1–9, M):** Select · Platform · Wall · Spawns 1–4 (key 4, again for the next) · Patch · Hay bale · Pitchforks · Bonfire · Scarecrow · Moving platform.
  - **Moving platform:** drag it where it starts; a see-through copy shows where it goes (5 m over at first). Drag the copy (or type End X/Y) to set the trip; speed and wait time are in the panel. Moving the platform moves its whole trip.
  - **Placing:** drag to draw platforms, walls and pitchfork rows; click to place everything else (you can keep dragging it until you let go). Ground pieces (spawns, patches, bales, pitchforks, bonfires) land on the platform under the cursor, and bales stack. Everything snaps to a 0.25 m grid; hold Shift for fine placement.
  - **Select:** drag to move, white handles to resize (platform edges/corners, pitchfork/bonfire width, scarecrow arm length and pole). Delete, Ctrl+D copy, arrow keys nudge (Shift = fine), Esc deselect, Ctrl+Z / Ctrl+Shift+Z undo/redo, Ctrl+S save.
  - **Panel:** map name + theme (Paper, Barn, Sunset, Dusk, Night, Plain); the selected piece's numbers; a patch can grow just one kind of pumpkin; a scarecrow has its own spin speed. Spawns can't be deleted, only moved.
  - **Checks**, live. A moving platform counts as a platform at both ends of its trip. Must fix (red, blocks playing): a missing spawn, or one not on a platform, inside a wall, or in a hazard. Warnings (amber): a spawn next to a hazard, two spawns on top of each other, no patches, a patch off a platform or buried, a bale stuck in a platform, a platform out of jumping reach. Clicking one selects the piece.
  - **Play test** saves and drops you into practice on the map; the Esc menu's Exit becomes **Exit to Editor**. **Exit** asks twice if there are unsaved changes.
- **Saved** in your browser. A map that passes the must-fix checks shows up in the Practice Map picker and in Match Settings → Maps (new maps start on).
- **Online:** when your friend joins, the host sends all of its custom maps (cleaned up on arrival) before the first snapshot. The guest keeps them only for that session.
- **Map codes:** `PFMAP1:` + base64 JSON, for sharing or backup. Anything imported or received is cleaned up first: known fields only, numbers kept on screen, counts capped, names shown as plain text.

## Menus
- **Main menu:** "Gourd Wars" across the top in a chunky cartoon font (Luckiest Guy from Google Fonts; falls back to Arial Black offline). The letters drop in one by one and bounce; as the last one lands, the title eases into a gentle side-to-side sway (no jump at the hand-off). Big pill buttons (Host Game, Join Game, Practice, Map Editor) sit right on the backdrop, no card.
- **Same look everywhere:** titles, headings and buttons use the logo's font; buttons are pills sitting on a little ledge that press down when clicked. Longer sentences (status, hints) stay in the plain font.
- Every other screen is one card in the middle with a title (Host Game, Join Game, Game Menu, Match Settings / Settings, Pumpkins, Map Editor, …); titles and buttons are in Title Case.
- Out of the game (main menu, Join Game, Map Editor) there's a plain dark backdrop; from the host screen on (and in the Esc menu) the arena shows behind the card.
- **Host Game:** Join Code + Copy Code, Match Settings, Play While Waiting (or "Play vs Dummies While Waiting"), Back.
- **Join Game:** "Enter join code", Join, Back.
- **Esc menu (Game Menu):** Resume, Settings (not for guests: they play by the host's settings), Exit (to the main menu, or to the editor in a play test).
- **Match Settings** (from the host screen; called **Settings** from the Esc menu) shows only what applies right now: Match Length + Maps + Random Order (on/off) for the host; Practice Map + Practice Dummies (just the number) while playing alone; Sights (on/off, everyone: see below); Pumpkins; Restart Match for a host with friends; Done. Damage Numbers, Lock Mouse (on/off, just for you) and Controls are there for everyone. A guest's Settings (from the Esc menu) has only those: they play by the host's settings.
- **Sights** (host setting, off by default; also used in practice): while you hold any gourd, dots in its color with a dark edge (so they show up on any map) show where it would fly if you threw it now (growing as you charge), fading a little toward the end, until the first thing it would hit (platforms, walls, moving platforms, hay bales, pitchforks), where it would fizzle (Vine) or split (Gourd Cluster), or off screen. Only you see your own; the host's snapshots tell guests whether sights are on. The Seed Spitter's sight is its seeds' path; the Big Gourd's, its short lob.
- **Pumpkins:** one row per type, with **Enabled** (On/Off) and **Rarity** (Common / Normal / Rare / Super Rare) columns.

## Debug / tuning
- `` ` `` shows health bars, damage numbers, debug text and the tuning panel.
- Tuning panel: tabs (Player / Combat / Patches / Pumpkins) with collapsible sections; each section shows how many values you've changed. Every pumpkin type has its own section. Tweaks are saved in your browser; **Copy changes** gives lines to paste back into `src/config.js` / `src/game/pumpkinTypes.js` (or to send to Claude).

## Look
- Simple graphics: stick figures made of lines and circles, pumpkins as circles with ribs and a stem.
- Each player has their own color (Blue, Red, Green, Yellow), never orange so they don't blend in with the pumpkins.

## Tech
- **Physics:** Planck.js (Box2D port).
- **Active ragdoll:** physics limbs on hinge joints. While you're in control, a hover spring, an upright torque, and joint motors keep the figure standing and posed. Getting hit turns them off for a moment.
- **Rendering:** plain Canvas 2D.
- **Networking:** PeerJS (free public matchmaking server + free relay servers for strict networks). The host runs the whole simulation, with one connection per guest (up to 3); each guest sends inputs 60×/s and draws the snapshots the host sends back 30×/s (about 1 KB with 2 players, 1.9 KB with 4: ~170 KB/s upload for a host with 3 guests), blended about 70 ms behind real time. Players live in slots 0–3 (slot = color, spawn, score); the host tells each guest its slot with a `welcome` message. Every player is driven by the same plain input object (`{left, right, jump, crouch, throw, harvest, ragdoll, aimX, aimY}`). Codes are 4 characters; the PeerJS id is `pumpkin-fight-CODE`.
- **Versions:** `0.19.4`-style. You set the first two numbers by hand (`VERSION` in `src/version.js`; stay under 1.0 until the first full release); the build adds the third: commits since that line last changed, so every push gets a new number. The dev server adds `-dev`. Shown in the main menu's corner. Both sides send it in their first message; the host only lets a friend in when it matches exactly. Otherwise the friend is told who's behind: if it's them, an **Update Now** button reloads the latest copy; if it's the host, the host sees "A friend tried to join with a newer/older version…" (same numbers but one is a dev build: "a different build").
- **Hosting:** GitHub Pages, https://jpdear.github.io/gourd-wars/ (repo `jpdear/gourd-wars`). Every push to `main` runs the tests, builds and publishes (`.github/workflows/deploy.yml`); it's live in about a minute. The build gives its files new names whenever they change, so browsers never mix old and new files.
- **Code:** see the README for the project layout, running it locally, and the tests.
- **Background tabs:** a tiny worker keeps the game ticking when its tab is hidden, so switching tabs doesn't freeze the match.
- **Drawing:** everything is drawn from a snapshot (plain data), on both computers, so both screens look the same. Particles are made locally from `splat` events.

## Build order
1. ~~One ragdoll on a platform: walk, jump, fall over, get up~~ ✅ (plus a test dummy and Classic pumpkin throw)
2. ~~Connect over PeerJS so each player controls a stick figure~~ ✅ (host / join with a code / practice menu)
3. ~~Pumpkin patches: grow, harvest, throw~~ ✅
4. ~~Rounds, deaths, scoring~~ ✅ (health, KOs, host-configurable match length)
5. More pumpkins and maps:
   - 5a ~~10 special pumpkin types + host spawn settings~~ ✅ (the Squash Ball was later removed, the Black Hole added: 10 now)
   - 5b ~~hay bales + hazards~~ ✅ (+ Testing Grounds map and a map switch)
   - 5c ~~maps + random rotation~~ ✅
6. Custom maps:
   - 6a ~~map editor + custom maps (storage, play test, codes, rotation, sent to the guest)~~ ✅
   - 6b ~~moving platforms (engine + editor tool)~~ ✅
7. ~~Up to 4 players (free-for-all, join anytime, crowns, 1–3 practice dummies)~~ ✅

## Open questions
- Should a fully charged Classic hit be able to knock someone off from mid-platform? (`knockback` in `PUMPKIN_TYPES`)
- Art style: stay with the light paper look, or try a darker spooky night theme?
- Game name?
