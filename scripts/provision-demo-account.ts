import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_ACCESS_TOKEN: z.string().min(1),
  SUPABASE_PROJECT_ID: z.string().regex(/^[a-z0-9]+$/),
  APP_REVIEW_EMAIL: z
    .string()
    .email()
    .refine((val) => val.trim().toLowerCase().endsWith('@joli.to'), {
      message: 'APP_REVIEW_EMAIL must be a @joli.to email address',
    }),
  APP_REVIEW_MAILBOX_PASSWORD: z.string().min(6),
})

export type ProvisionDemoAccountConfig = z.infer<typeof envSchema>

const apiKeysResponseSchema = z.array(
  z.object({
    name: z.string(),
    api_key: z.string().min(1),
  }),
)

const userRecordSchema = z.object({
  id: z.string().min(1),
  email: z.string().nullable().optional(),
})

const listUsersResponseSchema = z.object({
  users: z.array(userRecordSchema),
})

function maskGitHubSecret(secret: string): void {
  const escaped = secret
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
  process.stdout.write(`::add-mask::${escaped}\n`)
}

export async function provisionDemoAccount(
  rawEnv: NodeJS.ProcessEnv = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<{ success: boolean; action: 'created' | 'updated' }> {
  const parseResult = envSchema.safeParse(rawEnv)
  if (!parseResult.success) {
    throw new Error(
      'Missing or invalid configuration for demo account provisioning: ' +
        parseResult.error.issues.map((i) => i.path.join('.')).join(', '),
    )
  }
  const config = parseResult.data

  // 1. Fetch Supabase API keys (service_role and anon)
  const keyResponse = await fetchFn(
    `https://api.supabase.com/v1/projects/${config.SUPABASE_PROJECT_ID}/api-keys`,
    {
      headers: { Authorization: `Bearer ${config.SUPABASE_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!keyResponse.ok) {
    throw new Error(
      `Supabase API key lookup failed (HTTP ${keyResponse.status})`,
    )
  }
  const keys = apiKeysResponseSchema.parse(await keyResponse.json())
  const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key
  const anonKey = keys.find((key) => key.name === 'anon')?.api_key
  if (!serviceKey) throw new Error('Supabase service_role key is unavailable')
  if (!anonKey) throw new Error('Supabase anon key is unavailable')

  if (rawEnv.GITHUB_ACTIONS === 'true') {
    maskGitHubSecret(serviceKey)
    maskGitHubSecret(anonKey)
  }

  const adminBaseUrl = `https://${config.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/admin/users`
  const targetEmail = config.APP_REVIEW_EMAIL.trim().toLowerCase()

  // 2. Search if the user already exists in Supabase
  let existingUserId: string | null = null
  let page = 1
  while (true) {
    const listResponse = await fetchFn(
      `${adminBaseUrl}?page=${page}&per_page=50`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!listResponse.ok) {
      throw new Error(
        `Failed to query Supabase users list (HTTP ${listResponse.status})`,
      )
    }
    const pageData = listUsersResponseSchema.parse(await listResponse.json())
    const match = pageData.users.find(
      (u) => u.email?.trim().toLowerCase() === targetEmail,
    )
    if (match) {
      existingUserId = match.id
      break
    }
    if (pageData.users.length < 50) break
    page++
    if (page > 1000) {
      throw new Error(
        'Exceeded maximum pagination depth while searching for review account in Supabase',
      )
    }
  }

  let action: 'created' | 'updated'

  if (existingUserId) {
    // 3a. Update existing user's password and ensure email_confirm: true
    const updateResponse = await fetchFn(`${adminBaseUrl}/${existingUserId}`, {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: config.APP_REVIEW_MAILBOX_PASSWORD,
        email_confirm: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!updateResponse.ok) {
      throw new Error(
        `Failed to update existing demo user password in Supabase (HTTP ${updateResponse.status})`,
      )
    }
    userRecordSchema.parse(await updateResponse.json())
    action = 'updated'
  } else {
    // 3b. Create new user with confirmed email and password
    const createResponse = await fetchFn(adminBaseUrl, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: targetEmail,
        password: config.APP_REVIEW_MAILBOX_PASSWORD,
        email_confirm: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!createResponse.ok) {
      throw new Error(
        `Failed to create demo user in Supabase (HTTP ${createResponse.status})`,
      )
    }
    userRecordSchema.parse(await createResponse.json())
    action = 'created'
  }

  // 4. Verify password authentication via public /token?grant_type=password endpoint
  const verifyResponse = await fetchFn(
    `https://${config.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: targetEmail,
        password: config.APP_REVIEW_MAILBOX_PASSWORD,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  )

  if (!verifyResponse.ok) {
    throw new Error(
      `Password verification check for provisioned demo user failed (HTTP ${verifyResponse.status})`,
    )
  }

  const tokenData = z
    .object({
      access_token: z.string().min(1),
      token_type: z.string(),
      user: z.object({ id: z.string() }),
    })
    .parse(await verifyResponse.json())

  if (rawEnv.GITHUB_ACTIONS === 'true') {
    maskGitHubSecret(tokenData.access_token)
  }

  console.log(
    `Demo account ${action} and verified successfully in Supabase (ID: ${tokenData.user.id}).`,
  )
  return { success: true, action }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  provisionDemoAccount()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Provisioning demo account failed: ${msg}`)
      process.exit(1)
    })
}
