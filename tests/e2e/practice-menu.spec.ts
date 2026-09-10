import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

test.use({ hasTouch: true })

for (const width of [1280, 1024, 768, 393, 320]) {
  test(`home practice menu stays clear and operable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 393 ? 852 : 900 })
    await page.goto('/')
    await settleAnimations(page)
    const trigger = page.getByRole('button', { name: 'Practice', exact: true })
    const create = page.getByRole('button', {
      name: 'Create a card',
      exact: true,
    })
    const practiceBox = (await trigger.boundingBox())!
    const createBox = (await create.boundingBox())!
    expect(practiceBox.y).toBeCloseTo(createBox.y, 2)
    expect(practiceBox.height).toBeCloseTo(createBox.height, 2)
    // Grid tracks can differ by one browser layout subpixel.
    expect(practiceBox.width).toBeCloseTo(createBox.width, 1)
    await page.screenshot({
      path: `test-results/practice-menu-${width}-closed.png`,
      fullPage: true,
    })
    await trigger.tap()
    const menu = page.getByRole('menu', { name: 'Practice' })
    await expect(menu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Cards' })).toBeFocused()
    const box = (await menu.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    for (const item of await menu.getByRole('menuitem').all()) {
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/practice-menu-${width}-open.png`,
      fullPage: true,
    })
    if (width === 1280) {
      const grammar = page.getByRole('menuitem', { name: 'Grammar' })
      await grammar.hover()
      await settleAnimations(page)
      await page.screenshot({
        path: 'test-results/practice-menu-hover.png',
        fullPage: true,
      })
      await page.mouse.down()
      await settleAnimations(page)
      await page.screenshot({
        path: 'test-results/practice-menu-pressed.png',
        fullPage: true,
      })
      // Release outside the action so this visual check does not navigate.
      await page.mouse.move(0, 0)
      await page.mouse.up()
      await page.keyboard.press('Home')
    }
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitem', { name: 'Grammar' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(menu).toHaveCount(0)
    await trigger.tap()
    await page.keyboard.press('Shift+Tab')
    await expect(trigger).toBeFocused()
    await expect(menu).toHaveCount(0)
    await trigger.tap()
    await page.getByRole('heading', { level: 1 }).tap()
    await expect(menu).toHaveCount(0)
    await trigger.press('ArrowUp')
    await expect(page.getByRole('menuitem', { name: 'Grammar' })).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('textbox', { name: 'Your answer' }),
    ).toBeFocused()
    await page.getByRole('textbox').press('Enter')
    await page.keyboard.press('4')
    const activePrompt = await page
      .getByRole('heading', { level: 1 })
      .textContent()
    const progress = await page
      .getByRole('progressbar')
      .getAttribute('aria-valuenow')
    expect(Number(progress)).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Jolito home', exact: true }).click()
    await trigger.tap()
    await page.getByRole('menuitem', { name: 'Grammar' }).tap()
    await expect(
      page.getByRole('heading', { name: 'Pretérito indefinido' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Jolito home', exact: true }).click()
    await trigger.tap()
    await page.getByRole('menuitem', { name: 'Cards' }).tap()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      activePrompt!,
    )
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      progress!,
    )
  })
}
