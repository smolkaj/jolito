import { practiceCards, practiceGrammar } from './practice'
import {
  createGrammarCards,
  grammarContext,
  grammarQueue,
} from '../../src/domain/grammar'
import { auditAccessibility, settleAnimations } from './accessibility'
import { expect, test, type Page } from '@playwright/test'

async function ratingGeometry(page: Page) {
  await settleAnimations(page)
  return page.locator('.grade-buttons').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      gap: style.gap,
      columns: style.gridTemplateColumns,
      buttons: Array.from(element.querySelectorAll('button')).map((button) => {
        const style = getComputedStyle(button)
        return {
          padding: style.padding,
          gap: style.gap,
          height: button.getBoundingClientRect().height,
        }
      }),
    }
  })
}

async function completionStyle(page: Page) {
  await settleAnimations(page)
  return page.locator('.complete-card').evaluate((card) => {
    const dimensions = (element: Element) => {
      const style = getComputedStyle(element)
      return {
        padding: style.padding,
        border: style.border,
        borderRadius: style.borderRadius,
        fontSize: style.fontSize,
        gap: style.gap,
      }
    }
    return {
      width: card.getBoundingClientRect().width,
      top: card.getBoundingClientRect().top + scrollY,
      card: dimensions(card),
      heading: dimensions(card.querySelector('h1')!),
      actions: dimensions(card.querySelector('.complete-actions')!),
      primary: dimensions(card.querySelector('.primary-button')!),
      secondary: dimensions(card.querySelector('.secondary-button')!),
      mascot: dimensions(card.querySelector('img')!),
    }
  })
}

