export function shade(c, pct) {
  if (!c) return '#000';
  let hex = c;
  if (hex.startsWith('var(')) {
    const name = hex.match(/--[\w-]+/)?.[0];
    hex = name ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '#14b8a6';
  }
  if (!hex.startsWith('#')) return c;
  if (hex.length === 4) hex = '#' + hex.slice(1).split('').map((x) => x + x).join('');
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (pct < 0) { r = Math.round(r * (1 + pct)); g = Math.round(g * (1 + pct)); b = Math.round(b * (1 + pct)); }
  else { r = Math.round(r + (255 - r) * pct); g = Math.round(g + (255 - g) * pct); b = Math.round(b + (255 - b) * pct); }
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
