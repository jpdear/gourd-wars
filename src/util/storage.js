// Saved data in this browser (localStorage). Reading or writing can fail (a private window,
// blocked storage): then nothing gets saved and reads come back empty (null).

// Every key the game saves under. (They keep the game's first name, Pumpkin Fight, so nobody's
// saved maps and settings get lost.)
export const STORAGE_KEYS = {
  customMaps: 'pumpkin-fight-custom-maps',
  spawns: 'pumpkin-fight-spawns',             // which pumpkins grow, and how often
  practiceMap: 'pumpkin-fight-map',
  match: 'pumpkin-fight-match',               // match length, map rotation
  dummies: 'pumpkin-fight-dummies',
  damageNumbers: 'pumpkin-fight-damage-numbers',   // your own On/Off choices (even as a guest): see prefs in app/settings.js
  lockMouse: 'pumpkin-fight-lock-mouse',
  keybinds: 'pumpkin-fight-keybinds',              // your keybinds (see app/keybinds.js)
  tuning: 'pumpkin-fight-tuning',             // tuning panel tweaks
  tuningView: 'pumpkin-fight-tuning-ui',      // tuning panel: open tab and groups
}

export function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch (e) { return null }
}
export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {}
}
export function loadText(key) {
  try { return localStorage.getItem(key) } catch (e) { return null }
}
export function saveText(key, value) {
  try { localStorage.setItem(key, value) } catch (e) {}
}
