// Feedback (the main menu's Feedback screen): sends what the player wrote into a Google Form, whose
// answers land in a Google Sheet. The game is a static site, so the form is the free "server": we
// post the answers to its formResponse address the way the form itself would.
//
//   sendFeedback({ category, message, name, email }, info)  → Promise of a status (see below)
//   prepareFeedback(fields, info, form)                      → { body } or { error } (no sending; tested)
//   feedbackReady()                                          whether the form is filled in below
//
// The reply is hidden from us (a cross-site post: mode 'no-cors'), so "sent" means it got through to
// Google, not that the form took it; if the form's ids below are wrong, answers just don't show up.
// The form's address and ids aren't secret: anyone can read them in the game's code.
import { clamp } from '../util/math.js'

// The Google Form: its id (from the "/forms/d/e/<id>/" part of its link) and each question's entry
// id ("entry.<number>": from the form's ⋮ → Get pre-filled link). Empty: feedback isn't set up yet.
export const FEEDBACK_FORM = {
  id: '1FAIpQLSe7pLZOEh8Sly9LxwRL0tujirZdPkuLLMoJrw3yAxMOUvIXDQ',
  fields: { category: 'entry.1499955558', message: 'entry.569485813', name: 'entry.77089951', email: 'entry.1778086386', info: 'entry.416577758' },
}
export const CATEGORIES = ['Bug', 'Idea', 'Other']
export const LIMITS = { message: 1000, name: 100, email: 100, cooldown: 60 }   // (characters; cooldown: seconds between sends)

// what sendFeedback can come back with (the menu shows each one's text: see FEEDBACK_TEXT in menus.js)
//   sent, empty (no message), wait (too soon after the last one), busy (still sending), offline, not-set-up
let sending = false, lastSent = -Infinity

export const feedbackReady = () => !!FEEDBACK_FORM.id && Object.values(FEEDBACK_FORM.fields).every(Boolean)

// The form's answers, ready to post. info: a line about the game and browser (version, mode, window
// size, user agent), added to every message.
export function prepareFeedback({ category, message, name, email }, info, form = FEEDBACK_FORM) {
  const text = String(message ?? '').trim().slice(0, LIMITS.message)
  if (!text) return { error: 'empty' }
  const body = new URLSearchParams()
  body.set(form.fields.category, CATEGORIES.includes(category) ? category : 'Other')
  body.set(form.fields.message, text)
  body.set(form.fields.name, String(name ?? '').trim().slice(0, LIMITS.name))
  body.set(form.fields.email, String(email ?? '').trim().slice(0, LIMITS.email))
  body.set(form.fields.info, String(info ?? ''))
  return { body }
}

export async function sendFeedback(fields, info, now = performance.now()) {
  if (!feedbackReady()) return 'not-set-up'
  if (sending) return 'busy'
  if (now - lastSent < LIMITS.cooldown * 1000) return 'wait'
  const { body, error } = prepareFeedback(fields, info)
  if (error) return error
  sending = true
  try {
    await fetch(`https://docs.google.com/forms/d/e/${FEEDBACK_FORM.id}/formResponse`, { method: 'POST', mode: 'no-cors', body })
    lastSent = now
    return 'sent'
  } catch (e) {
    return 'offline'
  } finally {
    sending = false
  }
}

// seconds until another can be sent (0: now)
export const feedbackWait = (now = performance.now()) => Math.ceil(clamp(LIMITS.cooldown - (now - lastSent) / 1000, 0, LIMITS.cooldown))
