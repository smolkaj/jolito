import { renderToStaticMarkup } from 'react-dom/server'
import { LegalContent } from '../src/content/LegalContent.tsx'
import dictionary from '../public/dict/es-en.json' with { type: 'json' }
import { dictionaryAttribution } from '../src/domain/dictionary-license.ts'

const pageStyles = `*{box-sizing:border-box}body{margin:0;background:#fdf5f8;color:#121815;font:16px/1.65 system-ui,sans-serif;padding:24px 16px}main{max-width:720px;margin:auto;background:white;border:2px solid #121815;border-radius:24px;padding:clamp(20px,5vw,40px);box-shadow:4px 4px 0 #121815}h1{line-height:1.2}h3{margin-top:28px}a{color:#a00057;text-underline-offset:3px}summary{cursor:pointer;font-weight:700;padding:12px 0}a:focus-visible,summary:focus-visible{outline:3px solid #a00057;outline-offset:4px}p,li{overflow-wrap:anywhere}.return{display:inline-block;margin-top:24px}`

export function dictionarySourcesHtml(): string {
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Dictionary credits • Jolito</title>
          <meta name="robots" content="noindex" />
          <style>{pageStyles}</style>
        </head>
        <body>
          <main>
            <a href="/privacy#credits">← Privacy &amp; credits</a>
            <h1>Dictionary sources</h1>
            <p>{dictionaryAttribution}</p>
            <p>
              Reference pages for the bundled dictionary’s headwords. Each
              page’s history credits its contributors. Some Mexican expressions
              are curated additions. Use your browser’s Find command to locate a
              word.
            </p>
            <ul>
              {dictionary.map(({ spanish }) => (
                <li key={spanish}>
                  <a
                    href={`https://en.wiktionary.org/wiki/${encodeURIComponent(spanish)}#Spanish`}
                  >
                    {spanish}
                  </a>
                </li>
              ))}
            </ul>
          </main>
        </body>
      </html>,
    )
  )
}

export function legalPageHtml(): string {
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#fdf5f8" />
          <title>Privacy Policy • Jolito</title>
          <link rel="canonical" href="https://joli.to/privacy" />
          <link rel="icon" href="/favicon.svg" />
          <style>{pageStyles}</style>
        </head>
        <body>
          <main>
            <a href="/">Jolito</a>
            <h1>Privacy Policy</h1>
            <LegalContent />
            <a href="/" className="return">
              ← Back to Jolito
            </a>
          </main>
        </body>
      </html>,
    )
  )
}
