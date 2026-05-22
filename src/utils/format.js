export function formatCost(n) {
  if (typeof n !== 'number' || !isFinite(n) || n === 0) return '$0';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return '$' + Math.round(n / 100) / 10 + 'k';
  return '$' + Math.round(n).toLocaleString();
}
