import { describe, it, expect, vi } from 'vitest'
import {
  cleanAnkiHtml,
  detectDirection,
  parseAnkiText,
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

describe('parseAnkiDeck packageParser delegation', () => {
  const fixedNow = 1700000000000

  it('rejects binary zip archive when no package parser is provided', async () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const result = await parseAnkiDeck(zipBytes, 'test.apkg', fixedNow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('requires an Anki package parser')
    }
  })

  it('delegates binary zip archive to provided package parser', async () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const mockParser = vi.fn().mockResolvedValue({
      success: true,
      cards: [],
      count: 0,
      stats: { newCount: 0, reviewCount: 0, learningCount: 0 },
    })
    const result = await parseAnkiDeck(
      zipBytes,
      'test.apkg',
      fixedNow,
      mockParser,
    )
    expect(mockParser).toHaveBeenCalledWith(zipBytes, fixedNow)
    expect(result.success).toBe(true)
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
    const emptyZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
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
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const resWithoutParser = await parseAnkiDeck(
      zipBytes,
      'sample.apkg',
      fixedNow,
    )
    expect(resWithoutParser.success).toBe(false)
    if (!resWithoutParser.success) {
      expect(resWithoutParser.error).toContain(
        'requires an Anki package parser',
      )
    }

    const mockParser = vi.fn().mockResolvedValue({
      success: true,
      cards: [],
      count: 0,
      stats: { newCount: 0, reviewCount: 0, learningCount: 0 },
    })
    const resWithParser = await parseAnkiDeck(
      zipBytes,
      'sample.apkg',
      fixedNow,
      mockParser,
    )
    expect(resWithParser.success).toBe(true)
    expect(mockParser).toHaveBeenCalledWith(zipBytes, fixedNow)
  })

  it('falls back to text parsing when json backup fails', async () => {
    const invalidJsonCards = '{ "not": "valid backup" }'
    const res = await parseAnkiDeck(invalidJsonCards, 'file.txt', fixedNow)
    expect(res.success).toBe(false)
  })
})

describe('numeric entity bounds tests', () => {
  it('handles invalid or out-of-bounds numeric entities safely', () => {
    const textDec = 'Word &#999999999; test'
    expect(cleanAnkiHtml(textDec)).toBe('Word test')

    const textHex = 'Word &#x110000; test'
    expect(cleanAnkiHtml(textHex)).toBe('Word test')
  })
})

describe('bulletproof stress and edge case testing', () => {
  const fixedNow = 1700000000000

  it('strips <style>, <script>, and <!-- comments --> from HTML', () => {
    const raw = `
      <style>
        .my-class { color: red; font-size: 16px; }
      </style>
      <script>
        alert("evil");
      </script>
      <!-- this is an internal comment -->
      <span class="my-class">Buenos días</span>
    `
    expect(cleanAnkiHtml(raw)).toBe('Buenos días')
  })

  it('strips zero-width spaces, joiners, and BOM marks', () => {
    const raw = '\uFEFF\u200B\u200CHola\u200D mundo\u200B'
    expect(cleanAnkiHtml(raw)).toBe('Hola mundo')
  })

  it('parses text export with 1-column cloze deletion notes', () => {
    const clozeText =
      'El {{c1::perro::canine}} duerme.\nLa {{c1::casa::house}} es grande.'
    const res = parseAnkiText(clozeText, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(2)
      expect(res.cards[0]?.prompt).toBe('El [canine] duerme.')
      expect(res.cards[0]?.answer).toBe('perro')
      expect(res.cards[1]?.prompt).toBe('La [house] es grande.')
      expect(res.cards[1]?.answer).toBe('casa')
    }
  })

  it('parses text export with space separator header #separator:space', () => {
    const spaceText = `#separator:space\nperro dog\ngato cat`
    const res = parseAnkiText(spaceText, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(2)
      expect(res.cards[0]?.prompt).toBe('perro')
      expect(res.cards[0]?.answer).toBe('dog')
    }
  })

  it('parses text export with pipe separator header #separator:pipe', () => {
    const pipeText = `#separator:pipe\n#html:true\nmesa|table|furniture\nsilla|chair|furniture`
    const res = parseAnkiText(pipeText, fixedNow)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.count).toBe(2)
      expect(res.cards[0]?.prompt).toBe('mesa')
      expect(res.cards[0]?.answer).toBe('table')
      expect(res.cards[0]?.context).toBe('furniture')
    }
  })

  it('fuzz testing: handles arbitrary random strings without throwing', async () => {
    const fuzzInputs = [
      '<html><body><script>unclosed',
      '{{c1::broken',
      '{{c999999999999999999::answer}}',
      '#separator:unknown_custom\n\n\n\n',
      '"""unclosed quotes in csv',
      '\x00\x01\x02\x03\x04\x05',
      '&#xZZZZ; &#9999999999999; &unknown;',
      '   \r\n\t\r\n   ',
      '# comment only\n# another comment',
      JSON.stringify({ not: 'a valid backup payload' }),
    ]

    for (const input of fuzzInputs) {
      expect(() => cleanAnkiHtml(input)).not.toThrow()
      expect(() => detectDirection(input, input)).not.toThrow()
      expect(() => parseAnkiText(input, fixedNow)).not.toThrow()
      await expect(
        parseAnkiDeck(input, 'test.txt', fixedNow),
      ).resolves.toBeDefined()
    }
  })
})
