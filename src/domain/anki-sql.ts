import initSqlJs, { type SqlJsStatic } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let sqlPromise: Promise<SqlJsStatic> | null = null

export function resetSqlPromiseForTesting(): void {
  sqlPromise = null
}

export async function getSqlJs(
  customInit?: () => Promise<SqlJsStatic>,
): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    if (customInit) {
      sqlPromise = customInit()
    } else {
      /* v8 ignore next 3 */
      if (typeof process === 'undefined' || !process.versions?.node) {
        sqlPromise = initSqlJs({ locateFile: () => sqlWasmUrl })
      } else {
        const fs = await import('node:fs')
        const path = await import('node:path')
        const buffer = fs.readFileSync(
          path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
        )
        const wasmBinary = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        )
        sqlPromise = initSqlJs({ wasmBinary })
      }
    }
  }
  return sqlPromise
}
