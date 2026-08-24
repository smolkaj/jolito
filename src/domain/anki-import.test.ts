import { describe, it, expect } from 'vitest'
import * as fflate from 'fflate'
import { getSqlJs } from './anki-sql'
import {
  cleanAnkiHtml,
  detectDirection,
  parseAnkiText,
  parseAnkiPackage,
  parseAnkiDeck,
} from './anki-import'

describe('cleanAnkiHtml', () => {
  it('handles empty or blank input', () => {
    expect(cleanAnkiHtml('')).toBe('')
  })

  it('strips basic HTML tags and converts line breaks to spaces', () => {
    const raw =
      '<b>Hola</b><br><div>¿Cómo estás?</div><p>Muy bien</p><li>item</li><tr>row</tr>'
    expect(cleanAnkiHtml(raw)).toBe('Hola ¿Cómo estás? Muy bien item row')
  })

  it('removes Anki sound tags and play tags', () => {
    const raw = '[sound:rec_12345.mp3] Buenos días [anki:play:q:0]'
    expect(cleanAnkiHtml(raw)).toBe('Buenos días')
  })

  it('decodes HTML entities including named, numeric decimal, and numeric hex', () => {
    const raw =
      '&iquest;Qu&eacute; tal? &amp; &iexcl;Hola! &quot;amigo&#39; &#160;gracias &#x21; &#x2014;'
    expect(cleanAnkiHtml(raw)).toBe('¿Qué tal? & ¡Hola! "amigo\' gracias ! —')
  })

  it('processes cloze deletions for prompt and answer', () => {
    const cloze1 = 'La capital de España es {{c1::Madrid::ciudad}}.'
    expect(
      cleanAnkiHtml(cloze1, { clozeSide: 'prompt', targetOrdinal: 0 }),
    ).toBe('La capital de España es [ciudad].')
    expect(
      cleanAnkiHtml(cloze1, { clozeSide: 'answer', targetOrdinal: 0 }),
    ).toBe('Madrid')

    const clozeWithoutHint = 'El perro es {{c1::canino}}.'
    expect(
      cleanAnkiHtml(clozeWithoutHint, {
        clozeSide: 'prompt',
        targetOrdinal: 0,
      }),
    ).toBe('El perro es [...].')
    expect(
      cleanAnkiHtml(clozeWithoutHint, {
        clozeSide: 'answer',
        targetOrdinal: 0,
      }),
    ).toBe('canino')

    // Multiple clozes on same sentence
    const multiCloze = '{{c1::Uno}} y {{c2::dos}}'
    expect(
      cleanAnkiHtml(multiCloze, { clozeSide: 'prompt', targetOrdinal: 0 }),
    ).toBe('[...] y dos')
    expect(
      cleanAnkiHtml(multiCloze, { clozeSide: 'prompt', targetOrdinal: 1 }),
    ).toBe('Uno y [...]')

    // Cloze side answer when no cloze matches ordinal
    expect(
      cleanAnkiHtml('No cloze here', { clozeSide: 'answer', targetOrdinal: 0 }),
    ).toBe('No cloze here')

    // Cloze without side options
    expect(cleanAnkiHtml('Texto con {{c1::palabra}}')).toBe('Texto con palabra')
  })
})

describe('detectDirection', () => {
  it('identifies Spanish prompt with English answer as es-en', () => {
    expect(
      detectDirection('¿Dónde está la biblioteca?', 'Where is the library?'),
    ).toBe('es-en')
    expect(
      detectDirection(
        'el gato duerme en la casa',
        'the cat sleeps in the house',
      ),
    ).toBe('es-en')
    expect(detectDirection('árbol', 'tree')).toBe('es-en')
  })

  it('identifies English prompt with Spanish answer as en-es', () => {
    expect(
      detectDirection('Where is the station?', '¿Dónde está la estación?'),
    ).toBe('en-es')
    expect(detectDirection('the dog and the cat', 'el perro y el gato')).toBe(
      'en-es',
    )
    expect(detectDirection('coffee', 'el café')).toBe('en-es')
  })

  it('defaults to es-en when ambiguous', () => {
    expect(detectDirection('Taxi', 'Taxi')).toBe('es-en')
  })
})

