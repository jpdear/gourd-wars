import { expect, it } from 'vitest'
import { binds, keyName, resetBinds, setBind } from '../src/app/keybinds.js'

it('binding a key another action has moves it: that action is left with none', () => {
  resetBinds()
  setBind('jump', 'KeyA')   // (Move Left's)
  expect(binds.jump).toBe('KeyA')
  expect(binds.left).toBe(null)
  setBind('left', 'ArrowLeft')
  expect(binds.left).toBe('ArrowLeft')
  resetBinds()
  expect(binds).toMatchObject({ left: 'KeyA', jump: 'KeyW', throw: 'Mouse0' })
})

it('names keys and mouse buttons the way players know them', () => {
  expect(keyName('KeyE')).toBe('E')
  expect(keyName('Digit3')).toBe('3')
  expect(keyName('ArrowUp')).toBe('↑')
  expect(keyName('Mouse2')).toBe('Right Click')
  expect(keyName('Mouse2', true)).toBe('RMB')
  expect(keyName(null)).toBe('—')
})
