/** Executed in the page: inspect the active account's collection, never legacy data. */
export function currentDeckJson(): string {
  const raw = localStorage.getItem('jolito-libraries-v1')
  const envelope = raw
    ? (JSON.parse(raw) as {
        accounts: Record<string, unknown>
        guest?: unknown
      })
    : null
  const sessionRaw = localStorage.getItem('jolito-auth-session-v1')
  const session = sessionRaw
    ? (JSON.parse(sessionRaw) as { user: { id: string } })
    : null
  const collection = session
    ? envelope?.accounts[`user:${session.user.id}`]
    : envelope?.guest
  return JSON.stringify(
    collection ?? { version: 3, cards: [], deletedCardIds: [] },
  )
}
