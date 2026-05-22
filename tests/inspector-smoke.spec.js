import { test, expect } from '@playwright/test';

test('Inspector opens with task fields when a task is selected', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:19999/');
  await page.waitForSelector('.welcome-actions', { timeout: 15_000 });
  await page.getByRole('button', { name: /Open sample project/i }).click();
  await page.waitForSelector('.topbar', { timeout: 15_000 });
  await page.waitForTimeout(500);

  // click on the first task row in the lpane
  const firstRow = page.locator('.lpane-body [data-task-id]').first();
  await firstRow.click();
  await page.waitForTimeout(300);

  // inspector drawer should be open and have a title input
  const ins = page.locator('.inspector.open');
  await expect(ins).toBeVisible();
  await expect(ins.locator('.ins-title-input')).toBeVisible();

  // basic field labels we expect
  await expect(ins.getByText('Priority').first()).toBeVisible();
  await expect(ins.getByText('Status').first()).toBeVisible();
  await expect(ins.getByText('Owner').first()).toBeVisible();
  await expect(ins.getByText('Color').first()).toBeVisible();

  if (errors.length) console.log('Console/page errors:', errors);
  expect(errors).toEqual([]);
});
