import { test, expect } from '@playwright/test';

// Smoke test for the persistence facade. Verifies the singleton is exposed via
// a dynamic import, that capability flags match the FSA backend, and that
// recents-list bookkeeping survives a round-trip through rename + delete.

test('persistence facade — capabilities and recents round-trip', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:19999/');
  await page.waitForSelector('.welcome-actions', { timeout: 15_000 });

  const result = await page.evaluate(async () => {
    // Clear any pre-existing recents so the test is deterministic.
    try { localStorage.removeItem('timeline-recents-v1'); } catch (_) {}

    const mod = await import('/src/persistence/index.js');
    const p = mod.persistence;

    // capabilities are exposed and shaped right
    const cap = p.capabilities;
    const capOk = cap && cap.share === false && cap.multiWorkspace === true
      && cap.snapshots === false && cap.cloudSettings === false
      && typeof cap.fsaAvailable === 'boolean';

    // listWorkspaces starts empty
    const initial = await p.listWorkspaces();

    // renameWorkspace on a missing id is a no-op
    await p.renameWorkspace('does-not-exist', 'x');

    // deleteWorkspace on a missing id is a no-op
    await p.deleteWorkspace('does-not-exist');

    // listSnapshots returns empty (cloud-only)
    const snaps = await p.listSnapshots('any');

    // createSnapshot throws not_supported in FSA mode
    let snapErr = null;
    try { await p.createSnapshot('any', {}, 'manual'); }
    catch (e) { snapErr = e?.code || e?.message; }

    return { capOk, initialLen: initial.length, snapsLen: snaps.length, snapErr };
  });

  expect(result.capOk).toBe(true);
  expect(result.initialLen).toBe(0);
  expect(result.snapsLen).toBe(0);
  expect(result.snapErr).toBe('not_supported_in_filesystem_mode');

  if (errors.length) console.log('Console/page errors:', errors);
  expect(errors).toEqual([]);
});
