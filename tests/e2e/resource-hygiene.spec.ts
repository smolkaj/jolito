import { practiceCards } from './practice'
import { expect, test } from '@playwright/test'

test.describe('Resource & Energy Hygiene', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and instrument timers, animation frames, and AudioContext before page scripts load
    await page.addInitScript(() => {
      // 1. Track setInterval handles
      const activeIntervals = new Map<
        unknown,
        { delay: number; stack: string }
      >()
      const origSetInterval = window.setInterval.bind(window)
      const origClearInterval = window.clearInterval.bind(window)

      window.setInterval = function (
        handler: TimerHandler,
        timeout?: number,
        ...args: unknown[]
      ) {
        const id = (origSetInterval as (...a: unknown[]) => unknown)(
          handler,
          timeout,
          ...args,
        )
        const stack = new Error().stack || ''
        activeIntervals.set(id, { delay: timeout ?? 0, stack })
        return id
      } as unknown as typeof window.setInterval

      window.clearInterval = function (id?: number) {
        if (id !== undefined) {
          activeIntervals.delete(id)
        }
        origClearInterval(id)
      } as unknown as typeof window.clearInterval

      // 2. Track requestAnimationFrame calls
      let rafCountDuringDwell = 0
      let trackingRaf = false
      const origRaf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = function (cb: FrameRequestCallback) {
        if (trackingRaf) {
          rafCountDuringDwell++
        }
        return origRaf(cb)
      }

      // 3. Track all AudioContext instances
      const audioContexts: AudioContext[] = []
      const winWithWebkit = window as unknown as {
        webkitAudioContext?: typeof AudioContext
      }
      const OrigAudioContext =
        window.AudioContext || winWithWebkit.webkitAudioContext

      if (OrigAudioContext) {
        const TrackedAudioContext = class extends OrigAudioContext {
          constructor(options?: AudioContextOptions) {
            super(options)
            audioContexts.push(this)
          }
        }
        window.AudioContext = TrackedAudioContext
        if (winWithWebkit.webkitAudioContext) {
          winWithWebkit.webkitAudioContext = TrackedAudioContext
        }
      }

      ;(window as unknown as { __hygiene: unknown }).__hygiene = {
        getActiveIntervals: () => Array.from(activeIntervals.values()),
        getAudioContextStates: () => audioContexts.map((ctx) => ctx.state),
        getAudioContextCount: () => audioContexts.length,
        startRafTracking: () => {
          rafCountDuringDwell = 0
          trackingRaf = true
        },
        stopRafTracking: () => {
          trackingRaf = false
          return rafCountDuringDwell
        },
      }
    })
  })

  test('idle dwell on welcome screen has zero intervals, zero animation loops, and near-zero CPU tasks', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: /^practice$/i }),
    ).toBeVisible()

    // 1. Verify zero recurring intervals were registered during initialization
    const activeIntervals = await page.evaluate(() =>
      (
        window as unknown as {
          __hygiene: { getActiveIntervals: () => unknown[] }
        }
      ).__hygiene.getActiveIntervals(),
    )
    expect(activeIntervals).toEqual([])

    // 2. Verify all audio contexts (e.g. from prewarm/predecode) remain strictly suspended before user gesture
    const states = await page.evaluate(() =>
      (
        window as unknown as {
          __hygiene: { getAudioContextStates: () => string[] }
        }
      ).__hygiene.getAudioContextStates(),
    )
    expect(states.length).toBeGreaterThanOrEqual(1)
    for (const state of states) {
      expect(state).toBe('suspended')
    }

    // 3. Measure CPU task and rAF execution during a 1.5s quiet dwell period using CDP
    const client = await page.context().newCDPSession(page)
    await client.send('Performance.enable')

    await page.evaluate(() =>
      (
        window as unknown as { __hygiene: { startRafTracking: () => void } }
      ).__hygiene.startRafTracking(),
    )

    const initialMetrics = await client.send('Performance.getMetrics')
    const getMetric = (
      metrics: { name: string; value: number }[],
      name: string,
    ) => metrics.find((m) => m.name === name)?.value ?? 0

    const initialTaskDuration = getMetric(
      initialMetrics.metrics,
      'TaskDuration',
    )
    const initialScriptDuration = getMetric(
      initialMetrics.metrics,
      'ScriptDuration',
    )

    // Dwell for 1.5 seconds without user interaction
    await page.waitForTimeout(1500)

    const finalMetrics = await client.send('Performance.getMetrics')
    const deltaTaskDuration =
      getMetric(finalMetrics.metrics, 'TaskDuration') - initialTaskDuration
    const deltaScriptDuration =
      getMetric(finalMetrics.metrics, 'ScriptDuration') - initialScriptDuration

    const rafCount = await page.evaluate(() =>
      (
        window as unknown as { __hygiene: { stopRafTracking: () => number } }
      ).__hygiene.stopRafTracking(),
    )
    await client.detach()

    // In a quiescent web app, script and task execution during idle dwell should be negligible (< 50ms)
    // and no requestAnimationFrame loops should be running continuously
    expect(deltaScriptDuration).toBeLessThan(0.05)
    expect(deltaTaskDuration).toBeLessThan(0.05)
    expect(rafCount).toBe(0)
  })

  test('suspends AudioContext automatically after interaction and returns to quiescent state', async ({
    page,
  }) => {
    await page.goto('/')

    // Start practice to unlock audio session
    await practiceCards(page)

    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()

    // Verify AudioContext was unlocked
    const contextCount = await page.evaluate(() =>
      (
        window as unknown as {
          __hygiene: { getAudioContextCount: () => number }
        }
      ).__hygiene.getAudioContextCount(),
    )
    expect(contextCount).toBeGreaterThanOrEqual(1)

    // Poll until all active AudioContexts transition back to 'suspended' after playback finishes and idle delay expires
    await expect
      .poll(
        async () => {
          const states = await page.evaluate(() =>
            (
              window as unknown as {
                __hygiene: { getAudioContextStates: () => string[] }
              }
            ).__hygiene.getAudioContextStates(),
          )
          return states.length > 0 && states.every((s) => s === 'suspended')
        },
        {
          message:
            'Expected all AudioContexts to transition to suspended after audio playback and idle timeout',
          timeout: 8000,
        },
      )
      .toBe(true)

    // Measure quiet dwell after audio has suspended
    const client = await page.context().newCDPSession(page)
    await client.send('Performance.enable')

    const initialMetrics = await client.send('Performance.getMetrics')
    const getMetric = (
      metrics: { name: string; value: number }[],
      name: string,
    ) => metrics.find((m) => m.name === name)?.value ?? 0

    const initialTask = getMetric(initialMetrics.metrics, 'TaskDuration')
    await page.waitForTimeout(1000)
    const finalMetrics = await client.send('Performance.getMetrics')
    const deltaTask =
      getMetric(finalMetrics.metrics, 'TaskDuration') - initialTask

    await client.detach()

    // CPU activity after audio suspension must remain near zero (< 50ms)
    expect(deltaTask).toBeLessThan(0.05)
  })

  test('immediately suspends AudioContext and halts work when tab visibility changes to hidden', async ({
    page,
  }) => {
    await page.goto('/')

    // Start practice to unlock audio
    await practiceCards(page)
    await expect(page.getByLabel(/your answer/i)).toBeVisible()

    // Trigger an answer submission which plays feedback tone
    await page.getByLabel(/your answer/i).fill('avocado')
    await page.getByLabel(/your answer/i).press('Enter')

    // Simulate tab backgrounding via visibilitychange
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Assert that contexts immediately suspend without waiting for 3s idle timer
    await expect
      .poll(
        async () => {
          const states = await page.evaluate(() =>
            (
              window as unknown as {
                __hygiene: { getAudioContextStates: () => string[] }
              }
            ).__hygiene.getAudioContextStates(),
          )
          return states.length > 0 && states.every((s) => s === 'suspended')
        },
        {
          message:
            'Expected all AudioContexts to immediately suspend upon visibility change to hidden',
          timeout: 1000,
        },
      )
      .toBe(true)
  })

  test('survives full round-trip lifecycle: suspends on hidden, re-arms on visible, and resumes on subsequent user interaction', async ({
    page,
  }) => {
    await page.goto('/')

    // Start practice to unlock audio
    await practiceCards(page)
    await expect(page.getByLabel(/your answer/i)).toBeVisible()

    // 1. Submit an answer (plays feedback sound)
    await page.getByLabel(/your answer/i).fill('avocado')
    await page.getByLabel(/your answer/i).press('Enter')

    // 2. Tab backgrounding (visibilitychange hidden)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Confirm suspended
    await expect
      .poll(
        async () => {
          const states = await page.evaluate(() =>
            (
              window as unknown as {
                __hygiene: { getAudioContextStates: () => string[] }
              }
            ).__hygiene.getAudioContextStates(),
          )
          return states.length > 0 && states.every((s) => s === 'suspended')
        },
        {
          message: 'Expected all AudioContexts to suspend when hidden',
          timeout: 1000,
        },
      )
      .toBe(true)

    // 3. Tab foregrounding (visibilitychange visible)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // 4. Next user interaction on the page (grade the card)
    const goodBtn = page.getByRole('button', { name: /good/i })
    await expect(goodBtn).toBeVisible()
    await goodBtn.click()

    // 5. Contexts must cleanly wake back up to running
    await expect
      .poll(
        async () => {
          const states = await page.evaluate(() =>
            (
              window as unknown as {
                __hygiene: { getAudioContextStates: () => string[] }
              }
            ).__hygiene.getAudioContextStates(),
          )
          return states.some((s) => s === 'running')
        },
        {
          message:
            'Expected AudioContext to resume to running upon user interaction after returning to visible',
          timeout: 2000,
        },
      )
      .toBe(true)

    // 6. After idle dwell, it must cleanly suspend again without leak
    await expect
      .poll(
        async () => {
          const states = await page.evaluate(() =>
            (
              window as unknown as {
                __hygiene: { getAudioContextStates: () => string[] }
              }
            ).__hygiene.getAudioContextStates(),
          )
          return states.length > 0 && states.every((s) => s === 'suspended')
        },
        {
          message:
            'Expected AudioContext to re-suspend after subsequent idle timeout',
          timeout: 6000,
        },
      )
      .toBe(true)
  })
})
