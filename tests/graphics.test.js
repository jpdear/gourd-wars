import { afterEach, describe, expect, it } from 'vitest'
import { GRAPHICS, changeGraphics, graphics, loadGraphics, validGraphic } from '../src/app/graphics.js'
import { PLAYER_COLORS } from '../src/config.js'
import { PUMPKIN_TYPES } from '../src/game/pumpkinTypes.js'
import { gfx, gourdColors, motionTime, playerColor, playerName, playerShape, recolor } from '../src/render/gfx.js'

afterEach(() => loadGraphics({}))   // (back to the defaults)

describe('graphics settings', () => {
  it('default to the normal look', () => {
    loadGraphics({})
    for (const name in GRAPHICS) expect(graphics[name]).toBe(GRAPHICS[name].value)
    expect(gfx).toMatchObject({ colorblind: 'off', shake: 1, flashes: true, outlines: false, sightScale: 1, effects: 1, simpleBackground: false, glow: 1, uiScale: 1 })
  })
  it('load saved choices, and fall back to the default for anything not valid', () => {
    loadGraphics({ shake: 'low', effects: 'lots', brightness: 500, uiSize: 'large', colorblind: 'redgreen' })
    expect(graphics).toMatchObject({ shake: 'low', effects: 'full', brightness: 100, uiSize: 'large', colorblind: 'redgreen' })
    expect(gfx).toMatchObject({ shake: 0.4, effects: 1, uiScale: 1.2, colorblind: 'redgreen' })
  })
  it('ignore a bad change', () => {
    changeGraphics('flashes', 'sometimes')
    changeGraphics('nope', 'on')
    expect(graphics.flashes).toBe('on')
    changeGraphics('flashes', 'off')
    expect(gfx.flashes).toBe(false)
  })
  it('take slider values from the menu as text', () => {
    changeGraphics('brightness', '115')
    expect(graphics.brightness).toBe(115)
    expect(validGraphic('brightness', 60)).toBe(false)
  })
  it('Reduced Motion On holds decoration still', () => {
    changeGraphics('motion', 'on')
    expect(motionTime(123)).toBe(0)
    changeGraphics('motion', 'off')
    expect(motionTime(123)).toBe(123)
  })
})

describe('Colorblind Mode', () => {
  it('off: players and gourds look as always', () => {
    expect(playerColor(1)).toBe(PLAYER_COLORS[1])
    expect(playerName(1)).toBe('Red')
    expect(playerShape(1)).toBe(null)
    expect(gourdColors(PUMPKIN_TYPES.vine)).toBe(PUMPKIN_TYPES.vine)
  })
  it('on: its own player colors, shapes in the names, recolored gourds (ribs too)', () => {
    for (const mode of ['redgreen', 'blueyellow']) {
      changeGraphics('colorblind', mode)
      expect(new Set([0, 1, 2, 3].map(i => playerColor(i))).size).toBe(4)
      expect(playerColor(1)).not.toBe(PLAYER_COLORS[1])
      expect(playerName(1)).toBe('Red (Triangle)')
      expect(playerShape(0)).toBe('circle')
    }
    changeGraphics('colorblind', 'redgreen')
    const vine = gourdColors(PUMPKIN_TYPES.vine)
    expect(vine.color).not.toBe(PUMPKIN_TYPES.vine.color)
    expect(vine.rib).not.toBe(PUMPKIN_TYPES.vine.rib)
    expect(vine.mark).toBe(PUMPKIN_TYPES.vine.mark)   // (the rest of the type is untouched)
    expect(recolor(PUMPKIN_TYPES.classic.color)).toBe(PUMPKIN_TYPES.classic.color)   // (only the ones that clash change)
    expect(recolor(PUMPKIN_TYPES.airdrop.color)).toBe(recolor(PUMPKIN_TYPES.airstrike.color))
  })
})
