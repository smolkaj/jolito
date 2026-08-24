import * as fflate from 'fflate'
import {
  chooseScene,
  studyCardSchema,
  type CardState,
  type Direction,
  type ReviewSchedule,
  type StudyCard,
} from './card'
import { parseDeckBackup } from './deck-backup'
import { getSqlJs } from './anki-sql'

export interface AnkiImportStats {
  newCount: number
  reviewCount: number
  learningCount: number
}

export type ParseAnkiResult =
  | {
      success: true
      cards: StudyCard[]
      count: number
      deckName?: string | undefined
      stats: AnkiImportStats
    }
  | {
      success: false
      error: string
      details?: string[] | undefined
    }

const ENTITY_MAP: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&iexcl;': '¡',
  '&iquest;': '¿',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&uuml;': 'ü',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Ntilde;': 'Ñ',
  '&Uuml;': 'Ü',
  '&mdash;': '—',
  '&ndash;': '–',
}

export function cleanAnkiHtml(
  raw: string,
  options?: { clozeSide?: 'prompt' | 'answer'; targetOrdinal?: number },
): string {
  if (!raw) return ''

  let text = raw
  const target = (options?.targetOrdinal ?? 0) + 1

  // If answer side of a cloze card, extract the cloze target content
  if (options?.clozeSide === 'answer') {
    const clozeRegex = /\{\{c(\d+)::([^:]+?)(?:::(.*?))?\}\}/g
    const matches: string[] = []
    let m: RegExpExecArray | null
    while ((m = clozeRegex.exec(text)) !== null) {
      if (Number(m[1]) === target && m[2]) {
        matches.push(m[2])
      }
    }
    if (matches.length > 0) {
      text = matches.join(', ')
    } else {
      text = text.replace(/\{\{c\d+::([^:]+?)(?:::(.*?))?\}\}/g, '$1')
    }
  } else if (options?.clozeSide === 'prompt') {
    text = text.replace(
      /\{\{c(\d+)::([^:]+?)(?:::(.*?))?\}\}/g,
      (
        _match: string,
        cNumStr: string,
        answerText: string,
        hintText?: string,
      ): string => {
        const cNum = Number(cNumStr)
        if (cNum === target) {
          return hintText ? `[${hintText}]` : '[...]'
        }
        return answerText
      },
    )
  } else {
    text = text.replace(/\{\{c\d+::([^:]+?)(?:::(.*?))?\}\}/g, '$1')
  }

  // Remove Anki media markup like [sound:...]
  text = text.replace(/\[sound:[^\]]+\]/gi, '')
  text = text.replace(/\[anki:[^\]]+\]/gi, '')

  // Replace block & break tags with spaces
  text = text.replace(/<(br|div|p|li|tr|\/tr|\/p|\/div)\s*\/?>/gi, ' ')

  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode named entities
  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    text = text.split(entity).join(replacement)
  }

  // Decode numeric decimal entities (e.g. &#160;)
  text = text.replace(/&#(\d+);/g, (_, dec: string) =>
    String.fromCodePoint(Number(dec)),
  )

  // Decode numeric hex entities (e.g. &#x20;)
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  )

  // Normalize spaces
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

const SPANISH_STOPWORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'en',
  'es',
  'son',
  'por',
  'para',
  'con',
  'sin',
  'que',
  'y',
  'o',
  'no',
  'se',
  'su',
  'mi',
  'tu',
  'este',
  'esta',
  'al',
  'muy',
  'más',
  'pero',
  'como',
  'yo',
  'tú',
  'él',
  'ella',
  'nosotros',
  'está',
  'están',
  'hacer',
  'tener',
])

const ENGLISH_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'this',
  'that',
  'these',
  'those',
  'and',
  'but',
  'or',
  'not',
  'it',
  'he',
  'she',
  'they',
  'we',
  'you',
  'i',
  'my',
  'your',
  'his',
  'her',
  'their',
  'our',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'what',
  'where',
])

