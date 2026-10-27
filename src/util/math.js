// HELPERS

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const wrapAngle = a => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI))
export const r3 = v => Math.round(v * 1000) / 1000
export function distToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  const t = len2 ? clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1) : 0
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t))
}
