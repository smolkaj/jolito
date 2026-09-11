// @vitest-environment node
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { unstable_dev } from 'wrangler'
import workerConfig from '../../wrangler.signup-alerts.json'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import worker, { type SignupAlertsEnv } from '../../src/worker/signup-alerts'

// These tests deliberately use only the local stack: SQL changes simulate a
// terminated worker and time passing without waiting thirty real minutes.
const url = 'http://127.0.0.1:54321'
const serviceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const anonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const users: string[] = []

function sql(statement: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_jolito',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    {
      input: statement,
      encoding: 'utf8',
    },
  ).trim()
}

async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${url}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok)
    throw new Error(
      `${path}: HTTP ${response.status}: ${await response.text()}`,
    )
  return response.json()
}

async function unverifiedUser() {
  const email = `signup-alert-${crypto.randomUUID()}@example.com`
  const user = z
    .object({ id: z.uuid(), email: z.email() })
    .parse(
      await request('/auth/v1/admin/users', { email, email_confirm: false }),
    )
  users.push(user.id)
  return user
}

async function verify(email: string): Promise<void> {
  const link = z.object({ hashed_token: z.string() }).parse(
    await request('/auth/v1/admin/generate_link', {
      type: 'magiclink',
      email,
    }),
  )
  const session = z.object({ access_token: z.string() }).parse(
    await request('/auth/v1/verify', {
      type: 'magiclink',
      token_hash: link.hashed_token,
    }),
  )
  expect(session.access_token).not.toBe('')
}

function environment(): SignupAlertsEnv {
  return {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SIGNUP_NOTIFICATION_EMAIL: 'maintainer@example.com',
    SEND_EMAIL: {
      send: vi.fn().mockResolvedValue({ messageId: 'local-accepted' }),
    },
  }
}

beforeAll(() => {
  sql(
    "insert into private.signup_notifications (user_id, status) select id, 'suppressed' from auth.users where email_confirmed_at is not null on conflict (user_id) do update set status = 'suppressed';",
  )
})
afterAll(async () => {
  for (const id of users) {
    const response = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    expect(response.ok).toBe(true)
  }
})

describe('signup alert lifecycle through real Supabase Auth and PostgREST', () => {
  it('ignores unverified accounts, then recovers a delivery outage after verification without another sign-in', async () => {
    const user = await unverifiedUser()
    const env = environment()
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).not.toHaveBeenCalled()

    await verify(user.email)
    vi.mocked(env.SEND_EMAIL.send).mockRejectedValueOnce(
      new Error('Mail provider offline'),
    )
    await expect(worker.scheduled({}, env)).rejects.toThrow(
      '1 signup notification attempt failed',
    )
    expect(
      sql(
        `select status from private.signup_notifications where user_id = '${user.id}'`,
      ),
    ).toBe('pending')
    sql(
      `update private.signup_notifications set lease_until = now() - interval '1 second' where user_id = '${user.id}'`,
    )
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2)
    expect(vi.mocked(env.SEND_EMAIL.send).mock.calls[1]?.[0].text).toContain(
      user.email,
    )
    expect(
      sql(
        `select status from private.signup_notifications where user_id = '${user.id}'`,
      ),
    ).toBe('sent')
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2)
  })

  it('coordinates simultaneous invocations against the actual database', async () => {
    const user = await unverifiedUser()
    await verify(user.email)
    const first = environment()
    const second = environment()
    await Promise.all([
      worker.scheduled({}, first),
      worker.scheduled({}, second),
    ])
    const attempts = [
      ...vi.mocked(first.SEND_EMAIL.send).mock.calls,
      ...vi.mocked(second.SEND_EMAIL.send).mock.calls,
    ]
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.[0].text).toContain(user.email)
  })

  it('recovers a terminated invocation and rejects its stale acknowledgement', async () => {
    const user = await unverifiedUser()
    await verify(user.email)
    const claims = z
      .array(z.object({ user_id: z.uuid(), lease_id: z.uuid() }))
      .parse(await request('/rest/v1/rpc/claim_signup_notifications', {}))
    expect(claims).toHaveLength(1)
    const claim = claims[0]!
    const env = environment()
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).not.toHaveBeenCalled()
    sql(
      `update private.signup_notifications set lease_until = now() - interval '1 second' where user_id = '${user.id}'`,
    )
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1)
    expect(
      await request('/rest/v1/rpc/finish_signup_notification', {
        p_user_id: claim.user_id,
        p_lease_id: claim.lease_id,
        p_delivered: true,
      }),
    ).toBe(false)
  })

  it('delivers through the actual local Workers email binding and persists its receipt', async () => {
    const user = await unverifiedUser()
    await verify(user.email)
    mkdirSync('.wrangler', { recursive: true })
    const directory = mkdtempSync('.wrangler/signup-runtime-')
    const configPath = resolve(directory, 'wrangler.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        ...workerConfig,
        main: resolve(workerConfig.main),
        send_email: [
          { name: 'SEND_EMAIL', destination_address: 'maintainer@example.com' },
        ],
        vars: {
          SUPABASE_URL: url,
          SUPABASE_SERVICE_ROLE_KEY: serviceKey,
          SIGNUP_NOTIFICATION_EMAIL: 'maintainer@example.com',
        },
      }),
    )
    const runtime = await unstable_dev(workerConfig.main, {
      config: configPath,
      local: true,
      ip: '127.0.0.1',
      port: 0,
      inspectorPort: 0,
      logLevel: 'error',
      experimental: {
        testScheduled: true,
        disableExperimentalWarning: true,
        disableDevRegistry: true,
        watch: false,
      },
    })
    try {
      expect((await runtime.fetch('/__scheduled')).ok).toBe(true)
      expect(
        sql(
          `select status from private.signup_notifications where user_id = '${user.id}'`,
        ),
      ).toBe('sent')
      expect((await runtime.fetch('/__scheduled')).ok).toBe(true)
      expect(
        sql(
          `select attempts from private.signup_notifications where user_id = '${user.id}'`,
        ),
      ).toBe('1')
    } finally {
      await runtime.stop()
      rmSync(directory, { recursive: true, force: true })
    }
  }, 30_000)

  it('baselines existing verified accounts when the actual migration is installed', () => {
    const migration = readFileSync(
      'supabase/migrations/20260910000000_signup_notifications.sql',
      'utf8',
    )
    const result = sql(`begin;
      drop function public.claim_signup_notifications();
      drop function public.finish_signup_notification(uuid, uuid, boolean);
      drop table private.signup_notifications;
      insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
        ('b0000000-0000-4000-8000-000000000001', 'existing@example.com', now(), now()),
        ('b0000000-0000-4000-8000-000000000002', 'waiting@example.com', null, null);
      ${migration}
      select status from private.signup_notifications where user_id = 'b0000000-0000-4000-8000-000000000001';
      select count(*) from public.claim_signup_notifications();
      update auth.users set email_confirmed_at = now(), last_sign_in_at = now() where id = 'b0000000-0000-4000-8000-000000000002';
      select user_id from public.claim_signup_notifications();
      rollback;`)
    expect(result).toContain('suppressed\n0')
    expect(result).toContain('b0000000-0000-4000-8000-000000000002')
  })

  it('rejects requests without a service credential', async () => {
    const response = await fetch(
      `${url}/rest/v1/rpc/claim_signup_notifications`,
      {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: '{}',
      },
    )
    expect(response.ok).toBe(false)
  })
})
