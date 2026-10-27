import { expect, it } from 'vitest'
import { GAME_VERSION, VERSION, compareVersions } from '../src/version.js'

it('builds the version from VERSION plus a build number', () => {
  expect(GAME_VERSION.startsWith(VERSION + '.')).toBe(true)
  expect(VERSION).toMatch(/^\d+\.\d+$/)
})

it('compares versions number by number', () => {
  expect(compareVersions('0.10', '0.9')).toBeGreaterThan(0)    // not alphabetical
  expect(compareVersions('0.19.3', '0.19.12')).toBeLessThan(0)
  expect(compareVersions('0.20.0', '0.19.40')).toBeGreaterThan(0)
  expect(compareVersions('1.0.0', '0.99.9')).toBeGreaterThan(0)
  expect(compareVersions('0.19', '0.19.0')).toBe(0)
})

it('treats a missing version (very old copies) as the oldest', () => {
  expect(compareVersions(undefined, '0.18')).toBeLessThan(0)
  expect(compareVersions('0.18', undefined)).toBeGreaterThan(0)
})

it('ignores the dev server\'s "-dev" tag when comparing', () => {
  expect(compareVersions('0.19.3-dev', '0.19.3')).toBe(0)
  expect(compareVersions('0.19.4-dev', '0.19.3')).toBeGreaterThan(0)
})
