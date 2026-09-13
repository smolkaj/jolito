import { describe, it, expect } from 'vitest'
import * as fflate from 'fflate'
import { getSqlJs } from './anki-sql'
import { parseAnkiPackage } from './anki-package'

describe('parseAnkiPackage (.apkg)', () => {
  const fixedNow = 1700000000000

  async function createSampleApkg(options: {
    deckName?: string
    crt?: number
    includeCol?: boolean
    useDefaultOnlyDecks?: boolean
    notes: Array<{
      id: number
      guid: string
      mid: number
      flds: string
      tags?: string
    }>
    cards: Array<{
      id: number
      nid: number
      did?: number
      ord: number
      type: number
      queue: number
      due: number
      ivl: number
      factor: number
      reps: number
      lapses: number
    }>
  }): Promise<Uint8Array> {
    const SQL = await getSqlJs()
    const db = new SQL.Database()

    db.run(`
      CREATE TABLE col (
        id integer primary key,
        crt integer not null,
        mod integer not null,
        scm integer not null,
        ver integer not null,
        dty integer not null,
        usn integer not null,
        ls integer not null,
        conf text not null,
        models text not null,
        decks text not null,
        dconf text not null,
        tags text not null
      );
      CREATE TABLE notes (
        id integer primary key,
        guid text not null,
        mid integer not null,
        mod integer not null,
        usn integer not null,
        tags text not null,
        flds text not null,
        sfld text not null,
        csum integer not null,
        flags integer not null,
        data text not null
      );
      CREATE TABLE cards (
        id integer primary key,
        nid integer not null,
        did integer not null,
        ord integer not null,
        mod integer not null,
        usn integer not null,
        type integer not null,
        queue integer not null,
        due integer not null,
        ivl integer not null,
        factor integer not null,
        reps integer not null,
        lapses integer not null,
        left integer not null,
        odue integer not null,
        odid integer not null,
        flags integer not null,
        data text not null
      );
    `)

    const crt = options.crt ?? 1600000000
    const deckId = 1580000000000
    const deckName = options.deckName ?? 'Spanish Vocabulary'
    const decksJson = options.useDefaultOnlyDecks
      ? JSON.stringify({ '1': { id: 1, name: 'Default' } })
      : JSON.stringify({
          '1': { id: 1, name: 'Default' },
          [String(deckId)]: { id: deckId, name: deckName },
        })
    const modelsJson = JSON.stringify({
      '1': {
        id: 1,
        name: 'Basic',
        flds: [{ name: 'Front' }, { name: 'Back' }],
        tmpls: [{ name: 'Card 1', ord: 0 }],
      },
    })

    if (options.includeCol !== false) {
      db.run(
        'INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, "{}", ?, ?, "{}", "{}")',
        [crt, crt, crt, modelsJson, decksJson],
      )
    }

    for (const n of options.notes) {
      db.run('INSERT INTO notes VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, 0, "")', [
        n.id,
        n.guid,
        n.mid,
        crt,
        n.tags ?? '',
        n.flds,
        n.flds.split('\x1f')[0] ?? '',
      ])
    }

    for (const c of options.cards) {
      db.run(
        'INSERT INTO cards VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, "")',
        [
          c.id,
          c.nid,
          c.did ?? deckId,
          c.ord,
          crt,
          c.type,
          c.queue,
          c.due,
          c.ivl,
          c.factor,
          c.reps,
          c.lapses,
        ],
      )
    }

    const sqliteData = db.export()
    db.close()

    const zipFiles: Record<string, Uint8Array> = {
      'collection.anki2': sqliteData,
      media: new TextEncoder().encode('{}'),
    }

    return fflate.zipSync(zipFiles)
  }

  it('imports an Anki .apkg deck package and preserves spaced repetition schedule', async () => {
    const apkgBytes = await createSampleApkg({
      deckName: 'Mexican Spanish Essentials',
      crt: 1600000000,
      notes: [
        {
          id: 1001,
          guid: 'g1001',
          mid: 1,
          flds: 'el aguacate\x1favocado\x1fcommon food ingredient',
        },
        {
          id: 1002,
          guid: 'g1002',
          mid: 1,
          flds: 'la estación de metro\x1fthe subway station\x1ftransit',
        },
        {
          id: 1003,
          guid: 'g1003',
          mid: 1,
          flds: 'el perro\x1fthe dog',
        },
        {
          id: 1004,
          guid: 'g1004',
          mid: 1,
          flds: 'el gato\x1fthe cat',
        },
      ],
      cards: [
        {
          id: 2001,
          nid: 1001,
          ord: 0,
          type: 2, // review
          queue: 2,
          due: 25, // 25 days after crt
          ivl: 14,
          factor: 2600, // 2.6 ease
          reps: 5,
          lapses: 1,
        },
        {
          id: 2002,
          nid: 1002,
          ord: 0,
          type: 0, // new
          queue: 0,
          due: 1002,
          ivl: 0,
          factor: 2500,
          reps: 0,
          lapses: 0,
        },
        {
          id: 2003,
          nid: 1003,
          ord: 0,
          type: 1, // learning
          queue: 1,
          due: 1003,
          ivl: 0,
          factor: 2500,
          reps: 1,
          lapses: 0,
        },
        {
          id: 2004,
          nid: 1004,
          ord: 0,
          type: 3, // relearning
          queue: 1,
          due: 1004,
          ivl: 2,
          factor: 2100,
          reps: 4,
          lapses: 1,
        },
      ],
    })

    const result = await parseAnkiPackage(apkgBytes, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.deckName).toBe('Mexican Spanish Essentials')
    expect(result.count).toBe(4)
    expect(result.stats.reviewCount).toBe(1)
    expect(result.stats.newCount).toBe(1)
    expect(result.stats.learningCount).toBe(2)

    const card1 = result.cards.find((c) => c.noteId === 'anki-1001')
    expect(card1).toBeDefined()
    expect(card1?.prompt).toBe('el aguacate')
    expect(card1?.answer).toBe('avocado')
    expect(card1?.context).toBe('common food ingredient')
    expect(card1?.direction).toBe('es-en')
    expect(card1?.scene).toBe('takeaway')
    expect(card1?.schedule.state).toBe('review')
    expect(card1?.schedule.intervalDays).toBe(14)
    expect(card1?.schedule.easeFactor).toBe(2.6)
    expect(card1?.schedule.reviews).toBe(5)
    expect(card1?.schedule.lapses).toBe(1)
    expect(card1?.schedule.dueAt).toBe((1600000000 + 25 * 86400) * 1000)

    const card2 = result.cards.find((c) => c.noteId === 'anki-1002')
    expect(card2).toBeDefined()
    expect(card2?.prompt).toBe('la estación de metro')
    expect(card2?.answer).toBe('the subway station')
    expect(card2?.scene).toBe('metro')
    expect(card2?.schedule.state).toBe('new')
    expect(card2?.schedule.dueAt).toBe(fixedNow)

    const card3 = result.cards.find((c) => c.noteId === 'anki-1003')
    expect(card3?.schedule.state).toBe('learning')

    const card4 = result.cards.find((c) => c.noteId === 'anki-1004')
    expect(card4?.schedule.state).toBe('relearning')
  })

  it('handles default-only decks fallback', async () => {
    const apkgBytes = await createSampleApkg({
      useDefaultOnlyDecks: true,
      notes: [{ id: 1, guid: 'g1', mid: 1, flds: 'uno\x1fone' }],
      cards: [
        {
          id: 1,
          nid: 1,
          ord: 0,
          type: 0,
          queue: 0,
          due: 1,
          ivl: 0,
          factor: 0,
          reps: 0,
          lapses: 0,
        },
      ],
    })
    const result = await parseAnkiPackage(apkgBytes, fixedNow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.deckName).toBe('Default')
    }
  })

  it('handles collection without col table gracefully', async () => {
    const apkgBytes = await createSampleApkg({
      includeCol: false,
      notes: [{ id: 1, guid: 'g1', mid: 1, flds: 'uno\x1fone' }],
      cards: [
        {
          id: 1,
          nid: 1,
          ord: 0,
          type: 0,
          queue: 0,
          due: 1,
          ivl: 0,
          factor: 0,
          reps: 0,
          lapses: 0,
        },
      ],
    })
    const result = await parseAnkiPackage(apkgBytes, fixedNow)
    expect(result.success).toBe(true)
  })

  it('handles bidirectional note cards with reversed templates', async () => {
    const apkgBytes = await createSampleApkg({
      notes: [
        {
          id: 1003,
          guid: 'g1003',
          mid: 1,
          flds: 'el café\x1fcoffee',
        },
      ],
      cards: [
        {
          id: 3001,
          nid: 1003,
          ord: 0,
          type: 0,
          queue: 0,
          due: 1,
          ivl: 0,
          factor: 2500,
          reps: 0,
          lapses: 0,
        },
        {
          id: 3002,
          nid: 1003,
          ord: 1, // Reverse card
          type: 0,
          queue: 0,
          due: 2,
          ivl: 0,
          factor: 2500,
          reps: 0,
          lapses: 0,
        },
      ],
    })

    const result = await parseAnkiPackage(apkgBytes, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(2)
    const forward = result.cards[0]
    const reverse = result.cards[1]
    expect(forward?.prompt).toBe('el café')
    expect(forward?.answer).toBe('coffee')
    expect(forward?.direction).toBe('es-en')

    expect(reverse?.prompt).toBe('coffee')
    expect(reverse?.answer).toBe('el café')
    expect(reverse?.direction).toBe('en-es')
  })

  it('returns structured error when zip file is corrupt', async () => {
    const corruptData = new Uint8Array([1, 2, 3, 4, 5])
    const result = await parseAnkiPackage(corruptData, fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('corrupted or not a valid .apkg archive')
    }
  })

  it('returns error when collection.anki2 is missing in archive', async () => {
    const emptyZip = fflate.zipSync({
      'dummy.txt': new TextEncoder().encode('hi'),
    })
    const result = await parseAnkiPackage(emptyZip, fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('database not found')
    }
  })

  it('returns error when collection has no notes/cards', async () => {
    const emptyDbApkg = await createSampleApkg({
      notes: [],
      cards: [],
    })
    const result = await parseAnkiPackage(emptyDbApkg, fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('No flashcards found')
    }
  })

  it('returns error when cards have only empty prompt and answer strings', async () => {
    const blankApkg = await createSampleApkg({
      notes: [{ id: 1, guid: 'g1', mid: 1, flds: '  \x1f  ' }],
      cards: [
        {
          id: 1,
          nid: 1,
          ord: 0,
          type: 0,
          queue: 0,
          due: 1,
          ivl: 0,
          factor: 0,
          reps: 0,
          lapses: 0,
        },
      ],
    })
    const result = await parseAnkiPackage(blankApkg, fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('No flashcards found')
    }
  })

  it('handles custom note model with multiple fields', async () => {
    const SQL = await getSqlJs()
    const db = new SQL.Database()
    db.run(`
      CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, decks TEXT);
      CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT, tags TEXT);
      CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, ord INTEGER, type INTEGER, queue INTEGER, due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, did INTEGER);
      INSERT INTO col VALUES (1, 1600000000, '{"1": {"name": "Custom"}}');
      INSERT INTO notes VALUES (1, 1, '¿Quieres un vaso de agua?\x1fDo you want a glass of water?\x1fextra context note', 'dining');
      INSERT INTO cards VALUES (1, 1, 0, 0, 0, 1, 0, 2500, 0, 0, 1);
    `)

    const dbBytes = db.export()
    db.close()

    const zip = fflate.zipSync({
      'collection.anki2': dbBytes,
    })

    const res = await parseAnkiPackage(zip, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(1)
      expect(res.cards[0]?.prompt).toBe('¿Quieres un vaso de agua?')
      expect(res.cards[0]?.answer).toBe('Do you want a glass of water?')
      expect(res.cards[0]?.context).toBe('extra context note dining')
    }
  })

  it('handles Anki cloze note inside .apkg SQLite package with 1 field', async () => {
    const SQL = await getSqlJs()
    const db = new SQL.Database()

    db.run(`
      CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, decks TEXT);
      CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT, tags TEXT);
      CREATE TABLE cards (
        id INTEGER PRIMARY KEY, nid INTEGER, ord INTEGER, type INTEGER, queue INTEGER,
        due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, did INTEGER
      );
    `)

    db.run(`
      INSERT INTO col VALUES (1, 1600000000, '{"1": {"name": "Spanish Clozes"}}');
      INSERT INTO notes VALUES (1, 10, '¿Quieres un {{c1::vaso de agua::glass of water}}?', 'dining');
      INSERT INTO cards VALUES (101, 1, 0, 0, 0, 0, 0, 2500, 0, 0, 1);
    `)

    const dbBytes = db.export()
    db.close()

    const zip = fflate.zipSync({
      'collection.anki2': dbBytes,
    })

    const res = await parseAnkiPackage(zip, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(1)
      expect(res.cards[0]?.prompt).toBe('¿Quieres un [glass of water]?')
      expect(res.cards[0]?.answer).toBe('vaso de agua')
      expect(res.cards[0]?.context).toBe('dining')
    }
  })

  it('handles SQLite database with missing notes table gracefully without throwing', async () => {
    const SQL = await getSqlJs()
    const db = new SQL.Database()
    db.run(
      'CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, decks TEXT);',
    )
    const dbBytes = db.export()
    db.close()

    const zip = fflate.zipSync({
      'collection.anki2': dbBytes,
    })

    const res = await parseAnkiPackage(zip, fixedNow)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Failed to read Anki database')
    }
  })

  it('handles corrupt SQLite binary inside zip gracefully without throwing', async () => {
    const corruptDb = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])
    const zip = fflate.zipSync({
      'collection.anki2': corruptDb,
    })

    const res = await parseAnkiPackage(zip, fixedNow)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toMatch(/database|failed/i)
    }
  })
})
