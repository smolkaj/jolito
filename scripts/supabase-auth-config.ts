import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { loadEnvLocal } from './cf-utils.ts'

export interface BuildSupabaseAuthPatchOptions {
  domain: string
  resendApiKey?: string | undefined
  magicLinkTemplate?: string | undefined
}

export function buildSupabaseAuthPatch({
  domain,
  resendApiKey,
  magicLinkTemplate,
}: BuildSupabaseAuthPatchOptions): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    site_url: `https://${domain}`,
    mailer_autoconfirm: false,
    uri_allow_list: `https://${domain}/**,https://*-jolito.smolkaj.workers.dev/**,https://jolito.smolkaj.workers.dev/**,http://localhost:*/**,http://127.0.0.1:*/**`,
  }

  if (magicLinkTemplate) {
    patch.mailer_subjects_magic_link =
      'Your Jolito verification code is {{ .Token }}'
    patch.mailer_templates_magic_link_content = magicLinkTemplate
    patch.mailer_subjects_confirmation = patch.mailer_subjects_magic_link
    patch.mailer_templates_confirmation_content = magicLinkTemplate
  }

  if (resendApiKey) {
    patch.smtp_host = 'smtp.resend.com'
    patch.smtp_port = '587'
    patch.smtp_user = 'resend'
    patch.smtp_pass = resendApiKey
    patch.smtp_admin_email = `signin@${domain}`
    patch.smtp_sender_name = 'Jolito'
  }

  return patch
}

export async function syncSupabaseAuthConfig(
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const config = z
    .object({
      SUPABASE_ACCESS_TOKEN: z.string().min(1),
      SUPABASE_PROJECT_ID: z.string().regex(/^[a-z0-9]+$/),
    })
    .parse(env)
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${config.SUPABASE_PROJECT_ID}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${config.SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildSupabaseAuthPatch({
          domain: 'joli.to',
          magicLinkTemplate: readFileSync(
            'supabase/templates/magic_link.html',
            'utf8',
          ),
        }),
      ),
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok)
    throw new Error(
      `Supabase Auth configuration failed (HTTP ${response.status})`,
    )
  z.object({ mailer_autoconfirm: z.literal(false) }).parse(
    await response.json(),
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  loadEnvLocal()
  await syncSupabaseAuthConfig(process.env)
}
