import { describe, expect, it } from 'vitest'
import { LIMITS, prepareFeedback } from '../src/app/feedback.js'

const FORM = { id: 'form', fields: { category: 'entry.1', message: 'entry.2', name: 'entry.3', email: 'entry.4', info: 'entry.5' } }

describe('prepareFeedback', () => {
  it('fills every field of the form', () => {
    const { body } = prepareFeedback({ category: 'Idea', message: '  more gourds  ', name: ' Sam ', email: 'sam@example.com' }, 'v1 | practice', FORM)
    expect(Object.fromEntries(body)).toEqual({ 'entry.1': 'Idea', 'entry.2': 'more gourds', 'entry.3': 'Sam', 'entry.4': 'sam@example.com', 'entry.5': 'v1 | practice' })
  })
  it('turns down an empty message', () => {
    expect(prepareFeedback({ category: 'Bug', message: '   ' }, '', FORM)).toEqual({ error: 'empty' })
  })
  it('cuts long text to the limits and files unknown categories under Other', () => {
    const { body } = prepareFeedback({ category: 'Spam', message: 'x'.repeat(5000), name: 'y'.repeat(500), email: 'z'.repeat(500) }, '', FORM)
    expect(body.get('entry.1')).toBe('Other')
    expect(body.get('entry.2')).toHaveLength(LIMITS.message)
    expect(body.get('entry.3')).toHaveLength(LIMITS.name)
    expect(body.get('entry.4')).toHaveLength(LIMITS.email)
  })
  it('leaves name and email empty when none are given', () => {
    const { body } = prepareFeedback({ category: 'Bug', message: 'hi' }, '', FORM)
    expect([body.get('entry.3'), body.get('entry.4')]).toEqual(['', ''])
  })
})
