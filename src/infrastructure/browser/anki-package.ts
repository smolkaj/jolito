import * as fflate from 'fflate'
import {
  chooseScene,
  studyCardSchema,
  type CardState,
  type ReviewSchedule,
  type StudyCard,
} from '../../domain/card'
import {
  cleanAnkiHtml,
  detectDirection,
  type ParseAnkiResult,
} from '../../domain/anki-import'
import { getSqlJs } from './anki-sql'

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

  let db: InstanceType<Awaited<ReturnType<typeof getSqlJs>>['Database']>
  try {
    const SQL = await getSqlJs()
    db = new SQL.Database(dbData)
  } catch (err) {
    return {
      success: false,
      error: `Invalid Anki package: database could not be opened (${err instanceof Error ? err.message : 'invalid sqlite database'}).`,
    }
  }

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
      let extraFields = fields.slice(2).join(' ')

      const hasCloze = /\{\{c\d+::/.test(rawPrompt)
      if (hasCloze && (!rawAnswer || ord > 0)) {
        rawAnswer = rawPrompt
        extraFields = fields.slice(1).join(' ')
      } else if (ord === 1 && fields.length >= 2) {
        // Reversed card template (ord 1)
        rawPrompt = fields[1] || ''
        rawAnswer = fields[0] || ''
      }

      const contextText = [extraFields, tagsStr.trim()]
        .filter(Boolean)
        .join(' ')

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
        contentRevision: 0,
        resetRevision: { generation: 0, at: 0 },
        createdAt: cardIdNum > 1000000000000 ? cardIdNum : now,
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
      source: 'package',
      cards,
      count: cards.length,
      deckName,
      stats: {
        newCount,
        reviewCount,
        learningCount,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to read Anki database: ${err instanceof Error ? err.message : 'query execution failed'}.`,
    }
  } finally {
    db.close()
  }
}