async function sessionLayout(page: Page) {
  await settleAnimations(page)
  return page
    .getByRole('progressbar', { name: 'Session progress' })
    .evaluate((element) => {
      const bar = element.getBoundingClientRect()
      const study = document
        .querySelector('.study-card')!
        .getBoundingClientRect()
      const input = getComputedStyle(document.querySelector('.answer-input')!)
      return {
        x: bar.x,
        y: bar.y + scrollY,
        width: bar.width,
        height: bar.height,
        contentTop: study.y + scrollY,
        inputHeight: parseFloat(input.height),
        inputFontSize: parseFloat(input.fontSize),
      }
    })
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 393, height: 852 },
  { width: 320, height: 568 },
]) {
  test(`grammar is clear, accessible and keyboard-operable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await practiceGrammar(page)
    await expect(
      page.getByRole('heading', { name: 'Pretérito indefinido' }),
    ).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-home.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'New round' }).click()
    const grammarLayout = await sessionLayout(page)
    await page.getByRole('textbox').fill('habl')
    await page.getByRole('button', { name: 'Patterns', exact: true }).click()
    await settleAnimations(page)
    const resume = (await page
      .getByRole('button', { name: 'Resume round' })
      .boundingBox())!
    const fresh = (await page
      .getByRole('button', { name: 'New round' })
      .boundingBox())!
    expect(resume.y).toBeCloseTo(fresh.y, 2)
    expect(resume.width).toBeCloseTo(fresh.width, 2)
    expect(resume.height).toBeCloseTo(fresh.height, 2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-resume.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Resume round' }).click()
    await expect(page.getByRole('textbox')).toHaveValue('habl')
    const input = page.getByRole('textbox', { name: 'Your conjugation' })
    await expect(input).toBeFocused()
    for (const button of await page.locator('.answer-accents button').all()) {
      const box = await button.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    const check = page.getByRole('button', { name: 'Reveal answer' })
    const cardBox = (await page.locator('.study-card').boundingBox())!
    for (const state of ['rest', 'hover', 'pressed']) {
      if (state === 'hover') await check.hover()
      if (state === 'pressed') await page.mouse.down()
      await settleAnimations(page)
      const box = (await check.boundingBox())!
      // Preserve the intentional 1px hover/press travel; ignore subpixel rounding.
      const travel = state === 'hover' ? -1 : state === 'pressed' ? 1 : 0
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 0.01)
      expect(box.y - travel).toBeGreaterThanOrEqual(cardBox.y - 0.01)
      expect(box.x + box.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 0.01,
      )
      expect(box.y + box.height - travel).toBeLessThanOrEqual(
        cardBox.y + cardBox.height + 0.01,
      )
      if (state === 'pressed') {
        await page.mouse.move(0, 0)
        await page.mouse.up()
      }
    }
    await input.fill('habl')
    await page.getByRole('button', { name: 'Insert é' }).click()
    await expect(input).toHaveValue('hablé')
    await expect(input).toBeFocused()
    await settleAnimations(page)
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-answer.png`,
      fullPage: true,
    })
    await input.press('Enter')
    await expect(page.getByRole('status')).toHaveText('hablé')
    await expect(page.locator('.grammar-explanation')).toHaveCount(0)
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-reveal.png`,
      fullPage: true,
    })
    const grammarRatings = await ratingGeometry(page)
    await page.keyboard.press('1')
    for (let index = 0; index < 5; index++) {
      await page.getByRole('textbox').press('Enter')
      await page.keyboard.press('4')
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Después de cenar, yo',
    )
    await page.getByRole('textbox').fill('hable')
    await page.getByRole('textbox').press('Enter')
    await expect(page.locator('.expected-row .diff-seg-accent')).toHaveText('é')
    await expect(page.locator('.diff-row').first()).toContainText('hable')
    await expect(page.locator('.grammar-explanation')).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-correction.png`,
      fullPage: true,
    })
    await page.keyboard.press('4')
    for (let index = 0; index < 2; index++) {
      await page.getByRole('textbox').press('Enter')
      await page.keyboard.press('4')
    }
    await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
    await settleAnimations(page)
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-complete.png`,
      fullPage: true,
    })
    const grammarCompletion = await completionStyle(page)
    await page.getByRole('button', { name: 'Back home' }).click()
    await practiceCards(page)
    await expect(
      page.getByRole('textbox', { name: 'Your answer' }),
    ).toBeVisible()
    const vocabularyLayout = await sessionLayout(page)
    for (const key of [
      'x',
      'y',
      'width',
      'height',
      'contentTop',
      'inputHeight',
      'inputFontSize',
    ] as const) {
      expect(vocabularyLayout[key]).toBeCloseTo(grammarLayout[key], 2)
    }
    await page.getByRole('textbox', { name: 'Your answer' }).press('Enter')
    const vocabularyRatings = await ratingGeometry(page)
    expect(vocabularyRatings.gap).toBe(grammarRatings.gap)
    expect(vocabularyRatings.columns).toBe(grammarRatings.columns)
    vocabularyRatings.buttons.forEach(({ height, ...style }, index) => {
      const { height: expectedHeight, ...expectedStyle } =
        grammarRatings.buttons[index]!
      expect(style).toEqual(expectedStyle)
      expect(height).toBeCloseTo(expectedHeight, 2)
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.keyboard.press('4')
    while (await page.getByRole('textbox', { name: 'Your answer' }).count()) {
      await page.getByRole('textbox', { name: 'Your answer' }).press('Enter')
      await page.keyboard.press('4')
    }
    expect(await completionStyle(page)).toEqual(grammarCompletion)
    expect((await auditAccessibility(page)).violations).toEqual([])
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === 'running').length,
      ),
    ).toBe(0)
  })
}

test('grammar survives offline reload and never leaks into the vocabulary library', async ({
  page,
  context,
}) => {
  await page.goto('/#/grammar')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.getByRole('radio', { name: /Irregular stems/ }).check()
  await page.getByRole('button', { name: 'New round' }).click()
  await page.getByRole('textbox').fill('tuve')
  await page.getByRole('textbox').press('Enter')
  await page.keyboard.press('4')
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('radio', { name: /Irregular stems/ }).check()
  await page.getByRole('button', { name: 'New round' }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
    'En el camino, yo … una idea.',
  )
  await page.getByRole('textbox').press('Enter')
  await page.keyboard.press('4')
  await page.getByRole('button', { name: 'Jolito home', exact: true }).click()
  await page.getByRole('button', { name: 'Manage deck' }).click()
  await expect(page.getByRole('main')).not.toContainText('tener · yo')
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jolito-library-v1')!) as {
        version: number
        cards: { grammar?: unknown }[]
      },
  )
  expect(saved.version).toBe(2)
  expect(saved.cards.filter((card) => card.grammar)).toHaveLength(2)
})

test('native keyboard controls coexist with grammar audio and grading shortcuts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    window.speechSynthesis.speak = (utterance) => {
      window.__speechSynthesisCalls!.push({
        text: utterance.text,
        lang: utterance.lang,
      })
      utterance.onend?.(new SpeechSynthesisEvent('end', { utterance }))
    }
  })
  const now = Date.now()
  await page.clock.setFixedTime(now)
  await page.route('**/api/tts*', (route) => route.fulfill({ status: 503 }))
  await page.goto('/#/grammar')
  const speechCount = () =>
    page.evaluate(() => window.__speechSynthesisCalls!.length)
  await page.getByRole('button', { name: 'New round' }).click()
  await expect.poll(speechCount).toBe(1)
  await page.getByRole('textbox').press('Enter')
  await expect.poll(speechCount).toBe(2)
  // Separate intentional replays from speech’s double-activation suppression.
  await page.clock.setFixedTime(now + 1000)
  await page.getByRole('status').focus()
  await page.keyboard.press('Space')
  await expect.poll(speechCount).toBe(3)
  await page.clock.setFixedTime(now + 2000)
  const audioButton = page.locator('.reveal-panel .audio-button')
  await audioButton.press('Space')
  await expect.poll(speechCount).toBe(4)
  await page.getByRole('button', { name: /Easy/ }).press('Space')
  await expect(page.getByRole('textbox')).toBeFocused()
  await expect.poll(speechCount).toBe(5)
  await page.getByRole('textbox').press('Space')
  await expect(page.getByRole('textbox')).toHaveValue(' ')
  expect(await speechCount()).toBe(5)
})

test('accent taps preserve the active input and selection across practice turns', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  })
  try {
    const page = await context.newPage()
    await page.goto('/#/grammar')
    await page.getByRole('button', { name: 'New round' }).tap()
    for (let turn = 0; turn < 2; turn++) {
      const input = page.getByRole('textbox')
      await input.fill('hablX')
      await input.evaluate((element: HTMLInputElement) => {
        element.setSelectionRange(4, 5)
        element.addEventListener('blur', () =>
          element.setAttribute('data-blurred', 'true'),
        )
      })
      await page.getByRole('button', { name: 'Insert é' }).tap()
      await expect(input).toHaveValue('hablé')
      await expect(input).toBeFocused()
      await expect(input).not.toHaveAttribute('data-blurred')
      await input.press('Backspace')
      await expect(input).toHaveValue('habl')
      await input.press('Enter')
      await page.keyboard.press('4')
    }
  } finally {
    await context.close()
  }
})

test('grammar prepares neural voices for both contexts and retains them across interruption and offline recall', async ({
  page,
  context,
}) => {
  // A short valid WAV exercises the actual decode/cache/playback path without an external TTS dependency.
  const wav = Buffer.alloc(44 + 1600)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24)
  wav.writeUInt32LE(16000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(1600, 40)
  await page.addInitScript(() => {
    window.__speechSynthesisCalls = []
    window.speechSynthesis.speak = (utterance) => {
      window.__speechSynthesisCalls!.push({
        text: utterance.text,
        lang: utterance.lang,
      })
    }
    // The wrapper forwards the original receiver with apply below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      document.documentElement.dataset.neuralPlays = String(
        Number(document.documentElement.dataset.neuralPlays ?? 0) + 1,
      )
      return start.apply(this, args)
    }
  })
  let offline = false
  let offlineRequests = 0
  const fetched = new Map<string, Set<string>>()
  await page.route('**/api/tts*', async (route) => {
    if (offline) {
      offlineRequests++
      await route.abort('internetdisconnected')
      return
    }
    const url = new URL(route.request().url())
    const text = url.searchParams.get('text')!
    const voices = fetched.get(text) ?? new Set<string>()
    voices.add(url.searchParams.get('voice')!)
    fetched.set(text, voices)
    await route.fulfill({ contentType: 'audio/wav', body: wav })
  })
  await page.goto('/#/grammar')
  const original = 'Anoche yo hablé con la vecina.'
  const repeated = 'Después de cenar, yo hablé de la película.'
  const spokenPrompt = 'Anoche yo mmm con la vecina.'
  for (const text of [
    original,
    repeated,
    spokenPrompt,
    'Después de cenar, yo mmm de la película.',
  ]) {
    await expect
      .poll(() => [...(fetched.get(text) ?? [])].sort())
      .toEqual(['es-MX-DaliaNeural', 'es-MX-JorgeNeural'])
  }
  // Count unique grammar entries in the neural cache only: the service-worker shell
  // also caches TTS URLs, but cannot establish neural playback readiness.
  const roundTexts = grammarQueue(createGrammarCards(0), 0, 'mixed').flatMap(
    (card) =>
      [0, 1].flatMap((reviews) => {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        return [context.spokenPrompt, context.completed]
      }),
  )
  const cachedGrammar = () =>
    page.evaluate(async (texts) => {
      const entries = await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith('jolito-audio-'))
          .map(async (key) => (await caches.open(key)).keys()),
      )
      return new Set(
        entries
          .flat()
          .filter((request) =>
            texts.includes(new URL(request.url).searchParams.get('text') ?? ''),
          )
          .map((request) => request.url),
      ).size
    }, roundTexts)
  await expect.poll(cachedGrammar).toBe(64)
  await page.getByRole('button', { name: 'New round' }).click()
  const plays = () =>
    page.evaluate(() =>
      Number(document.documentElement.dataset.neuralPlays ?? 0),
    )
  await expect.poll(plays).toBeGreaterThan(0)
  const afterAutoplay = await plays()
  // An intentional replay occurs after the 80ms double-activation window.
  await page.clock.setFixedTime(Date.now() + 1000)
  await page.getByRole('textbox').fill('habl')
  await page.getByRole('textbox').press('Control+Space')
  await expect.poll(plays).toBeGreaterThan(afterAutoplay)
  await expect(page.getByRole('textbox')).toHaveValue('habl')
  const afterReplay = await plays()
  await page.getByRole('textbox').press('Enter')
  await expect.poll(plays).toBeGreaterThan(afterReplay)
  // Interrupt before grading so setup predicts the same already-warmed round.
  await page.getByRole('button', { name: 'Patterns' }).click()
  await page.getByRole('button', { name: 'Resume round' }).click()
  await page.getByRole('button', { name: 'Jolito home' }).click()
  await page.getByRole('button', { name: 'Manage deck', exact: true }).click()
  const demo = page.getByRole('button', { name: /explore demo deck/i })
  if (await demo.isVisible()) await demo.click()
  await page.getByRole('checkbox', { name: /select card aguacate/i }).click()
  await page.getByRole('button', { name: /delete selected \(1\)/i }).click()
  await page.getByRole('button', { name: /^delete card$/i }).click()
  await expect(
    page.getByRole('checkbox', { name: /select card aguacate/i }),
  ).toHaveCount(0)
  await context.setOffline(true)
  offline = true
  await page.getByRole('button', { name: 'Jolito home' }).click()
  await practiceGrammar(page)
  await expect(page.getByRole('status')).toBeVisible()
  await expect.poll(cachedGrammar).toBe(64)
  await page.keyboard.press('1')
  for (let turn = 0; turn < 5; turn++) {
    await page.getByRole('button', { name: 'Play prompt audio' }).click()
    const before = await plays()
    await page.getByRole('textbox').press('Enter')
    await expect.poll(plays).toBeGreaterThan(before)
    await page.keyboard.press('4')
  }
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Después de cenar, yo',
  )
  const before = await plays()
  await page.getByRole('textbox').press('Enter')
  await expect.poll(plays).toBeGreaterThan(before)
  expect(await page.evaluate(() => window.__speechSynthesisCalls)).toEqual([])
  expect(offlineRequests).toBe(0)
  // Leaving before the scheduled reveal audio fires must cancel it.
  await page.keyboard.press('4')
  await page.getByRole('textbox').press('Enter')
  await page.getByRole('button', { name: 'Jolito home' }).click()
  const ended = await plays()
  await page.waitForTimeout(250)
  expect(await plays()).toBe(ended)
})