export function detectDirection(prompt: string, answer: string): Direction {
  const getScores = (text: string) => {
    let esScore = 0
    let enScore = 0

    if (/[áéíóúüñ¿¡]/i.test(text)) {
      esScore += 5
    }

    const words = text
      .toLowerCase()
      .split(/[\s,.;:!?¿¡"()]+/)
      .filter((w) => w.length > 0)

    for (const word of words) {
      if (SPANISH_STOPWORDS.has(word)) esScore += 2
      if (ENGLISH_STOPWORDS.has(word)) enScore += 2
    }

    return { esScore, enScore }
  }

  const promptScores = getScores(prompt)
  const answerScores = getScores(answer)

  if (
    (promptScores.enScore > promptScores.esScore &&
      answerScores.esScore >= answerScores.enScore) ||
    (answerScores.esScore > 0 && promptScores.esScore === 0)
  ) {
    return 'en-es'
  }

  if (
    (promptScores.esScore > promptScores.enScore &&
      answerScores.enScore >= answerScores.esScore) ||
    (promptScores.esScore > 0 && answerScores.esScore === 0)
  ) {
    return 'es-en'
  }

  return 'es-en'
}

function parseCsvTsvRows(text: string, delimiter: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false
  let i = 0

  while (i < normalized.length) {
    const char = normalized[i]

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < normalized.length && normalized[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        }
        insideQuotes = false
        i++
        continue
      }
      currentField += char
      i++
      continue
    }

    if (char === '"') {
      insideQuotes = true
      i++
      continue
    }

    if (char === delimiter) {
      currentRow.push(currentField)
      currentField = ''
      i++
      continue
    }

    if (char === '\n') {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
      i++
      continue
    }

    currentField += char
    i++
  }

  currentRow.push(currentField)
  rows.push(currentRow)

  return rows
}

