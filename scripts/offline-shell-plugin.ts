import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

/** The worker and its complete asset list are versioned together on every build. */
export function offlineShellPlugin(): Plugin {
  let buildId: string | undefined
  return {
    name: 'jolito-offline-shell',
    apply: 'build',
    transformIndexHtml() {
      if (!buildId) throw new Error('Offline build identity was not generated')
      return [
        {
          tag: 'meta',
          attrs: { name: 'jolito-build', content: buildId },
          injectTo: 'head',
        },
      ]
    },
    generateBundle(_options, bundle) {
      const source = readFileSync('public/sw.js', 'utf8')
      const files = Object.keys(bundle).sort()
      const hash = createHash('sha256')
        .update(source)
        .update(readFileSync('index.html'))
      for (const file of files) {
        const entry = bundle[file]!
        hash
          .update(file)
          .update(entry.type === 'chunk' ? entry.code : entry.source)
      }
      // Include public content so a dictionary/icon-only deployment updates the worker.
      for (const file of readdirSync('public', {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
        .sort((a, b) =>
          resolve(a.parentPath, a.name).localeCompare(
            resolve(b.parentPath, b.name),
          ),
        )) {
        const path = resolve(file.parentPath, file.name)
        hash
          .update(relative(resolve('public'), path))
          .update(readFileSync(path))
      }
      buildId = hash.digest('hex').slice(0, 16)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: source
          .replace('__JOLITO_BUILD_ID__', buildId)
          .replace('/* __JOLITO_BUILD_ASSETS__ */ []', JSON.stringify(files)),
      })
    },
  }
}
