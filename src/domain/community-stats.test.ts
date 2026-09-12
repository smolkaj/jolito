import { describe, expect, it } from 'vitest'
import { communityStatsSchema } from './community-stats'

describe('communityStatsSchema', () => {
  it('parses valid community stats with learners', () => {
    const parsed = communityStatsSchema.parse({
      learners: 42,
      cards: 100,
      reviews: 250,
    })
    expect(parsed).toEqual({
      learners: 42,
      cards: 100,
      reviews: 250,
    })
  })

  it('normalizes users key to learners', () => {
    const parsed = communityStatsSchema.parse({
      users: 12,
      cards: 500,
      reviews: 1200,
    })
    expect(parsed).toEqual({
      learners: 12,
      cards: 500,
      reviews: 1200,
    })
  })

  it('handles string reviews from postgres bigint', () => {
    const parsed = communityStatsSchema.parse({
      learners: 5,
      cards: 10,
      reviews: '310',
    })
    expect(parsed).toEqual({
      learners: 5,
      cards: 10,
      reviews: 310,
    })
  })

  it('rejects invalid or negative counts', () => {
    expect(() =>
      communityStatsSchema.parse({
        learners: -1,
        cards: 10,
        reviews: 0,
      }),
    ).toThrow()

    expect(() =>
      communityStatsSchema.parse({
        cards: 'not-a-number',
        reviews: 0,
      }),
    ).toThrow()
  })
})
