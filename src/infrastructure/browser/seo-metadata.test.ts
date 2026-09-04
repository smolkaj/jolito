import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('SEO search snippet and favicon compliance', () => {
  const rootDir = resolve(__dirname, '../../../')
  const indexPath = resolve(rootDir, 'index.html')
  const publicDir = resolve(rootDir, 'public')

  it('declares a search-optimized meta description containing the brand name and keywords', () => {
    expect(existsSync(indexPath)).toBe(true)
    const html = readFileSync(indexPath, 'utf-8')

    // Meta description must explicitly begin with or mention the brand name
    // so Google snippet generators match queries like "jolito flash cards"
    const metaDescMatch = html.match(
      /<meta\s+name="description"\s+content="([^"]+)"/,
    )
    expect(metaDescMatch).not.toBeNull()
    const descContent = metaDescMatch?.[1] ?? ''
    expect(descContent).not.toBe('')
    expect(descContent.toLowerCase()).toContain('jolito')
    expect(descContent.toLowerCase()).toContain('flashcards')

    // OpenGraph and Twitter descriptions should also be updated
    expect(html).toContain(
      '<meta\n      property="og:description"\n      content="' +
        descContent +
        '"',
    )
    expect(html).toContain(
      '<meta\n      name="twitter:description"\n      content="' +
        descContent +
        '"',
    )
  })

  it('declares Google-compliant favicon links with multiples of 48px and fallback ICO', () => {
    const html = readFileSync(indexPath, 'utf-8')

    // Fallback ICO with sizes="any"
    expect(html).toMatch(
      /<link\s+rel="icon"\s+href="\/favicon\.ico"\s+sizes="any"/,
    )

    // SVG icon for modern high-res browser tabs
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"/,
    )

    // Google Search multiple-of-48px square requirement (48x48, 96x96)
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="48x48"\s+href="\/favicon-48x48\.png"/,
    )
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="96x96"\s+href="\/favicon-96x96\.png"/,
    )

    // Standard desktop tab sizes (32x32, 16x16)
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="32x32"\s+href="\/favicon-32x32\.png"/,
    )
    expect(html).toMatch(
      /<link\s+rel="icon"\s+type="image\/png"\s+sizes="16x16"\s+href="\/favicon-16x16\.png"/,
    )

    // Ensure all referenced favicon files physically exist in public/
    const requiredFiles = [
      'favicon.ico',
      'favicon.svg',
      'favicon-48x48.png',
      'favicon-96x96.png',
      'favicon-32x32.png',
      'favicon-16x16.png',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
    ]

    for (const file of requiredFiles) {
      expect(
        existsSync(resolve(publicDir, file)),
        `Expected ${file} to exist in public directory`,
      ).toBe(true)
    }
  })
})
