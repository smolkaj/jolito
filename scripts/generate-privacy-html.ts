import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import {
  PRIVACY_POLICY_METADATA,
  PRIVACY_SECTIONS,
  type PrivacySegment,
} from '../src/domain/privacy-content.ts'

function renderSegment(segment: PrivacySegment): string {
  if (segment.type === 'text') return segment.text
  if (segment.type === 'strong') return `<strong>${segment.text}</strong>`
  if (segment.type === 'link') {
    const target = segment.external
      ? ' target="_blank" rel="noopener noreferrer"'
      : ''
    return `<a href="${segment.href}"${target}>${segment.text}</a>`
  }
  return ''
}

export async function generatePrivacyHtml(): Promise<string> {
  const sectionsHtml = PRIVACY_SECTIONS.map((section) => {
    const paragraphsHtml = section.paragraphs
      .map(
        (p) =>
          `        <p>\n          ${p.map(renderSegment).join('')}\n        </p>`,
      )
      .join('\n')
    return `      <section>\n        <h2>${section.number}. ${section.title}</h2>\n${paragraphsHtml}\n      </section>`
  }).join('\n\n')

  const rawHtml = `<!doctype html>
<html lang="en" style="background-color: #fdf5f8; color-scheme: light">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#fdf5f8" />
    <title>${PRIVACY_POLICY_METADATA.title}</title>
    <meta
      name="description"
      content="${PRIVACY_POLICY_METADATA.description}"
    />
    <link rel="canonical" href="${PRIVACY_POLICY_METADATA.canonicalUrl}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <style>
      :root {
        --papel: #fdf5f8;
        --card: #ffffff;
        --ink: #1f1b18;
        --ink-light: #645b53;
        --line: #2b2520;
        --rosa: #d94a7a;
        --rosa-dark: #b83561;
        --verde: #1b8a5a;
        --verde-dark: #126340;
        --shadow: 4px 4px 0 var(--line);
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
          Arial, sans-serif;
        background-color: var(--papel);
        color: var(--ink);
        line-height: 1.6;
        padding: 24px 16px 64px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
      }
      .privacy-container {
        width: 100%;
        max-width: 680px;
        background: var(--card);
        border: 2.5px solid var(--line);
        border-radius: 24px;
        padding: clamp(24px, 5vw, 40px);
        box-shadow: var(--shadow);
      }
      header {
        margin-bottom: 28px;
        border-bottom: 2px solid #f0e6eb;
        padding-bottom: 20px;
      }
      .brand-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .brand-title {
        font-size: 20px;
        font-weight: 800;
        color: var(--ink);
        text-decoration: none;
      }
      h1 {
        font-size: clamp(26px, 4vw, 32px);
        font-weight: 800;
        line-height: 1.2;
        color: var(--ink);
        margin-bottom: 8px;
      }
      .subtitle {
        color: var(--ink-light);
        font-size: 15px;
      }
      .effective-date {
        display: inline-block;
        margin-top: 6px;
        font-size: 13px;
        color: var(--ink-light);
      }
      section {
        margin-bottom: 24px;
      }
      h2 {
        font-size: 18px;
        font-weight: 700;
        color: var(--ink);
        margin-bottom: 8px;
      }
      p {
        font-size: 15px;
        color: var(--ink);
        line-height: 1.65;
        margin-bottom: 8px;
      }
      ul {
        margin-left: 20px;
        margin-bottom: 8px;
      }
      li {
        font-size: 15px;
        margin-bottom: 4px;
      }
      a {
        color: var(--rosa-dark);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      a:hover {
        color: var(--rosa);
      }
      .return-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 24px;
        padding: 10px 20px;
        background: var(--papel);
        border: 2px solid var(--line);
        border-radius: 9999px;
        font-weight: 700;
        font-size: 14px;
        color: var(--ink);
        text-decoration: none;
        box-shadow: 2px 2px 0 var(--line);
        transition: transform 120ms ease;
      }
      .return-link:hover {
        transform: translate(-1px, -1px);
        box-shadow: 3px 3px 0 var(--line);
      }
    </style>
  </head>
  <body>
    <main class="privacy-container">
      <header>
        <div class="brand-row">
          <a href="/" class="brand-title">Jolito</a>
        </div>
        <h1>Privacy Policy</h1>
        <span class="effective-date">Effective date: ${PRIVACY_POLICY_METADATA.effectiveDate}</span>
      </header>

${sectionsHtml}

      <a href="/" class="return-link">← Return to Jolito</a>
    </main>
  </body>
</html>
`

  const options = await prettier.resolveConfig('public/privacy.html')
  return prettier.format(rawHtml, {
    ...options,
    filepath: 'public/privacy.html',
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputPath = resolve('public/privacy.html')
  const formattedHtml = await generatePrivacyHtml()
  writeFileSync(outputPath, formattedHtml, 'utf-8')
  console.log(`Generated ${outputPath}`)
}
