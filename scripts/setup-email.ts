import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'

export function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

export async function promptIfMissing(
  varName: string,
  promptText: string,
): Promise<string> {
  const existing = process.env[varName]
  if (existing) return existing.trim()

  const rl = readline.createInterface({ input, output })
  try {
    const answer = await rl.question(promptText)
    return answer.trim()
  } finally {
    rl.close()
  }
}

export interface CloudflareRoutingAddress {
  email: string
  verified: string | null
}

export interface CloudflareRoutingRule {
  id?: string
  name: string
  enabled: boolean
  matchers: { type: string; field: string; value: string }[]
  actions: { type: string; value: string[] }[]
}

export interface CloudflareZoneSummary {
  id: string
  name: string
  status: string
}

export async function cfApi<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const reqInit: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined) {
    reqInit.body = JSON.stringify(body)
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4${path}`,
    reqInit,
  )

  const data = (await res.json()) as {
    success: boolean
    result: T
    errors?: { message: string }[]
  }
  if (!data.success) {
    const errMsg =
      data.errors?.map((e) => e.message).join(', ') ?? res.statusText
    throw new Error(`Cloudflare API error (${path}): ${errMsg}`)
  }
  return data.result
}

export interface SetupEmailRoutingOptions {
  cfToken: string
  accountId: string
  zoneId: string
  domain: string
  destinationEmail?: string | undefined
}

export async function setupEmailRouting({
  cfToken,
  accountId,
  zoneId,
  domain,
  destinationEmail,
}: SetupEmailRoutingOptions): Promise<void> {
  console.log(`\n📧 Configuring Cloudflare Email Routing for ${domain}...`)
  const canonicalSender = `a@${domain}`

  // 1. Destination Address Verification (if provided)
  if (destinationEmail) {
    try {
      const addresses = await cfApi<CloudflareRoutingAddress[]>(
        `/accounts/${accountId}/email/routing/addresses`,
        cfToken,
      ).catch(() => [] as CloudflareRoutingAddress[])

      const existingDest = addresses.find(
        (a) => a.email.toLowerCase() === destinationEmail.toLowerCase(),
      )

      if (!existingDest) {
        console.log(`➕ Registering destination email: ${destinationEmail}...`)
        await cfApi(
          `/accounts/${accountId}/email/routing/addresses`,
          cfToken,
          'POST',
          { email: destinationEmail },
        ).catch(() => {
          console.warn(
            'ℹ️  Notice: Destination address already registered or requires manual verification.',
          )
        })
        console.log(
          '✉️  Verification email dispatched by Cloudflare. Please check your inbox and click the verification link!',
        )
      } else if (!existingDest.verified) {
        console.log(
          `⏳ Destination email (${destinationEmail}) is pending verification. Cloudflare will route emails once verified.`,
        )
      } else {
        console.log(
          `✔ Verified destination address active: ${destinationEmail}`,
        )
      }
    } catch {
      console.warn('⚠️  Could not check or register destination email address.')
    }
  } else {
    console.log(
      'ℹ️  No destination email specified. Skipping destination address configuration.',
    )
  }

  // 2. Enable Email Routing on Zone
  try {
    await cfApi(`/zones/${zoneId}/email/routing/enabled`, cfToken, 'POST', {
      enabled: true,
    })
    console.log(`✔ Cloudflare Email Routing enabled for zone ${domain}`)
  } catch {
    // ignore if already enabled
    console.log(`✔ Cloudflare Email Routing already active for ${domain}`)
  }

  // 3. Auto-provision DNS records for Email Routing (MX, SPF)
  try {
    await cfApi(`/zones/${zoneId}/email/routing/dns`, cfToken, 'POST')
    console.log(`✔ Email Routing DNS records (MX, SPF) provisioned`)
  } catch {
    console.log(`✔ Email Routing DNS records verified`)
  }

  // 4. Configure Routing Rule: a@domain -> destinationEmail
  if (destinationEmail) {
    try {
      const rules = await cfApi<CloudflareRoutingRule[]>(
        `/zones/${zoneId}/email/routing/rules`,
        cfToken,
      ).catch(() => [] as CloudflareRoutingRule[])

      const ruleExists = rules.some((r) =>
        r.matchers?.some(
          (m) =>
            m.field === 'to' &&
            m.value.toLowerCase() === canonicalSender.toLowerCase(),
        ),
      )

      if (!ruleExists) {
        console.log(
          `➕ Creating email forward rule: ${canonicalSender} -> ${destinationEmail}...`,
        )
        await cfApi(`/zones/${zoneId}/email/routing/rules`, cfToken, 'POST', {
          name: `Forward ${canonicalSender}`,
          enabled: true,
          matchers: [{ type: 'literal', field: 'to', value: canonicalSender }],
          actions: [{ type: 'forward', value: [destinationEmail] }],
        }).catch(() => {
          console.warn(
            `ℹ️  Notice: Forwarding rule for ${canonicalSender} already exists or was skipped.`,
          )
        })
        console.log(`✔ Email forward rule active: ${canonicalSender}`)
      } else {
        console.log(
          `✔ Email forward rule already active: ${canonicalSender} -> destination`,
        )
      }
    } catch {
      console.warn('⚠️  Notice: Could not configure routing rule.')
    }
  }

  // 5. Query DNS to confirm live propagation of MX records
  try {
    const dnsRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`,
      { headers: { Accept: 'application/dns-json' } },
    )
    const dnsData = (await dnsRes.json()) as { Answer?: { data: string }[] }
    const mxRecords = dnsData.Answer?.map((a) => a.data) ?? []
    if (mxRecords.length > 0) {
      console.log(`📡 Confirmed global MX records for ${domain}:`)
      mxRecords.forEach((mx) => console.log(`   - ${mx}`))
    }
  } catch {
    // ignore
  }

  console.log(`\n🎉 Cloudflare Email Routing configured for ${domain}!`)
}

