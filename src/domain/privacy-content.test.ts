import { describe, expect, it } from 'vitest'
import { PRIVACY_POLICY_METADATA, PRIVACY_SECTIONS } from './privacy-content'

describe('privacy-content domain', () => {
  it('defines the 5 required privacy sections', () => {
    expect(PRIVACY_SECTIONS).toHaveLength(5)
    expect(PRIVACY_SECTIONS.map((s) => s.title)).toEqual([
      'The Demo vs. Your Account',
      'What We Collect & Store',
      'Third-Party Services & AI Processing',
      'Data Export & Account Deletion',
      'Open Source & Contact',
    ])
  })

  it('contains expected metadata', () => {
    expect(PRIVACY_POLICY_METADATA.title).toBe('Privacy Policy • Jolito')
    expect(PRIVACY_POLICY_METADATA.description).toContain(
      'Local-first by design',
    )
    expect(PRIVACY_POLICY_METADATA.canonicalUrl).toBe('https://joli.to/privacy')
  })

  it('ensures each section has structured paragraphs with valid segments', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(section.paragraphs.length).toBeGreaterThan(0)
      for (const paragraph of section.paragraphs) {
        expect(paragraph.length).toBeGreaterThan(0)
        for (const segment of paragraph) {
          expect(['text', 'strong', 'link']).toContain(segment.type)
          expect(segment.text.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('ensures public/privacy.html is synchronized with privacy-content without drift', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { generatePrivacyHtml } =
      await import('../../scripts/generate-privacy-html.ts')
    const expectedHtml = await generatePrivacyHtml()
    const actualHtml = readFileSync(resolve('public/privacy.html'), 'utf-8')
    expect(actualHtml).toBe(expectedHtml)
  })
})
