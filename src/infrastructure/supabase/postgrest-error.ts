export interface PostgrestErrorPayload {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

export function parsePostgrestErrorPayload(
  errorText?: string | null,
): PostgrestErrorPayload | null {
  try {
    if (typeof errorText === 'string' && errorText.trim().length > 0) {
      const parsed: unknown = JSON.parse(errorText)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed
      }
    }
  } catch {
    // not JSON
  }
  return null
}