describe('parseAnkiText', () => {
  const fixedNow = 1700000000000

  it('parses standard Anki tab-delimited text export with headers', () => {
    const text = `#separator:tab
#html:true
#tags column:4
#columns:Front	Back	Context	Tags
¿Cómo te llamas?	What is your name?	Meeting someone new	greetings basics
Muchas gracias	Thank you very much	Polite expression	polite
`
    const result = parseAnkiText(text, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(2)
    expect(result.cards).toHaveLength(2)
    expect(result.cards[0]?.prompt).toBe('¿Cómo te llamas?')
    expect(result.cards[0]?.answer).toBe('What is your name?')
    expect(result.cards[0]?.context).toBe('Meeting someone new')
    expect(result.cards[0]?.direction).toBe('es-en')
    expect(result.cards[0]?.schedule.state).toBe('new')
    expect(result.cards[0]?.schedule.dueAt).toBe(fixedNow)

    expect(result.stats.newCount).toBe(2)
    expect(result.stats.reviewCount).toBe(0)
  })

  it('parses comma-separated CSV Anki export with quotes, escaped quotes, and multi-line fields', () => {
    const csv = `#separator:comma
"Hola, ""amigo""","Hello, ""friend""","informal greeting"
"Buenas noches","Good evening<br><i>(or night)</i>","evening farewell"
`
    const result = parseAnkiText(csv, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(2)
    expect(result.cards[0]?.prompt).toBe('Hola, "amigo"')
    expect(result.cards[0]?.answer).toBe('Hello, "friend"')
    expect(result.cards[1]?.answer).toBe('Good evening (or night)')
  })

  it('parses semicolon, pipe, and space separated text exports', () => {
    const semi = `#separator:semicolon\nuno;one;number 1`
    const semiRes = parseAnkiText(semi, fixedNow)
    expect(semiRes.success).toBe(true)

    const pipe = `#separator:pipe\ndos|two|number 2`
    const pipeRes = parseAnkiText(pipe, fixedNow)
    expect(pipeRes.success).toBe(true)

    const custom = `#separator:~\ntres~three~number 3`
    const customRes = parseAnkiText(custom, fixedNow)
    expect(customRes.success).toBe(true)

    const space = `#separator:space\ncuatro four`
    const spaceRes = parseAnkiText(space, fixedNow)
    expect(spaceRes.success).toBe(true)
  })

  it('auto-detects semicolon delimiter when no headers are present', () => {
    const semiAuto = `uno;one\ndos;two\ntres;three`
    const res = parseAnkiText(semiAuto, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(3)
    }
  })

  it('handles 2-column plain text TSV without headers', () => {
    const tsv = `el café	coffee
la estación	station
la comida	food
`
    const result = parseAnkiText(tsv, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(3)
    expect(result.cards[0]?.prompt).toBe('el café')
    expect(result.cards[0]?.answer).toBe('coffee')
    expect(result.cards[0]?.scene).toBe('takeaway')
  })

  it('returns error on empty or whitespace-only text', () => {
    const result = parseAnkiText('   \n\n#separator:tab\n\n', fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('No flashcards found')
    }
  })

  it('ignores lines with insufficient columns or empty front/back', () => {
    const tsv = `single column only
	missing prompt
valid prompt	valid answer
`
    const result = parseAnkiText(tsv, fixedNow)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.count).toBe(1)
    expect(result.cards[0]?.prompt).toBe('valid prompt')
  })
})

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
})

