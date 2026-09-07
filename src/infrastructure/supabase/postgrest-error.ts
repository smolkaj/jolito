export interface PostgrestErrorPayload {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

export function parsePostgrestErrorPayload(
  errorText: string,
): PostgrestErrorPayload | null {
  try {
    if (errorText) {
      return JSON.parse(errorText) as PostgrestErrorPayload
    }
  } catch {
    // not JSON
  }
  return null
}
