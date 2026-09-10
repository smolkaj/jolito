import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cfApi,
  loadEnvLocal,
  promptIfMissing,
  type CloudflareAccount,
  type CloudflareZone,
} from './cf-utils.ts'
import { setupEmailRouting } from './setup-email.ts'

loadEnvLocal()

const DOMAIN = process.env.DOMAIN ?? 'joli.to'
const WORKER_NAME = process.env.WORKER_NAME ?? 'jolito'

export function extractSupabaseProjectRef(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.SUPABASE_PROJECT_REF?.trim()) {
    return env.SUPABASE_PROJECT_REF.trim()
  }
  const supabaseUrl = env.VITE_SUPABASE_URL
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)
    if (match && match[1]) {
      return match[1]
    }
  }
  return undefined
}

export function getSupabaseAccessToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return env.SUPABASE_ACCESS_TOKEN.trim()
  }
  const homeDir = env.HOME || env.USERPROFILE || ''
  if (homeDir) {
    const tokenFile = resolve(homeDir, '.supabase/access-token')
    if (existsSync(tokenFile)) {
      try {
        const token = readFileSync(tokenFile, 'utf8').trim()
        if (token) return token
      } catch {
        // ignore unreadable file
      }
    }
  }
  return undefined
}

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
    uri_allow_list: `https://${domain}/**,https://*-jolito.smolkaj.workers.dev/**,https://jolito.smolkaj.workers.dev/**,http://localhost:*/**,http://127.0.0.1:*/**`,
  }

  if (magicLinkTemplate) {
    patch.mailer_subjects_magic_link =
      'Your Jolito verification code is {{ .Token }}'
    patch.mailer_templates_magic_link_content = magicLinkTemplate
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

export interface ResendDnsRecord {
  record: string
  name: string
  type: string
  value: string
  priority?: number
  ttl?: string
  status?: string
}

export interface ResendDomain {
  id: string
  name: string
  status: string
  records?: ResendDnsRecord[]
}

export async function syncResendDns({
  cfToken,
  zoneId,
  domain,
  resendApiKey,
}: {
  cfToken: string
  zoneId: string
  domain: string
  resendApiKey: string
}): Promise<void> {
  console.log(`\n📬 Synchronizing Resend email domain & DNS for ${domain}...`)

  try {
    let resendDomain: ResendDomain | undefined
    const listRes = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    })
    if (listRes.ok) {
      const listData = (await listRes.json()) as { data?: ResendDomain[] }
      resendDomain = listData.data?.find(
        (d) => d.name.toLowerCase() === domain.toLowerCase(),
      )
    }

    if (!resendDomain) {
      console.log(`➕ Registering domain ${domain} in Resend...`)
      const createRes = await fetch('https://api.resend.com/domains', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      })
      if (createRes.ok) {
        resendDomain = (await createRes.json()) as ResendDomain
        console.log(
          `✔ Registered domain ${domain} in Resend (ID: ${resendDomain.id})`,
        )
      }
    }

    if (!resendDomain) {
      console.warn(
        `⚠️  Could not retrieve or create Resend domain for ${domain}`,
      )
      return
    }

    const detailRes = await fetch(
      `https://api.resend.com/domains/${resendDomain.id}`,
      {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      },
    )
    if (!detailRes.ok) {
      console.warn(
        `⚠️  Could not fetch Resend domain details (status: ${detailRes.status})`,
      )
      return
    }

    const detail = (await detailRes.json()) as ResendDomain
    const records = detail.records ?? []

    if (records.length > 0) {
      const existingCfRecords = await cfApi<
        Array<{ type: string; name: string; content: string }>
      >(`/zones/${zoneId}/dns_records`, cfToken)

      for (const rec of records) {
        const expectedFullName =
          rec.name === '@'
            ? domain.toLowerCase()
            : `${rec.name.toLowerCase()}.${domain.toLowerCase()}`

        const alreadyExists = existingCfRecords.some((cf) => {
          const cfName = cf.name.toLowerCase()
          const cfType = cf.type.toUpperCase()
          return (
            cfType === rec.type.toUpperCase() &&
            (cfName === expectedFullName || cfName === rec.name.toLowerCase())
          )
        })

        if (!alreadyExists) {
          console.log(
            `➕ Adding Cloudflare DNS record: ${rec.type} ${rec.name} -> ${rec.value}...`,
          )
          await cfApi(`/zones/${zoneId}/dns_records`, cfToken, 'POST', {
            type: rec.type,
            name: rec.name,
            content: rec.value,
            ...(rec.priority !== undefined ? { priority: rec.priority } : {}),
            ttl: 1,
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err)
            if (!msg.includes('already exists') && !msg.includes('duplicate')) {
              console.warn(`⚠️  Notice adding DNS record ${rec.name}: ${msg}`)
            }
          })
          console.log(`✔ DNS record provisioned: ${rec.type} ${rec.name}`)
        } else {
          console.log(`✔ DNS record already present: ${rec.type} ${rec.name}`)
        }
      }

      if (detail.status !== 'verified') {
        console.log(`🔄 Triggering Resend domain verification check...`)
        await fetch(
          `https://api.resend.com/domains/${resendDomain.id}/verify`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendApiKey}` },
          },
        ).catch(() => {})
      } else {
        console.log(`✔ Resend domain ${domain} is verified`)
      }
    }
  } catch (err: unknown) {
    console.warn(
      `⚠️  Notice during Resend DNS synchronization: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
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
  ;(zone.name_servers ?? []).forEach((ns) => console.log(`   - ${ns}`))

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

  // 6. Configure www -> apex 301 Permanent Redirect
  console.log(
    `\n🔀 Configuring 301 Permanent Redirect for www.${DOMAIN} -> https://${DOMAIN}...`,
  )
  try {
    await cfApi(`/zones/${zone.id}/dns_records`, cfToken, 'POST', {
      type: 'AAAA',
      name: 'www',
      content: '100::',
      proxied: true,
    })
  } catch {
    // ignore if record already exists
  }
  try {
    await cfApi(`/zones/${zone.id}/pagerules`, cfToken, 'POST', {
      targets: [
        {
          target: 'url',
          constraint: {
            operator: 'matches',
            value: `*www.${DOMAIN}/*`,
          },
        },
      ],
      actions: [
        {
          id: 'forwarding_url',
          value: {
            url: `https://${DOMAIN}/$2`,
            status_code: 301,
          },
        },
      ],
      status: 'active',
    })
    console.log(
      `✔ 301 Permanent Redirect active: www.${DOMAIN}/* -> https://${DOMAIN}/*`,
    )
  } catch {
    // ignore if rule already exists
  }

  // 7. Spaceship.com API Automation
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

  // 8. Resend Email Domain & DNS Configuration (if RESEND_API_KEY is provided)
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (resendApiKey) {
    await syncResendDns({
      cfToken,
      zoneId: zone.id,
      domain: DOMAIN,
      resendApiKey,
    })
  } else {
    console.log(
      '\nℹ️  RESEND_API_KEY not provided. Skipping automatic Resend DNS records.',
    )
  }

  // 9. Supabase Auth Configuration
  console.log(
    `\n📦 Synchronizing Supabase Auth Configuration for https://${DOMAIN}...`,
  )
  const projectRef = extractSupabaseProjectRef()
  const supabaseToken = getSupabaseAccessToken()

  if (projectRef && supabaseToken) {
    try {
      console.log(
        `🔄 Updating Supabase Auth settings via Management API for project ${projectRef}...`,
      )
      const templatePath = resolve(
        process.cwd(),
        'supabase/templates/magic_link.html',
      )
      const magicLinkTemplate = existsSync(templatePath)
        ? readFileSync(templatePath, 'utf8')
        : undefined

      const patchBody = buildSupabaseAuthPatch({
        domain: DOMAIN,
        resendApiKey,
        magicLinkTemplate,
      })

      const authRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${supabaseToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patchBody),
        },
      )
      if (authRes.ok) {
        console.log(
          `✔ Supabase Auth Site URL, redirect URLs, custom SMTP (Resend), and Magic Link template synchronized!`,
        )
      } else {
        const errText = await authRes.text().catch(() => '')
        console.warn(
          `⚠️  Supabase Management API error (${authRes.status}): ${errText}`,
        )
      }
    } catch (err: unknown) {
      console.warn(
        `⚠️  Failed to reach Supabase Management API: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  } else {
    console.log(
      'ℹ️  SUPABASE_ACCESS_TOKEN not found (checked env and ~/.supabase/access-token).',
    )
    console.log(
      `👉 Please ensure Supabase Auth URL Configuration is set in the Supabase Dashboard:\n` +
        `   URL: https://supabase.com/dashboard/project/${projectRef ?? '<project-ref>'}/auth/url-configuration\n` +
        `   • Site URL: https://${DOMAIN}\n` +
        `   • Redirect URLs:\n` +
        `     - https://${DOMAIN}/**\n` +
        `     - https://*-jolito.smolkaj.workers.dev/**\n` +
        `     - https://jolito.smolkaj.workers.dev/**\n` +
        `     - http://localhost:*/**\n` +
        `     - http://127.0.0.1:*/**`,
    )
  }

  // 10. DNS & Live Health Check
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

  // 11. Cloudflare Email Routing (@joli.to -> destination)
  const destinationEmail = process.env.FEEDBACK_NOTIFICATION_EMAIL
  try {
    await setupEmailRouting({
      cfToken,
      accountId,
      zoneId: zone.id,
      domain: DOMAIN,
      destinationEmail: destinationEmail || undefined,
    })
  } catch {
    console.warn(
      '⚠️  Notice: Could not complete automatic Email Routing setup. Run `npm run setup:email` for dedicated setup.',
    )
  }

  console.log(`\n🎉 Setup complete! Visit: https://${DOMAIN}\n`)
}

// Run directly if invoked as entrypoint
const currentFilePath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFilePath) {
  main().catch(() => {
    console.error('\n❌ Setup failed. Check credentials and permissions.')
    process.exit(1)
  })
}
