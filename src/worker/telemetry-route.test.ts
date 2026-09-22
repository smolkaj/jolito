import { describe, expect, it, vi } from 'vitest'
import {
  handleTelemetryRequest,
  extractCountryFromRequest,
  type TelemetryWorkerEnv,
} from './telemetry-route'

describe('extractCountryFromRequest', () => {
  it('extracts country from cf-ipcountry header', () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      headers: { 'cf-ipcountry': 'DE' },
    })
    expect(extractCountryFromRequest(req)).toBe('de')
  })

  it('extracts country from request.cf.country if header missing', () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat')
    Object.defineProperty(req, 'cf', {
      value: { country: 'MX' },
    })
    expect(extractCountryFromRequest(req)).toBe('mx')
  })

  it('falls back to unknown if missing or invalid', () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat')
    expect(extractCountryFromRequest(req)).toBe('unknown')
  })
})

describe('handleTelemetryRequest', () => {
  const validEnv: TelemetryWorkerEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-key',
    TELEMETRY_SECRET: 'test-salt',
  }

  const validPayload = {
    deviceId: 'dev-123456789',
    platform: 'ios',
    os: 'iOS 18.0',
    browser: 'Mobile Safari',
    deviceType: 'mobile',
    engagementTier: 'active',
  }

  it('returns 204 for OPTIONS with CORS headers', async () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'OPTIONS',
    })
    const res = await handleTelemetryRequest(req)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('returns 405 for GET', async () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'GET',
    })
    const res = await handleTelemetryRequest(req)
    expect(res.status).toBe(405)
    expect(res.headers.get('Allow')).toContain('POST')
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'POST',
      body: 'invalid-json{',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handleTelemetryRequest(req, validEnv)
    expect(res.status).toBe(400)
    const data = (await res.json()) as { error?: string }
    expect(data.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid payload (missing or short deviceId)', async () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ deviceId: 'short' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handleTelemetryRequest(req, validEnv)
    expect(res.status).toBe(400)
    const data = (await res.json()) as { error?: string }
    expect(data.error).toBe('Validation failed')
  })

  it('returns 503 if Supabase is unconfigured', async () => {
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await handleTelemetryRequest(req, {})
    expect(res.status).toBe(503)
  })

  it('successfully records telemetry via Supabase RPC', async () => {
    let capturedUrl = ''
    let capturedBody: Record<string, unknown> = {}
    const mockFetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url
        capturedBody = JSON.parse((init?.body as string) || '{}') as Record<
          string,
          unknown
        >
        return Promise.resolve(new Response(null, { status: 200 }))
      })

    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: {
        'Content-Type': 'application/json',
        'cf-ipcountry': 'US',
      },
    })

    const res = await handleTelemetryRequest(req, validEnv, {
      fetchFn: mockFetch as unknown as typeof fetch,
      nowFn: () => new Date('2026-09-22T12:00:00Z'),
    })

    expect(res.status).toBe(200)
    expect(capturedUrl).toBe(
      'https://test.supabase.co/rest/v1/rpc/record_client_activity',
    )
    expect(capturedBody.p_country).toBe('us')
    expect(capturedBody.p_platform).toBe('ios')
    expect(capturedBody.p_os).toBe('iOS 18.0')
    expect(capturedBody.p_browser).toBe('Mobile Safari')
    expect(capturedBody.p_device_type).toBe('mobile')
    expect(capturedBody.p_engagement_tier).toBe('active')
    expect(typeof capturedBody.p_user_hash).toBe('string')
    expect((capturedBody.p_user_hash as string).length).toBe(64)
  })

  it('returns 502 if Supabase RPC returns error status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('DB Error', { status: 500 }))
    const req = new Request('https://joli.to/api/telemetry/heartbeat', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await handleTelemetryRequest(req, validEnv, {
      fetchFn: mockFetch as unknown as typeof fetch,
    })
    expect(res.status).toBe(502)
  })
})
