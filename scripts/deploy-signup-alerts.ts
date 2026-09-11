import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import baseConfig from '../wrangler.signup-alerts.json' with { type: 'json' }
import { cfApi, loadEnvLocal } from './cf-utils.ts'

const addressesSchema = z.array(
  z.object({ email: z.email(), verified: z.string().nullable() }),
)
const rulesSchema = z.array(
  z.object({
    enabled: z.boolean(),
    matchers: z.array(
      z.object({
        type: z.string(),
        field: z.string(),
        value: z.string().optional(),
      }),
    ),
    actions: z.array(
      z.object({ type: z.string(), value: z.array(z.string()).optional() }),
    ),
  }),
)

export function verifiedMaintainerInbox(
  addresses: unknown,
  rules: unknown,
): string {
  const matches = rulesSchema
    .parse(rules)
    .filter(
      (rule) =>
        rule.enabled &&
        rule.matchers.some(
          (matcher) =>
            matcher.type === 'literal' &&
            matcher.field === 'to' &&
            matcher.value?.toLowerCase() === 'a@joli.to',
        ),
    )
  const recipients = matches.flatMap((rule) =>
    rule.actions
      .filter((action) => action.type === 'forward')
      .flatMap((action) => action.value ?? []),
  )
  if (recipients.length !== 1)
    throw new Error(
      'Expected one active forwarding destination for a@joli.to; run npm run setup:email',
    )
  const recipient = recipients[0]!
  if (
    !addressesSchema
      .parse(addresses)
      .some(
        (address) =>
          address.email.toLowerCase() === recipient.toLowerCase() &&
          address.verified,
      )
  ) {
    throw new Error(
      'The maintainer destination must be verified in Cloudflare Email Routing',
    )
  }
  return recipient
}

export async function deploySignupAlerts(
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const config = z
    .object({
      CLOUDFLARE_API_TOKEN: z.string().min(1),
      SUPABASE_ACCESS_TOKEN: z.string().min(1),
      SUPABASE_PROJECT_ID: z.string().regex(/^[a-z0-9]+$/),
    })
    .parse(env)
  const zones = z
    .array(z.object({ id: z.string(), account: z.object({ id: z.string() }) }))
    .length(1)
    .parse(await cfApi('/zones?name=joli.to', config.CLOUDFLARE_API_TOKEN))
  const zone = zones[0]!
  const [addresses, rules] = await Promise.all([
    cfApi(
      `/accounts/${zone.account.id}/email/routing/addresses`,
      config.CLOUDFLARE_API_TOKEN,
    ),
    cfApi(`/zones/${zone.id}/email/routing/rules`, config.CLOUDFLARE_API_TOKEN),
  ])
  const recipient = verifiedMaintainerInbox(addresses, rules)
  const authResponse = await fetch(
    `https://api.supabase.com/v1/projects/${config.SUPABASE_PROJECT_ID}/config/auth`,
    {
      headers: { Authorization: `Bearer ${config.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!authResponse.ok)
    throw new Error(
      `Supabase Auth configuration failed (HTTP ${authResponse.status})`,
    )
  z.object({ mailer_autoconfirm: z.literal(false) }).parse(
    await authResponse.json(),
  )
  const keyResponse = await fetch(
    `https://api.supabase.com/v1/projects/${config.SUPABASE_PROJECT_ID}/api-keys`,
    {
      headers: { Authorization: `Bearer ${config.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!keyResponse.ok)
    throw new Error(`Supabase key lookup failed (HTTP ${keyResponse.status})`)
  const keys = z
    .array(z.object({ name: z.string(), api_key: z.string().min(1) }))
    .parse(await keyResponse.json())
  const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key
  if (!serviceKey) throw new Error('Supabase service_role key is unavailable')

  // Wrangler prints the binding destination. Mask dynamically resolved values
  // before invoking it in the public Actions log.
  if (env.GITHUB_ACTIONS === 'true') {
    for (const value of [recipient, serviceKey]) {
      const escaped = value
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
      console.log(`::add-mask::${escaped}`)
    }
  }

  mkdirSync('.wrangler', { recursive: true })
  const directory = mkdtempSync('.wrangler/signup-alerts-')
  try {
    const configPath = resolve(directory, 'wrangler.json')
    const secretsPath = resolve(directory, 'secrets.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        ...baseConfig,
        main: resolve(baseConfig.main),
        account_id: zone.account.id,
        send_email: [{ name: 'SEND_EMAIL', destination_address: recipient }],
        vars: {
          SUPABASE_URL: `https://${config.SUPABASE_PROJECT_ID}.supabase.co`,
        },
      }),
      { mode: 0o600 },
    )
    writeFileSync(
      secretsPath,
      JSON.stringify({
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        SIGNUP_NOTIFICATION_EMAIL: recipient,
      }),
      { mode: 0o600 },
    )
    execFileSync(
      'npx',
      [
        'wrangler',
        'deploy',
        '--config',
        configPath,
        '--secrets-file',
        secretsPath,
      ],
      {
        stdio: 'inherit',
        env: { ...env, CLOUDFLARE_ACCOUNT_ID: zone.account.id },
      },
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  loadEnvLocal()
  await deploySignupAlerts(process.env)
}
