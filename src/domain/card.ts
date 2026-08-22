import { z } from 'zod'

export const cardDirectionSchema = z.enum(['es-en', 'en-es'])

export const cardSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  direction: cardDirectionSchema,
  createdAt: z.iso.datetime(),
})

export const cardCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  cards: z.array(cardSchema),
})

export type CardDirection = z.infer<typeof cardDirectionSchema>
export type Card = z.infer<typeof cardSchema>
export type CardCollection = z.infer<typeof cardCollectionSchema>
