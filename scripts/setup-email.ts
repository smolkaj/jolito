import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cfApi,
  loadEnvLocal,
  promptIfMissing,
  type CloudflareAccount,
  type CloudflareZone,
} from './cf-utils.ts'

export interface CloudflareRoutingAddress {
  id?: string
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

export interface CloudflareRoutingSettings {
  id?: string
  enabled: boolean
  status?: string
}

export interface SetupEmailRoutingOptions {
  cfToken: string
  accountId: string
  zoneId: string
  domain: string
  destinationEmail?: string | undefined
}

export function getManagedSenders(domain: string): string[] {
  return ['a', 'signin', 'login'].map((p) => `${p}@${domain}`)
}

export async function setupEmailRouting({
  cfToken,
  accountId,
  zoneId,
  domain,
  destinationEmail,
}: SetupEmailRoutingOptions): Promise<void> {
  console.log(`\n📧 Configuring Cloudflare Email Routing for ${domain}...`)
  const managedSenders = getManagedSenders(domain)

  let isDestinationVerified = false

  // 1. Destination Address Verification (if provided)
  if (destinationEmail) {
    const addresses = await cfApi<CloudflareRoutingAddress[]>(
      `/accounts/${accountId}/email/routing/addresses`,
      cfToken,
    )

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
      )
      console.log(
        `✉️  Verification email dispatched by Cloudflare to ${destinationEmail}.`,
      )
      console.log(
        '👉 Please check your inbox and click the verification link to activate email routing.',
      )
    } else if (!existingDest.verified) {
      console.log(
        `⏳ Destination email (${destinationEmail}) is pending verification.`,
      )
      console.log(
        '👉 Please click the verification link sent by Cloudflare to your inbox.',
      )
    } else {
      isDestinationVerified = true
      console.log(`✔ Verified destination address active: ${destinationEmail}`)
    }
  } else {
    console.log(
      'ℹ️  No destination email specified. Skipping destination address configuration.',
    )
  }

  // 2. Enable Email Routing on Zone
  let routingSettings: CloudflareRoutingSettings | null = null
  try {
    routingSettings = await cfApi<CloudflareRoutingSettings>(
      `/zones/${zoneId}/email/routing`,
      cfToken,
    )
  } catch {
    // Some zones may not return routing object until enabled
  }

  if (routingSettings?.enabled) {
    console.log(`✔ Cloudflare Email Routing is already active for ${domain}`)
  } else {
    console.log(`➕ Enabling Cloudflare Email Routing for zone ${domain}...`)
    await cfApi(`/zones/${zoneId}/email/routing/enabled`, cfToken, 'POST', {
      enabled: true,
    })
    console.log(`✔ Cloudflare Email Routing enabled for zone ${domain}`)
  }

  // 3. Auto-provision DNS records for Email Routing (MX, SPF)
  console.log('🔍 Checking Email Routing DNS records (MX, SPF)...')
  try {
    await cfApi(`/zones/${zoneId}/email/routing/dns`, cfToken, 'POST')
    console.log(`✔ Email Routing DNS records provisioned/verified`)
  } catch (dnsErr) {
    const msg = dnsErr instanceof Error ? dnsErr.message : String(dnsErr)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`✔ Email Routing DNS records already present`)
    } else {
      throw dnsErr
    }
  }

  // 4. Configure Routing Rules: managedSenders -> destinationEmail
  if (destinationEmail) {
    if (!isDestinationVerified) {
      console.log(
        `⏳ Destination email (${destinationEmail}) is pending verification. Forwarding rules cannot be activated yet.`,
      )
      console.log(
        `👉 After clicking the verification link sent to ${destinationEmail}, re-run 'npm run setup:email' to activate forwarding rules.`,
      )
    } else {
      const rules = await cfApi<CloudflareRoutingRule[]>(
        `/zones/${zoneId}/email/routing/rules`,
        cfToken,
      )

      for (const sender of managedSenders) {
        const existingRule = rules.find((r) =>
          r.matchers?.some(
            (m) =>
              m.field === 'to' &&
              m.value.toLowerCase() === sender.toLowerCase(),
          ),
        )

        if (!existingRule) {
          console.log(
            `➕ Creating email forward rule: ${sender} -> ${destinationEmail}...`,
          )
          await cfApi(`/zones/${zoneId}/email/routing/rules`, cfToken, 'POST', {
            name: `Forward ${sender}`,
            enabled: true,
            matchers: [{ type: 'literal', field: 'to', value: sender }],
            actions: [{ type: 'forward', value: [destinationEmail] }],
          })
          console.log(`✔ Email forward rule active: ${sender}`)
        } else {
          const currentAction = existingRule.actions?.find(
            (a) => a.type === 'forward',
          )
          const currentTarget = currentAction?.value?.[0]
          const needsUpdate =
            !existingRule.enabled ||
            currentTarget?.toLowerCase() !== destinationEmail.toLowerCase()

          if (needsUpdate && existingRule.id) {
            console.log(
              `🔄 Updating email forward rule: ${sender} -> ${destinationEmail}...`,
            )
            await cfApi(
              `/zones/${zoneId}/email/routing/rules/${existingRule.id}`,
              cfToken,
              'PUT',
              {
                name: existingRule.name || `Forward ${sender}`,
                enabled: true,
                matchers: [{ type: 'literal', field: 'to', value: sender }],
                actions: [{ type: 'forward', value: [destinationEmail] }],
              },
            )
            console.log(
              `✔ Email forward rule updated: ${sender} -> ${destinationEmail}`,
            )
          } else {
            console.log(
              `✔ Email forward rule already active: ${sender} -> ${currentTarget ?? destinationEmail}`,
            )
          }
        }
      }
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
    } else {
      console.log(
        `ℹ️  Global MX records not yet detected on public DNS for ${domain} (propagation may take several minutes).`,
      )
    }
  } catch {
    console.log(
      `ℹ️  Could not query public DNS at this time; verify MX propagation later.`,
    )
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

  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  if (!accountId) {
    const accounts = await cfApi<CloudflareAccount[]>('/accounts', cfToken)
    const firstAccount = accounts[0]
    if (!firstAccount) {
      throw new Error('No Cloudflare accounts found for this API token.')
    }
    accountId = firstAccount.id
    console.log(`ℹ️  Using Cloudflare Account: ${firstAccount.name}`)
  }

  const zones = await cfApi<CloudflareZone[]>(`/zones?name=${domain}`, cfToken)
  const zone = zones[0]
  if (!zone) {
    throw new Error(
      `Cloudflare zone for ${domain} not found in account. Run 'npm run setup:domain' first.`,
    )
  }

  const destinationEmail = await promptIfMissing(
    'FEEDBACK_NOTIFICATION_EMAIL',
    'Enter destination email for feedback notifications and sign-in replies (e.g. your personal email): ',
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
  main().catch(() => {
    console.error(
      '\n❌ Email setup failed. Check credentials, zone status, and permissions.',
    )
    process.exit(1)
  })
}
