import { test } from 'node:test'
import assert from 'node:assert/strict'
import { provisionDemoAccount } from '../../scripts/provision-demo-account.ts'

const validEnv = {
  SUPABASE_ACCESS_TOKEN: 'sbp_mock_token_123456789',
  SUPABASE_PROJECT_ID: 'xwqjelkfdcfzyxxblvhp',
  APP_REVIEW_EMAIL: 'reviewer@joli.to',
  APP_REVIEW_MAILBOX_PASSWORD: 'SuperSecretPassword123!',
}

const mockKeys = [
  { name: 'anon', api_key: 'mock-anon-key' },
  { name: 'service_role', api_key: 'mock-service-role-key' },
]

function mockFetchFactory(options: {
  existingUsers?: Array<{ id: string; email: string | null }>
  pages?: Record<number, Array<{ id: string; email: string | null }>>
  updateOk?: boolean
  createOk?: boolean
  verifyOk?: boolean
  keysOk?: boolean
  listOk?: boolean
}) {
  const {
    existingUsers = [],
    pages,
    updateOk = true,
    createOk = true,
    verifyOk = true,
    keysOk = true,
    listOk = true,
  } = options

  const calls: { url: string; method: string; body?: unknown }[] = []

  const mockFetch: typeof fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const method = init?.method ?? 'GET'
    const body: unknown = init?.body
      ? (JSON.parse(init.body as string) as unknown)
      : undefined
    calls.push({ url, method, body })

    if (url.includes('/api-keys')) {
      if (!keysOk) {
        return Promise.resolve(new Response('Forbidden', { status: 403 }))
      }
      return Promise.resolve(Response.json(mockKeys))
    }

    if (url.includes('/auth/v1/admin/users')) {
      if (method === 'GET') {
        if (!listOk)
          return Promise.resolve(new Response('Server error', { status: 500 }))
        if (pages) {
          const match = url.match(/[?&]page=(\d+)/)
          const pageNum = match && match[1] ? parseInt(match[1], 10) : 1
          return Promise.resolve(Response.json({ users: pages[pageNum] ?? [] }))
        }
        return Promise.resolve(Response.json({ users: existingUsers }))
      }
      if (method === 'PUT') {
        if (!updateOk)
          return Promise.resolve(new Response('Bad request', { status: 400 }))
        return Promise.resolve(
          Response.json({ id: 'user-123', email: 'reviewer@joli.to' }),
        )
      }
      if (method === 'POST') {
        if (!createOk)
          return Promise.resolve(new Response('Unprocessable', { status: 422 }))
        return Promise.resolve(
          Response.json({ id: 'user-456', email: 'reviewer@joli.to' }),
        )
      }
    }

    if (url.includes('/auth/v1/token?grant_type=password')) {
      if (!verifyOk) {
        return Promise.resolve(
          new Response(JSON.stringify({ error_code: 'invalid_credentials' }), {
            status: 400,
          }),
        )
      }
      return Promise.resolve(
        Response.json({
          access_token: 'mock-verified-jwt-token',
          token_type: 'bearer',
          user: { id: 'verified-user-id' },
        }),
      )
    }

    return Promise.reject(new Error(`Unexpected mock request to ${url}`))
  }

  return { mockFetch, calls }
}

void test('provisionDemoAccount validates required environment variables without leaking them', async () => {
  await assert.rejects(
    () => provisionDemoAccount({}, () => Promise.resolve(new Response())),
    (err: Error) => {
      assert.match(
        err.message,
        /Missing or invalid configuration for demo account provisioning/,
      )
      assert.doesNotMatch(err.message, /SuperSecretPassword/)
      return true
    },
  )

  await assert.rejects(
    () =>
      provisionDemoAccount(
        {
          ...validEnv,
          APP_REVIEW_MAILBOX_PASSWORD: 'short',
        },
        () => Promise.resolve(new Response()),
      ),
    (err: Error) => {
      assert.match(err.message, /APP_REVIEW_MAILBOX_PASSWORD/)
      assert.doesNotMatch(err.message, /short/)
      return true
    },
  )

  await assert.rejects(
    () =>
      provisionDemoAccount(
        {
          ...validEnv,
          APP_REVIEW_EMAIL: 'reviewer@gmail.com',
        },
        () => Promise.resolve(new Response()),
      ),
    (err: Error) => {
      assert.match(err.message, /APP_REVIEW_EMAIL/)
      return true
    },
  )
})

