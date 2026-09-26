import { expect, test, type Page } from '@playwright/test'
import { createStudyCards, type StudyCard } from '../../src/domain/card'

declare global {
  interface Window {
    __audioPlays?: number
  }
}

// 44-byte WAV header + 1600 bytes PCM silence
const silentWav = Buffer.alloc(44 + 1600)
silentWav.write('RIFF', 0)
silentWav.writeUInt32LE(silentWav.length - 8, 4)
silentWav.write('WAVEfmt ', 8)
silentWav.writeUInt32LE(16, 16)
silentWav.writeUInt16LE(1, 20)
silentWav.writeUInt16LE(1, 22)
silentWav.writeUInt32LE(8000, 24)
silentWav.writeUInt32LE(16000, 28)
silentWav.writeUInt16LE(2, 32)
silentWav.writeUInt16LE(16, 34)
silentWav.write('data', 36)
silentWav.writeUInt32LE(1600, 40)

function createSmokeCards(): StudyCard[] {
  const baseTime = Date.now() - 3600_000
  return [
    ...createStudyCards(
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: 'fruta verde',
        bidirectional: false,
      },
      'smoke-note-1',
      baseTime,
    ),
    ...createStudyCards(
      {
        spanish: 'biblioteca',
        english: 'library',
        context: 'lugar de libros',
        bidirectional: false,
      },
      'smoke-note-2',
      baseTime + 1000,
    ),
    ...createStudyCards(
      {
        spanish: 'manzana',
        english: 'apple',
        context: 'fruta roja',
        bidirectional: false,
      },
      'smoke-note-3',
      baseTime + 2000,
    ),
  ]
}

interface SmokeEnvOptions {
  cards?: StudyCard[]
}

async function setupSmokeEnvironment(
  page: Page,
  options: SmokeEnvOptions = {},
) {
  const cards = options.cards ?? createSmokeCards()
  const pageErrors: Error[] = []
  page.on('pageerror', (err) => pageErrors.push(err))

  await page.route('https://mock.supabase.co/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }),
  )
  await page.route('**/api/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cardsStudied: 100, activeUsers: 10 }),
    }),
  )
  await page.route('**/api/tts*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/wav',
      body: silentWav,
    }),
  )

  await page.addInitScript(
    ({ cardsJson }) => {
      window.__audioPlays = 0

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        window.speechSynthesis
      ) {
        const origSpeak = window.speechSynthesis.speak.bind(
          window.speechSynthesis,
        )
        window.speechSynthesis.speak = function (utterance) {
          window.__audioPlays = (window.__audioPlays ?? 0) + 1
          return origSpeak(utterance)
        }
      }

      if (typeof AudioBufferSourceNode !== 'undefined') {
        // Forward original receiver with apply
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const origStart = AudioBufferSourceNode.prototype.start
        AudioBufferSourceNode.prototype.start = function (...args) {
          window.__audioPlays = (window.__audioPlays ?? 0) + 1
          return origStart.apply(this, args)
        }
      }

      const parsedCards: unknown = JSON.parse(cardsJson)
      localStorage.setItem(
        'jolito-libraries-v1',
        JSON.stringify({
          version: 1,
          accounts: {},
          guest: {
            version: 3,
            cards: parsedCards,
            deletedCardIds: [],
          },
        }),
      )
    },
    { cardsJson: JSON.stringify(cards) },
  )

  return { pageErrors }
}

async function dismissDemoModalIfPresent(page: Page) {
  const dismissBtn = page.getByRole('button', { name: /explore demo deck/i })
  if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissBtn.click()
  }
}

