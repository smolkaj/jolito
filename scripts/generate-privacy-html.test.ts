import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generatePrivacyHtml } from './generate-privacy-html'

describe('generate-privacy-html script', () => {
  it('guarantees public/privacy.html is synchronized with generatePrivacyHtml()', async () => {
    const filePath = resolve('public/privacy.html')
    const fileContent = readFileSync(filePath, 'utf-8')
    const generated = await generatePrivacyHtml()

    expect(fileContent).toBe(generated)
  })
})
