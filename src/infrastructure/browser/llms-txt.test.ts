import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('llms.txt specification and discovery compliance', () => {
  const rootDir = resolve(__dirname, '../../../')
  const llmsTxtPath = resolve(rootDir, 'public/llms.txt')
  const llmsFullTxtPath = resolve(rootDir, 'public/llms-full.txt')
  const indexPath = resolve(rootDir, 'index.html')

  it('provides a valid public/llms.txt matching the llmstxt.org v2 standard', () => {
    expect(existsSync(llmsTxtPath)).toBe(true)
    const content = readFileSync(llmsTxtPath, 'utf-8').trim()

    // 1. Must have an H1 title as the first heading
    expect(content).toMatch(/^# [^\n]+/)
    const h1Matches = content.match(/^# [^\n]+/gm)
    expect(h1Matches?.length).toBe(1)
    expect(h1Matches?.[0]).toBe('# Jolito')

    // 2. Must have a blockquote summary directly under the H1
    expect(content).toMatch(/^# Jolito\n\n> [^\n]+/m)

    // 3. Must have H2 sections including Origin Story
    const h2Matches = content.match(/^## [^\n]+/gm)
    expect(h2Matches && h2Matches.length >= 2).toBe(true)
    expect(content).toContain('## Origin Story')

    // 4. Must contain bulleted Markdown links [text](url) with descriptions
    const linkMatches = Array.from(
      content.matchAll(/- \[([^\]]+)\]\(([^)]+)\)/g),
    )
    expect(linkMatches.length).toBeGreaterThanOrEqual(2)

    // 5. All linked URLs must be well-formed absolute URLs
    for (const match of linkMatches) {
      const url = match[2]
      expect(url).toBeDefined()
      if (url) {
        expect(() => new URL(url)).not.toThrow()
        expect(url.startsWith('http://') || url.startsWith('https://')).toBe(
          true,
        )
      }
    }
  })

  it('provides a comprehensive public/llms-full.txt context file', () => {
    expect(existsSync(llmsFullTxtPath)).toBe(true)
    const content = readFileSync(llmsFullTxtPath, 'utf-8').trim()

    expect(content).toMatch(/^# Jolito/)
    expect(content).toContain('Origin Story')
    expect(content).toContain('Product Overview')
    expect(content).toContain('Core Principles & Learning Design')
    expect(content).toContain('Keyboard Controls & Review Flow')
  })

  it('includes describedby and alternate link discovery in index.html', () => {
    expect(existsSync(indexPath)).toBe(true)
    const html = readFileSync(indexPath, 'utf-8')

    expect(html).toMatch(
      /<link\s+[^>]*rel="describedby"[^>]*href="\/llms\.txt"/,
    )
    expect(html).toMatch(
      /<link\s+[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*href="\/llms\.txt"/,
    )
  })
})