export function parseAnkiText(content: string, now: number): ParseAnkiResult {
  const trimmed = content.trim()
  if (!trimmed) {
    return {
      success: false,
      error: 'No flashcards found in the Anki file.',
    }
  }

  const lines = trimmed.split(/\r?\n/)
  let delimiter = '\t'
  let headerCount = 0

  for (const line of lines) {
    const clean = line.trim()
    if (clean.startsWith('#')) {
      headerCount++
      const match = clean.match(
        /^#separator:(tab|comma|semicolon|pipe|space|.+)$/i,
      )
      if (match && match[1]) {
        const sep = match[1].toLowerCase()
        if (sep === 'tab') delimiter = '\t'
        else if (sep === 'comma') delimiter = ','
        else if (sep === 'semicolon') delimiter = ';'
        else if (sep === 'pipe') delimiter = '|'
        else if (sep === 'space') delimiter = ' '
        else delimiter = match[1]
      }
      continue
    }
    if (clean.length > 0) break
  }

  // Auto-detect delimiter if not specified in headers
  if (headerCount === 0) {
    const sample = lines.slice(0, 10).join('\n')
    const tabs = (sample.match(/\t/g) || []).length
    const commas = (sample.match(/,/g) || []).length
    const semicolons = (sample.match(/;/g) || []).length
    if (tabs > 0) {
      delimiter = '\t'
    } else if (commas > semicolons && commas > 0) {
      delimiter = ','
    } else if (semicolons > 0) {
      delimiter = ';'
    }
  }

  const dataRows = parseCsvTsvRows(content, delimiter)
  const cards: StudyCard[] = []

  for (const [rowIndex, rawCols] of dataRows.entries()) {
    const firstCol = rawCols[0]?.trim() || ''
    if (firstCol.startsWith('#') || rawCols.length < 2) continue

    const prompt = cleanAnkiHtml(rawCols[0] || '')
    const answer = cleanAnkiHtml(rawCols[1] || '')
    const context = rawCols.length >= 3 ? cleanAnkiHtml(rawCols[2] || '') : ''

    if (!prompt || !answer) continue

    const direction = detectDirection(prompt, answer)
    const scene = chooseScene(prompt, answer, context)
    const noteId = `anki-txt-${rowIndex + 1}`

    const candidate = {
      id: `${noteId}:${direction}`,
      noteId,
      prompt,
      answer,
      direction,
      context,
      scene,
      schedule: {
        state: 'new' as const,
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
    }

    const parsedCard = studyCardSchema.safeParse(candidate)
    if (parsedCard.success) {
      cards.push(parsedCard.data)
    }
  }

  if (cards.length === 0) {
    return {
      success: false,
      error: 'No flashcards found in the Anki file.',
    }
  }

  return {
    success: true,
    cards,
    count: cards.length,
    stats: {
      newCount: cards.length,
      reviewCount: 0,
      learningCount: 0,
    },
  }
}

export async function parseAnkiPackage(
  buffer: Uint8Array | ArrayBuffer,
  now: number,
): Promise<ParseAnkiResult> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = fflate.unzipSync(bytes)
  } catch (err) {
    return {
      success: false,
      error: `Invalid Anki package: file is corrupted or not a valid .apkg archive (${err instanceof Error ? err.message : 'unzip failed'}).`,
    }
  }

  const dbData = unzipped['collection.anki2'] || unzipped['collection.anki21']
  if (!dbData) {
    return {
      success: false,
      error: 'Invalid Anki package: collection database not found in archive.',
    }
  }

  const SQL = await getSqlJs()
  const db = new SQL.Database(dbData)

  try {
    let crt = Math.floor(now / 1000)
    let deckName: string | undefined

    try {
      const colRes = db.exec('SELECT crt, decks FROM col LIMIT 1;')
      const colRow = colRes[0]?.values[0]
      if (colRow) {
        if (typeof colRow[0] === 'number') {
          crt = colRow[0]
        }
        if (typeof colRow[1] === 'string') {
          const decks = JSON.parse(colRow[1]) as Record<
            string,
            { name?: string; id?: number }
          >
          for (const d of Object.values(decks)) {
            if (d.name && d.name !== 'Default') {
              deckName = d.name
              break
            }
          }
          if (!deckName && decks['1']?.name) {
            deckName = decks['1'].name
          }
        }
      }
    } catch {
      // Fallback
    }

    const cardsRes = db.exec(`
      SELECT
        n.id, n.mid, n.flds, n.tags,
        c.id, c.ord, c.type, c.queue, c.due, c.ivl, c.factor, c.reps, c.lapses, c.did
      FROM notes n
      JOIN cards c ON c.nid = n.id
      ORDER BY n.id, c.ord;
    `)

    if (!cardsRes[0] || cardsRes[0].values.length === 0) {
      return {
        success: false,
        error: 'No flashcards found in the Anki deck database.',
      }
    }

    const cards: StudyCard[] = []
    let newCount = 0
    let reviewCount = 0
    let learningCount = 0

    for (const row of cardsRes[0].values) {
      const noteIdNum = row[0] as number
      const fldsStr = (row[2] as string) || ''
      const tagsStr = (row[3] as string) || ''
      const cardIdNum = row[4] as number
      const ord = (row[5] as number) || 0
      const type = (row[6] as number) || 0
      const due = (row[8] as number) || 0
      const ivl = (row[9] as number) || 0
      const factor = (row[10] as number) || 0
      const reps = (row[11] as number) || 0
      const lapses = (row[12] as number) || 0

      const fields = fldsStr.split('\x1f')
      let rawPrompt = fields[0] || ''
      let rawAnswer = fields[1] || ''
      const extraFields = fields.slice(2).join(' ')
      const contextText = [extraFields, tagsStr.trim()]
        .filter(Boolean)
        .join(' ')

      // If reversed template (ord > 0)
      if (ord === 1 && fields.length >= 2) {
        rawPrompt = fields[1] || ''
        rawAnswer = fields[0] || ''
      }

      const prompt = cleanAnkiHtml(rawPrompt, {
        clozeSide: 'prompt',
        targetOrdinal: ord,
      })
      const answer = cleanAnkiHtml(rawAnswer, {
        clozeSide: 'answer',
        targetOrdinal: ord,
      })
      const context = cleanAnkiHtml(contextText)

      if (!prompt || !answer) continue

      const direction = detectDirection(prompt, answer)
      const scene = chooseScene(prompt, answer, context)

      let state: CardState = 'new'
      let dueAt = now
      let intervalDays = 0
      const easeFactor =
        factor > 0 ? Math.max(1.3, +(factor / 1000).toFixed(2)) : 2.5

      if (type === 2) {
        // Review state
        state = 'review'
        intervalDays = Math.max(1, ivl)
        dueAt = (crt + due * 86400) * 1000
        reviewCount++
      } else if (type === 1) {
        // Learning state
        state = 'learning'
        intervalDays = 0
        learningCount++
      } else if (type === 3) {
        // Relearning state
        state = 'relearning'
        intervalDays = Math.max(1, ivl)
        learningCount++
      } else {
        // New state (type 0)
        state = 'new'
        intervalDays = 0
        newCount++
      }

      const schedule: ReviewSchedule = {
        state,
        dueAt,
        intervalDays,
        easeFactor,
        reviews: reps > 0 ? reps : type > 0 ? 1 : 0,
        lapses,
      }

      const noteId = `anki-${noteIdNum}`
      const cardCandidate = {
        id: `anki-${cardIdNum}:${direction}`,
        noteId,
        prompt,
        answer,
        direction,
        context,
        scene,
        schedule,
      }

      const parsedCard = studyCardSchema.safeParse(cardCandidate)
      if (parsedCard.success) {
        cards.push(parsedCard.data)
      }
    }

    if (cards.length === 0) {
      return {
        success: false,
        error: 'No flashcards found in the Anki deck.',
      }
    }

    return {
      success: true,
      cards,
      count: cards.length,
      deckName,
      stats: {
        newCount,
        reviewCount,
        learningCount,
      },
    }
  } finally {
    db.close()
  }
}

