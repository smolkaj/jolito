import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isSafeToReload } from './reload-safety'

describe('isSafeToReload', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  it('returns true when page is clean and on default view', () => {
    expect(isSafeToReload()).toBe(true)
  })

  it('returns false when a modal dialog is open', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    expect(isSafeToReload()).toBe(false)
  })

  it('returns false when a modal backdrop or sheet is present', () => {
    const sheet = document.createElement('div')
    sheet.className = 'modal-sheet'
    document.body.appendChild(sheet)
    expect(isSafeToReload()).toBe(false)
  })

  it('returns false when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(isSafeToReload()).toBe(false)
  })

  it('returns false when any input has non-empty text', () => {
    const input = document.createElement('input')
    input.value = 'hola'
    document.body.appendChild(input)
    // Blur to ensure focus is not on the input
    input.blur()
    expect(isSafeToReload()).toBe(false)
  })

  it('returns false when a textarea has non-empty text', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'some notes'
    document.body.appendChild(textarea)
    expect(isSafeToReload()).toBe(false)
  })

  it('ignores empty inputs or hidden inputs', () => {
    const emptyInput = document.createElement('input')
    emptyInput.value = '   '
    const hiddenInput = document.createElement('input')
    hiddenInput.type = 'hidden'
    hiddenInput.value = 'secret'
    document.body.appendChild(emptyInput)
    document.body.appendChild(hiddenInput)
    expect(isSafeToReload()).toBe(true)
  })

  it('returns false when in review session hash', () => {
    window.location.hash = '#/review'
    expect(isSafeToReload()).toBe(false)
  })

  it('returns false when in grammar practice hash', () => {
    window.location.hash = '#/grammar'
    expect(isSafeToReload()).toBe(false)
  })

  it('returns true when on deck view without active dialogs or dirty inputs', () => {
    window.location.hash = '#/deck'
    expect(isSafeToReload()).toBe(true)
  })
})
