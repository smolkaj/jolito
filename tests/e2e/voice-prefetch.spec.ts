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
  console.log('SpeechSynthesis calls on homescreen interaction:', calls)
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
  const practiceBtn = page.getByRole('button', { name: /^practice$/i })
  await expect(practiceBtn).toBeVisible()
  await practiceBtn.click()

  // Wait for card review to mount and play prompt
  await page.waitForTimeout(600)

  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  console.log('SpeechSynthesis calls on entering practice:', calls)
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
  await page.waitForTimeout(500)

  const calls = await page.evaluate(() => window.__speechSynthesisCalls ?? [])
  console.log('SpeechSynthesis calls when offline/failing:', calls)
  expect(calls.length).toBeGreaterThan(0)
  expect(calls[0]?.text).toBe('aguacate')
})
