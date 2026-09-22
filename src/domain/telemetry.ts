import { z } from 'zod'

export const engagementTierSchema = z.enum(['casual', 'active', 'deep'])
export type EngagementTier = z.infer<typeof engagementTierSchema>

export const platformSchema = z.enum(['ios', 'android', 'web', 'unknown'])
export type Platform = z.infer<typeof platformSchema>

export const deviceTypeSchema = z.enum([
  'mobile',
  'tablet',
  'desktop',
  'unknown',
])
export type DeviceType = z.infer<typeof deviceTypeSchema>

export const telemetryPayloadSchema = z.object({
  deviceId: z
    .string({ message: 'deviceId is required' })
    .trim()
    .min(6, 'deviceId is too short')
    .max(64, 'deviceId is too long'),
  platform: platformSchema.default('unknown'),
  os: z.string().trim().max(32).default('unknown'),
  browser: z.string().trim().max(32).default('unknown'),
  deviceType: deviceTypeSchema.default('unknown'),
  engagementTier: engagementTierSchema.default('casual'),
})

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>

export async function computeMonthlyUserHash(
  deviceId: string,
  yearMonth: string,
  secret: string,
  subtleCrypto: SubtleCrypto = crypto.subtle,
): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${deviceId}:${yearMonth}:${secret}`)
  const buffer = await subtleCrypto.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
