import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const BASELINE_DIR = path.join(process.cwd(), 'tests', 'baseline.spec.js-snapshots');
const VITE_DIR = path.join(process.cwd(), 'tests', 'output');

const PAIRS = [
  { base: '01-welcome-chromium-win32.png', vite: 'vite-01-welcome.png' },
  { base: '02-sample-loaded-chromium-win32.png', vite: 'vite-02-sample-loaded.png' },
  { base: '03-lanes-by-owner-chromium-win32.png', vite: 'vite-03-lanes-by-owner.png' },
  { base: '04-list-view-chromium-win32.png', vite: 'vite-04-list-view.png' },
  { base: '05-command-palette-chromium-win32.png', vite: 'vite-05-command-palette.png' },
];

const ALLOWED_DIFF_RATIO = 0.02; // 2% max — generous for font hinting / antialias

for (const { base, vite } of PAIRS) {
  test(`parity: ${base} <-> ${vite}`, async () => {
    const basePath = path.join(BASELINE_DIR, base);
    const vitePath = path.join(VITE_DIR, vite);
    expect(fs.existsSync(basePath), `baseline missing: ${basePath}`).toBe(true);
    expect(fs.existsSync(vitePath), `vite output missing: ${vitePath}`).toBe(true);

    const img1 = PNG.sync.read(fs.readFileSync(basePath));
    const img2 = PNG.sync.read(fs.readFileSync(vitePath));

    if (img1.width !== img2.width || img1.height !== img2.height) {
      console.log(`  size mismatch: baseline ${img1.width}x${img1.height} vs vite ${img2.width}x${img2.height}`);
    }

    const w = Math.min(img1.width, img2.width);
    const h = Math.min(img1.height, img2.height);
    const diff = new PNG({ width: w, height: h });

    // Crop both to common rect for comparison
    function crop(src, W, H) {
      const out = new PNG({ width: W, height: H });
      for (let y = 0; y < H; y++) {
        const srcStride = src.width * 4;
        const dstStride = W * 4;
        src.data.copy(out.data, y * dstStride, y * srcStride, y * srcStride + dstStride);
      }
      return out;
    }
    const a = img1.width === w && img1.height === h ? img1 : crop(img1, w, h);
    const b = img2.width === w && img2.height === h ? img2 : crop(img2, w, h);

    const mismatched = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.15 });
    const ratio = mismatched / (w * h);

    const diffPath = path.join(VITE_DIR, `diff-${vite}`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(`  ${base}: ${mismatched} px diff (${(ratio * 100).toFixed(3)}%)  -> ${diffPath}`);
    expect(ratio, `diff too high: ${(ratio * 100).toFixed(3)}%`).toBeLessThan(ALLOWED_DIFF_RATIO);
  });
}
