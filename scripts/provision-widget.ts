import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { AppleApi, token } from './app-store.ts'

export const WIDGET_BUNDLE_ID = 'to.joli.app.JolitoWidgetExtension'
export const WIDGET_PROFILE_NAME = 'Jolito Widget Extension AppStore'

const idSchema = z.object({ type: z.string(), id: z.string().min(1) })
const resourceSchema = idSchema.extend({
  attributes: z.record(z.string(), z.unknown()).default({}),
  relationships: z
    .record(z.string(), z.object({ data: z.unknown().optional() }))
    .default({}),
})

export async function provisionWidgetProfile(
  api: AppleApi,
): Promise<{ profileId: string; profileContent: string }> {
  // 1. Ensure Bundle ID exists
  const existingBundles = await api.list(
    `/v1/bundleIds?filter[identifier]=${WIDGET_BUNDLE_ID}&fields[bundleIds]=identifier,name`,
  )
  let bundleIdId: string
  if (existingBundles.length > 0) {
    bundleIdId = existingBundles[0]!.id
  } else {
    console.log(`Registering bundle ID: ${WIDGET_BUNDLE_ID}...`)
    const created = await api.call('/v1/bundleIds', 'POST', {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: WIDGET_BUNDLE_ID,
          name: 'Jolito Widget Extension',
          platform: 'UNIVERSAL',
        },
      },
    })
    const parsed = resourceSchema.parse(created.data)
    bundleIdId = parsed.id
  }

  // 2. Locate active distribution certificate
  const isUnexpired = (cert: { attributes: { expirationDate?: unknown } }) => {
    const expiry = cert.attributes.expirationDate
    return typeof expiry === 'string' && new Date(expiry).getTime() > Date.now()
  }
  let certs = (
    await api.list('/v1/certificates?filter[certificateType]=DISTRIBUTION')
  ).filter(isUnexpired)
  if (certs.length === 0) {
    certs = (
      await api.list(
        '/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION',
      )
    ).filter(isUnexpired)
  }
  if (certs.length === 0) {
    throw new Error('No active distribution certificate found in Apple account')
  }
  const certId = certs[0]!.id

  // 3. Check for existing App Store distribution profile
  const existingProfiles = await api.list(
    `/v1/profiles?filter[profileType]=IOS_APP_STORE&filter[name]=${encodeURIComponent(WIDGET_PROFILE_NAME)}`,
  )

  for (const prof of existingProfiles) {
    const rawContent = prof.attributes.profileContent
    const expiry = prof.attributes.expirationDate
    const relData = prof.relationships?.bundleId?.data as
      { id?: unknown } | undefined
    const bundleMatches = !relData?.id || relData.id === bundleIdId
    const isValid =
      typeof rawContent === 'string' &&
      rawContent.length > 0 &&
      typeof expiry === 'string' &&
      new Date(expiry).getTime() > Date.now() &&
      bundleMatches

    if (isValid) {
      console.log(`Using existing profile: ${WIDGET_PROFILE_NAME} (${prof.id})`)
      return { profileId: prof.id, profileContent: rawContent }
    }

    // Expired or invalid profile with this name: delete it to avoid 409 conflict upon recreation
    console.log(`Deleting expired/invalid profile: ${prof.id}...`)
    await api.call(`/v1/profiles/${prof.id}`, 'DELETE')
  }

  // 4. Create new App Store distribution profile
  console.log(`Creating provisioning profile: ${WIDGET_PROFILE_NAME}...`)
  const createdProfile = await api.call('/v1/profiles', 'POST', {
    data: {
      type: 'profiles',
      attributes: {
        name: WIDGET_PROFILE_NAME,
        profileType: 'IOS_APP_STORE',
      },
      relationships: {
        bundleId: {
          data: {
            type: 'bundleIds',
            id: bundleIdId,
          },
        },
        certificates: {
          data: [
            {
              type: 'certificates',
              id: certId,
            },
          ],
        },
      },
    },
  })

  const parsedProfile = resourceSchema.parse(createdProfile.data)
  const content = parsedProfile.attributes.profileContent
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('Apple API returned empty profileContent for new profile')
  }

  return { profileId: parsedProfile.id, profileContent: content }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    const outIdx = args.indexOf('--output')
    const outputPath = outIdx !== -1 ? args[outIdx + 1] : undefined
    if (!outputPath) {
      throw new Error('Usage: node scripts/provision-widget.ts --output <path>')
    }

    const api = new AppleApi(token())
    const { profileId, profileContent } = await provisionWidgetProfile(api)
    writeFileSync(outputPath, Buffer.from(profileContent, 'base64'))
    console.log(
      `✓ Auto-provisioned widget profile ${profileId} -> ${outputPath}`,
    )
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Widget provisioning failed',
    )
    process.exitCode = 1
  }
}
