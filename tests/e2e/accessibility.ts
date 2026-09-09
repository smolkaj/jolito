import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** Accessibility contrast measures the settled surface, not a fade's opacity.
 * Infinite loading indicators must not hold an audit open. */
export async function auditAccessibility(page: Page) {
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
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
}
