import { z } from 'zod'
import type { SendEmailBinding } from './email-binding'

export interface SignupAlertsEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SIGNUP_NOTIFICATION_EMAIL: string
  SEND_EMAIL: SendEmailBinding
}

const configSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SIGNUP_NOTIFICATION_EMAIL: z.email(),
})
const claimsSchema = z
  .array(
    z.object({
      user_id: z.uuid(),
      email: z.email(),
      verified_at: z.iso.datetime({ offset: true }),
      lease_id: z.uuid(),
    }),
  )
  .max(10)

async function rpc(
  env: SignupAlertsEnv,
  name: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`${name} failed (HTTP ${response.status})`)
  return response.json()
}

export default {
  async scheduled(_event: unknown, env: SignupAlertsEnv): Promise<void> {
    configSchema.parse(env)
    if (!env.SEND_EMAIL) throw new Error('SEND_EMAIL binding is required')
    const claims = claimsSchema.parse(
      await rpc(env, 'claim_signup_notifications', {}),
    )
    let failures = 0
    for (const claim of claims) {
      let delivered = false
      try {
        await env.SEND_EMAIL.send({
          from: 'a@joli.to',
          to: env.SIGNUP_NOTIFICATION_EMAIL,
          subject: 'New Jolito learner',
          text: [
            'A new learner joined Jolito.',
            '',
            `Email: ${claim.email}`,
            `Verified: ${claim.verified_at}`,
            `Account: ${claim.user_id}`,
          ].join('\n'),
        })
        delivered = true
      } catch {
        // Keep provider diagnostics (which can contain email addresses) out of logs.
        console.error('Signup email provider rejected an attempt')
      }
      try {
        const recorded = z.boolean().parse(
          await rpc(env, 'finish_signup_notification', {
            p_user_id: claim.user_id,
            p_lease_id: claim.lease_id,
            p_delivered: delivered,
          }),
        )
        if (!recorded)
          throw new Error('Signup notification lease expired or was replaced')
        if (!delivered) failures++
      } catch {
        // The lease expires and a later invocation recovers, even if this process dies.
        console.error('Signup notification receipt could not be recorded')
        failures++
      }
    }
    if (failures)
      throw new Error(`${failures} signup notification attempt failed`)
  },
}
