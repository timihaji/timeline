import { test, expect } from '@playwright/test';

const APP = '/timeline.html';

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

test.describe('Baseline screenshots (legacy timeline.html)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
  });

  test('01 welcome screen', async ({ page }) => {
    await page.goto(APP);
    await page.waitForSelector('.welcome-actions, .topbar', { timeout: 15_000 });
    await settle(page);
    await expect(page).toHaveScreenshot('01-welcome.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test('02 sample workspace loaded', async ({ page }) => {
    await page.goto(APP);
    await page.waitForSelector('.welcome-actions', { timeout: 15_000 });
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    await settle(page);
    await expect(page).toHaveScreenshot('02-sample-loaded.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test('03 lanes by owner', async ({ page }) => {
    await page.goto(APP);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    // Switch lane mode via the tweaks panel if available; otherwise use the topbar lane control
    const laneBtn = page.locator('[data-lane-mode]').first();
    if (await laneBtn.count() > 0) {
      await laneBtn.click().catch(() => {});
    }
    await settle(page);
    await expect(page).toHaveScreenshot('03-lanes-by-owner.png', { fullPage: true, maxDiffPixelRatio: 0.05 });
  });

  test('04 list view', async ({ page }) => {
    await page.goto(APP);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    const listToggle = page.locator('button:has-text("List"), [aria-label*="List" i]').first();
    if (await listToggle.count() > 0) {
      await listToggle.click().catch(() => {});
      await settle(page);
    }
    await expect(page).toHaveScreenshot('04-list-view.png', { fullPage: true, maxDiffPixelRatio: 0.05 });
  });

  test('05 command palette', async ({ page }) => {
    await page.goto(APP);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    await page.keyboard.press('Control+K');
    await settle(page);
    await expect(page).toHaveScreenshot('05-command-palette.png', { fullPage: true, maxDiffPixelRatio: 0.05 });
  });
});
