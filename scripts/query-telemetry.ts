import { loadEnvLocal } from './cf-utils.ts'

interface CountryCount {
  country: string
  unique_users: number
  active_days: number
}

interface PlatformCount {
  platform: string
  unique_users: number
  active_days: number
}

interface EngagementCount {
  engagement_tier: string
  count: number
}

interface TelemetrySummary {
  days: number
  since: string
  unique_users: number
  by_country: CountryCount[]
  by_platform: PlatformCount[]
  by_engagement: EngagementCount[]
}

async function run(): Promise<void> {
  loadEnvLocal()

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://xwqjelkfdcfzyxxblvhp.supabase.co'
  ).replace(/\/+$/, '')

  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cWplbGtmZGNmenl4eGJsdmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1Mzc2OTcsImV4cCI6MjEwMzExMzY5N30.cTfu8_OsfAuEBdwkpbfu1ftx9r0SJuUpqtoyMEmOTqw'

  const args = process.argv.slice(2)
  let days = 30
  const daysIdx = args.indexOf('--days')
  const rawDays = daysIdx !== -1 ? args[daysIdx + 1] : undefined
  if (rawDays) {
    days = parseInt(rawDays, 10) || 30
  }

  console.log(`\nFetching Jolito client telemetry for past ${days} days...`)
  console.log(`Endpoint: ${supabaseUrl}\n`)

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_telemetry_summary`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_days: days }),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(
        `Failed to fetch telemetry summary: ${res.status} ${res.statusText}`,
      )
      console.error(text)
      process.exit(1)
    }

    const summary = (await res.json()) as TelemetrySummary

    console.log('====================================================')
    console.log(`Jolito Audience & Engagement Summary (${summary.days} Days)`)
    console.log(`Period: Since ${summary.since}`)
    console.log(`Total Unique Active Users: ${summary.unique_users}`)
    console.log('====================================================\n')

    console.log('--- Breakdown by Platform ---')
    if (!summary.by_platform || summary.by_platform.length === 0) {
      console.log('  No activity recorded.')
    } else {
      console.table(
        summary.by_platform.map((p) => ({
          Platform: p.platform,
          'Unique Users': p.unique_users,
          'Active Days': p.active_days,
        })),
      )
    }

    console.log('\n--- Breakdown by Country (Top 20) ---')
    if (!summary.by_country || summary.by_country.length === 0) {
      console.log('  No activity recorded.')
    } else {
      console.table(
        summary.by_country.map((c) => ({
          Country: c.country.toUpperCase(),
          'Unique Users': c.unique_users,
          'Active Days': c.active_days,
        })),
      )
    }

    console.log('\n--- Breakdown by Engagement Tier ---')
    if (!summary.by_engagement || summary.by_engagement.length === 0) {
      console.log('  No activity recorded.')
    } else {
      console.table(
        summary.by_engagement.map((e) => ({
          Tier: e.engagement_tier,
          'Session Days': e.count,
        })),
      )
    }
  } catch (error) {
    console.error('Error fetching telemetry:', error)
    process.exit(1)
  }
}

void run()