test.describe('E2E Fast Smoke Suite', () => {
  test('a) app bootstrap & navigation across primary views (Home, Review, Deck, Grammar)', async ({
    page,
  }) => {
    const { pageErrors } = await setupSmokeEnvironment(page)

    await page.goto('/')
    await expect(page).toHaveTitle(/Jolito/)
    await expect(page.locator('.brand')).toBeVisible()

    // 1. Navigate to Deck
    await page.getByRole('button', { name: 'Deck (Manage deck)' }).click()
    await expect(page).toHaveURL(/#\/deck/)
    await dismissDemoModalIfPresent(page)
    await expect(
      page.getByRole('heading', { name: /manage deck/i }),
    ).toBeVisible()

    // 2. Navigate to Grammar
    await page
      .getByRole('button', { name: 'Grammar (Practice grammar)' })
      .click()
    await expect(page).toHaveURL(/#\/grammar/)
    await expect(page.getByRole('combobox', { name: /tense/i })).toBeVisible()

    // 3. Navigate to Cards / Review
    await page.getByRole('button', { name: 'Cards (Study session)' }).click()
    await expect(page).toHaveURL(/#\/study/)
    await expect(page.locator('.study-prompt')).toBeVisible()

    // 4. Return to Home via brand click
    await page.getByRole('button', { name: 'Jolito home' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(
      page.getByRole('button', { name: /practice/i }).first(),
    ).toBeVisible()

    expect(pageErrors).toEqual([])
  })

  test('b) study review flow: start session, reveal answer with Space/Enter, rate with 1-4, verify card advances', async ({
    page,
  }) => {
    const { pageErrors } = await setupSmokeEnvironment(page)

    await page.goto('/#/study')

    // Initial card is due
    const prompt = page.locator('.study-prompt')
    await expect(prompt).toBeVisible()
    const firstPrompt = await prompt.textContent()
    expect(firstPrompt).toBeTruthy()

    // 1. Reveal answer on card 1 using Enter in the answer input
    const input = page.getByRole('textbox')
    await expect(input).toBeFocused()
    await input.press('Enter')

    // Verification of revealed answer state
    const gradesGroup = page.locator('.grade-buttons')
    await expect(gradesGroup).toBeVisible()

    // Rate with '3' (Good) using keyboard shortcut
    await page.keyboard.press('3')

    // Verify card advances to the second card
    await expect(prompt).not.toHaveText(firstPrompt!)
    const secondPrompt = await prompt.textContent()
    expect(secondPrompt).toBeTruthy()

    // 2. Reveal answer on card 2 using Space on the reveal button
    const revealBtn = page.locator('.reveal-button')
    await revealBtn.focus()
    await page.keyboard.press('Space')

    await expect(gradesGroup).toBeVisible()

    // Rate with '4' (Easy)
    await page.keyboard.press('4')

    // Verify card advances again
    await expect(prompt).not.toHaveText(secondPrompt!)

    expect(pageErrors).toEqual([])
  })

  test('c) audio interaction: trigger audio button, verify playback initiation without error', async ({
    page,
  }) => {
    const { pageErrors } = await setupSmokeEnvironment(page)

    await page.goto('/#/study')

    const audioButton = page.getByRole('button', { name: 'Play prompt audio' })
    await expect(audioButton).toBeVisible()

    // Trigger audio playback
    await audioButton.click()

    // Verify playback initiation without error
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__audioPlays ?? 0)
      })
      .toBeGreaterThan(0)

    expect(pageErrors).toEqual([])
  })

  test('d) deck manager table: render, sort column, search filter', async ({
    page,
  }) => {
    const { pageErrors } = await setupSmokeEnvironment(page)

    await page.goto('/#/deck')
    await dismissDemoModalIfPresent(page)

    // 1. Render table with seeded cards
    await expect(page.getByRole('table', { name: 'Deck cards' })).toBeVisible()
    const rows = page.locator('.deck-card-row')
    await expect(rows).toHaveCount(3)

    // 2. Sort column (Sort by prompt)
    const promptSortBtn = page.getByRole('button', { name: 'Sort by prompt' })
    await promptSortBtn.click()

    const promptTextsAsc = await page
      .locator('.deck-card-row .col-prompt .deck-phrase-text')
      .allTextContents()
    expect(promptTextsAsc).toEqual(['aguacate', 'biblioteca', 'manzana'])

    await promptSortBtn.click()
    const promptTextsDesc = await page
      .locator('.deck-card-row .col-prompt .deck-phrase-text')
      .allTextContents()
    expect(promptTextsDesc).toEqual(['manzana', 'biblioteca', 'aguacate'])

    // 3. Search filter
    const searchInput = page.getByRole('searchbox', {
      name: 'Search cards in deck',
    })
    await searchInput.fill('biblioteca')

    await expect(rows).toHaveCount(1)
    await expect(
      page.locator('.deck-card-row .col-prompt .deck-phrase-text'),
    ).toHaveText('biblioteca')

    // Clear search filter
    await searchInput.fill('')
    await expect(rows).toHaveCount(3)

    expect(pageErrors).toEqual([])
  })
})
