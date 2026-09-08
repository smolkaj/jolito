import { z } from 'zod'

// Read-only. Never print the provider response: it includes SMTP credentials.
const authConfigSchema = z.object({
  site_url: z.string(),
  smtp_host: z.string().nullish(),
  smtp_admin_email: z.string().nullish(),
  rate_limit_email_sent: z.number().optional(),
  disable_signup: z.boolean().optional(),
})

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref =
    process.env.SUPABASE_PROJECT_ID ?? process.env.SUPABASE_PROJECT_REF
  if (!token || !ref) {
    console.error(
      'Not checked: set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID to inspect hosted signup settings. No emails will be sent.',
    )
    process.exitCode = 2
    return
  }
  if (!/^[a-z0-9]+$/.test(ref))
    throw new Error('Invalid Supabase project reference.')
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/config/auth`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  )
  if (!response.ok)
    throw new Error(
      `Could not inspect hosted signup settings (HTTP ${response.status}).`,
    )
  const parsed = authConfigSchema.safeParse(await response.json())
  if (!parsed.success)
    throw new Error(
      'Hosted signup settings did not match the expected schema; inspect the dashboard.',
    )
  const config = parsed.data
  const customSmtp = Boolean(
    config.smtp_host?.trim() && config.smtp_admin_email?.trim(),
  )
  const canonicalRedirect =
    config.site_url.replace(/\/+$/, '') === 'https://joli.to'
  console.log(
    JSON.stringify(
      {
        customSmtp,
        canonicalRedirect,
        signupDisabled: config.disable_signup ?? 'not reported',
        authEmailsPerHour: config.rate_limit_email_sent ?? 'not reported',
        inboxDelivery:
          'Not tested. Complete one sign-in with a consenting non-team recipient.',
        operatingCost:
          'Confirm free plan and hard limits in provider dashboards.',
      },
      null,
      2,
    ),
  )
  if (!customSmtp || !canonicalRedirect || config.disable_signup)
    process.exitCode = 1
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Preflight failed.')
  process.exitCode = 1
})
