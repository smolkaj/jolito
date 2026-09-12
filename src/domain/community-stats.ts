import { z } from 'zod'

const countSchema = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v)),
])

export const communityStatsSchema = z
  .object({
    learners: countSchema.optional(),
    users: countSchema.optional(),
    cards: countSchema,
    reviews: countSchema,
  })
  .transform((data) => ({
    learners: data.learners ?? data.users ?? 0,
    cards: data.cards,
    reviews: data.reviews,
  }))

export type CommunityStats = z.infer<typeof communityStatsSchema>
