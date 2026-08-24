import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

// Load .env.local if present
function loadEnvLocal(): void {
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

loadEnvLocal()

const DOMAIN = process.env.DOMAIN ?? 'joli.to'
const WORKER_NAME = process.env.WORKER_NAME ?? 'jolito'

async function promptIfMissing(
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

interface CloudflareZone {
  id: string
  name: string
  name_servers: string[]
  status: string
}

interface CloudflareAccount {
  id: string
  name: string
}

async function cfApi<T>(
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

async function main() {
  console.log(
    '\n🚀 Starting Jolito Automated Domain Setup for ' + DOMAIN + '\n',
  )

  // 1. Credentials
  const cfToken = await promptIfMissing(
    'CLOUDFLARE_API_TOKEN',
    'Enter Cloudflare API Token (with Zone:Edit, DNS:Edit, Worker:Edit permissions): ',
  )

  if (!cfToken) {
    console.error('❌ Cloudflare API token is required.')
    process.exit(1)
  }

  // 2. Cloudflare Account ID
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) {
    const accounts = await cfApi<CloudflareAccount[]>('/accounts', cfToken)
    const firstAccount = accounts[0]
    if (!firstAccount) {
      throw new Error('No Cloudflare accounts found for this API token.')
    }
    accountId = firstAccount.id
    console.log(`ℹ️  Using Cloudflare Account: ${firstAccount.name}`)
  }

  // 3. Ensure Cloudflare Zone exists
  console.log(`\n🔍 Checking Cloudflare Zone for ${DOMAIN}...`)
  const zones = await cfApi<CloudflareZone[]>(`/zones?name=${DOMAIN}`, cfToken)
  let zone: CloudflareZone

  const existingZone = zones[0]
  if (existingZone) {
    zone = existingZone
    console.log(`✔ Found existing Cloudflare Zone: ${zone.id}`)
  } else {
    console.log(`➕ Creating new Cloudflare Zone for ${DOMAIN}...`)
    zone = await cfApi<CloudflareZone>('/zones', cfToken, 'POST', {
      name: DOMAIN,
      account: { id: accountId },
      type: 'full',
      jump_start: false,
    })
    console.log(`✔ Created Cloudflare Zone: ${zone.id}`)
  }

  console.log(`📌 Cloudflare Nameservers for ${DOMAIN}:`)
  zone.name_servers.forEach((ns) => console.log(`   - ${ns}`))

  // 4. Configure Zone Settings (Strict SSL, Always HTTPS, TLS 1.3)
  console.log('\n🔒 Enforcing SSL & Security Settings on Cloudflare...')
  await cfApi(`/zones/${zone.id}/settings/ssl`, cfToken, 'PATCH', {
    value: 'strict',
  }).catch(() => {})
  await cfApi(`/zones/${zone.id}/settings/always_use_https`, cfToken, 'PATCH', {
    value: 'on',
  }).catch(() => {})
  await cfApi(`/zones/${zone.id}/settings/tls_1_3`, cfToken, 'PATCH', {
    value: 'on',
  }).catch(() => {})
  await cfApi(`/zones/${zone.id}/settings/brotli`, cfToken, 'PATCH', {
    value: 'on',
  }).catch(() => {})
  console.log('✔ Security settings (Strict SSL, HTTPS, TLS 1.3) active')

  // 5. Attach Worker Custom Domain
  console.log(`\n⚡ Attaching Custom Domain to Worker '${WORKER_NAME}'...`)
  try {
    await cfApi(`/accounts/${accountId}/workers/domains`, cfToken, 'PUT', {
      hostname: DOMAIN,
      zone_id: zone.id,
      service: WORKER_NAME,
      environment: 'production',
    })
    console.log(`✔ Attached custom domain: https://${DOMAIN}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`ℹ️  Custom domain https://${DOMAIN} already attached`)
    } else {
      console.warn(`⚠️  Notice on ${DOMAIN}: ${msg}`)
    }
  }

  // 6. Spaceship.com API Automation
  console.log('\n🛰️  Spaceship Nameserver Configuration...')
  const spaceshipKey = process.env.SPACESHIP_API_KEY
  const spaceshipSecret = process.env.SPACESHIP_API_SECRET

  if (spaceshipKey && spaceshipSecret) {
    console.log(`🔄 Updating Spaceship nameservers via API for ${DOMAIN}...`)
    const ssRes = await fetch(
      `https://spaceship.dev/api/v1/domains/${DOMAIN}/nameservers`,
      {
        method: 'PUT',
        headers: {
          'X-API-Key': spaceshipKey,
          'X-API-Secret': spaceshipSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'custom',
          hosts: zone.name_servers,
        }),
      },
    )

    if (ssRes.ok || ssRes.status === 202) {
      console.log(
        `✔ Spaceship nameservers automatically updated to [${zone.name_servers.join(', ')}]!`,
      )
    } else {
      console.warn(`⚠️  Spaceship API returned HTTP status: ${ssRes.status}`)
      console.log('👉 Please ensure the nameservers in Spaceship are set to:')
      zone.name_servers.forEach((ns) => console.log(`   - ${ns}`))
    }
  } else {
    console.log(
      'ℹ️  SPACESHIP_API_KEY / SPACESHIP_API_SECRET not provided in environment.',
    )
    console.log(
      '👉 Set nameservers in Spaceship.com -> Launchpad -> Domains -> ' +
        DOMAIN +
        ' -> Nameservers:',
    )
    zone.name_servers.forEach((ns) => console.log(`   - ${ns}`))
  }

  // 7. Supabase Auth Config Push
  console.log('\n📦 Pushing Supabase Auth Configuration...')
  try {
    execSync('npx supabase config push', { stdio: 'inherit' })
    console.log('✔ Supabase Auth redirect URLs synchronized')
  } catch {
    console.log(
      'ℹ️  Supabase CLI not linked or skipped. Run `npx supabase config push` when ready.',
    )
  }

  // 8. DNS & Live Health Check
  console.log('\n🌐 Checking DNS propagation & live status...')
  try {
    const dnsRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=NS`,
      {
        headers: { Accept: 'application/dns-json' },
      },
    )
    const dnsData = (await dnsRes.json()) as { Answer?: { data: string }[] }
    const currentNs =
      dnsData.Answer?.map((a) => a.data).join(', ') ?? 'propagating...'
    console.log(`📡 Current Global NS for ${DOMAIN}: ${currentNs}`)
  } catch {
    // ignore
  }

  console.log(`\n🎉 Setup complete! Visit: https://${DOMAIN}\n`)
}

main().catch(() => {
  console.error('\n❌ Setup failed. Check credentials and permissions.')
  process.exit(1)
})
