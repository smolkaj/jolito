import { expect, test, type Locator } from '@playwright/test'
import { createGrammarCards } from '../../src/domain/grammar'
import { createStudyCards, type StudyCard } from '../../src/domain/card'
import { auditAccessibility, settleAnimations } from './accessibility'

// Check rendered glyph positions across diff spans, not just container bounds:
// a highlighted correction must not break an ordinary word across lines.
async function wordLines(text: Locator) {
  return text.evaluate((element) => {
    const nodes: { node: Text; start: number; end: number }[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let offset = 0
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      nodes.push({ node, start: offset, end: offset + node.length })
      offset += node.length
    }
    return [...(element.textContent ?? '').matchAll(/[\p{L}\p{M}]+/gu)].map(
      (match) => {
        const start = match.index
        const end = start + match[0].length
        const tops = new Set<number>()
        for (const part of nodes.filter(
          (part) => part.end > start && part.start < end,
        )) {
          const range = document.createRange()
          range.setStart(part.node, Math.max(0, start - part.start))
          range.setEnd(part.node, Math.min(part.node.length, end - part.start))
          for (const rect of range.getClientRects())
            tops.add(Math.round(rect.top))
        }
        return { word: match[0], lines: tops.size }
      },
    )
  })
}

const grammar = createGrammarCards(0, 'perfect')
const vocabulary = createStudyCards(
  {
    spanish: 'hemos compartido experiencias',
    english: 'we have learned together',
    context: '',
    bidirectional: true,
  },
  'word-readability',
  0,
)
const examples: {
  name: string
  card: StudyCard
  expected: string
  typed: string
}[] = [
  {
    name: 'grammar missing ending',
    card: grammar.find(
      (c) => c.grammar.verb === 'hablar' && c.grammar.person === 0,
    )!,
    expected: 'he hablado',
    typed: 'he habla',
  },
  {
    name: 'grammar auxiliary and participle',
    card: grammar.find(
      (c) => c.grammar.verb === 'aprender' && c.grammar.person === 3,
    )!,
    expected: 'hemos aprendido',
    typed: 'emos aprendio',
  },
  {
    name: 'grammar accent',
    card: grammar.find(
      (c) => c.grammar.verb === 'oír' && c.grammar.person === 4,
    )!,
    expected: 'han oído',
    typed: 'an oido',
  },
  {
    name: 'Spanish vocabulary phrase',
    card: vocabulary[1]!,
    expected: 'hemos compartido experiencias',
    typed: 'hemos compártido experiencas',
  },
  {
    name: 'English vocabulary phrase',
    card: vocabulary[0]!,
    expected: 'we have learned together',
    typed: 'we hav learned togeher',
  },
]

for (const width of [320, 393]) {
  for (const example of examples) {
    test(`${example.name} keeps words readable at ${width}px in every feedback state`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 852 })
      const card = {
        ...example.card,
        schedule: { ...example.card.schedule, reviews: 1, dueAt: 0 },
      }
      expect(card.answer).toBe(example.expected)
      await page.addInitScript(
        (card) =>
          localStorage.setItem(
            'jolito-library-v1',
            JSON.stringify({ version: 3, cards: [card] }),
          ),
        card,
      )
      for (const [state, answer] of [
        ['incorrect', example.typed],
        ['empty', ''],
        ['exact', example.expected],
      ]) {
        await page.goto(card.grammar ? '/#/grammar' : '/#/study')
        await page.reload()
        if (card.grammar) {
          await page
            .getByRole('combobox', { name: 'Tense' })
            .selectOption('perfect')
          await page.getByRole('button', { name: 'New round' }).click()
        }
        await page.getByRole('textbox').fill(answer!)
        await page.getByRole('textbox').press('Enter')
        const expected =
          state === 'exact'
            ? page.locator('.diff-text')
            : page.locator('.expected-row .diff-text')
        await expect(expected).toHaveText(example.expected)
        await settleAnimations(page)
        for (const text of await page.locator('.diff-text').all()) {
          for (const word of await wordLines(text))
            expect(word.lines, word.word).toBe(1)
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        expect((await auditAccessibility(page)).violations).toEqual([])
        await page.screenshot({
          path: `test-results/answer-${width}-${example.name.replace(/ /g, '-')}-${state}.png`,
          fullPage: true,
        })
      }
    })
  }
}