void test('provisionDemoAccount creates new user and verifies password when user does not exist', async () => {
  const { mockFetch, calls } = mockFetchFactory({ existingUsers: [] })
  const result = await provisionDemoAccount(validEnv, mockFetch)

  assert.deepEqual(result, { success: true, action: 'created' })
  const createCall = calls.find(
    (c) => c.method === 'POST' && c.url.includes('/admin/users'),
  )
  assert.ok(createCall)
  assert.deepEqual(createCall.body, {
    email: 'reviewer@joli.to',
    password: 'SuperSecretPassword123!',
    email_confirm: true,
  })

  const verifyCall = calls.find(
    (c) => c.method === 'POST' && c.url.includes('/token?grant_type=password'),
  )
  assert.ok(verifyCall)
  assert.deepEqual(verifyCall.body, {
    email: 'reviewer@joli.to',
    password: 'SuperSecretPassword123!',
  })
})

void test('provisionDemoAccount updates existing user password across paginated results and handles null emails', async () => {
  const dummyUsers = Array.from({ length: 50 }, (_, i) => ({
    id: `dummy-${i}`,
    email: i % 3 === 0 ? null : `other-${i}@example.com`,
  }))
  const { mockFetch, calls } = mockFetchFactory({
    pages: {
      1: dummyUsers,
      2: [
        { id: 'anon-guest', email: null },
        { id: 'user-page-2', email: 'reviewer@joli.to' },
      ],
    },
  })
  const result = await provisionDemoAccount(validEnv, mockFetch)

  assert.deepEqual(result, { success: true, action: 'updated' })
  const updateCall = calls.find(
    (c) => c.method === 'PUT' && c.url.includes('/admin/users/user-page-2'),
  )
  assert.ok(updateCall)
  assert.deepEqual(updateCall.body, {
    password: 'SuperSecretPassword123!',
    email_confirm: true,
  })
})

void test('provisionDemoAccount masks dynamic secrets and tokens when running in GITHUB_ACTIONS', async () => {
  const outputs: string[] = []
  const originalWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = (
    chunk: string | Uint8Array,
    ...args: unknown[]
  ): boolean => {
    outputs.push(chunk.toString())
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return originalWrite(chunk, ...(args as any))
  }

  try {
    const { mockFetch } = mockFetchFactory({ existingUsers: [] })
    await provisionDemoAccount(
      { ...validEnv, GITHUB_ACTIONS: 'true' },
      mockFetch,
    )

    const maskedEntries = outputs.filter((l) => l.startsWith('::add-mask::'))
    assert.ok(maskedEntries.length >= 3)
    assert.ok(
      maskedEntries.some((l) => l.includes('mock-service-role-key')),
      'Service key must be registered with ::add-mask::',
    )
    assert.ok(
      maskedEntries.some((l) => l.includes('mock-anon-key')),
      'Anon key must be registered with ::add-mask::',
    )
    assert.ok(
      maskedEntries.some((l) => l.includes('mock-verified-jwt-token')),
      'Verified JWT must be registered with ::add-mask::',
    )
  } finally {
    process.stdout.write = originalWrite
  }
})

void test('provisionDemoAccount fails loudly with sanitized error if password verification fails', async () => {
  const { mockFetch } = mockFetchFactory({ verifyOk: false })
  await assert.rejects(
    () => provisionDemoAccount(validEnv, mockFetch),
    (err: Error) => {
      assert.match(
        err.message,
        /Password verification check for provisioned demo user failed \(HTTP 400\)/,
      )
      assert.doesNotMatch(err.message, /SuperSecretPassword/)
      return true
    },
  )
})

void test('provisionDemoAccount fails loudly if Supabase API keys lookup fails', async () => {
  const { mockFetch } = mockFetchFactory({ keysOk: false })
  await assert.rejects(
    () => provisionDemoAccount(validEnv, mockFetch),
    (err: Error) => {
      assert.match(err.message, /Supabase API key lookup failed \(HTTP 403\)/)
      return true
    },
  )
})

void test('provisionDemoAccount fails loudly if Supabase list users fails', async () => {
  const { mockFetch } = mockFetchFactory({ listOk: false })
  await assert.rejects(
    () => provisionDemoAccount(validEnv, mockFetch),
    (err: Error) => {
      assert.match(
        err.message,
        /Failed to query Supabase users list \(HTTP 500\)/,
      )
      return true
    },
  )
})
