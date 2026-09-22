import { afterEach, describe, expect, it } from 'vitest'
import { getAppVersion } from './version'

describe('getAppVersion', () => {
  afterEach(() => {
    document.querySelector('meta[name="jolito-version"]')?.remove()
  })

  it('reads from meta[name="jolito-version"] when present', () => {
    const meta = document.createElement('meta')
    meta.name = 'jolito-version'
    meta.content = '2026.09.22 (abc1234)'
    document.head.appendChild(meta)

    expect(getAppVersion()).toBe('2026.09.22 (abc1234)')
  })

  it('falls back gracefully when meta is missing', () => {
    expect(getAppVersion()).toBe('dev')
  })
})
