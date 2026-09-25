import { practiceCards } from './practice'
import { expect, test } from '@playwright/test'

interface TrackedSpeechCall {
  text: string
  lang: string
}

declare global {
  interface Window {
    __speechSynthesisCalls?: TrackedSpeechCall[]
  }
}

test('never falls back to robotic speech synthesis when clicking homescreen sample cards', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    if (window.speechSynthesis) {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis)
      window.speechSynthesis.speak = function (
        utterance: SpeechSynthesisUtterance,
      ) {
        window.__speechSynthesisCalls?.push({
          text: utterance.text,
          lang: utterance.lang,
        })
        return orig(utterance)
      }
    }
  })

  // Simulate network latency so prefetch doesn't finish in 1ms
  await page.route('**/api/tts*', async (route) => {
    await new Promise((r) => setTimeout(r, 400))
    await route.continue()
  })

  await page.goto('/')

  // 1. Spanish sample card click
  const spanishCard = page.getByRole('button', {
    name: /play pronunciation for mexican spanish card: aguacate/i,
  })
  await expect(spanishCard).toBeVisible()
  await spanishCard.click()
  await page.waitForTimeout(600)

  // 2. English sample card click
  const englishCard = page.getByRole('button', {
    name: /show english card: avocado/i,
  })
  await englishCard.getByText('ENGLISH').click()
  const playEnglish = page.getByRole('button', {
    name: /play pronunciation for english card: avocado/i,
  })
  await expect(playEnglish).toBeVisible()
  await playEnglish.click()
  await page.waitForTimeout(600)

  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  expect(calls).toEqual([])
})

test('never falls back to robotic speech synthesis when practicing from homescreen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    if (window.speechSynthesis) {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis)
      window.speechSynthesis.speak = function (
        utterance: SpeechSynthesisUtterance,
      ) {
        window.__speechSynthesisCalls?.push({
          text: utterance.text,
          lang: utterance.lang,
        })
        return orig(utterance)
      }
    }
  })

  // Simulate network latency
  await page.route('**/api/tts*', async (route) => {
    await new Promise((r) => setTimeout(r, 400))
    await route.continue()
  })

  await page.goto('/')

  // Click Practice
  const practiceBtn = page.getByRole('button', {
    name: /^practice$/i,
  })
  await expect(practiceBtn).toBeVisible()
  await practiceCards(page)

  // Wait for card review to mount and play prompt
  await page.waitForTimeout(600)

  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  expect(calls).toEqual([])
})

test('gracefully falls back to speech synthesis when TTS network fails or offline', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    if (window.speechSynthesis) {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis)
      window.speechSynthesis.speak = function (
        utterance: SpeechSynthesisUtterance,
      ) {
        window.__speechSynthesisCalls?.push({
          text: utterance.text,
          lang: utterance.lang,
        })
        return orig(utterance)
      }
    }
  })

  // Abort TTS network calls to simulate offline or network failure
  await page.route('**/api/tts*', async (route) => {
    await route.abort('failed')
  })

  await page.goto('/')

  const spanishCard = page.getByRole('button', {
    name: /play pronunciation for mexican spanish card: aguacate/i,
  })
  await expect(spanishCard).toBeVisible()
  await spanishCard.click()

  await expect
    .poll(async () => {
      const calls = await page.evaluate(
        () => window.__speechSynthesisCalls ?? [],
      )
      return calls.length
    })
    .toBeGreaterThan(0)

  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  expect(calls[0]?.text).toBe('aguacate')
})

test('edited prompts speak immediately while prefetch is pending and late failures cannot replay after leaving study', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    const original = window.speechSynthesis.speak.bind(window.speechSynthesis)
    window.speechSynthesis.speak = (utterance) => {
      window.__speechSynthesisCalls?.push({
        text: utterance.text,
        lang: utterance.lang,
      })
      original(utterance)
    }
  })

  const phrases = ['el ajolote nuevo', 'la cuenta pendiente']
  let releasePrefetch!: () => void
  const pending = new Promise<void>((resolve) => {
    releasePrefetch = resolve
  })
  const requested = new Set<string>()
  const finished = new Set<string>()
  await page.route('**/api/tts*', async (route) => {
    const phrase = new URL(route.request().url()).searchParams.get('text') ?? ''
    if (!phrases.includes(phrase)) return route.continue()
    requested.add(phrase)
    await pending
    await route.abort('failed')
    finished.add(phrase)
  })

  await page.goto('/')
  await practiceCards(page)
  await expect(page.getByRole('button', { name: /edit card/i })).toBeVisible()
  await page.evaluate(() => {
    window.__speechSynthesisCalls = []
  })

  try {
    for (const [index, phrase] of phrases.entries()) {
      await page.getByRole('button', { name: /edit card/i }).click()
      await page.getByLabel(/mexican spanish \(prompt\)/i).fill(phrase)
      await page.getByRole('button', { name: /save changes/i }).click()
      // Deliberately keep cloud requests unresolved: auto-play must use the
      // current device voice instead of depending on a lucky prefetch race.
      await expect.poll(() => requested.has(phrase)).toBe(true)
      await expect
        .poll(() => page.evaluate(() => window.__speechSynthesisCalls))
        .toEqual(
          phrases.slice(0, index + 1).map((text) => ({ text, lang: 'es-MX' })),
        )
      expect(finished.size).toBe(0)
    }
    await page
      .getByRole('button', { name: /^Deck\b/i })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { name: /manage deck/i }),
    ).toBeVisible()
    const before = await page.evaluate(() => window.__speechSynthesisCalls)
    releasePrefetch()
    await expect.poll(() => finished.size).toBe(phrases.length)
    // Drain browser delivery/render turns after both network failures. Neither
    // the superseded prompt nor the ended study session may speak again.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    )
    expect(await page.evaluate(() => window.__speechSynthesisCalls)).toEqual(
      before,
    )
  } finally {
    releasePrefetch()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