export async function parseAnkiDeck(
  fileData: ArrayBuffer | Uint8Array | string,
  filename?: string,
  now = Date.now(),
): Promise<ParseAnkiResult> {
  const ext = (filename ?? '').toLowerCase()

  if (typeof fileData !== 'string') {
    const bytes =
      fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData)

    // Check ZIP magic header: PK
    if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return parseAnkiPackage(bytes, now)
    }

    // Try decoding text if not zip
    try {
      const decodedText = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes,
      )
      return parseAnkiDeck(decodedText, filename, now)
    } catch {
      return {
        success: false,
        error: 'Unsupported file format or unreadable binary file.',
      }
    }
  }

  // String data
  const text = fileData.trim()
  if (text.startsWith('{') || text.startsWith('[')) {
    const backupResult = parseDeckBackup(text)
    if (backupResult.success) {
      return {
        success: true,
        cards: backupResult.cards,
        count: backupResult.count,
        stats: {
          newCount: backupResult.cards.filter((c) => c.schedule.state === 'new')
            .length,
          reviewCount: backupResult.cards.filter(
            (c) => c.schedule.state === 'review',
          ).length,
          learningCount: backupResult.cards.filter(
            (c) =>
              c.schedule.state === 'learning' ||
              c.schedule.state === 'relearning',
          ).length,
        },
      }
    }
  }

  if (ext.endsWith('.apkg') || ext.endsWith('.colpkg')) {
    return {
      success: false,
      error: 'Invalid .apkg package file provided as text string.',
    }
  }

  return parseAnkiText(text, now)
}
