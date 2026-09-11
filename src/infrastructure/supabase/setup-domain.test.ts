import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncSupabaseAuthConfig } from '../../../scripts/supabase-auth-config'

afterEach(() => vi.restoreAllMocks())
import {
  extractSupabaseProjectRef,
  getSupabaseAccessToken,
  buildSupabaseAuthPatch,
} from '../../../scripts/setup-domain'

describe('Domain & Supabase Setup Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractSupabaseProjectRef', () => {
    it('prefers explicit SUPABASE_PROJECT_REF env var', () => {
      const ref = extractSupabaseProjectRef({
        SUPABASE_PROJECT_REF: 'custom-ref-123',
        VITE_SUPABASE_URL: 'https://other-ref.supabase.co',
      })
      expect(ref).toBe('custom-ref-123')
    })

    it('extracts ref from VITE_SUPABASE_URL when SUPABASE_PROJECT_REF is unset', () => {
      const ref = extractSupabaseProjectRef({
        VITE_SUPABASE_URL: 'https://xwqjelkfdcfzyxxblvhp.supabase.co',
      })
      expect(ref).toBe('xwqjelkfdcfzyxxblvhp')
    })

    it('returns undefined if neither is present', () => {
      const ref = extractSupabaseProjectRef({})
      expect(ref).toBeUndefined()
    })
  })

  describe('getSupabaseAccessToken', () => {
    it('returns token from SUPABASE_ACCESS_TOKEN if provided', () => {
      const token = getSupabaseAccessToken({
        SUPABASE_ACCESS_TOKEN: 'test-token-xyz',
      })
      expect(token).toBe('test-token-xyz')
    })

    it('returns undefined when no env var or home file exists', () => {
      const token = getSupabaseAccessToken({
        HOME: '/nonexistent-home-dir-for-tests',
      })
      expect(token).toBeUndefined()
    })
  })

  describe('buildSupabaseAuthPatch', () => {
    it('builds base patch with site_url and uri_allow_list', () => {
      const patch = buildSupabaseAuthPatch({
        domain: 'joli.to',
      })

      expect(patch.site_url).toBe('https://joli.to')
      expect(patch.mailer_autoconfirm).toBe(false)
      expect(patch.uri_allow_list).toContain('https://joli.to/**')
      expect(patch.uri_allow_list).toContain('http://localhost:*/**')
      expect(patch.smtp_host).toBeUndefined()
      expect(patch.mailer_templates_magic_link_content).toBeUndefined()
    })

    it('attaches Resend custom SMTP settings when resendApiKey is provided', () => {
      const patch = buildSupabaseAuthPatch({
        domain: 'joli.to',
        resendApiKey: 're_test_key_123',
      })

      expect(patch.smtp_host).toBe('smtp.resend.com')
      expect(patch.smtp_port).toBe('587')
      expect(patch.smtp_user).toBe('resend')
      expect(patch.smtp_pass).toBe('re_test_key_123')
      expect(patch.smtp_admin_email).toBe('signin@joli.to')
      expect(patch.smtp_sender_name).toBe('Jolito')
    })

    it('attaches custom magic link template and subject when provided', () => {
      const patch = buildSupabaseAuthPatch({
        domain: 'joli.to',
        magicLinkTemplate: '<html><body>{{ .Token }}</body></html>',
      })

      expect(patch.mailer_subjects_magic_link).toBe(
        'Your Jolito verification code is {{ .Token }}',
      )
      expect(patch.mailer_templates_confirmation_content).toBe(
        patch.mailer_templates_magic_link_content,
      )
      expect(patch.mailer_subjects_confirmation).toBe(
        patch.mailer_subjects_magic_link,
      )
      expect(patch.mailer_templates_magic_link_content).toBe(
        '<html><body>{{ .Token }}</body></html>',
      )
    })
  })
})

describe('production email verification policy', () => {
  it('applies verified sign-in and the existing code template to both new and returning accounts', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ mailer_autoconfirm: false }))
    await syncSupabaseAuthConfig({
      SUPABASE_ACCESS_TOKEN: 'test-token',
      SUPABASE_PROJECT_ID: 'testproject',
    })
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.method).toBe('PATCH')
    const payload = JSON.parse(request?.body as string) as Record<
      string,
      unknown
    >
    expect(payload.mailer_autoconfirm).toBe(false)
    expect(payload.mailer_templates_confirmation_content).toBe(
      payload.mailer_templates_magic_link_content,
    )
    expect(payload.mailer_templates_confirmation_content).toContain(
      '{{ .Token }}',
    )
    expect(payload.mailer_subjects_confirmation).toBe(
      payload.mailer_subjects_magic_link,
    )
  })

  it('stops rollout when the authentication policy cannot be applied', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 403 }),
    )
    await expect(
      syncSupabaseAuthConfig({
        SUPABASE_ACCESS_TOKEN: 'test-token',
        SUPABASE_PROJECT_ID: 'testproject',
      }),
    ).rejects.toThrow('Auth configuration failed (HTTP 403)')
  })
})
