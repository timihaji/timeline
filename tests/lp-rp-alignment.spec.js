import { test, expect } from '@playwright/test';

const VITE_URL = 'http://127.0.0.1:19999/';

// LP/RP alignment invariant: for every day index N, the header day cell
// (.hdr-day) and the grid background column (.grid-col) must share the
// exact same `left` offset within their respective tracks. Memory:
// project_lp_rp_alignment_invariant.md — broken 3× by adding per-pane
// headers to .rpane alone. Run after every Phase 4 commit.
test('LP/RP alignment: header day N == grid column N', async ({ page }) => {
  await page.goto(VITE_URL);
  await page.getByRole('button', { name: /Open sample project/i }).click();
  await page.waitForSelector('.timeline-hdr .hdr-day', { timeout: 15_000 });
  await page.waitForSelector('.grid-bg .grid-col', { timeout: 15_000 });

  const result = await page.evaluate(() => {
    const headerDays = Array.from(document.querySelectorAll('.timeline-hdr .hdr-day'));
    const gridCols = Array.from(document.querySelectorAll('.grid-bg .grid-col'));
    if (!headerDays.length || !gridCols.length) {
      return { error: 'no header days or grid cols', headerDays: headerDays.length, gridCols: gridCols.length };
    }
    const n = Math.min(headerDays.length, gridCols.length);
    // Sample several indices spanning the axis
    const indices = [0, 1, 5, 10, 25, 50, 100, n - 1].filter(i => i < n && i >= 0);
    const pairs = indices.map(i => ({
      i,
      hdrLeft: headerDays[i].offsetLeft,
      colLeft: gridCols[i].offsetLeft,
      hdrWidth: headerDays[i].offsetWidth,
      colWidth: gridCols[i].offsetWidth,
    }));
    return { n, pairs };
  });

  expect(result.error).toBeUndefined();
  expect(result.n).toBeGreaterThan(100);

  for (const p of result.pairs) {
    expect(p.hdrLeft, `day ${p.i}: hdr.left ${p.hdrLeft} != col.left ${p.colLeft}`).toBe(p.colLeft);
    expect(p.hdrWidth, `day ${p.i}: hdr.width ${p.hdrWidth} != col.width ${p.colWidth}`).toBe(p.colWidth);
  }
});
