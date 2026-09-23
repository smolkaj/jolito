import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { AppleApi, token } from './app-store.ts'

export const APP_BUNDLE_ID = 'to.joli.app'
export const APP_PROFILE_NAME = 'Jolito AppStore Distribution'

const idSchema = z.object({ type: z.string(), id: z.string().min(1) })
const resourceSchema = idSchema.extend({
  attributes: z.record(z.string(), z.unknown()).default({}),
  relationships: z
    .record(z.string(), z.object({ data: z.unknown().optional() }))
    .default({}),
})

export async function provisionAppProfile(
  api: AppleApi,
): Promise<{ profileId: string; profileContent: string }> {
  // 1. Locate Bundle ID
  const existingBundles = await api.list(
    `/v1/bundleIds?filter[identifier]=${APP_BUNDLE_ID}&fields[bundleIds]=identifier,name`,
  )
  let bundleIdId: string
  if (existingBundles.length > 0) {
    bundleIdId = existingBundles[0]!.id
  } else {
    console.log(`Registering bundle ID: ${APP_BUNDLE_ID}...`)
    const created = await api.call('/v1/bundleIds', 'POST', {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: APP_BUNDLE_ID,
          name: 'Jolito',
          platform: 'UNIVERSAL',
        },
      },
    })
    const parsed = resourceSchema.parse(created.data)
    bundleIdId = parsed.id
  }

  // 2. Ensure APPLE_ID_AUTH capability is registered on the bundle ID
  const capabilities = await api.list(
    `/v1/bundleIds/${bundleIdId}/bundleIdCapabilities`,
  )
  const hasSignInWithAppleCap = capabilities.some(
    (cap) => cap.attributes.capabilityType === 'APPLE_ID_AUTH',
  )
  if (!hasSignInWithAppleCap) {
    console.log(`Enabling APPLE_ID_AUTH capability on ${APP_BUNDLE_ID}...`)
    try {
      await api.call('/v1/bundleIdCapabilities', 'POST', {
        data: {
          type: 'bundleIdCapabilities',
          attributes: {
            capabilityType: 'APPLE_ID_AUTH',
            settings: [
              {
                key: 'APPLE_ID_AUTH_APP_CONSENT',
                options: [{ key: 'PRIMARY_APP_CONSENT' }],
              },
            ],
          },
          relationships: {
            bundleId: {
              data: {
                type: 'bundleIds',
                id: bundleIdId,
              },
            },
          },
        },
      })
    } catch (error) {
      // 409 Conflict indicates the capability is already active or registered
      if (!String(error).includes('409')) {
        throw error
      }
    }
  }

  // 3. Locate active distribution certificate
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

  // 4. Check for existing App Store distribution profile
  const existingProfiles = await api.list(
    `/v1/profiles?filter[profileType]=IOS_APP_STORE&filter[name]=${encodeURIComponent(APP_PROFILE_NAME)}`,
  )

  for (const prof of existingProfiles) {
    const rawContent = prof.attributes.profileContent
    const expiry = prof.attributes.expirationDate
    const relData = prof.relationships?.bundleId?.data as
      { id?: unknown } | undefined
    const bundleMatches = !relData?.id || relData.id === bundleIdId
    const decodedText =
      typeof rawContent === 'string'
        ? Buffer.from(rawContent, 'base64').toString('utf8')
        : ''
    const hasSignInWithApple = decodedText.includes(
      'com.apple.developer.applesignin',
    )
    const isValid =
      typeof rawContent === 'string' &&
      rawContent.length > 0 &&
      typeof expiry === 'string' &&
      new Date(expiry).getTime() > Date.now() &&
      bundleMatches &&
      hasSignInWithApple

    if (isValid) {
      console.log(`Using existing profile: ${APP_PROFILE_NAME} (${prof.id})`)
      return { profileId: prof.id, profileContent: rawContent }
    }

    // Expired or missing capability: delete it to avoid conflict upon recreation
    console.log(`Deleting expired/invalid profile: ${prof.id}...`)
    await api.call(`/v1/profiles/${prof.id}`, 'DELETE')
  }

  // 5. Create new App Store distribution profile
  console.log(`Creating provisioning profile: ${APP_PROFILE_NAME}...`)
  const createdProfile = await api.call('/v1/profiles', 'POST', {
    data: {
      type: 'profiles',
      attributes: {
        name: APP_PROFILE_NAME,
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
      throw new Error('Usage: node scripts/provision-app.ts --output <path>')
    }

    const api = new AppleApi(token())
    const { profileId, profileContent } = await provisionAppProfile(api)
    writeFileSync(outputPath, Buffer.from(profileContent, 'base64'))
    console.log(`✓ Auto-provisioned app profile ${profileId} -> ${outputPath}`)
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'App provisioning failed',
    )
    process.exitCode = 1
  }
}
