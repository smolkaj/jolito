import { z } from 'zod'

export const postgrestErrorPayloadSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
    details: z.string().nullable().optional(),
    hint: z.string().nullable().optional(),
  })
  .passthrough()

export type PostgrestErrorPayload = z.infer<typeof postgrestErrorPayloadSchema>

export function parsePostgrestErrorPayload(
  errorText?: string | null,
): PostgrestErrorPayload | null {
  if (typeof errorText !== 'string') return null
  const trimmed = errorText.trim()
  if (trimmed.length === 0) return null

  try {
    const parsed: unknown = JSON.parse(trimmed)
    const result = postgrestErrorPayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
