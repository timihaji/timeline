import { DEFAULT_CALENDAR, CURRENT_VERSION } from './constants.js';
import { todayStr, TODAY, ymd } from './dates.js';
import { genId } from '../utils/ids.js';
import { normalizeStatus } from './rollups.js';

export const MIGRATIONS = [
  { from: 1, to: 2, migrate(data){
    data.projects = (data.projects || []).map(p => ({...p, owners: p.owners || []}));
    data.version = 2;
    return data;
  } },
  { from: 2, to: 3, migrate(data){
    data.projects = (data.projects || []).map(p => ({
      ...p,
      calendar: p.calendar || {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]},
      autoSchedule: p.autoSchedule || 'cascade',
      tasks: (p.tasks || []).map(t => {
        const lag = typeof t.lag === 'number' ? t.lag : 0;
        const next = {
          ...t,
          deps: (t.deps || []).map(d =>
            typeof d === 'string' ? {id: d, type: 'FS', lag} : d
          ),
        };
        // Per-task lag is deprecated — promoted to per-dep above.
        delete next.lag;
        return next;
      }),
    }));
    data.version = 3;
    return data;
  } },
  // v3 → v4 (Phase A): adds status enum, tags, comments, project tagRegistry,
  // per-resource availability calendar (workingDays / holidays / PTO / allocationPct).
  { from: 3, to: 4, migrate(data){
    data.projects = (data.projects || []).map(p => ({
      ...p,
      tagRegistry: Array.isArray(p.tagRegistry) ? p.tagRegistry : [],
      owners: (p.owners || []).map(o => ({
        ...o,
        // null calendar => owner falls back to project calendar.
        calendar: o.calendar || null,
        pto: Array.isArray(o.pto) ? o.pto : [],
        // 100 = full availability; <100 lets the scheduler stretch durations later.
        allocationPct: typeof o.allocationPct === 'number' ? o.allocationPct : 100,
      })),
      tasks: (p.tasks || []).map(t => {
        const status = normalizeStatus(t.status, t.done);
        const next = {
          ...t,
          status,
          // Keep `done` synced so existing renderers (30+ sites) keep working.
          done: status === 'done',
          tags: Array.isArray(t.tags) ? t.tags : [],
          comments: Array.isArray(t.comments) ? t.comments : [],
        };
        return next;
      }),
    }));
    data.version = 4;
    return data;
  } },
  // v4 → v5: replaces single `baseline` Map with named `baselines[]` array + `activeBaselineId`.
  { from: 4, to: 5, migrate(data){
    data.projects = (data.projects || []).map(p => {
      const baselines = Array.isArray(p.baselines) ? p.baselines : [];
      let activeBaselineId = p.activeBaselineId || null;
      // Promote legacy single baseline to the new array if present and array is empty.
      if (p.baseline && baselines.length === 0) {
        const snapshot = typeof p.baseline === 'object' && !(p.baseline instanceof Map)
          ? p.baseline
          : Object.fromEntries(p.baseline);
        const id = genId('bl-');
        baselines.push({ id, name: 'Original baseline', createdAt: p.created || todayStr, snapshot });
        activeBaselineId = id;
      }
      const next = { ...p, baselines, activeBaselineId };
      delete next.baseline;
      return next;
    });
    data.version = 5;
    return data;
  } },
  // v5 → v6: adds workspace-root laneMode/lanes/stageRegistry and per-task laneId/stage.
  { from: 5, to: 6, migrate(data){
    data.laneMode = data.laneMode || 'off';
    data.lanes = Array.isArray(data.lanes) ? data.lanes : [];
    data.stageRegistry = Array.isArray(data.stageRegistry) ? data.stageRegistry : [];
    data.projects = (data.projects || []).map(p => ({
      ...p,
      tasks: (p.tasks || []).map(t => ({
        ...t,
        laneId: t.laneId || null,
        stage:  t.stage  || null,
      })),
    }));
    data.version = 6;
    return data;
  } },
];

