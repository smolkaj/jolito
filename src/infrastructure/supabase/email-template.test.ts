import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Supabase Auth Email Template', () => {
  const rootDir = resolve(__dirname, '../../..')
  const templatePath = resolve(rootDir, 'supabase/templates/magic_link.html')
  const configPath = resolve(rootDir, 'supabase/config.toml')

  it('template file exists in supabase/templates/magic_link.html', () => {
    expect(existsSync(templatePath)).toBe(true)
  })

  it('contains mandatory GoTrue replacement tags {{ .ConfirmationURL }} and {{ .Token }}', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toContain('{{ .ConfirmationURL }}')
    expect(content).toContain('{{ .Token }}')
  })

  it('includes inbox preheader preview snippet with verification code to prevent preview leakage', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toMatch(
      /Your\s+Jolito\s+verification\s+code\s+is\s+\{\{\s*\.Token\s*\}\}/i,
    )
  })

  it('includes explicit verification code phrasing and domain-bound OTP for OS AutoFill heuristics', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toMatch(/Your\s+verification\s+code/i)
    expect(content).toContain('@joli.to #{{ .Token }}')
    expect(content).toMatch(/class="domain-bound-otp"[^>]*color:\s*#5f6e66/i)
  })

  it('includes key security guarantees (expiry and ignore disclaimer)', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toMatch(/60\s+minutes/i)
    expect(content).toMatch(/safely\s+ignore/i)
  })

  it('includes Jolito brand identity, web link, and visual badge', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toContain('Jolito')
    expect(content).toContain('joli.to')
    // Official geometric brand logo with protective badge container and presentation role
    expect(content).toContain('https://joli.to/favicon-96x96.png')
    expect(content).toMatch(/<img[^>]*role="presentation"/i)
    expect(content).toContain('class="brand-logo-badge"')
    // Rosa Mexicano brand accent
    expect(content).toContain('#e4007c')
  })

  it('maintains lean, focused copy without marketing boilerplate or redundant narration', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).not.toMatch(/Spoken Mexican Spanish/i)
    expect(content).not.toMatch(/Signing in on another device/i)
    expect(content).not.toMatch(/Click below to sign in instantly/i)
  })

  it('includes responsive and dark mode style rules with explicit contrast protection', () => {
    const content = readFileSync(templatePath, 'utf-8')
    expect(content).toContain('@media (prefers-color-scheme: dark)')
    expect(content).toContain('@media only screen and (max-width: 600px)')

    // Verify dark mode preserves header brand wordmark contrast
    expect(content).toMatch(/\.brand-wordmark\s*\{[^}]*color:\s*#fdf5f8/i)

    // Verify dark mode aligns OTP code container with brand palette
    expect(content).toMatch(
      /\.code-container\s*\{[^}]*background-color:\s*#20151b/i,
    )
    expect(content).toMatch(/\.code-display\s*\{[^}]*color:\s*#f272ad/i)
    expect(content).toMatch(/\.domain-bound-otp\s*\{[^}]*color:\s*#8d9c94/i)

    // Verify dark mode preserves footer and expiry contrast (WCAG AA)
    expect(content).toMatch(/\.expiry-text\s*\{[^}]*color:\s*#8d9c94/i)
    expect(content).toMatch(/\.footer-text\s*\{[^}]*color:\s*#8d9c94/i)

    // Verify mobile optical centering for OTP code
    expect(content).toMatch(/\.code-display\s*\{[^}]*padding-left:\s*0\.22em/i)
  })

  it('preserves WCAG AA contrast on light mode text and footer', () => {
    const content = readFileSync(templatePath, 'utf-8')
    // Uses #5f6e66 (5.34:1 on #ffffff, 4.98:1 on #fdf5f8)
    expect(content).toMatch(/class="expiry-text"[^>]*color:\s*#5f6e66/i)
    expect(content).toMatch(/class="footer-text"[^>]*color:\s*#5f6e66/i)
  })

  it('renders cleanly without leftover template delimiters when Go variables are substituted', () => {
    const content = readFileSync(templatePath, 'utf-8')
    const rendered = content
      .replace(
        /\{\{\s*\.ConfirmationURL\s*\}\}/g,
        'https://joli.to/#access_token=test-jwt',
      )
      .replace(/\{\{\s*\.Token\s*\}\}/g, '482910')

    expect(rendered).toContain('https://joli.to/#access_token=test-jwt')
    expect(rendered).toContain('482910')
    expect(rendered).toContain('@joli.to #482910')
    expect(rendered).not.toContain('{{')
    expect(rendered).not.toContain('}}')
  })

  it('supabase/config.toml defines magic_link email template configuration', () => {
    expect(existsSync(configPath)).toBe(true)
    const configContent = readFileSync(configPath, 'utf-8')

    expect(configContent).toContain('[auth.email.template.magic_link]')
    expect(configContent).toMatch(
      /subject\s*=\s*"Your Jolito verification code is \{\{ \.Token \}\}"/,
    )
    expect(configContent).toMatch(
      /content_path\s*=\s*"\.\/supabase\/templates\/magic_link\.html"/,
    )
  })
})
