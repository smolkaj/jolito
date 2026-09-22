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

test('never falls back to robotic speech synthesis when editing a card mid-practice and resuming review', async ({
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

  // Verify prefetch and autoplay without artificial route delay

  await page.goto('/')

  // Start review
  const practiceBtn = page.getByRole('button', { name: /^practice$/i })
  await expect(practiceBtn).toBeVisible()
  await practiceCards(page)

  // Wait for card to mount
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Open in-study edit modal
  const editBtn = page.getByRole('button', { name: /edit card/i })
  await expect(editBtn).toBeVisible()
  await editBtn.click()

  // Modify prompt to a brand new phrase
  const promptInput = page.getByLabel(/mexican spanish \(prompt\)/i)
  await expect(promptInput).toBeVisible()
  await promptInput.fill('el ajolote nuevo')

  // Save changes
  const saveBtn = page.getByRole('button', { name: /save changes/i })
  await saveBtn.click()

  // Wait for modal to dismiss and autoplay to fire for the edited prompt
  await page.waitForTimeout(600)

  // Verify speech synthesis was never called
  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  expect(calls).toEqual([])
})
