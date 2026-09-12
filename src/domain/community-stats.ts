import { z } from 'zod'

export const communityStatsSchema = z
  .object({
    learners: z.number().int().nonnegative().optional(),
    users: z.number().int().nonnegative().optional(),
    cards: z.number().int().nonnegative(),
    reviews: z.union([
      z.number().int().nonnegative(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((v) => Number(v)),
    ]),
  })
  .transform((data) => ({
    learners: data.learners ?? data.users ?? 0,
    cards: data.cards,
    reviews:
      typeof data.reviews === 'string' ? Number(data.reviews) : data.reviews,
  }))

export type CommunityStats = z.infer<typeof communityStatsSchema>
