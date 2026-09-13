import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Measure settled surfaces while leaving infinite loading indicators alone. */
export async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect &&
          Number.isFinite(animation.effect.getTiming().iterations),
      )
    await Promise.allSettled(finite.map((animation) => animation.finished))
  })
}

export async function auditAccessibility(page: Page) {
  await settleAnimations(page)
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
}
