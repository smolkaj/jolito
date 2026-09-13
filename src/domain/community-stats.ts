import { z } from 'zod'

const countSchema = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v)),
])

export const communityStatsSchema = z.object({
  learners: countSchema,
  cards: countSchema,
  reviews: countSchema,
})

export type CommunityStats = z.infer<typeof communityStatsSchema>
