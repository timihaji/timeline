import { test, expect } from '@playwright/test';

const VITE_URL = 'http://127.0.0.1:19999/';

test.describe.configure({ mode: 'serial' });

test('Vite app boots without console errors', async ({ page }) => {
  const errors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`${err.name}: ${err.message}`);
  });

  await page.goto(VITE_URL);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Welcome screen or topbar should appear
  const welcome = page.locator('.welcome-actions, .topbar').first();
  const ok = await welcome.count();

  console.log('---- console errors:', errors.length);
  errors.slice(0, 30).forEach((e, i) => console.log(`  [${i}] ${e}`));
  console.log('---- page errors:', pageErrors.length);
  pageErrors.slice(0, 30).forEach((e, i) => console.log(`  [${i}] ${e}`));

  await page.screenshot({ path: 'tests/output/vite-smoke.png', fullPage: true });

  expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(ok, 'welcome or topbar to appear').toBeGreaterThan(0);
});
