import { describe, expect, it } from 'vitest'
import { hashForView, viewFromHash } from './navigation'

describe('navigation', () => {
  it('maps url hashes to view names', () => {
    expect(viewFromHash('#/create')).toBe('create')
    expect(viewFromHash('#create')).toBe('create')
    expect(viewFromHash('#/study')).toBe('review')
    expect(viewFromHash('#/review')).toBe('review')
    expect(viewFromHash('#/complete')).toBe('complete')
    expect(viewFromHash('#/')).toBe('welcome')
    expect(viewFromHash('')).toBe('welcome')
    expect(viewFromHash('#unknown')).toBe('welcome')
  })

  it('maps view names to canonical url hashes', () => {
    expect(hashForView('create')).toBe('#/create')
    expect(hashForView('review')).toBe('#/study')
    expect(hashForView('complete')).toBe('#/complete')
    expect(hashForView('welcome')).toBe('#/')
  })
})
