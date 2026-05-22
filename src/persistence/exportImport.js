// JSON download/upload helpers — kept across the v2.0 cloud migration as a
// backup mechanism even after the FSA mode is removed.
//
// Pure data-layer: no React, no app state, no recents bookkeeping.

/**
 * Trigger a browser download of a JSON payload using an anchor + object URL.
 * The blob URL is revoked on the next tick.
 */
export function downloadWorkspace(filename, payload) {
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'workspace.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Read a File (from <input type=file>) as text via FileReader. Returns a Promise.
 */
export function readUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Can't read file"));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}
