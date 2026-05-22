import { test, expect } from '@playwright/test';

const VITE_URL = 'http://127.0.0.1:19999/';

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

test.describe.configure({ mode: 'serial' });

test.describe('Vite parity (compare against Phase 0 baselines)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
  });

  test('01 welcome screen (vite)', async ({ page }) => {
    await page.goto(VITE_URL);
    await page.waitForSelector('.welcome-actions, .topbar', { timeout: 15_000 });
    await settle(page);
    await page.screenshot({ path: 'tests/output/vite-01-welcome.png', fullPage: true });
  });

  test('02 sample workspace loaded (vite)', async ({ page }) => {
    await page.goto(VITE_URL);
    await page.waitForSelector('.welcome-actions', { timeout: 15_000 });
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    await settle(page);
    await page.screenshot({ path: 'tests/output/vite-02-sample-loaded.png', fullPage: true });
  });

  test('03 lanes by owner (vite)', async ({ page }) => {
    await page.goto(VITE_URL);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    const laneBtn = page.locator('[data-lane-mode]').first();
    if (await laneBtn.count() > 0) {
      await laneBtn.click().catch(() => {});
    }
    await settle(page);
    await page.screenshot({ path: 'tests/output/vite-03-lanes-by-owner.png', fullPage: true });
  });

  test('04 list view (vite)', async ({ page }) => {
    await page.goto(VITE_URL);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    const listToggle = page.locator('button:has-text("List"), [aria-label*="List" i]').first();
    if (await listToggle.count() > 0) {
      await listToggle.click().catch(() => {});
      await settle(page);
    }
    await page.screenshot({ path: 'tests/output/vite-04-list-view.png', fullPage: true });
  });

  test('05 command palette (vite)', async ({ page }) => {
    await page.goto(VITE_URL);
    await page.getByRole('button', { name: /Open sample project/i }).click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    await page.keyboard.press('Control+K');
    await settle(page);
    await page.screenshot({ path: 'tests/output/vite-05-command-palette.png', fullPage: true });
  });
});
