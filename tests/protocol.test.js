import { expect, it } from 'vitest'
import { emptyInput } from '../src/game/input.js'
import { makeCode, packInput, unpackInput } from '../src/net/protocol.js'

it('sends input compactly and gets the same input back', () => {
  const input = { ...emptyInput(), left: true, throw: true, ragdoll: true, aimX: 12.3456, aimY: 7.891 }
  expect(unpackInput(packInput(input))).toEqual({ ...input, aimX: 12.35, aimY: 7.89 })
  expect(unpackInput({})).toEqual(emptyInput())   // (garbage in: nothing pressed)
})

it('makes 4-character join codes without look-alike characters', () => {
  for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
})