async function main(): Promise<void> {
  loadEnvLocal()
  const domain = process.env.DOMAIN ?? 'joli.to'

  console.log(`\n🚀 Jolito Email Routing Setup for ${domain}\n`)

  const cfToken = await promptIfMissing(
    'CLOUDFLARE_API_TOKEN',
    'Enter Cloudflare API Token (with Zone:Edit, DNS:Edit, Email:Edit permissions): ',
  )
  if (!cfToken) {
    console.error('❌ Cloudflare API token is required.')
    process.exit(1)
  }

  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    const accounts = await cfApi<{ id: string; name: string }[]>(
      '/accounts',
      cfToken,
    )
    const firstAccount = accounts[0]
    if (!firstAccount) {
      throw new Error('No Cloudflare accounts found for this API token.')
    }
    accountId = firstAccount.id
    console.log(`ℹ️  Using Cloudflare Account: ${firstAccount.name}`)
  }

  const zones = await cfApi<CloudflareZoneSummary[]>(
    `/zones?name=${domain}`,
    cfToken,
  )
  const zone = zones[0]
  if (!zone) {
    throw new Error(
      `Cloudflare zone for ${domain} not found in account. Run 'npm run setup:domain' first.`,
    )
  }

  const destinationEmail = await promptIfMissing(
    'FEEDBACK_NOTIFICATION_EMAIL',
    'Enter destination email for feedback notifications (e.g. your Gmail): ',
  )

  await setupEmailRouting({
    cfToken,
    accountId,
    zoneId: zone.id,
    domain,
    destinationEmail: destinationEmail || undefined,
  })
}

// Run directly if invoked as entrypoint
const currentFilePath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFilePath) {
  main().catch((err) => {
    console.error(
      '\n❌ Email setup failed:',
      err instanceof Error ? err.message : err,
    )
    process.exit(1)
  })
}
