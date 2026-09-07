import { describe, expect, it } from 'vitest'
import { parsePostgrestErrorPayload } from './postgrest-error'

describe('parsePostgrestErrorPayload', () => {
  it('parses valid PostgREST JSON error payload', () => {
    const json = JSON.stringify({
      code: '42501',
      message: 'new row violates row-level security policy for table "decks"',
      details: 'Failing row contains (null, ...)',
      hint: 'Check your RLS policies.',
    })

    const result = parsePostgrestErrorPayload(json)
    expect(result).toEqual({
      code: '42501',
      message: 'new row violates row-level security policy for table "decks"',
      details: 'Failing row contains (null, ...)',
      hint: 'Check your RLS policies.',
    })
  })

  it('returns null for empty string or nullish input', () => {
    expect(parsePostgrestErrorPayload('')).toBeNull()
  })

  it('returns null for non-JSON string', () => {
    expect(parsePostgrestErrorPayload('Internal Server Error 500')).toBeNull()
    expect(
      parsePostgrestErrorPayload('<html><body>502 Bad Gateway</body></html>'),
    ).toBeNull()
  })

  it('handles partial fields gracefully', () => {
    const json = JSON.stringify({
      code: 'PGRST205',
      message: 'table not found',
    })

    const result = parsePostgrestErrorPayload(json)
    expect(result?.code).toBe('PGRST205')
    expect(result?.message).toBe('table not found')
    expect(result?.details).toBeUndefined()
  })
})
