import { test, expect } from '@playwright/test';

// One-shot live check: when VITE_SUPABASE_* env vars are set, the AuthGate
// should render the LoginScreen (not the welcome screen) for unauthenticated
// visitors. This test is NOT part of the regular regression suite — it only
// passes against a Vite instance booted with a real .env file present.

test('Auth gate renders LoginScreen when Supabase is configured', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(`${e.name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:19999/');

  // The auth card should appear (no session in this fresh browser context).
  await page.waitForSelector('.auth-card', { timeout: 15_000 });
  await expect(page.locator('.auth-card h1')).toHaveText('Timeline');
  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(page.locator('input[type=password]')).toBeVisible();

  // The Timeline welcome screen should NOT be present.
  await expect(page.locator('.welcome-actions')).toHaveCount(0);

  // The Supabase module should report configured.
  const state = await page.evaluate(async () => {
    const mod = await import('/src/persistence/supabase.js');
    return { configured: mod.isSupabaseConfigured(), clientNull: mod.supabase === null };
  });
  expect(state.configured).toBe(true);
  expect(state.clientNull).toBe(false);

  if (errors.length) console.log('Console/page errors:', errors);
  expect(errors).toEqual([]);
});
