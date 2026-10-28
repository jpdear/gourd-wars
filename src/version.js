// The game's version. Set the first two numbers here by hand (stay under 1.0 until the first
// full release); the build adds a third: how many commits since this line last changed
// (0.19.0, 0.19.1, …), so every push gets a new number. The dev server adds "-dev".
// A friend can only join a host with the exact same version.
export const VERSION = '0.20'
export const GAME_VERSION = `${VERSION}.${__BUILD_NUMBER__}`   // (__BUILD_NUMBER__: filled in by vite.config.js)
export const GAME_URL = 'https://jpdear.github.io/gourd-wars/'   // where the latest version lives

// <0 if version a is older than b, >0 if newer, 0 if the numbers are the same ('0.9' < '0.10';
// missing counts as oldest; a "-dev" tag is ignored)
export function compareVersions(a, b) {
  const pa = String(a ?? '').split('.').map(n => parseInt(n, 10)), pb = String(b ?? '').split('.').map(n => parseInt(n, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}
