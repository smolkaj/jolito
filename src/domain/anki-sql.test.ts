import { describe, it, expect } from 'vitest'
import { getSqlJs, resetSqlPromiseForTesting } from './anki-sql'

describe('getSqlJs', () => {
  it('loads sql.js engine and allows executing queries', async () => {
    resetSqlPromiseForTesting()
    const SQL = await getSqlJs()
    expect(SQL).toBeDefined()
    const db = new SQL.Database()
    db.run('CREATE TABLE words (id INTEGER PRIMARY KEY, term TEXT);')
    db.run('INSERT INTO words VALUES (1, "hola");')
    const res = db.exec('SELECT * FROM words WHERE id = 1;')
    expect(res).toHaveLength(1)
    expect(res[0]?.values[0]?.[1]).toBe('hola')
    db.close()
  })

  it('reuses existing sql instance on consecutive calls', async () => {
    const instance1 = await getSqlJs()
    const instance2 = await getSqlJs()
    expect(instance1).toBe(instance2)
  })

  it('supports customInit function', async () => {
    resetSqlPromiseForTesting()
    const custom = await getSqlJs(async () => {
      const SQL = await getSqlJs()
      return SQL
    })
    expect(custom).toBeDefined()
  })
})
