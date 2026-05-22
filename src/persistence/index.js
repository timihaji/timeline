// Persistence facade.
//
// This is the single interface the React app talks to for workspace + settings
// + snapshot + share I/O. Implementations:
//
//   - fileSystemPersistence  → File System Access API + IndexedDB (current v1)
//   - supabasePersistence    → Supabase Postgres + Auth + RPC (future Phase 8)
//
// Phase 5 deliverable: define the interface shape, wire the FSA backend, expose
// capability flags so the UI can hide cloud-only buttons. Snapshots and shares
// throw `not_supported_in_filesystem_mode` until Phase 8.

import {
  FSA_AVAILABLE,
  CURRENT_HANDLE_KEY,
  idbPut, idbGet, idbDel,
  pickAndOpen, pickAndSave, readHandle, writeHandle,
} from './fileSystemPersistence.js';
import { downloadWorkspace, readUploadedFile } from './exportImport.js';

const RECENTS_KEY = 'timeline-recents-v1';
const RECENTS_MAX = 8;

function readRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; }
  catch (_) { return []; }
}

function writeRecents(list) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list)); } catch (_) {}
}

function notSupported() {
  const err = new Error('not_supported_in_filesystem_mode');
  err.code = 'not_supported_in_filesystem_mode';
  throw err;
}

/**
 * File-system backend implementing the persistence facade.
 *
 * Workspaces here correspond to entries in the localStorage recents list. Each
 * entry has an `id` (uuid), a `name` (filename), a `savedAt` timestamp, and an
 * optional `hasHandle` flag. When hasHandle is true, a `FileSystemFileHandle`
 * keyed by the same id lives in IndexedDB.
 */
export const fileSystemPersistence = {
  async init() { /* noop */ },

  capabilities: {
    share: false,
    multiWorkspace: true,        // via recents
    snapshots: false,
    cloudSettings: false,
    fsaAvailable: FSA_AVAILABLE,
  },

  // ── Workspaces ──────────────────────────────────────────────────────────

  async listWorkspaces() {
    return readRecents().map(e => ({
      id: e.id,
      name: e.name,
      updatedAt: e.savedAt,
      hasHandle: !!e.hasHandle,
    }));
  },

  async loadWorkspace(id) {
    const entry = readRecents().find(e => e.id === id);
    if (!entry) {
      const err = new Error('workspace_not_found');
      err.code = 'workspace_not_found';
      throw err;
    }
    if (!entry.hasHandle) {
      const err = new Error('no_handle_use_picker');
      err.code = 'no_handle_use_picker';
      throw err;
    }
    const handle = await idbGet(id);
    if (!handle) {
      const err = new Error('handle_lost');
      err.code = 'handle_lost';
      throw err;
    }
    const text = await readHandle(handle);
    return { id, name: entry.name, text, handle };
  },

  async saveWorkspace(id, { name, text, handle }) {
    let h = handle;
    if (!h) {
      h = await pickAndSave(name || 'workspace.json');
      if (!h) return null; // user cancelled
    }
    await writeHandle(h, text);
    try { await idbPut(CURRENT_HANDLE_KEY, h); } catch (_) {}
    const savedName = h.name || name || 'workspace.json';
    const newId = await pushRecent(savedName, h, id);
    return { id: newId, name: savedName, updatedAt: Date.now(), handle: h };
  },

  /** Prompt the OS open picker, then return the picked handle + text. */
  async openViaPicker() {
    const handle = await pickAndOpen();
    if (!handle) return null;
    const text = await readHandle(handle);
    const id = await pushRecent(handle.name, handle);
    return { id, name: handle.name, text, handle };
  },

  /** Import a File from <input type=file> — no handle, name-only recent. */
  async importFile(file) {
    const text = await readUploadedFile(file);
    const id = await pushRecent(file.name, null);
    return { id, name: file.name, text, handle: null };
  },

  /** Export via download — no handle is tracked. */
  exportDownload(name, text) {
    downloadWorkspace(name, text);
  },

  async createWorkspace(/* name */) {
    // No-op in FSA mode — workspace creation happens at first save.
    notSupported();
  },

  async renameWorkspace(id, name) {
    const list = readRecents();
    const entry = list.find(e => e.id === id);
    if (!entry) return;
    entry.name = name;
    writeRecents(list);
  },

  async deleteWorkspace(id) {
    const list = readRecents();
    const entry = list.find(e => e.id === id);
    if (entry?.hasHandle) { try { await idbDel(id); } catch (_) {} }
    writeRecents(list.filter(e => e.id !== id));
  },

  // ── Settings (cloud-only — local mode keeps localStorage) ───────────────

  async loadSettings() { return null; },
  async saveSettings(/* patch */) { /* noop — local mode uses localStorage */ },

  // ── Snapshots (cloud-only) ──────────────────────────────────────────────

  async createSnapshot(/* workspaceId, workspace, reason */) { notSupported(); },
  async listSnapshots(/* workspaceId */) { return []; },
  async restoreSnapshot(/* snapshotId */) { notSupported(); },

  // ── Share links (cloud-only) ────────────────────────────────────────────

  async createShare(/* workspaceId, opts */) { notSupported(); },
  async listShares(/* workspaceId */) { return []; },
  async revokeShare(/* token */) { notSupported(); },
  async loadShare(/* token, password */) { notSupported(); },
};

// ── Recents helpers ────────────────────────────────────────────────────────
// Shared by saveWorkspace / openViaPicker / importFile to keep the recents list
// MRU-sorted and bounded to RECENTS_MAX, evicting IDB handles of dropped entries.

async function pushRecent(name, handle, idHint) {
  const id = idHint || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const entry = { id, name, savedAt: Date.now(), hasHandle: !!handle };
  const prev = readRecents().filter(e => e.name !== name && e.id !== id);
  const next = [entry, ...prev].slice(0, RECENTS_MAX);
  const evicted = prev.slice(RECENTS_MAX - 1);
  for (const ev of evicted) { if (ev.hasHandle) { try { await idbDel(ev.id); } catch (_) {} } }
  if (handle) { try { await idbPut(id, handle); } catch (_) {} }
  writeRecents(next);
  return id;
}

// ── Default export — the active persistence singleton ──────────────────────
// Phase 8 will swap this to a session-aware selector that returns the Supabase
// backend when a user is signed in. For now we always return the FSA backend.

export const persistence = fileSystemPersistence;
