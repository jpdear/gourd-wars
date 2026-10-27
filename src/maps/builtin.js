// Every map (one screen: 32 x 18 m). A jump reaches ~4.3 m up and ~7 m across, so every
// platform is within ~3.6 m up and ~4.5 m across of another one.
//   platforms  solid ground: x, y = center, w, h = size (wall: true = drawn as a wall/ceiling)
//   spawns     feet positions for players 1-4 (Blue, Red, Green, Yellow)
//   patches    pumpkin patches {x, y, only?} (on platform tops; only = always grows that type)
//   bales      hay bales {x, y}: y = the surface they sit on
//   spikes     pitchfork rows {x, y, w}: y = base, tines point up (instant kill)
//   fires      bonfires {x, y, w}: y = base (damage + a hop out)
//   scythes    scarecrows {x, y, length, pole, turnTime?}: x, y = pivot, length = arm (the outer
//              blade is deadly), pole = how far the pole reaches down, turnTime = seconds per turn
//   movers     moving platforms {x, y, w, h, x2, y2, speed, pause}: slide from (x, y) to (x2, y2)
//              and back at about speed m/s, waiting pause seconds at each end (optional)
//   theme      one of THEMES

import { THEMES } from './themes.js'

export const MAPS = {
  patch: {
    name: 'The Patch',
    theme: THEMES.paper,
    platforms: [
      { x: 16,   y: 4,    w: 14, h: 0.8 },
      { x: 4.5,  y: 7,    w: 5,  h: 0.6 },
      { x: 27.5, y: 7,    w: 5,  h: 0.6 },
      { x: 16,   y: 10.5, w: 6,  h: 0.6 },
    ],
    spawns: [{ x: 11, y: 4.4 }, { x: 21, y: 4.4 }, { x: 3.5, y: 7.3 }, { x: 28.5, y: 7.3 }],
    patches: [{ x: 16, y: 4.4 }, { x: 4.5, y: 7.3 }, { x: 27.5, y: 7.3 }],
    bales: [], spikes: [], fires: [], scythes: [],
  },
  // Inside a barn: walls and a ceiling; the only way out is the hole in the floor.
  hayloft: {
    name: 'Hay Loft',
    theme: THEMES.barn,
    platforms: [
      { x: 0.4,  y: 10,   w: 0.8,  h: 16, wall: true },   // walls
      { x: 31.6, y: 10,   w: 0.8,  h: 16, wall: true },
      { x: 16,   y: 17.65, w: 32,  h: 0.7, wall: true },  // ceiling (bottom 17.3, just above the score)
      { x: 6.9,  y: 1.3,  w: 12.2, h: 2.6 },              // barn floor (top 2.6), hole from x 13 to 19
      { x: 25.1, y: 1.3,  w: 12.2, h: 2.6 },
      { x: 10.5, y: 5.3,  w: 3,    h: 0.4 },              // shelves (top 5.5)
      { x: 21.5, y: 5.3,  w: 3,    h: 0.4 },
      { x: 5,    y: 8.1,  w: 8,    h: 0.6 },              // lofts (top 8.4)
      { x: 27,   y: 8.1,  w: 8,    h: 0.6 },
      { x: 16,   y: 11.4, w: 6,    h: 0.4 },              // beam over the hole (top 11.6)
    ],
    spawns: [{ x: 3.5, y: 2.6 }, { x: 28.5, y: 2.6 }, { x: 6.5, y: 8.4 }, { x: 25.5, y: 8.4 }],
    patches: [{ x: 9.8, y: 2.6 }, { x: 22.2, y: 2.6 }, { x: 16, y: 11.6 }],
    bales: [
      { x: 5.6, y: 2.6 }, { x: 6.65, y: 2.6 }, { x: 6.1, y: 3.4 }, { x: 12.4, y: 2.6 },     // left floor: stack + hole edge
      { x: 26.4, y: 2.6 }, { x: 25.35, y: 2.6 }, { x: 25.9, y: 3.4 }, { x: 19.6, y: 2.6 },  // right floor
      { x: 3, y: 8.4 }, { x: 29, y: 8.4 },                                                  // lofts
    ],
    spikes: [], fires: [], scythes: [],
  },
  // Two fields and a raised mound in the middle, swept by a big scarecrow.
  field: {
    name: 'Scarecrow Field',
    theme: THEMES.sunset,
    platforms: [
      { x: 5.5,  y: 3.4,   w: 9,   h: 1.2 },   // fields (top 4)
      { x: 26.5, y: 3.4,   w: 9,   h: 1.2 },
      { x: 16,   y: 4.4,   w: 7,   h: 1.2 },   // the mound (top 5), under the scarecrow
      { x: 6,    y: 7.35,  w: 3.5, h: 0.5 },   // side ledges (top 7.6)
      { x: 26,   y: 7.35,  w: 3.5, h: 0.5 },
      { x: 10.5, y: 10.35, w: 2.5, h: 0.5 },   // stepping ledges (top 10.6)
      { x: 21.5, y: 10.35, w: 2.5, h: 0.5 },
      { x: 16,   y: 12.4,  w: 4,   h: 0.5 },   // perch above the scythe's reach (top 12.65)
    ],
    spawns: [{ x: 6.5, y: 4 }, { x: 25.5, y: 4 }, { x: 6, y: 7.6 }, { x: 26, y: 7.6 }],
    patches: [{ x: 3.5, y: 4 }, { x: 28.5, y: 4 }, { x: 16, y: 5 }, { x: 16, y: 12.65 }],
    bales: [{ x: 8.8, y: 4 }, { x: 23.2, y: 4 }],
    spikes: [], fires: [],
    scythes: [{ x: 16, y: 8.2, length: 2.8, pole: 3.2 }],
  },
  // Little platforms over a floor of pitchforks.
  pit: {
    name: 'Pitchfork Pit',
    theme: THEMES.dusk,
    platforms: [
      { x: 16, y: 1.5,   w: 31,  h: 0.6 },   // floor under the pitchforks (top 1.8)
      { x: 4,  y: 4.75,  w: 5,   h: 0.5 },   // start ledges (top 5)
      { x: 28, y: 4.75,  w: 5,   h: 0.5 },
      { x: 10, y: 6.25,  w: 3,   h: 0.5 },   // stepping stones (top 6.5)
      { x: 22, y: 6.25,  w: 3,   h: 0.5 },
      { x: 16, y: 4.25,  w: 3.5, h: 0.5 },   // low middle stone (top 4.5)
      { x: 16, y: 9.25,  w: 4,   h: 0.5 },   // mid high (top 9.5)
      { x: 5,  y: 9.75,  w: 3,   h: 0.5 },   // side highs (top 10)
      { x: 27, y: 9.75,  w: 3,   h: 0.5 },
      { x: 16, y: 12.75, w: 3,   h: 0.5 },   // top perch (top 13)
    ],
    spawns: [{ x: 4.5, y: 5 }, { x: 27.5, y: 5 }, { x: 5, y: 10 }, { x: 27, y: 10 }],
    patches: [{ x: 2.5, y: 5 }, { x: 29.5, y: 5 }, { x: 16, y: 4.5 }, { x: 16, y: 13 }],
    bales: [{ x: 17.1, y: 9.5 }],
    spikes: [{ x: 16, y: 1.8, w: 30.6 }],
    fires: [], scythes: [],
  },
  // A campground at night with a big bonfire in the middle.
  camp: {
    name: 'Bonfire Camp',
    theme: THEMES.night,
    platforms: [
      { x: 16,   y: 2.9, w: 30, h: 1.2 },   // campground (top 3.5)
      { x: 9.5,  y: 6.6, w: 4,  h: 0.5 },   // log platforms (top 6.85)
      { x: 22.5, y: 6.6, w: 4,  h: 0.5 },
      { x: 16,   y: 9.6, w: 5,  h: 0.5 },   // high center (top 9.85)
      { x: 3,    y: 9.6, w: 3,  h: 0.5 },   // high sides
      { x: 29,   y: 9.6, w: 3,  h: 0.5 },
    ],
    spawns: [{ x: 8, y: 3.5 }, { x: 24, y: 3.5 }, { x: 9.5, y: 6.85 }, { x: 22.5, y: 6.85 }],
    patches: [{ x: 4, y: 3.5 }, { x: 28, y: 3.5 }, { x: 15, y: 9.85 }],
    bales: [{ x: 12.6, y: 3.5 }, { x: 19.4, y: 3.5 }, { x: 17.6, y: 9.85 }],
    spikes: [], scythes: [],
    fires: [{ x: 16, y: 3.5, w: 1.8 }],
  },
  // A test map with one of everything (off in the rotation by default).
  testing: {
    name: 'Testing Grounds',
    theme: THEMES.plain,
    platforms: [
      { x: 7,    y: 4,   w: 10,  h: 0.8 },   // left ground (top 4.4)
      { x: 25,   y: 4,   w: 10,  h: 0.8 },   // right ground
      { x: 16,   y: 9.5, w: 6,   h: 0.6 },   // top middle (top 9.8), under the scarecrow
      { x: 2.5,  y: 8.5, w: 3,   h: 0.5 },   // high ledges
      { x: 29.5, y: 8.5, w: 3,   h: 0.5 },
      { x: 16,   y: 1.5, w: 8.4, h: 0.6 },   // pit floor under the pitchforks (top 1.8, above the help text)
    ],
    spawns: [{ x: 5, y: 4.4 }, { x: 24, y: 4.4 }, { x: 8, y: 4.4 }, { x: 21, y: 4.4 }],
    patches: [{ x: 4, y: 4.4 }, { x: 22, y: 4.4 }, { x: 16, y: 9.8 }],
    bales: [{ x: 10.4, y: 4.4 }, { x: 11.45, y: 4.4 }, { x: 10.9, y: 5.2 }, { x: 25.8, y: 4.4 }],
    spikes: [{ x: 16, y: 1.8, w: 8 }],
    fires: [{ x: 28.2, y: 4.4, w: 1.4 }],
    scythes: [{ x: 16, y: 12.4, length: 2.6, pole: 2.6 }],
    movers: [{ x: 13.5, y: 4.15, w: 3, h: 0.5, x2: 18.5, y2: 4.15, speed: 2.5, pause: 1 }],   // a ferry over the pit
  },
}
for (const map of Object.values(MAPS)) map.movers = map.movers || []
export const BUILTIN_MAP_IDS = Object.keys(MAPS)
export const mapIds = () => Object.keys(MAPS).filter(id => !id.startsWith('__'))   // (built-ins + custom maps)
export const mapDef = id => MAPS[id] || MAPS.patch   // (fallback if a map is missing, e.g. a deleted custom map)
