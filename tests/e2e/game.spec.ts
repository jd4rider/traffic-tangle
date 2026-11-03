import { expect, test, type Page } from '@playwright/test'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function state(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__TT__?.state() ?? null)
}

async function project(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(({ x: px, y: py }) => (window as any).__TT__.project(px, py), { x, y })
}

async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const point = await project(page, x, y)
  await page.mouse.click(point.x, point.y)
}

/**
 * Taps a menu control and waits for the scene it opens. Chromium can swallow the
 * very first pointer event on a canvas that has not been focused yet, so a tap
 * that changed nothing is retried once - the same thing a player would do.
 */
async function tapForScene(page: Page, x: number, y: number, scene: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await clickDesign(page, x, y)
    const opened = await page
      .waitForFunction((key) => (window as any).__TT__?.active() === key, scene, { timeout: 6_000, polling: 100 })
      .then(() => true)
      .catch(() => false)
    if (opened) return
  }
  await page.waitForFunction((key) => (window as any).__TT__?.active() === key, scene, { timeout: 6_000 })
}

async function settle(page: Page): Promise<void> {
  // Phaser needs a couple of rendered frames before it routes pointer input.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.waitForTimeout(120)
}

async function boot(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => (window as any).__TT__?.active() === 'Menu', undefined, { timeout: 30_000 })
  await settle(page)
}

async function startJourney(page: Page): Promise<void> {
  await boot(page)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => (window as any).__TT__?.active() === 'Game', undefined, { timeout: 15_000 })
  await page.waitForTimeout(400)
  await settle(page)
}

async function routeEverything(page: Page): Promise<void> {
  const snapshot = await state(page)
  for (const vehicle of snapshot.vehicles) {
    const start = snapshot.nodes[vehicle.start]
    const goal = snapshot.nodes[vehicle.goal]
    await clickDesign(page, start.x, start.y)
    await page.waitForTimeout(80)
    await clickDesign(page, goal.x, goal.y)
    await page.waitForTimeout(80)
  }
}

test.describe('Traffic Tangle', () => {
  test('boots to a live menu without console errors', async ({ page }) => {
    const problems: string[] = []
    page.on('pageerror', (error) => problems.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    await boot(page)
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveCount(1)
    const box = await canvas.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(200)
    expect(box?.height ?? 0).toBeGreaterThan(400)
    expect(problems).toEqual([])
  })

  test('draws routes by tapping a car and its pin, then finishes the level', async ({ page }) => {
    await startJourney(page)
    const before = await state(page)
    expect(before.mode).toBe('journey')
    expect(before.vehicles.length).toBeGreaterThanOrEqual(2)

    await routeEverything(page)
    const routed = await state(page)
    for (const vehicle of routed.vehicles) {
      expect(routed.routes[vehicle.id]?.length ?? 0).toBeGreaterThan(1)
    }

    await clickDesign(page, 557, 1156)
    await page.waitForFunction(() => (window as any).__TT__?.state()?.overlay === true, undefined, { timeout: 60_000 })
    const done = await state(page)
    expect(done.overlay).toBe(true)
    expect(done.running).toBe(false)

    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('traffic-tangle-save-v1') ?? '{}'))
    expect(save.unlocked).toBeGreaterThanOrEqual(2)
  })

  test('undo and redo restore routes', async ({ page }) => {
    await startJourney(page)
    const snapshot = await state(page)
    const vehicle = snapshot.vehicles[0]
    await clickDesign(page, snapshot.nodes[vehicle.start].x, snapshot.nodes[vehicle.start].y)
    await clickDesign(page, snapshot.nodes[vehicle.goal].x, snapshot.nodes[vehicle.goal].y)
    expect((await state(page)).routes[vehicle.id]?.length ?? 0).toBeGreaterThan(1)

    await page.keyboard.press('u')
    await page.waitForTimeout(200)
    expect((await state(page)).routes[vehicle.id] ?? null).toBeNull()

    await page.keyboard.down('Shift')
    await page.keyboard.press('y')
    await page.keyboard.up('Shift')
    const snapshot2 = await state(page)
    expect(snapshot2).toBeTruthy()
  })

  test('navigates worlds and opens a level', async ({ page }) => {
    await boot(page)
    await tapForScene(page, 205, 981, 'Worlds')
    await settle(page)
    await tapForScene(page, 360, 221, 'Levels')
    await settle(page)
    await tapForScene(page, 89, 225, 'Game')
    expect((await state(page)).levelNumber).toBe(1)
  })

  test('opens the daily challenge as the same shared level', async ({ page }) => {
    await boot(page)
    await clickDesign(page, 205, 1055)
    await page.waitForFunction(() => (window as any).__TT__?.active() === 'Game', undefined, { timeout: 15_000 })
    const snapshot = await state(page)
    expect(snapshot.mode).toBe('daily')
    expect(snapshot.levelId).toBeTruthy()
    expect(snapshot.timeLimit).toBeGreaterThan(0)
  })

  test('keeps progress after a reload and continues on the next garden', async ({ page }) => {
    await startJourney(page)
    await routeEverything(page)
    await clickDesign(page, 557, 1156)
    await page.waitForFunction(() => (window as any).__TT__?.state()?.overlay === true, undefined, { timeout: 60_000 })
    await page.reload()
    await page.waitForFunction(() => (window as any).__TT__?.active() === 'Menu', undefined, { timeout: 30_000 })
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('traffic-tangle-save-v1') ?? '{}'))
    expect(save.completed['level-0001']?.stars ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('fits a small portrait phone without scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await boot(page)
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: document.querySelector('canvas')?.getBoundingClientRect(),
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1)
    expect(metrics.canvas?.width ?? 0).toBeGreaterThan(300)
    expect(metrics.canvas?.height ?? 0).toBeGreaterThan(700)
  })
})