export function migrateWorkspace(data){
  if (!data || typeof data !== 'object') throw new Error('Invalid workspace file');
  let v = data.version || 1;
  if (v > CURRENT_VERSION) {
    throw new Error('This file was saved by a newer version of Timeline (v' + v + '). Please update the app to open it.');
  }
  let cur = data;
  while (v < CURRENT_VERSION) {
    const step = MIGRATIONS.find(m => m.from === v);
    if (!step) throw new Error('No migration available from workspace version ' + v + ' to ' + CURRENT_VERSION);
    cur = step.migrate(cur);
    if ((cur.version || 0) <= v) throw new Error('Migration from v' + v + ' did not advance the version');
    v = cur.version;
  }
  cur.version = CURRENT_VERSION;
  return cur;
}

export function serializeWorkspace(projects, activeProjectId, opts={}){
  const {laneMode='off', lanes=[], stageRegistry=[]} = opts;
  return JSON.stringify({
    version: CURRENT_VERSION,
    activeProjectId,
    laneMode,
    lanes,
    stageRegistry,
    projects: projects.map(p => ({
      ...p,
      baselines: Array.isArray(p.baselines) ? p.baselines : [],
      activeBaselineId: p.activeBaselineId || null,
    }))
  }, null, 2);
}

export function parseWorkspace(json){
  const raw = JSON.parse(json);
  if (!raw || !Array.isArray(raw.projects)) throw new Error('Invalid workspace file');
  const data = migrateWorkspace(raw);
  return {
    version: data.version,
    activeProjectId: data.activeProjectId || null,
    laneMode: data.laneMode || 'off',
    lanes: Array.isArray(data.lanes) ? data.lanes : [],
    stageRegistry: Array.isArray(data.stageRegistry) ? data.stageRegistry : [],
    projects: data.projects.map(p => ({
      id: p.id || genId('proj-'),
      name: p.name || 'Untitled',
      color: p.color || '#7c3aed',
      created: p.created || todayStr,
      // Defensive normalization of Phase A fields — keeps invariants even if a file
      // came in pre-migrated or hand-edited.
      tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
        const status = normalizeStatus(t.status, t.done);
        return {
          ...t,
          status,
          done: status === 'done',
          tags: Array.isArray(t.tags) ? t.tags : [],
          comments: Array.isArray(t.comments) ? t.comments : [],
          laneId: t.laneId || null,
          stage:  t.stage  || null,
        };
      }),
      baselines: Array.isArray(p.baselines) ? p.baselines : [],
      activeBaselineId: p.activeBaselineId || null,
      owners: (Array.isArray(p.owners) ? p.owners : []).map(o => ({
        ...o,
        calendar: o.calendar || null,
        pto: Array.isArray(o.pto) ? o.pto : [],
        allocationPct: typeof o.allocationPct === 'number' ? o.allocationPct : 100,
      })),
      calendar: p.calendar || {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]},
      autoSchedule: p.autoSchedule || 'cascade',
      tagRegistry: Array.isArray(p.tagRegistry) ? p.tagRegistry : [],
      // Phase B2: saved views are additive — no migration step, just defensive default.
      savedViews: Array.isArray(p.savedViews) ? p.savedViews : [],
    }))
  };
}

// ── Orphan migration ──
// Ensures every non-project task has a parent set. Orphans get reparented to the
// first project task; if none exist, a default "Tasks" set is created.
export function migrateOrphans(projects){
  return projects.map(p => {
    if(!p.tasks?.length) return p;
    const orphans = p.tasks.filter(t => t.kind !== 'project' && !t.parent);
    if(!orphans.length) return p;
    let firstSetId = p.tasks.find(t => t.kind === 'project')?.id;
    let newTasks = p.tasks;
    if(!firstSetId){
      firstSetId = 't-default-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      const start = orphans[0].start || ymd(TODAY);
      const end = orphans.reduce((mx,t) => t.end > mx ? t.end : mx, start);
      newTasks = [{id: firstSetId, kind: 'project', parent: null, title: 'Tasks', start, end, priority: 'p2', progress: 0}, ...newTasks];
    }
    return {...p, tasks: newTasks.map(t => (t.kind !== 'project' && !t.parent) ? {...t, parent: firstSetId} : t)};
  });
}
