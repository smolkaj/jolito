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
      const itemBox = (await item.boundingBox())!
      expect(itemBox.height).toBeGreaterThanOrEqual(44)
      const isForeground = await page.evaluate(
        ({ x, y }: { x: number; y: number }) => {
          const el = document.elementFromPoint(x, y)
          return el ? Boolean(el.closest('.flat-choice')) : false
        },
        { x: itemBox.x + itemBox.width / 2, y: itemBox.y + itemBox.height / 2 },
      )
      expect(isForeground).toBe(true)
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
      page.getByRole('heading', { name: 'Grammar', exact: true }),
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

test('practice menu stays fully in the foreground over hero sample cards on iPad viewports', async ({
  page,
}) => {
  for (const viewport of [
    { width: 768, height: 1024 }, // iPad Mini portrait
    { width: 810, height: 1080 }, // iPad 10.2" portrait
    { width: 820, height: 1180 }, // iPad Air portrait
    { width: 834, height: 1194 }, // iPad Pro 11" portrait
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await settleAnimations(page)

    const trigger = page.getByRole('button', { name: 'Practice', exact: true })
    const esCard = page.locator('.sample-card-es')
    const enCard = page.locator('.sample-card-en')
    await expect(esCard).toBeVisible()
    await expect(enCard).toBeVisible()

    // Test with default Spanish card (aguacate) active, and with English card active
    for (const activeSide of ['spanish', 'english'] as const) {
      if (activeSide === 'english') {
        await enCard.click()
        await settleAnimations(page)
      }

      await trigger.tap()
      const menu = page.getByRole('menu', { name: 'Practice' })
      await expect(menu).toBeVisible()

      // The menu options dropdown must be maximally in the foreground over cards
      const menuBox = (await menu.boundingBox())!
      const checkPoints = [
        { x: menuBox.x + 10, y: menuBox.y + 10 },
        { x: menuBox.x + menuBox.width - 10, y: menuBox.y + 10 },
        { x: menuBox.x + 10, y: menuBox.y + menuBox.height - 10 },
        {
          x: menuBox.x + menuBox.width - 10,
          y: menuBox.y + menuBox.height - 10,
        },
        {
          x: menuBox.x + menuBox.width / 2,
          y: menuBox.y + menuBox.height - 10,
        },
      ]

      for (const pt of checkPoints) {
        const isHit = await page.evaluate(
          ({ x, y }: { x: number; y: number }) => {
            const el = document.elementFromPoint(x, y)
            return el ? Boolean(el.closest('.practice-menu-options')) : false
          },
          pt,
        )
        expect(isHit).toBe(true)
      }

      // Both menu choices are unobstructed and can be tapped directly
      for (const item of await menu.getByRole('menuitem').all()) {
        const itemBox = (await item.boundingBox())!
        const isForeground = await page.evaluate(
          ({ x, y }: { x: number; y: number }) => {
            const el = document.elementFromPoint(x, y)
            return el ? Boolean(el.closest('.flat-choice')) : false
          },
          {
            x: itemBox.x + itemBox.width / 2,
            y: itemBox.y + itemBox.height / 2,
          },
        )
        expect(isForeground).toBe(true)
      }

      // Dismiss menu
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
    }
  }
})
