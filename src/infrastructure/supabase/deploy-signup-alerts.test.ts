import { afterEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { cfApi } from '../../../scripts/cf-utils'
import { deploySignupAlerts } from '../../../scripts/deploy-signup-alerts'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  const execFileSync = vi.fn()
  return { ...actual, execFileSync, default: { ...actual, execFileSync } }
})
vi.mock('../../../scripts/cf-utils.ts', () => ({
  cfApi: vi.fn(),
  loadEnvLocal: vi.fn(),
}))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})
import { verifiedMaintainerInbox } from '../../../scripts/deploy-signup-alerts'

const rules = [
  {
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: 'a@joli.to' }],
    actions: [{ type: 'forward', value: ['maintainer@example.com'] }],
  },
]

describe('free signup email destination', () => {
  it('uses the verified destination itself, not the forwarding alias', () => {
    expect(
      verifiedMaintainerInbox(
        [{ email: 'maintainer@example.com', verified: '2026-01-01' }],
        rules,
      ),
    ).toBe('maintainer@example.com')
  })
  it('rejects unverified destinations rather than selecting a paid fallback', () => {
    expect(() =>
      verifiedMaintainerInbox(
        [{ email: 'maintainer@example.com', verified: null }],
        rules,
      ),
    ).toThrow('must be verified')
  })
  it('rejects ambiguous or missing configuration', () => {
    expect(() => verifiedMaintainerInbox([], [])).toThrow(
      'one active forwarding destination',
    )
    expect(() => verifiedMaintainerInbox([], [...rules, ...rules])).toThrow(
      'one active forwarding destination',
    )
    expect(() =>
      verifiedMaintainerInbox([], [{ ...rules[0], enabled: false }]),
    ).toThrow('one active forwarding destination')
  })
})

describe('signup worker deployment', () => {
  it('restricts delivery and keeps secrets separate from the public app configuration', async () => {
    vi.mocked(cfApi)
      .mockResolvedValueOnce([{ id: 'zone-1', account: { id: 'account-1' } }])
      .mockResolvedValueOnce([
        { email: 'maintainer@example.com', verified: '2026-01-01' },
      ])
      .mockResolvedValueOnce(rules)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ mailer_autoconfirm: false }))
        .mockResolvedValueOnce(
          Response.json([{ name: 'service_role', api_key: 'test-secret-key' }]),
        ),
    )
    let configPath = ''
    let secretsPath = ''
    vi.mocked(execFileSync).mockImplementation((_file, args) => {
      const argumentsList = args as string[]
      configPath = argumentsList[3]!
      secretsPath = argumentsList[5]!
      expect(JSON.parse(readFileSync(configPath, 'utf8'))).toMatchObject({
        name: 'jolito-signup-alerts',
        workers_dev: false,
        preview_urls: false,
        send_email: [
          { name: 'SEND_EMAIL', destination_address: 'maintainer@example.com' },
        ],
        triggers: { crons: ['*/5 * * * *'] },
      })
      expect(readFileSync(configPath, 'utf8')).not.toContain('test-secret-key')
      expect(JSON.parse(readFileSync(secretsPath, 'utf8'))).toEqual({
        SUPABASE_SERVICE_ROLE_KEY: 'test-secret-key',
        SIGNUP_NOTIFICATION_EMAIL: 'maintainer@example.com',
      })
      return Buffer.from('')
    })
    await deploySignupAlerts({
      CLOUDFLARE_API_TOKEN: 'test-cf',
      SUPABASE_ACCESS_TOKEN: 'test-sb',
      SUPABASE_PROJECT_ID: 'testproject',
    })
    expect(execFileSync).toHaveBeenCalledTimes(1)
    expect(existsSync(configPath)).toBe(false)
    expect(existsSync(secretsPath)).toBe(false)
  })

  it('refuses to activate notifications when Auth auto-confirms accounts', async () => {
    vi.mocked(cfApi)
      .mockResolvedValueOnce([{ id: 'zone-1', account: { id: 'account-1' } }])
      .mockResolvedValueOnce([
        { email: 'maintainer@example.com', verified: '2026-01-01' },
      ])
      .mockResolvedValueOnce(rules)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ mailer_autoconfirm: true })),
    )
    await expect(
      deploySignupAlerts({
        CLOUDFLARE_API_TOKEN: 'test-cf',
        SUPABASE_ACCESS_TOKEN: 'test-sb',
        SUPABASE_PROJECT_ID: 'testproject',
      }),
    ).rejects.toThrow()
    expect(execFileSync).not.toHaveBeenCalled()
  })

  it('fails before deploying when a required credential is missing', async () => {
    await expect(deploySignupAlerts({})).rejects.toThrow()
    expect(cfApi).not.toHaveBeenCalled()
    expect(execFileSync).not.toHaveBeenCalled()
  })
})
