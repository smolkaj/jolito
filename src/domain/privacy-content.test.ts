import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIVACY_POLICY_METADATA, PRIVACY_SECTIONS } from './privacy-content'
import { generatePrivacyHtml } from '../../scripts/generate-privacy-html'

describe('privacy-content domain', () => {
  it('defines the 4 required privacy sections', () => {
    expect(PRIVACY_SECTIONS).toHaveLength(4)
    expect(PRIVACY_SECTIONS.map((s) => s.title)).toEqual([
      'The Demo vs. Your Account',
      'What We Collect',
      'Data Export & Account Deletion',
      'Open Source & Contact',
    ])
  })

  it('guarantees public/privacy.html is synchronized with privacy-content domain', async () => {
    const filePath = resolve('public/privacy.html')
    const fileContent = readFileSync(filePath, 'utf-8')
    const generated = await generatePrivacyHtml()

    expect(fileContent).toBe(generated)
  })

  it('contains expected metadata', () => {
    expect(PRIVACY_POLICY_METADATA.title).toBe('Privacy Policy • Jolito')
    expect(PRIVACY_POLICY_METADATA.description).toContain(
      'Local-first by design',
    )
    expect(PRIVACY_POLICY_METADATA.canonicalUrl).toBe('https://joli.to/privacy')
  })
})
