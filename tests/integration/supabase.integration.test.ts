import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { AuthService, AuthUser } from '../../src/application/ports'
import type { StudyCard } from '../../src/domain/card'
import type { SupabaseAuthService } from '../../src/infrastructure/supabase/auth-service'
import { SupabaseFeedbackService } from '../../src/infrastructure/supabase/feedback-service'
import { SupabaseSyncService } from '../../src/infrastructure/supabase/sync-service'

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
).replace(/\/+$/, '')
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

async function ensureLocalSupabaseRunning(): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(2000),
    })
    if (res.status === 200 || res.status === 401) {
      return
    }
    throw new Error(
      `Unexpected HTTP status ${res.status} from local Supabase at ${SUPABASE_URL}/rest/v1/`,
    )
  } catch (err) {
    throw new Error(
      `Local Supabase is offline or unreachable at ${SUPABASE_URL}.\n` +
        `Live integration tests require a running local Supabase stack.\n` +
        `Start local Supabase with:\n` +
        `  npx supabase start -x realtime,storage-api,imgproxy,studio,logflare,vector,supavisor\n` +
        `Caused by: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

describe('Supabase Live Stack Integration', () => {
  beforeAll(async () => {
    await ensureLocalSupabaseRunning()
  })

  async function createRealTestUser(prefix: string): Promise<{
    user: AuthUser
    accessToken: string
    authService: AuthService
  }> {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`

    const signupRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'magiclink', email }),
      },
    )

    if (!signupRes.ok) {
      const errText = await signupRes.text()
      throw new Error(`Failed to create test user: ${errText}`)
    }

    const link = z
      .object({
        hashed_token: z.string(),
        verification_type: z.enum(['signup', 'magiclink']),
      })
      .parse(await signupRes.json())
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: link.verification_type,
        token_hash: link.hashed_token,
      }),
    })
    if (!verifyRes.ok)
      throw new Error(`Failed to verify test user: HTTP ${verifyRes.status}`)
    const data = (await verifyRes.json()) as {
      access_token: string
      user: { id: string; email: string }
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
    }
    const token = data.access_token

    const authService: AuthService = {
      getCurrentUser: () => authUser,
      isCurrentOwner: (ownerId: string | null) => ownerId === authUser.id,
      getUser: () => Promise.resolve(authUser),
      getAccessToken: () => Promise.resolve(token),
      refreshSession: () => Promise.resolve(token),
      sendMagicLink: () => Promise.resolve({ success: true }),
      verifyOtp: () => Promise.resolve({ success: true }),
      signOut: () => Promise.resolve(),
      onAuthStateChange: () => () => {},
    }

    return { user: authUser, accessToken: token, authService }
  }

  it('allows guest to submit feedback end-to-end to local Supabase', async () => {
    const dummyAuth: AuthService = {
      getCurrentUser: () => null,
      isCurrentOwner: (ownerId: string | null) => ownerId === null,
      getUser: () => Promise.resolve(null),
      getAccessToken: () => Promise.resolve(null),
      sendMagicLink: () => Promise.resolve({ success: true }),
      verifyOtp: () => Promise.resolve({ success: true }),
      signOut: () => Promise.resolve(),
      onAuthStateChange: () => () => {},
    }

    const feedbackService = new SupabaseFeedbackService(
      dummyAuth,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )

    const uniqueMsg = `Live guest note ${Date.now()}`
    const result = await feedbackService.submitFeedback(
      {
        message: uniqueMsg,
        context: { view: 'welcome', source: 'integration-test' },
      },
      null,
    )

    expect(result.success).toBe(true)

    // Verify row exists in PostgREST using service role key
    const verifyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/feedback?message=eq.${encodeURIComponent(uniqueMsg)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    expect(verifyRes.ok).toBe(true)
    const rows = (await verifyRes.json()) as Array<{
      email: string
      user_id: string | null
      message: string
    }>
    expect(rows.length).toBe(1)
    expect(rows[0]?.email).toBe('guest@jolito.app')
    expect(rows[0]?.user_id).toBeNull()
    expect(rows[0]?.message).toBe(uniqueMsg)
  })

  it('allows authenticated user to submit feedback with their user_id', async () => {
    const { user, authService } = await createRealTestUser('feedback-user')
    const feedbackService = new SupabaseFeedbackService(
      authService,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )

    const uniqueMsg = `Authenticated feedback note ${Date.now()}`
    const result = await feedbackService.submitFeedback(
      {
        message: uniqueMsg,
        context: { view: 'study' },
      },
      user,
    )

    expect(result.success).toBe(true)

    // Verify row in database
    const verifyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/feedback?message=eq.${encodeURIComponent(uniqueMsg)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )
    expect(verifyRes.ok).toBe(true)
    const rows = (await verifyRes.json()) as Array<{
      email: string
      user_id: string
      message: string
    }>
    expect(rows.length).toBe(1)
    expect(rows[0]?.user_id).toBe(user.id)
    expect(rows[0]?.email).toBe(user.email)
  })

  it('enforces PostgreSQL RLS: prevents anon reading or spoofing user_id in feedback', async () => {
    // 1. Anon reading feedback must return empty list (0 rows)
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })
    expect(readRes.ok).toBe(true)
    const rows = (await readRes.json()) as unknown[]
    expect(rows).toEqual([])

    // 2. Anon attempting to insert with non-null user_id must be rejected with RLS error (42501)
    const fakeUserId = '33333333-3333-3333-3333-333333333333'
    const spoofRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: fakeUserId,
        email: 'spoofed@example.com',
        message: 'Spoofed feedback submission',
      }),
    })
    expect(spoofRes.ok).toBe(false)
    const errBody = (await spoofRes.json()) as { code: string; message: string }
    expect(errBody.code).toBe('42501')
    expect(errBody.message).toContain('row-level security')
  })

  it('enforces PostgreSQL RLS: user A can only view their own feedback, not user B or guests', async () => {
    const userA = await createRealTestUser('user-a')
    const userB = await createRealTestUser('user-b')

    const feedbackServiceA = new SupabaseFeedbackService(
      userA.authService,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )
    const feedbackServiceB = new SupabaseFeedbackService(
      userB.authService,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    )

    const msgA = `User A note ${Date.now()}`
    const msgB = `User B note ${Date.now()}`

    await feedbackServiceA.submitFeedback({ message: msgA }, userA.user)
    await feedbackServiceB.submitFeedback({ message: msgB }, userB.user)

    // User A reads feedback via PostgREST with User A token
    const userARead = await fetch(
      `${SUPABASE_URL}/rest/v1/feedback?select=message,user_id`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userA.accessToken}`,
        },
      },
    )
    expect(userARead.ok).toBe(true)
    const userARows = (await userARead.json()) as Array<{
      message: string
      user_id: string
    }>
    const messages = userARows.map((r) => r.message)
    expect(messages).toContain(msgA)
    expect(messages).not.toContain(msgB)
    for (const r of userARows) {
      expect(r.user_id).toBe(userA.user.id)
    }
  })

  it('synchronizes decks and guarantees RLS user isolation', async () => {
    const userA = await createRealTestUser('sync-a')
    const userB = await createRealTestUser('sync-b')

    const syncServiceA = new SupabaseSyncService(
      userA.authService as unknown as SupabaseAuthService,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      'device-a',
    )
    const syncServiceB = new SupabaseSyncService(
      userB.authService as unknown as SupabaseAuthService,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      'device-b',
    )

    const sampleCard: StudyCard = {
      id: 'card-live-1',
      noteId: 'note-live-1',
      prompt: 'la calabaza',
      answer: 'pumpkin',
      direction: 'es-en',
      context: 'En el mercado',
      scene: 'takeaway',
      schedule: {
        state: 'new',
        dueAt: Date.now(),
        intervalDays: 1,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: Date.now(),
    }

    // 1. User A pushes deck
    const pushResult = await syncServiceA.pushDeck([sampleCard], userA.user)
    expect(pushResult.success).toBe(true)

    // 2. User A pulls deck -> sees their card
    const pullA = await syncServiceA.pullDeck(userA.user)
    expect(pullA.success).toBe(true)
    expect(pullA.cards).toEqual([sampleCard])

    // 3. User B pulls deck -> gets empty list (cannot see User A deck)
    const pullB = await syncServiceB.pullDeck(userB.user)
    expect(pullB.success).toBe(true)
    expect(pullB.cards).toEqual([])

    // 4. Anon user attempting to read decks via PostgREST is blocked by RLS
    const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/decks?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })
    expect(anonRes.ok).toBe(true)
    const anonRows = (await anonRes.json()) as unknown[]
    expect(anonRows).toEqual([])
  })
})
