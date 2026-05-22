import { test, expect } from '@playwright/test';

// Phase 7 fallback contract: when VITE_SUPABASE_URL is missing, the app must
// still render its welcome screen without ever showing the LoginScreen.
// Dev/CI runs without env vars; auth must be transparent there.

test('No Supabase env vars → app renders the welcome screen, no auth UI', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(`${e.name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:19999/');
  await page.waitForSelector('.welcome-actions', { timeout: 15_000 });

  // Welcome screen is present.
  await expect(page.locator('.welcome-actions')).toBeVisible();

  // Auth UI is NOT present.
  await expect(page.locator('.auth-card')).toHaveCount(0);

  // Confirm the auth module reports unconfigured.
  const state = await page.evaluate(async () => {
    const mod = await import('/src/persistence/supabase.js');
    return { configured: mod.isSupabaseConfigured(), clientNull: mod.supabase === null };
  });
  expect(state.configured).toBe(false);
  expect(state.clientNull).toBe(true);

  if (errors.length) console.log('Console/page errors:', errors);
  expect(errors).toEqual([]);
});
