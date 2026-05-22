// File System Access + IndexedDB primitives for local-disk workspace persistence.
//
// Two layers:
//   1. Raw IDB helpers (idbOpen/Put/Get/Del) for persisting FileSystemFileHandles
//      across sessions. The handles must survive page reload so Open Recent works.
//   2. FSA wrappers (pickAndOpen, pickAndSave, readHandle, writeHandle) that hide
//      the showOpenFilePicker / showSaveFilePicker / createWritable plumbing.
//
// This module is pure data-layer: no React, no UI, no localStorage of workspace
// content. Recents-list management and serialization live elsewhere.

export const FSA_AVAILABLE = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

const IDB_DB = 'timeline-files';
const IDB_STORE = 'handles';
export const CURRENT_HANDLE_KEY = 'gantt-current-handle';

function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

export async function idbPut(id, val) {
  const db = await idbOpen();
  return new Promise((r, j) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, id);
    tx.oncomplete = r;
    tx.onerror = () => j(tx.error);
  });
}

export async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((r, j) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(id);
    rq.onsuccess = () => r(rq.result);
    rq.onerror = () => j(rq.error);
  });
}

export async function idbDel(id) {
  const db = await idbOpen();
  return new Promise((r, j) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = r;
    tx.onerror = () => j(tx.error);
  });
}

// ── FSA pickers ──────────────────────────────────────────────────────────────

const WORKSPACE_TYPES = [{
  description: 'Timeline Workspace',
  accept: { 'application/json': ['.json'] }
}];

/**
 * Show the OS file picker for opening a workspace. Returns the handle, or null
 * if the user cancelled. Throws on any other error.
 */
export async function pickAndOpen() {
  if (!FSA_AVAILABLE) throw new Error('File System Access API not available');
  try {
    const [handle] = await window.showOpenFilePicker({ types: WORKSPACE_TYPES });
    return handle;
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Show the OS save picker. Returns the new handle, or null if the user cancelled.
 */
export async function pickAndSave(suggestedName = 'workspace.json') {
  if (!FSA_AVAILABLE) throw new Error('File System Access API not available');
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: WORKSPACE_TYPES,
    });
  } catch (e) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Read the file referenced by a handle as text. Re-requests read permission if
 * Chromium has dropped it across sessions. Returns the text contents, or throws.
 * Throws an Error with .code === 'permission_denied' if the user declines.
 */
export async function readHandle(handle) {
  let perm;
  try { perm = await handle.queryPermission({ mode: 'read' }); } catch (_) { perm = 'prompt'; }
  if (perm !== 'granted') {
    try { perm = await handle.requestPermission({ mode: 'read' }); } catch (_) { perm = 'denied'; }
  }
  if (perm !== 'granted') {
    const err = new Error('Permission denied');
    err.code = 'permission_denied';
    throw err;
  }
  const file = await handle.getFile();
  return await file.text();
}

/**
 * Write text to the file referenced by a handle. Throws on any failure.
 */
export async function writeHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}
