export function genId(prefix) {
  return (prefix || 'p') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
