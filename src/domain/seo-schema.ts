import { z } from 'zod'

export const schemaOrgOfferSchema = z.object({
  '@type': z.literal('Offer'),
  price: z.string(),
  priceCurrency: z.string(),
})

export type SchemaOrgOffer = z.infer<typeof schemaOrgOfferSchema>

export const schemaOrgWebApplicationSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('WebApplication'),
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string().min(10),
  applicationCategory: z.string().min(1),
  operatingSystem: z.string().min(1),
  offers: schemaOrgOfferSchema,
  featureList: z.array(z.string().min(1)).min(3),
  inLanguage: z.array(z.string()).min(1),
  image: z.string().url(),
})

export type SchemaOrgWebApplication = z.infer<
  typeof schemaOrgWebApplicationSchema
>

export const schemaOrgProviderSchema = z.object({
  '@type': z.literal('Organization'),
  name: z.string().min(1),
  sameAs: z.string().url(),
})

export type SchemaOrgProvider = z.infer<typeof schemaOrgProviderSchema>

export const schemaOrgCourseInstanceSchema = z.object({
  '@type': z.literal('CourseInstance'),
  courseMode: z.literal('online'),
})

export type SchemaOrgCourseInstance = z.infer<
  typeof schemaOrgCourseInstanceSchema
>

export const schemaOrgCourseSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('Course'),
  name: z.string().min(1),
  description: z.string().min(10),
  provider: schemaOrgProviderSchema,
  inLanguage: z.array(z.string()).min(1),
  isAccessibleForFree: z.boolean(),
  educationalLevel: z.string().min(1),
  teaches: z.string().min(1),
  hasCourseInstance: z.array(schemaOrgCourseInstanceSchema).min(1),
})

export type SchemaOrgCourse = z.infer<typeof schemaOrgCourseSchema>

export const schemaOrgItemSchema = z.union([
  schemaOrgWebApplicationSchema,
  schemaOrgCourseSchema,
])

export type SchemaOrgItem = z.infer<typeof schemaOrgItemSchema>

/**
 * Extracts and validates all application/ld+json blocks from an HTML string using strict Zod schemas.
 * Ensures data boundaries are enforced and throws a descriptive error if parsing or schema validation fails.
 */
export function extractAndValidateJsonLd(html: string): SchemaOrgItem[] {
  const matches = [
    ...html.matchAll(
      /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ]

  if (matches.length === 0) {
    throw new Error('No application/ld+json scripts found in HTML')
  }

  return matches.map((match, i) => {
    const content = match[1]
    if (!content) {
      throw new Error(`Empty application/ld+json script #${i + 1}`)
    }

    let raw: unknown
    try {
      raw = JSON.parse(content)
    } catch (err) {
      throw new Error(
        `Invalid JSON in application/ld+json script #${i + 1}: ${String(err)}`,
        { cause: err },
      )
    }

    const result = schemaOrgItemSchema.safeParse(raw)
    if (!result.success) {
      throw new Error(
        `Schema.org validation error in script #${i + 1}: ${result.error.message}`,
        { cause: result.error },
      )
    }

    return result.data
  })
}

/**
 * Validates that index.html contains both WebApplication and Course structured data for Google search rich snippets.
 */
export function validateIndexHtmlStructuredData(html: string): {
  webApp: SchemaOrgWebApplication
  course: SchemaOrgCourse
} {
  const items = extractAndValidateJsonLd(html)

  const webApp = items.find(
    (item): item is SchemaOrgWebApplication =>
      item['@type'] === 'WebApplication',
  )
  if (!webApp) {
    throw new Error('Missing required Schema.org WebApplication block in HTML')
  }

  const course = items.find(
    (item): item is SchemaOrgCourse => item['@type'] === 'Course',
  )
  if (!course) {
    throw new Error('Missing required Schema.org Course block in HTML')
  }

  return { webApp, course }
}