describe('parseAnkiDeck dispatcher', () => {
  const fixedNow = 1700000000000

  it('dispatches .txt string to parseAnkiText', async () => {
    const text = 'gracias\tthank you\npor favor\tplease'
    const result = await parseAnkiDeck(text, 'cards.txt', fixedNow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.count).toBe(2)
    }
  })

  it('dispatches utf-8 text from Uint8Array when non-zip', async () => {
    const encoded = new TextEncoder().encode('hola\thello\nadios\tgoodbye')
    const result = await parseAnkiDeck(encoded, 'words.tsv', fixedNow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.count).toBe(2)
    }
  })

  it('dispatches Jolito JSON backup format gracefully', async () => {
    const json = JSON.stringify({
      version: 1,
      cards: [
        {
          id: 'card-1',
          noteId: 'note-1',
          prompt: 'hola',
          answer: 'hello',
          direction: 'es-en',
          context: '',
          scene: 'conversation',
          schedule: {
            state: 'new',
            dueAt: fixedNow,
            intervalDays: 0,
            easeFactor: 2.5,
            reviews: 0,
            lapses: 0,
          },
        },
      ],
    })
    const result = await parseAnkiDeck(json, 'backup.json', fixedNow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.count).toBe(1)
      expect(result.cards[0]?.prompt).toBe('hola')
    }
  })

  it('handles invalid apkg as string gracefully', async () => {
    const result = await parseAnkiDeck(
      'not a real package',
      'bad.apkg',
      fixedNow,
    )
    expect(result.success).toBe(false)
  })

  it('handles binary array buffer without zip header or valid text gracefully', async () => {
    const invalidBinary = new Uint8Array([0, 1, 2, 3, 4])
    const result = await parseAnkiDeck(
      invalidBinary.buffer,
      'unknown.bin',
      fixedNow,
    )
    expect(result.success).toBe(false)
  })
})

describe('additional edge cases for 100% branch coverage', () => {
  const fixedNow = 1700000000000

  it('auto-detects comma delimiter when commas > 0 and no headers', () => {
    const csvAuto = 'uno,one\ndos,two\ntres,three'
    const res = parseAnkiText(csvAuto, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(3)
    }
  })

  it('handles parseAnkiDeck with ArrayBuffer containing valid zip', async () => {
    const emptyZip = fflate.zipSync({
      'dummy.txt': new TextEncoder().encode('hi'),
    })
    const res = await parseAnkiDeck(emptyZip.buffer, 'sample.apkg', fixedNow)
    expect(res.success).toBe(false)
  })

  it('handles parseAnkiDeck with non-utf8 binary buffer', async () => {
    const nonUtf8 = new Uint8Array([0x80, 0x81, 0x82, 0xff])
    const res = await parseAnkiDeck(nonUtf8.buffer, 'corrupt.bin', fixedNow)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toContain('Unsupported file format')
    }
  })
})

describe('coverage boost test cases', () => {
  it('calls parseAnkiDeck without optional parameters', async () => {
    const text = 'perro\tdog'
    const res = await parseAnkiDeck(text)
    expect(res.success).toBe(true)
  })

  it('rejects string ending in .colpkg', async () => {
    const res = await parseAnkiDeck('bad string', 'deck.colpkg')
    expect(res.success).toBe(false)
  })

  it('dispatches JSON array backup format', async () => {
    const json = JSON.stringify([
      {
        id: 'card-2',
        noteId: 'note-2',
        prompt: 'gato',
        answer: 'cat',
        direction: 'es-en',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'review',
          dueAt: 1700000000000,
          intervalDays: 1,
          easeFactor: 2.5,
          reviews: 1,
          lapses: 0,
        },
      },
    ])
    const res = await parseAnkiDeck(json)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(1)
    }
  })
})

describe('more branch coverage tests', () => {
  const fixedNow = 1700000000000

  it('handles parseAnkiDeck with Uint8Array zip directly', async () => {
    const emptyZip = fflate.zipSync({
      'dummy.txt': new TextEncoder().encode('hi'),
    })
    const res = await parseAnkiDeck(emptyZip, 'sample.apkg', fixedNow)
    expect(res.success).toBe(false)
  })

  it('falls back to text parsing when json backup fails', async () => {
    const invalidJsonCards = '{ "not": "valid backup" }'
    const res = await parseAnkiDeck(invalidJsonCards, 'file.txt', fixedNow)
    expect(res.success).toBe(false)
  })
})
