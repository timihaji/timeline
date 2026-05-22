import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, Fragment } from 'react';
import Sortable from 'sortablejs';
import './styles/base.css';
import { genId } from './utils/ids.js';
import { shade } from './utils/colors.js';
import { formatCost } from './utils/format.js';
import {
  DAY_MS, DOW, MONTHS, CLOCK_DAYS, DEFAULT_CALENDAR,
  STATUSES, STATUS_META, DEP_TYPES, DEMO_TASKS, CURRENT_VERSION,
} from './data/constants.js';
import { newProject, sampleWorkspace, nextDepType } from './data/schema.js';
import {
  normalizeStatus, syncDoneFromStatus,
  taskChildren, taskHasChildren, taskDescendants, computeSubtaskRollup,
  getEffectiveCalendarForOwner,
  normalizeDep, depList, wouldCreateCycle,
  computeAtRisk, getHealth, getDepChain,
  computeWbsMap, computeTaskCost, computeCostRollup,
  classifyStatus,
} from './data/rollups.js';
import {
  computeCriticalPath, applyDepConstraint, cascadeAfterMove, recomputeSetSpans,
  fullAutoSchedule, computeFloat, detectConflicts, autoStagger, autoSort,
} from './data/scheduling.js';
import {
  MIGRATIONS, migrateWorkspace, serializeWorkspace, parseWorkspace, migrateOrphans,
} from './data/migrations.js';
import {
  INDENT_PX, LANE_PRI_ORDER, LANE_PRI_LABELS, LANE_PRI_COLORS,
  buildRows, buildRowsByProject, buildRowsWithLanes,
} from './data/rows.js';
import { buildArrowPath } from './data/arrows.js';
import { addMonths, expandRecurring } from './data/recurring.js';
import {
  TODAY, ymd, parseYmd, addDays, diffDays, fmtShort, isWeekend, todayStr,
  fmtClock, getCalendar, isWorkingDay, workingDaysBetween, addWorkingDays, formatDuration,
} from './data/dates.js';
import { HelpModal } from './components/HelpModal.jsx';
import { DateField } from './components/DateField.jsx';
import { SearchFilterBar } from './components/SearchFilterBar.jsx';
import { CommandPalette } from './components/CommandPalette.jsx';
import { TemplateInstantiateModal } from './components/TemplateInstantiateModal.jsx';
import { BaselinesPanel } from './components/BaselinesPanel.jsx';
import { ListView } from './components/ListView.jsx';
import { CalendarView } from './components/CalendarView.jsx';
import { Minimap } from './components/Minimap.jsx';
import { FileMenu } from './components/FileMenu.jsx';
import { Topbar } from './components/Topbar.jsx';
import { Inspector } from './components/Inspector.jsx';
import { ModalsHost } from './components/modals/ModalsHost.jsx';
import {
  FSA_AVAILABLE, CURRENT_HANDLE_KEY,
  idbPut, idbGet, idbDel,
} from './persistence/fileSystemPersistence.js';
import { downloadWorkspace } from './persistence/exportImport.js';
import { Header } from './grid/Header.jsx';
import { DepArrows } from './grid/DepArrows.jsx';
import { Bar } from './grid/Bar.jsx';
import { TodayLine, NowCurtain } from './grid/NowCurtain.jsx';
import { useAxis } from './hooks/useAxis.js';

const __TWEAKS_STYLE = `
  /* ── Backdrop + drawer shell ── */
  .set-backdrop{position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.18);
    opacity:0;pointer-events:none;transition:opacity .18s ease}
  .set-backdrop[data-open="1"]{opacity:1;pointer-events:auto}
  .set-drawer{position:fixed;top:0;right:0;bottom:0;width:320px;z-index:2147483646;
    background:var(--surface);color:var(--t1);
    border-left:1px solid var(--border);
    box-shadow:-12px 0 40px rgba(0,0,0,.10);
    font:13px/1.45 var(--font);
    display:flex;flex-direction:column;
    transform:translateX(100%);transition:transform .2s cubic-bezier(.3,.7,.4,1)}
  .set-drawer[data-open="1"]{transform:translateX(0)}
  .set-hd{display:flex;align-items:center;justify-content:space-between;
    height:52px;flex-shrink:0;padding:0 14px 0 18px;border-bottom:1px solid var(--border)}
  .set-hd b{font-size:14px;font-weight:600;letter-spacing:-.01em;color:var(--t1)}
  .set-x{appearance:none;border:0;background:transparent;color:var(--t3);
    width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:18px;line-height:1;
    display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s}
  .set-x:hover{background:var(--surface-2);color:var(--t1)}
  .set-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;
    padding:14px 18px 22px;display:flex;flex-direction:column;gap:14px}
  .set-body::-webkit-scrollbar{width:10px}
  .set-body::-webkit-scrollbar-thumb{background:var(--surface-3);border-radius:99px;
    border:2px solid transparent;background-clip:content-box}
  .set-body::-webkit-scrollbar-thumb:hover{background:var(--t4);background-clip:content-box;border:2px solid transparent}

  /* ── Sections + rows ── */
  .set-sect{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:var(--t3);padding:8px 0 2px}
  .set-sect:first-child{padding-top:0}
  .set-row{display:flex;flex-direction:column;gap:6px}
  .set-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px;min-height:30px}
  .set-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:var(--t2);font-size:12.5px}
  .set-lbl>span:first-child{font-weight:500}
  .set-val{color:var(--t4);font:11px var(--mono);font-variant-numeric:tabular-nums}

  /* ── Inputs / selects ── */
  .set-field{appearance:none;width:100%;height:32px;padding:0 10px;
    border:1px solid var(--border-s);border-radius:8px;
    background:var(--surface-2);color:var(--t1);
    font-family:var(--font);font-size:12.5px;outline:none;
    transition:border-color .12s,box-shadow .12s,background .12s}
  .set-field:focus{border-color:var(--accent-border);background:var(--surface);
    box-shadow:0 0 0 3px var(--accent-dim)}
  select.set-field{padding-right:26px;cursor:pointer;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%236b7280' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 10px center}

  /* ── Slider ── */
  .set-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:8px 0;
    border-radius:999px;background:var(--surface-3);outline:none;cursor:pointer}
  .set-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:16px;height:16px;border-radius:50%;background:var(--accent);
    border:2px solid var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.18);cursor:pointer}
  .set-slider::-moz-range-thumb{width:16px;height:16px;border-radius:50%;
    background:var(--accent);border:2px solid var(--surface);
    box-shadow:0 1px 3px rgba(0,0,0,.18);cursor:pointer}

  /* ── Toggle ── */
  .set-toggle{position:relative;width:34px;height:20px;border:0;border-radius:999px;
    background:var(--surface-3);transition:background .15s;cursor:pointer;padding:0;flex-shrink:0}
  .set-toggle[data-on="1"]{background:var(--accent)}
  .set-toggle i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.18);transition:transform .15s}
  .set-toggle[data-on="1"] i{transform:translateX(14px)}

  /* ── Segmented control ── */
  .set-seg{display:flex;padding:2px;border-radius:8px;background:var(--surface-2);
    border:1px solid var(--border-s);gap:0}
  .set-seg button{flex:1;appearance:none;border:0;background:transparent;
    height:26px;padding:0 10px;border-radius:6px;cursor:pointer;
    font:inherit;font-size:11.5px;font-weight:500;color:var(--t3);
    transition:background .12s,color .12s;white-space:nowrap;line-height:1}
  .set-seg button:hover:not([data-on="1"]){color:var(--t1)}
  .set-seg button[data-on="1"]{background:var(--surface);color:var(--accent);
    box-shadow:0 1px 2px rgba(0,0,0,.08)}

  /* ── Buttons ── */
  .set-btn{appearance:none;height:32px;padding:0 14px;border:1px solid var(--border-s);
    border-radius:8px;background:var(--surface-2);color:var(--t1);
    font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;
    transition:background .12s,border-color .12s}
  .set-btn:hover{background:var(--surface-3)}
  .set-btn.danger{background:transparent;color:var(--p1);border-color:var(--border-s)}
  .set-btn.danger:hover{background:var(--surface-2);border-color:var(--p1)}
  .set-btn.block{width:100%;justify-content:center;display:flex;align-items:center}

  /* ── Day-of-week toggle buttons + holidays ── */
  .set-dow-row{display:flex;gap:4px;flex-wrap:wrap}
  .set-dow-btn{appearance:none;height:28px;min-width:36px;padding:0 8px;
    border:1px solid var(--border-s);border-radius:6px;
    background:var(--surface-2);color:var(--t3);
    font:inherit;font-size:10.5px;font-weight:600;letter-spacing:.02em;cursor:pointer;
    transition:background .12s,color .12s,border-color .12s}
  .set-dow-btn:hover{color:var(--t1)}
  .set-dow-btn[data-on="1"]{background:var(--accent-dim);color:var(--accent);
    border-color:var(--accent-border)}
  .set-holidays{display:flex;flex-direction:column;gap:6px}
  .set-holiday-row{display:flex;gap:6px;align-items:center}
  .set-holiday-row .set-field{flex:1}
  .set-holiday-del{appearance:none;width:30px;height:30px;flex-shrink:0;
    border:1px solid var(--border-s);border-radius:8px;background:var(--surface-2);
    color:var(--t3);font-size:15px;line-height:1;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    transition:background .12s,color .12s,border-color .12s}
  .set-holiday-del:hover{color:var(--p1);border-color:var(--p1)}
  .set-holiday-add{appearance:none;height:30px;padding:0 12px;
    border:1px dashed var(--border-s);border-radius:8px;
    background:transparent;color:var(--t3);
    font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;
    transition:background .12s,color .12s,border-color .12s}
  .set-holiday-add:hover{color:var(--accent);border-color:var(--accent-border);
    background:var(--accent-dim)}
`;

const TIMELINE_TWK_KEY = 'timeline-tweaks-v1';

function useTweaks(defaults) {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(TIMELINE_TWK_KEY)) || {}; }
    catch(e) { return {}; }
  })();
  const [values, setValues] = React.useState({...defaults, ...stored});
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => {
      const next = { ...prev, ...edits };
      try { localStorage.setItem(TIMELINE_TWK_KEY, JSON.stringify(next)); } catch(e) {}
      return next;
    });
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

function TweaksPanel({ title = 'Settings', children }) {
  const [open, setOpen] = React.useState(false);
  // Toggle/activate/deactivate protocol + Cmd/Ctrl+, shortcut all funnel through
  // setOpen — duplicate activate messages are no-ops.
  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
      else if (t === '__toggle_edit_mode') setOpen((o) => !o);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      // Cmd/Ctrl+, toggles regardless of open state.
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Escape only when open, and not when something else has focus that
      // needs Esc (a contenteditable, an open <select>, etc.). For simplicity
      // we let Esc always close — the drawer is the most recently opened
      // overlay so closing it first is the natural behaviour.
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = () => setOpen(false);

  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div className="set-backdrop" data-open={open ? '1' : '0'} onClick={dismiss} aria-hidden="true" />
      <aside className="set-drawer" data-open={open ? '1' : '0'} role="dialog" aria-label={title} aria-hidden={!open}>
        <div className="set-hd">
          <b>{title}</b>
          <button className="set-x" aria-label="Close settings" onClick={dismiss}>×</button>
        </div>
        <div className="set-body">{open ? children : null}</div>
      </aside>
    </>
  );
}

function TweakSection({ title, label, children }) {
  return (<><div className="set-sect">{title ?? label}</div>{children}</>);
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'set-row set-row-h' : 'set-row'}>
      <div className="set-lbl"><span>{label}</span>{value != null && <span className="set-val">{value}</span>}</div>
      {children}
    </div>
  );
}

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="set-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="set-row set-row-h">
      <div className="set-lbl"><span>{label}</span></div>
      <button type="button" className="set-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value} onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="set-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

// Segmented radio. Used for theme/bar-style/label-position pickers.
function TweakRadio({ label, value, options, onChange }) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  return (
    <TweakRow label={label}>
      <div className="set-seg" role="radiogroup" aria-label={label}>
        {opts.map((o) => (
          <button key={String(o.value)} type="button" role="radio"
                  aria-checked={o.value === value}
                  data-on={o.value === value ? '1' : '0'}
                  onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, danger = false, block = false }) {
  const cls = ['set-btn'];
  if (danger) cls.push('danger');
  if (block) cls.push('block');
  return (<button type="button" className={cls.join(' ')} onClick={onClick}>{label}</button>);
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakSelect, TweakRadio, TweakButton,
});
// Date helpers moved to src/data/dates.js
// (ymd, parseYmd, addDays, diffDays, fmtShort, isWeekend, TODAY, todayStr, fmtClock,
//  getCalendar, isWorkingDay, workingDaysBetween, addWorkingDays, formatDuration)

// DEMO_TASKS moved to src/data/constants.js

// ── Workspace helpers ──
// genId moved to src/utils/ids.js

// newProject, sampleWorkspace moved to src/data/schema.js

// ── Status enum (Phase A2) ──
// Single source of truth for task status. `done` boolean is kept as a
// derived/synced field for back-compat with existing renderers — see syncDoneFromStatus
// and syncStatusFromDone helpers below.
// STATUSES, STATUS_META moved to src/data/constants.js
// normalizeStatus, syncDoneFromStatus moved to src/data/rollups.js

// CURRENT_VERSION moved to src/data/constants.js
// Migration definitions + workspace IO moved to src/data/migrations.js
// (MIGRATIONS, migrateWorkspace, serializeWorkspace, parseWorkspace, migrateOrphans)

// Row building moved to src/data/rows.js
// (INDENT_PX, LANE_PRI_ORDER, LANE_PRI_LABELS, LANE_PRI_COLORS,
//  buildRows, buildRowsByProject, buildRowsWithLanes)

// ── Subtask helpers (Phase A1) ──
// All derived — no stored summary flag. A task is a "summary" iff some other
// task names it as parent. Roll-ups aggregate descendant leaves so renderers and
// inspectors can show summary start/end/progress/cost without mutating data.
// Subtask + dep + cycle helpers moved to src/data/rollups.js
// (taskChildren, taskHasChildren, taskDescendants, computeSubtaskRollup,
//  getEffectiveCalendarForOwner, normalizeDep, depList, wouldCreateCycle)

// Scheduling primitives moved to src/data/scheduling.js
// (computeCriticalPath, applyDepConstraint, cascadeAfterMove, recomputeSetSpans,
//  fullAutoSchedule, computeFloat, detectConflicts, autoStagger, autoSort)

// buildArrowPath moved to src/data/arrows.js

// shade moved to src/utils/colors.js

// computeWbsMap, computeTaskCost, computeCostRollup moved to src/data/rollups.js

// formatCost moved to src/utils/format.js

// addMonths, expandRecurring moved to src/data/recurring.js

// ── Project template helpers (localStorage-backed, cross-workspace) ──
const TEMPLATES_KEY = 'timeline-templates-v1';

function loadTemplates(){
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.templates)) return [];
    return obj.templates;
  } catch(_){
    return [];
  }
}

function saveTemplates(arr){
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify({ templates: arr }));
    return true;
  } catch(e){
    return false;
  }
}

// Sanitize a project record into a template. Strips volatile fields, replaces
// IDs with stable index-based slugs (t1, t2, …) and re-anchors all task dates
// so the earliest task starts on a fixed reference day (2000-01-01). On
// instantiation the user picks a start date and we re-offset forward.
const TEMPLATE_ANCHOR = '2000-01-01';

function sanitizeForTemplate(project){
  if (!project) return null;
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  // Find earliest start
  let earliest = null;
  for (const t of tasks){
    if (!t.start) continue;
    if (earliest == null || t.start < earliest) earliest = t.start;
  }
  const anchor = earliest || TEMPLATE_ANCHOR;
  const offset = diffDays(anchor, TEMPLATE_ANCHOR); // days to add
  // Build id->slug map (project tasks get tN, projects pN)
  const idMap = new Map();
  let pCnt = 1, tCnt = 1;
  for (const t of tasks){
    if (t.kind === 'project') idMap.set(t.id, 'p' + (pCnt++));
    else idMap.set(t.id, 't' + (tCnt++));
  }
  const slugTasks = tasks.map(t => {
    const newId = idMap.get(t.id) || t.id;
    const newParent = t.parent ? (idMap.get(t.parent) || null) : null;
    const newDeps = (t.deps || []).map(d => {
      const nd = normalizeDep(d);
      if (!nd) return null;
      const mapped = idMap.get(nd.id);
      if (!mapped) return null; // skip dangling
      return {...nd, id: mapped};
    }).filter(Boolean);
    // Re-anchor dates
    const newStart = t.start ? addDays(t.start, offset) : t.start;
    const newEnd   = t.end   ? addDays(t.end,   offset) : t.end;
    const clean = {...t, id: newId, parent: newParent, deps: newDeps, start: newStart, end: newEnd};
    // Strip volatile/derived fields
    delete clean.baselineEnd;
    return clean;
  });
  return {
    name: project.name || 'Untitled',
    color: project.color || '#7c3aed',
    tasks: slugTasks,
    owners: (project.owners || []).map(o => ({...o})),
    calendar: project.calendar ? {
      workingDays: [...(project.calendar.workingDays || DEFAULT_CALENDAR.workingDays)],
      holidays: [...(project.calendar.holidays || [])],
    } : {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]},
    autoSchedule: project.autoSchedule || 'cascade',
  };
}

// Instantiate: clone sanitized template, regenerate IDs, offset dates from
// TEMPLATE_ANCHOR forward to user-picked startDate.
function instantiateTemplate(template, name, startDate){
  const src = template.project;
  if (!src) return null;
  const tasks = Array.isArray(src.tasks) ? src.tasks : [];
  const offset = diffDays(TEMPLATE_ANCHOR, startDate);
  // Build slug -> fresh id map
  const idMap = new Map();
  for (const t of tasks){
    const prefix = t.kind === 'project' ? 'p' : 't';
    idMap.set(t.id, prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  }
  const newTasks = tasks.map(t => {
    const newId = idMap.get(t.id) || t.id;
    const newParent = t.parent ? (idMap.get(t.parent) || null) : null;
    const newDeps = (t.deps || []).map(d => {
      const nd = normalizeDep(d);
      if (!nd) return null;
      const mapped = idMap.get(nd.id);
      if (!mapped) return null;
      return {...nd, id: mapped};
    }).filter(Boolean);
    const newStart = t.start ? addDays(t.start, offset) : t.start;
    const newEnd   = t.end   ? addDays(t.end,   offset) : t.end;
    return {...t, id: newId, parent: newParent, deps: newDeps, start: newStart, end: newEnd};
  });
  return {
    id: genId('proj-'),
    name: name || src.name || 'New project',
    color: src.color || '#7c3aed',
    created: todayStr,
    baselines: [], activeBaselineId: null,
    tasks: newTasks,
    owners: (src.owners || []).map(o => ({...o})),
    calendar: src.calendar ? {
      workingDays: [...(src.calendar.workingDays || DEFAULT_CALENDAR.workingDays)],
      holidays: [...(src.calendar.holidays || [])],
    } : {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]},
    autoSchedule: src.autoSchedule || 'cascade',
  };
}

Object.assign(window,{
  DAY_MS,TODAY,todayStr,
  ymd,parseYmd,addDays,diffDays,fmtShort,isWeekend,
  DOW,MONTHS,DEMO_TASKS,
  DEFAULT_CALENDAR, isWorkingDay, workingDaysBetween, addWorkingDays, formatDuration,
  normalizeDep, depList,
  buildRows,buildRowsByProject,buildRowsWithLanes,migrateOrphans,
  computeCriticalPath,computeAtRisk,getHealth,getDepChain,
  cascadeAfterMove,fullAutoSchedule,computeFloat,detectConflicts,autoStagger,
  buildArrowPath,shade,
  genId, newProject, sampleWorkspace, serializeWorkspace, parseWorkspace,
  CURRENT_VERSION, MIGRATIONS, migrateWorkspace,
  STATUSES, STATUS_META, normalizeStatus, syncDoneFromStatus,
  taskChildren, taskHasChildren, taskDescendants, computeSubtaskRollup,
  getEffectiveCalendarForOwner,
  computeWbsMap, computeTaskCost, computeCostRollup, formatCost,
  addMonths, expandRecurring,
  loadTemplates, saveTemplates, sanitizeForTemplate, instantiateTemplate,
});
// (consolidated React import at top of module)
// Minimap moved to src/components/Minimap.jsx

const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function GanttTweaks({ tw, setTweak, activeProject, updateActiveProject, customConfirm,
  laneMode, lanes, stageRegistry, setLaneMode, setLanes, setStageRegistry, setLaneCollapsed, setDirty }){
  if(!window.TweaksPanel) return null;
  const { TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakSelect, TweakRadio, TweakButton } = window;
  const DEFAULT_CAL = window.DEFAULT_CALENDAR;
  const calendar = activeProject?.calendar ?? DEFAULT_CAL;
  const workingDays = Array.isArray(calendar.workingDays) ? calendar.workingDays : DEFAULT_CAL.workingDays;
  const holidays = Array.isArray(calendar.holidays) ? calendar.holidays : [];
  const autoSchedule = activeProject?.autoSchedule || 'cascade';

  const toggleDow = (d) => {
    if (!activeProject) return;
    const has = workingDays.includes(d);
    const nx = has ? workingDays.filter(x=>x!==d) : [...workingDays, d].sort((a,b)=>a-b);
    updateActiveProject({ calendar: { workingDays: nx, holidays } });
  };
  const setHolidayAt = (idx, val) => {
    if (!activeProject) return;
    const nx = [...holidays];
    if (val) nx[idx] = val; else nx.splice(idx, 1);
    updateActiveProject({ calendar: { workingDays, holidays: nx } });
  };
  const addHoliday = () => {
    if (!activeProject) return;
    const today = new Date().toISOString().slice(0,10);
    updateActiveProject({ calendar: { workingDays, holidays: [...holidays, today] } });
  };
  const setAutoSchedule = (v) => {
    if (!activeProject) return;
    updateActiveProject({ autoSchedule: v });
  };

  const onReset = async () => {
    const ok = customConfirm
      ? await customConfirm(
          'Reset everything?',
          'This will erase all projects, tasks, layouts, and preferences from this browser. This cannot be undone.',
          { destructive: true, okLabel: 'Reset everything', cancelLabel: 'Cancel' }
        )
      : window.confirm('Reset everything? This wipes all data from this browser. Cannot be undone.');
    if (!ok) return;
    try { localStorage.clear(); } catch(e) {}
    location.reload();
  };

  return (
    <TweaksPanel title="Settings">
      <TweakSection title="Timeline">
        <TweakSlider label="Row height" value={tw.rowHeight} min={26} max={60} step={2}
          onChange={v=>setTweak('rowHeight',v)} unit="px"/>
      </TweakSection>

      <TweakSection title="Lanes">
        <TweakSelect label="Mode" value={laneMode}
          options={[
            {value:'off',      label:'Off (no lanes)'},
            {value:'owner',    label:'By owner'},
            {value:'status',   label:'By status'},
            {value:'priority', label:'By priority'},
            {value:'stage',    label:'By stage'},
            {value:'manual',   label:'Manual (named lanes)'},
          ]}
          onChange={v=>{ setLaneMode(v); setLaneCollapsed(new Set()); setDirty(true); }}/>

        {/* Stage editor — visible when mode is 'stage' */}
        {laneMode==='stage'&&(
          <div className="lane-stage-editor">
            <div className="lse-title">Stages (workspace-wide)</div>
            {stageRegistry.map((s,idx)=>(
              <div key={s.id} className="lse-row">
                <span className="lse-handle">&#9776;</span>
                <input className="lse-input" value={s.name}
                  onChange={e=>{
                    const v=e.target.value;
                    setStageRegistry(prev=>prev.map((x,i)=>i===idx?{...x,name:v}:x));
                    setDirty(true);
                  }}/>
                <button className="lse-del" title="Delete stage" onClick={()=>{
                  setStageRegistry(prev=>prev.filter((_,i)=>i!==idx));
                  setDirty(true);
                }}>×</button>
              </div>
            ))}
            <button className="lse-add" onClick={()=>{
              const id=genId('stage-');
              setStageRegistry(prev=>[...prev,{id,name:'New stage',order:prev.length}]);
              setDirty(true);
            }}>+ Add stage</button>
          </div>
        )}

        {/* Manual lane manager — visible when mode is 'manual' */}
        {laneMode==='manual'&&(
          <div className="lane-stage-editor">
            <div className="lse-title">Lanes (workspace-wide)</div>
            {lanes.map((ln,idx)=>(
              <div key={ln.id} className="lse-row">
                <input type="color" className="lse-color" value={ln.color||'#94a3b8'}
                  onChange={e=>{
                    const c=e.target.value;
                    setLanes(prev=>prev.map((x,i)=>i===idx?{...x,color:c}:x));
                    setDirty(true);
                  }}/>
                <input className="lse-input" value={ln.name}
                  onChange={e=>{
                    const v=e.target.value;
                    setLanes(prev=>prev.map((x,i)=>i===idx?{...x,name:v}:x));
                    setDirty(true);
                  }}/>
                <button className="lse-del" title="Delete lane" onClick={()=>{
                  setLanes(prev=>prev.filter((_,i)=>i!==idx));
                  setDirty(true);
                }}>×</button>
              </div>
            ))}
            <button className="lse-add" onClick={()=>{
              const id=genId('lane-');
              const colors=['#96c6e8','#b2e0ac','#f5dc88','#f5bad0','#c4b5fd','#fca5a5','#6ee7b7'];
              const color=colors[lanes.length%colors.length];
              setLanes(prev=>[...prev,{id,name:'New lane',color,order:prev.length}]);
              setDirty(true);
            }}>+ Add lane</button>
          </div>
        )}
      </TweakSection>

      <TweakSection title="Overlays">
        <TweakToggle label="Critical path"          value={!!tw.showCritical}          onChange={v=>setTweak('showCritical',v)}/>
        <TweakToggle label="Milestone lines"         value={!tw.hideMilestoneLines}    onChange={v=>setTweak('hideMilestoneLines',!v)}/>
        <TweakToggle label="Float / slack ghosts"   value={!!tw.showFloat}            onChange={v=>setTweak('showFloat',v)}/>
        <TweakToggle label="PERT probability tails" value={!!tw.showProbBars}         onChange={v=>setTweak('showProbBars',v)}/>
        <TweakToggle label="Now curtain"            value={tw.showNowCurtain!==false} onChange={v=>setTweak('showNowCurtain',v)}/>
        <TweakToggle label="Minimap strip"          value={tw.showMinimap!==false}    onChange={v=>setTweak('showMinimap',v)}/>
        <TweakToggle label="Owner badges"           value={tw.showOwners!==false}     onChange={v=>setTweak('showOwners',v)}/>
        <TweakToggle label="Conflict highlights"    value={tw.showConflicts!==false}  onChange={v=>setTweak('showConflicts',v)}/>
        <TweakRadio  label="Label position"         value={tw.labelPos||'auto'}
          options={[{value:'auto',label:'Auto'},{value:'inside',label:'Inside'},{value:'outside',label:'Next to'},{value:'both',label:'Both'}]}
          onChange={v=>setTweak('labelPos',v)}/>
        <TweakToggle label="Clock"                  value={tw.showClock!==false}      onChange={v=>setTweak('showClock',v)}/>
        <TweakToggle label="Today-line tracks time" value={tw.todayLineLive!==false}  onChange={v=>setTweak('todayLineLive',v)}/>
      </TweakSection>

      <TweakSection title="Grid">
        <TweakToggle label="Weekend shading"   value={tw.showWeekends!==false} onChange={v=>setTweak('showWeekends',v)}/>
        <TweakToggle label="Show dependencies" value={tw.showDeps!==false}     onChange={v=>setTweak('showDeps',v)}/>
        <TweakToggle label="Show all dep arrows" value={!!tw.showAllDeps}      onChange={v=>setTweak('showAllDeps',v)}/>
        <TweakToggle label="Compact bars"      value={!!tw.compactBars}        onChange={v=>setTweak('compactBars',v)}/>
        <TweakToggle label="Pill bars"         value={!!tw.pillBars}           onChange={v=>setTweak('pillBars',v)}/>
        <TweakToggle label="Hide completed tasks" value={!!tw.hideDone}        onChange={v=>setTweak('hideDone',v)}/>
        <TweakToggle label="Snap to day"       value={tw.snapToDay!==false}    onChange={v=>setTweak('snapToDay',v)}/>
        {activeProject && (
          <div className="set-row">
            <div className="set-lbl"><span>Auto-schedule</span></div>
            <select className="set-field" value={autoSchedule} onChange={e=>setAutoSchedule(e.target.value)}>
              <option value="cascade">Cascade direct dependents</option>
              <option value="off">Off (manual)</option>
              <option value="full">Full auto-schedule</option>
            </select>
          </div>
        )}
      </TweakSection>

      {activeProject && (
        <TweakSection title="Active calendar">
          <div className="set-row">
            <div className="set-lbl"><span>Working days</span></div>
            <div className="set-dow-row">
              {DOW_LABELS.map((lbl,i)=>{
                const on = workingDays.includes(i);
                return (
                  <button key={i} type="button" className="set-dow-btn"
                          data-on={on?'1':'0'}
                          onClick={()=>toggleDow(i)}>{lbl}</button>
                );
              })}
            </div>
          </div>
          <div className="set-row">
            <div className="set-lbl"><span>Holidays</span><span className="set-val">{holidays.length}</span></div>
            <div className="set-holidays">
              {holidays.map((h, idx)=>(
                <div key={idx} className="set-holiday-row">
                  <input type="date" className="set-field" value={h||''}
                    onChange={e=>setHolidayAt(idx, e.target.value)}/>
                  <button type="button" className="set-holiday-del"
                    aria-label="Remove holiday"
                    onClick={()=>setHolidayAt(idx, '')}>×</button>
                </div>
              ))}
              <button type="button" className="set-holiday-add" onClick={addHoliday}>+ add holiday</button>
            </div>
          </div>
        </TweakSection>
      )}

      <TweakSection title="Appearance">
        <TweakRadio label="Theme" value={tw.theme||'things'}
          options={[{value:'things',label:'Light'},{value:'dark',label:'Dark'}]}
          onChange={v=>setTweak('theme',v)}/>
      </TweakSection>

      <TweakSection title="Reset">
        <TweakButton label="Reset everything" danger block onClick={onReset}/>
      </TweakSection>
    </TweaksPanel>
  );
}

Object.assign(window,{ GanttTweaks });
// classifyStatus moved to src/data/rollups.js
// Window-alias destructure removed: all consumers (ListView, CalendarView, Minimap, SearchFilterBar)
// have been extracted to src/components/ and use direct imports from src/data/*.

// ── Search / Filter Bar ───────────────────────────────────────────
// SearchFilterBar moved to src/components/SearchFilterBar.jsx

// ── List View ─────────────────────────────────────────────────────
// ListView moved to src/components/ListView.jsx

// ── Calendar View ─────────────────────────────────────────────────
// CalendarView moved to src/components/CalendarView.jsx

Object.assign(window, { SearchFilterBar, ListView, CalendarView, classifyStatus });
// (cross-script re-imports collapsed — symbols are in same-module scope after consolidation)

// DEP_TYPES moved to src/data/constants.js
// nextDepType moved to src/data/schema.js

// Color presets for inspector swatch grid (8 Things-3 pastels — light but chromatic, clear hues)
// red, orange, yellow, green, teal, blue, purple, pink
const COLOR_PRESETS = ['#f9a8a8','#fac89a','#f5dc88','#b2e0ac','#9dd8d5','#96c6e8','#c3b2e8','#f5bad0'];

// FSA_AVAILABLE + IDB helpers moved to src/persistence/fileSystemPersistence.js

// Small modal: instantiate a template — collects name + start date.
// TemplateInstantiateModal moved to src/components/TemplateInstantiateModal.jsx

// Baselines panel — full CRUD for named baseline snapshots.
// BaselinesPanel moved to src/components/BaselinesPanel.jsx

// Batch 5: Keyboard shortcut help overlay. Categorised list of shortcuts.
// HelpModal moved to src/components/HelpModal.jsx

// ── Phase B1: Command palette ──
// Generic palette over an action registry. Each command: {id,label,group,shortcut?,keywords?,run}.
// Filters by case-insensitive substring against label + group + keywords. Arrow keys / Enter / Esc.
// Mouse + keyboard share the active index so hover and arrow nav agree.
// CommandPalette moved to src/components/CommandPalette.jsx

// ── DateField (DD/MM/YYYY text input + inline calendar) ──
// DateField moved to src/components/DateField.jsx (helpers isoToDDMMYYYY/parseDDMMYYYY inlined there)

function App(){
  const tweakRes = window.useTweaks ? window.useTweaks(window.__TWEAK_DEFAULTS) : [window.__TWEAK_DEFAULTS,()=>{}];
  const tw = tweakRes[0], setTweak = tweakRes[1];

  // Mirror theme tweak to document.body so CSS keys off body[data-theme] updates live.
  React.useEffect(() => {
    const t = tw.theme;
    if (t == null || t === '') delete document.body.dataset.theme;
    else document.body.dataset.theme = t;
  }, [tw.theme]);

  // ── Workspace state ──
  const [projects,        setProjects]        = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [fileHandle,      setFileHandle]      = useState(null);
  const [dirty,           setDirty]           = useState(false);
  const [showWelcome,     setShowWelcome]     = useState(true);
  const [projectPanelOpen,setProjectPanelOpen]= useState(true);
  const [fileMenuOpen,    setFileMenuOpen]    = useState(false);
  const [projCtxMenu,     setProjCtxMenu]     = useState(null);  // {x,y,projectId}
  const [projRenaming,    setProjRenaming]    = useState(null);  // {id,value}
  const [groupCtxMenu,    setGroupCtxMenu]    = useState(null);  // {x,y,groupId,kind:'project'|'owner',title}
  const [groupRenaming,   setGroupRenaming]   = useState(null);  // {id,kind,value}
  const [onboardDismissed,setOnboardDismissed]= useState(()=>{ try{ return !!localStorage.getItem('onboardingHintDismissed'); }catch(e){ return false; } });
  const [markDonePrompt,  setMarkDonePrompt]  = useState(null);  // taskId currently prompted
  const markDonePromptTimerRef = useRef(null);
  const [sortToast,       setSortToast]       = useState(null);  // {prevTasks} | null
  const sortToastTimerRef = useRef(null);

  // ── Lanes state (workspace-root-level, persisted in workspace file) ──
  const [laneMode,       setLaneMode]       = useState('off');
  const [lanes,          setLanes]          = useState([]);
  const [stageRegistry,  setStageRegistry]  = useState([]);
  // Lane collapse is ephemeral (not persisted) — same pattern as task collapse.
  const [laneCollapsed,  setLaneCollapsed]  = useState(new Set());

  // Stable refs so callbacks (saveWorkspace, autosave) always read latest values
  // without needing to be recreated on every lane state change.
  const laneModeRef      = useRef('off');       laneModeRef.current      = laneMode;
  const lanesRef         = useRef([]);          lanesRef.current         = lanes;
  const stageRegistryRef = useRef([]);          stageRegistryRef.current = stageRegistry;

  // ── Core editing state ──
  const [collapsed,   setCollapsed]   = useState(new Set());
  const [selected,    setSelected]    = useState(null);
  const [selectedSet, setSelectedSet] = useState(new Set());
  // Anchor row for Shift+click range selection (Finder/Excel convention).
  // Seeded on plain click + Ctrl/Cmd-click; Shift+click never moves it.
  const selAnchorRef  = useRef(null);
  // Live mirrors so Sortable callbacks (registered once, deps=[]) can read current values
  // without forcing a Sortable re-init on every selection / groupBy change.
  const selectedSetRef = useRef(selectedSet); selectedSetRef.current = selectedSet;
  const [hoverRow,    setHoverRow]    = useState(null);
  const [hoveredBarId,setHoveredBarId]= useState(null);
  const [drag,        setDrag]        = useState(null);
  const [lasso,       setLasso]       = useState(null);
  const [snapInfo,    setSnapInfo]    = useState(null);
  const [renaming,    setRenaming]    = useState(null);
  const [durationBuf, setDurationBuf] = useState('');
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [focusChain,  setFocusChain]  = useState(null);
  const [toasts,      setToasts]      = useState([]);
  const [predPicker,  setPredPicker]  = useState(null); // {taskId, anchor:{x,y}}
  const [predFilter,  setPredFilter]  = useState('');
  const [hoveredDepEdge, setHoveredDepEdge] = useState(null); // {fromId,toId} or null

  // Bulk-op picker: {x,y,kind:'owner'|'color'|'priority', ids:Set}
  const [bulkPicker,  setBulkPicker]  = useState(null);
  // Inspector disclosure state (per-task) — uses session-local Set
  const [insOpen,     setInsOpen]     = useState({notes:false, links:false, custom:false});

  // Inspector drawer ref (slide-in panel, used by click-away handler)
  const drawerRef = useRef(null);
  // When pinned, drawer ignores Esc and click-away — stays open until × is clicked or another bar swaps it
  const [drawerPinned, setDrawerPinned] = useState(false);
  // Cross-cut clipboard: deep-cloned task objects (Copy/Paste menu items)
  const [clipboard, setClipboard]     = useState(null);
  // Right-click on empty grid: {x,y,day,rowIdx}
  const [gridCtxMenu, setGridCtxMenu] = useState(null);
  // Right-click on dependency arrow: {x,y,fromId,toId}
  const [depCtxMenu,  setDepCtxMenu]  = useState(null);
  // Nested ctx submenu: {x,y,kind:'duration'|'move'|'jump-pred'|'jump-dep'|'depType', taskId?, dep?}
  const [ctxSubmenu,  setCtxSubmenu]  = useState(null);

  // ── Batch 4: filter + view state ──
  const [filter, setFilter] = useState({
    q: '', owners: new Set(), priorities: new Set(), status: 'all'
  });
  // Debounced text for the search input — fires 150ms after typing stops.
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filter.q), 150);
    return () => clearTimeout(id);
  }, [filter.q]);

  // Live clock + today-line tick — fires at each minute boundary
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const align = 60000 - (Date.now() % 60000);
    let interval;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60000);
    }, align);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);
  // View mode persisted in tweaks
  const viewMode = tw.viewMode === 'list' || tw.viewMode === 'calendar' ? tw.viewMode : 'gantt';
  const setViewMode = useCallback((mode) => { setTweak('viewMode', mode); }, [setTweak]);

  // ── Recurrence editor popover: {taskId, draft:{pattern,interval,count}}
  const [recurEditor, setRecurEditor] = useState(null);
  // ── Batch 5: keyboard help overlay
  const [helpOpen, setHelpOpen] = useState(false);
  // ── Baselines panel
  const [baselinesOpen, setBaselinesOpen] = useState(false);
  // ── Phase B1: command palette (Cmd/Ctrl+K)
  const [paletteOpen, setPaletteOpen] = useState(false);
  // ── Phase B2: saved views dropdown open/closed
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  // ── Templates ──
  const [templates,   setTemplates]   = useState(() => loadTemplates());
  // ── Template modal: 'pick' | 'manage' | {kind:'instantiate', template} | null
  const [tmplModal,   setTmplModal]   = useState(null);
  // ── File menu Templates submenu
  const [fileTmplSubOpen, setFileTmplSubOpen] = useState(false);
  const [fileRecentSubOpen, setFileRecentSubOpen] = useState(false);

  // ── Recent files ──
  const RECENTS_KEY = 'timeline-recents-v1';
  const RECENTS_MAX = 8;
  const [recents, setRecents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; } catch(_) { return []; }
  });
  const persistRecents = useCallback((next) => {
    setRecents(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch(_) {}
  }, []);
  const pushRecent = useCallback(async (name, handle) => {
    const id = crypto.randomUUID();
    const entry = { id, name, savedAt: Date.now(), hasHandle: !!handle };
    const prev = recents.filter(e => e.name !== name);
    const next = [entry, ...prev].slice(0, RECENTS_MAX);
    // Drop IDB handles for evicted entries
    const evicted = prev.slice(RECENTS_MAX - 1);
    for (const ev of evicted) { if (ev.hasHandle) idbDel(ev.id); }
    if (handle) { try { await idbPut(id, handle); } catch(_) {} }
    persistRecents(next);
  }, [recents, persistRecents]);
  const removeRecent = useCallback(async (id) => {
    const entry = recents.find(e => e.id === id);
    if (entry && entry.hasHandle) { try { await idbDel(id); } catch(_) {} }
    persistRecents(recents.filter(e => e.id !== id));
  }, [recents, persistRecents]);

  const [modal, setModal] = useState(null); // {type,title,body,defaultValue,destructive,okLabel,cancelLabel}
  const modalResolverRef = useRef(null);
  const modalInputRef = useRef(null);

  const closeModal = useCallback((value) => {
    if(modalResolverRef.current){ modalResolverRef.current(value); modalResolverRef.current=null; }
    setModal(null);
  },[]);
  const customPrompt = useCallback((title, defaultValue='', body='') => new Promise(resolve=>{
    modalResolverRef.current=resolve;
    setModal({type:'prompt',title,body,defaultValue,okLabel:'OK',cancelLabel:'Cancel'});
  }),[]);
  const customConfirm = useCallback((title, body='', {destructive=false,okLabel='OK',cancelLabel='Cancel'}={}) => new Promise(resolve=>{
    modalResolverRef.current=resolve;
    setModal({type:'confirm',title,body,destructive,okLabel,cancelLabel});
  }),[]);
  const customAlert = useCallback((title, body='') => new Promise(resolve=>{
    modalResolverRef.current=resolve;
    setModal({type:'alert',title,body,okLabel:'OK'});
  }),[]);

  const refreshTemplates = useCallback(() => {
    setTemplates(loadTemplates());
  }, []);

  // Persist templates to localStorage and re-sync state.
  const persistTemplates = useCallback((arr) => {
    saveTemplates(arr);
    setTemplates(arr);
  }, []);

  // ── Derived: active project ──
  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const tasks           = activeProject?.tasks ?? [];
  const baselines       = activeProject?.baselines ?? [];
  const activeBaselineId = activeProject?.activeBaselineId ?? null;
  const activeBaseline  = baselines.find(b => b.id === activeBaselineId) ?? null;
  const calendar = activeProject?.calendar ?? DEFAULT_CALENDAR;
  const autoSchedule = activeProject?.autoSchedule ?? 'cascade';

  // Apply scheduling mode after a move. The 'cascade' mode is the default
  // (downstream direct dependents shift). 'off' skips it entirely. 'full' runs
  // a forward pass over the whole dep DAG.
  const applySchedule = useCallback((ts, movedId) => {
    if (autoSchedule === 'off') return recomputeSetSpans(ts);
    if (autoSchedule === 'full') return recomputeSetSpans(fullAutoSchedule(ts, calendar));
    return recomputeSetSpans(cascadeAfterMove(ts, movedId, calendar));
  }, [autoSchedule, calendar]);

  // ── Tweak aliases ──
  const dayW           = tw.dayWidth  || 36;
  const rowH           = tw.rowHeight || 34;
  // laneMode is now workspace-level state (not a tweak); groupBy alias removed.
  const showFloat           = !!tw.showFloat;
  const showCritical        = !!tw.showCritical;
  const hideMilestoneLines  = !!tw.hideMilestoneLines;
  const showProbBars   = !!tw.showProbBars;
  const showNowCurtain = !!tw.showNowCurtain;
  const showOwners     = tw.showOwners     !== false;
  const showConflicts  = tw.showConflicts  !== false;
  const showMinimap    = tw.showMinimap    !== false;
  const labelPos       = tw.labelPos      || 'auto';
  const showAllDeps    = !!tw.showAllDeps;

  // ── Toast notifications ──
  const showToast = React.useCallback((msg, kind='info', ms=3200)=>{
    const id = Date.now() + Math.random();
    setToasts(q => [...q, {id, msg, kind}]);
    setTimeout(()=>setToasts(q=>q.filter(t=>t.id!==id)), ms);
  },[]);
  // Expose globally so pure functions (fullAutoSchedule) can call it
  React.useEffect(()=>{ window.__showToast = showToast; return ()=>{ delete window.__showToast; }; },[showToast]);

  // ── CSS vars ──
  useLayoutEffect(()=>{
    document.documentElement.style.setProperty('--col-w', dayW+'px');
    document.documentElement.style.setProperty('--row-h', rowH+'px');
  },[dayW,rowH]);

  // ── Undo / redo + mutation helpers ──
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const UNDO_CAP = 100;
  const [undoTick, setUndoTick] = useState(0);

  const commitMutation = useCallback((label, mutator) => {
    setProjects(prev => {
      const next = mutator(prev);
      if (next === prev) return prev;
      undoStackRef.current.push({label, projects: prev});
      if (undoStackRef.current.length > UNDO_CAP) undoStackRef.current.shift();
      redoStackRef.current = [];
      return next;
    });
    setDirty(true);
    setUndoTick(t => t + 1);
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current.pop();
    setProjects(cur => {
      redoStackRef.current.push({label: entry.label, projects: cur});
      if (redoStackRef.current.length > UNDO_CAP) redoStackRef.current.shift();
      return entry.projects;
    });
    setDirty(true);
    setUndoTick(t => t + 1);
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current.pop();
    setProjects(cur => {
      undoStackRef.current.push({label: entry.label, projects: cur});
      if (undoStackRef.current.length > UNDO_CAP) undoStackRef.current.shift();
      return entry.projects;
    });
    setDirty(true);
    setUndoTick(t => t + 1);
  }, []);

  const resetUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoTick(t => t + 1);
  }, []);

  const updateTasks = useCallback((fn) => {
    commitMutation('edit tasks', ps => ps.map(p => p.id === activeProjectId ? {...p, tasks: fn(p.tasks)} : p));
  }, [activeProjectId, commitMutation]);

  // ── Drag-and-drop reorder (SortableJS) ──
  // Mutates the cross-project flat tasks array so reordering a task affects
  // only the items visible in the current project lane. Reparenting via
  // horizontal drag (or Tab/Shift+Tab) updates the dropped task's `parent`.
  const tasksRef = useRef(null); tasksRef.current = tasks;
  const projectIdRef = useRef(null); projectIdRef.current = activeProjectId;
  // Live mirror of the current groupBy so Sortable callbacks can branch (project vs owner view)
  // without forcing a re-init when the user toggles groupBy.
  // laneModeRef declared above; used in drag handlers in place of old groupByRef.

  const isDescendantOf = useCallback((ts, candidateAncestorId, taskId) => {
    // True if taskId is `candidateAncestorId` itself or a descendant.
    if (taskId === candidateAncestorId) return true;
    const byParent = new Map();
    for (const t of ts){ const k = t.parent || '__root'; if (!byParent.has(k)) byParent.set(k,[]); byParent.get(k).push(t); }
    const stack = [candidateAncestorId];
    while (stack.length){
      const id = stack.pop();
      if (id === taskId) return true;
      for (const c of (byParent.get(id) || [])) stack.push(c.id);
    }
    return false;
  }, []);

  const handleDragStart = useCallback((evt) => {
    const id = evt.item.dataset.taskId;
    // Drop the shift-range anchor so a post-drag shift-click doesn't extend from a stale row.
    selAnchorRef.current = null;
    // Multi-drag: if the grabbed row is part of a >1 selection, gather all selected
    // ids in document order so the drop logic can splice them together at the primary slot.
    // If the user grabbed a row outside the selection, collapse selection to just it.
    const container = lpaneBodyRef.current;
    const selSet = selectedSetRef.current;
    let dragIds;
    if (selSet && selSet.has(id) && selSet.size > 1 && container){
      const visibleIds = Array.from(container.querySelectorAll('.task-row.is-child[data-task-id]')).map(el => el.dataset.taskId);
      dragIds = visibleIds.filter(x => selSet.has(x));
      // Hide secondaries so they don't visually trail; restored in handleDragEnd
      dragIds.forEach(x => {
        if (x === id) return;
        const el = container.querySelector(`.task-row.is-child[data-task-id="${CSS.escape(x)}"]`);
        if (el) el.classList.add('multi-drag-hidden');
      });
    } else {
      dragIds = [id];
      if (selSet && !selSet.has(id)){
        // Collapse selection to the grabbed row (async — fine, dragIds is what matters for drop)
        setSelected(id);
        setSelectedSet(new Set([id]));
      }
    }
    // Floating tooltip near cursor — tells the user where this row will land
    const tip = document.createElement('div');
    tip.className = 'drag-tooltip';
    tip.textContent = '';
    document.body.appendChild(tip);
    dragStateRef.current = {
      taskId: id, taskIds: dragIds, currentDepth: 1,
      tooltipEl: tip, newParent: null, newOwner: null, blocked: false,
      mode: laneModeRef.current === 'owner' ? 'owner' : 'project',
    };
  }, []);

  const handleDragMove = useCallback((evt, originalEvent) => {
    const st = dragStateRef.current;
    if (!st) return true;
    const clientX = (originalEvent && originalEvent.clientX) || 0;
    const clientY = (originalEvent && originalEvent.clientY) || 0;
    // Owner view: no horizontal indent semantics. Walk back to nearest owner-group-row,
    // resolve the target owner, and short-circuit out.
    if (st.mode === 'owner'){
      const dragged = evt.dragged || evt.item;
      let cursor = dragged && dragged.previousElementSibling;
      let ownerName = null;
      while (cursor){
        if (cursor.classList && cursor.classList.contains('owner-group-row')){
          ownerName = cursor.getAttribute('data-owner');
          break;
        }
        cursor = cursor.previousElementSibling;
      }
      st.newOwner = ownerName;
      st.newParent = null; // unused in owner-mode end handler
      st.blocked = ownerName == null;
      const tip = st.tooltipEl;
      if (tip){
        tip.textContent = ownerName ? ('→ Owner: ' + ownerName) : 'Drop on an owner group';
        tip.classList.toggle('is-blocked', st.blocked);
        tip.style.transform = 'translate(' + (clientX + 14) + 'px, ' + (clientY + 14) + 'px)';
      }
      return true;
    }
    // Vertical reorder only — walk the DOM to find the row directly above the drag ghost
    // and use its depth as the landing depth (no horizontal indent/outdent).
    const dragged = evt.dragged || evt.item;
    let prev = dragged && dragged.previousElementSibling;
    let prevKind = null;
    let prevTaskId = null;
    let prevDepth = 0;
    let prevProjectId = null;
    while (prev){
      if (prev.classList && prev.classList.contains('task-row') && prev.classList.contains('is-child')){
        prevKind = 'task'; prevTaskId = prev.dataset.taskId;
        prevDepth = parseInt(prev.dataset.depth, 10) || 1;
        break;
      }
      if (prev.classList && prev.classList.contains('group-row')){
        prevKind = 'project'; prevProjectId = prev.getAttribute('data-pid'); break;
      }
      if (prev.classList && prev.classList.contains('owner-group-row')){ prevKind = 'owner'; break; }
      prev = prev.previousElementSibling;
    }
    st.currentDepth = prevDepth || 1;
    let parentText = '';
    let blocked = false;
    const ts = tasksRef.current || [];
    if (prevKind === 'owner'){
      blocked = true; parentText = 'Cannot drop in owner-group view';
    } else if (prevKind === 'project'){
      const projTask = ts.find(t => t.kind === 'project' && t.project === prevProjectId);
      parentText = '→ Top of ' + (projTask ? projTask.title : (prevProjectId || 'project'));
    } else if (prevKind === 'task'){
      const prevTask = ts.find(t => t.id === prevTaskId);
      parentText = prevTask ? ('→ After ' + prevTask.title) : '';
    }
    st.blocked = blocked;
    const tip = st.tooltipEl;
    if (tip){
      tip.textContent = parentText;
      tip.classList.toggle('is-blocked', blocked);
      tip.style.transform = 'translate(' + (clientX + 14) + 'px, ' + (clientY + 14) + 'px)';
    }
    return true;
  }, []);

  const handleDragEnd = useCallback((evt) => {
    const st = dragStateRef.current;
    dragStateRef.current = null;
    const dragged = evt.item;
    if (dragged){ /* no indent-preview to clear */ }
    if (st && st.tooltipEl){ try { st.tooltipEl.remove(); } catch(e){} }
    const container = lpaneBodyRef.current;
    // Always restore any hidden multi-drag rows, even on abort
    if (container){
      container.querySelectorAll('.task-row.multi-drag-hidden').forEach(el => el.classList.remove('multi-drag-hidden'));
    }
    if (!st) return;
    if (st.blocked) return; // owner-group abort or loop guard
    const draggedId = st.taskId;
    const draggedIds = (st.taskIds && st.taskIds.length) ? st.taskIds : [draggedId];
    if (!container) return;

    // ── Owner view: re-owner the dragged task(s); preserve hierarchy ──
    if (st.mode === 'owner'){
      const ownerName = st.newOwner;
      if (!ownerName) return;
      const draggedSet = new Set(draggedIds);
      updateTasks(ts => ts.map(t => draggedSet.has(t.id) ? {...t, owner: ownerName} : t));
      return;
    }

    // ── Project view: existing reparent logic, extended for multi-drag ──
    const targetDepth = st.currentDepth;
    let prev = dragged.previousElementSibling;
    // Skip over hidden secondary-drag rows so the depth/parent resolution treats
    // them as if they were already gone (which they will be after splice).
    const isMultiSecondary = (el) => el && el.classList &&
      el.classList.contains('task-row') && el.classList.contains('is-child') &&
      el.dataset && el.dataset.taskId && el.dataset.taskId !== draggedId &&
      draggedIds.indexOf(el.dataset.taskId) >= 0;
    while (prev && isMultiSecondary(prev)) prev = prev.previousElementSibling;
    let newParent = null;
    while (prev){
      if (prev.classList && prev.classList.contains('group-row')){
        const pid = prev.getAttribute('data-pid');
        const projTask = tasksRef.current.find(t => t.kind === 'project' && t.project === pid);
        newParent = projTask ? projTask.id : null;
        break;
      }
      if (prev.classList && prev.classList.contains('owner-group-row')){
        newParent = undefined; break;
      }
      if (prev.classList && prev.classList.contains('task-row') && prev.classList.contains('is-child')){
        const prevId = prev.dataset.taskId;
        const prevDepth = parseInt(prev.dataset.depth, 10) || 1;
        if (targetDepth > prevDepth){
          newParent = prevId;
        } else if (targetDepth === prevDepth){
          const prevTask = tasksRef.current.find(t => t.id === prevId);
          newParent = prevTask ? (prevTask.parent || null) : null;
        } else {
          let cursor = prev.previousElementSibling;
          let found = false;
          while (cursor){
            if (isMultiSecondary(cursor)){ cursor = cursor.previousElementSibling; continue; }
            if (cursor.classList && cursor.classList.contains('task-row') && cursor.classList.contains('is-child')){
              const d = parseInt(cursor.dataset.depth, 10) || 1;
              if (d === targetDepth){
                const cursorTask = tasksRef.current.find(t => t.id === cursor.dataset.taskId);
                newParent = cursorTask ? (cursorTask.parent || null) : null;
                found = true; break;
              }
              if (d < targetDepth){
                const cursorTask = tasksRef.current.find(t => t.id === cursor.dataset.taskId);
                newParent = cursorTask ? cursorTask.id : null;
                found = true; break;
              }
            }
            if (cursor.classList && cursor.classList.contains('group-row')){
              const pid = cursor.getAttribute('data-pid');
              const projTask = tasksRef.current.find(t => t.kind === 'project' && t.project === pid);
              newParent = projTask ? projTask.id : null;
              found = true; break;
            }
            cursor = cursor.previousElementSibling;
          }
          if (!found) newParent = null;
        }
        break;
      }
      prev = prev.previousElementSibling;
    }
    if (newParent === undefined) return; // owner-group abort

    // Drop at the very top of the list (no preceding sibling) → newParent stays null.
    // buildRowsByProject only renders tasks reachable from a kind:'project' root, so a
    // non-project task with parent:null is an orphan that vanishes from the UI until
    // migrateOrphans() runs on reload. Snap to the first project header here so the drop
    // lands somewhere visible immediately. Sortable's filter prevents dragging project-kind
    // rows themselves, so every dragged id is a non-project task.
    if (newParent === null){
      const firstProj = tasksRef.current.find(t => t.kind === 'project');
      if (firstProj) newParent = firstProj.id;
    }

    // Loop guard: reject if any dragged id would become an ancestor of newParent (cycle).
    for (const did of draggedIds){
      if (newParent && isDescendantOf(tasksRef.current, did, newParent)) return;
    }

    updateTasks(ts => {
      const draggedSet = new Set(draggedIds);
      // 1. Reparent every dragged task to the resolved newParent.
      //    (Group-drag flattens hierarchy among dragged ids — they all become siblings of
      //     each other under newParent. Preserving inter-selection hierarchy here is rare
      //     and adds complexity; flat behaviour is what Finder / Things 3 / Notion do.)
      const next = ts.map(t => draggedSet.has(t.id) ? {...t, parent: newParent} : t);
      // 2. Splice all dragged ids together at the primary row's slot — order matches doc order.
      const primary = draggedId;
      const draggedInOrder = draggedIds.map(id => next.find(t => t.id === id)).filter(Boolean);
      const without = next.filter(t => !draggedSet.has(t.id));
      // SortableJS already moved the primary's DOM node. To find its slot in the flat array,
      // read the live visible order, locate the primary, then map back to the index in `without`.
      const rowEls = Array.from(container.querySelectorAll('.task-row.is-child[data-task-id]'));
      const visibleOrder = rowEls.map(el => el.dataset.taskId).filter(id => !draggedSet.has(id) || id === primary);
      const pVisIdx = visibleOrder.indexOf(primary);
      // Find the task id that follows the primary in the visible order — anchor the splice before it.
      let anchorIdx = -1;
      if (pVisIdx >= 0){
        for (let i = pVisIdx + 1; i < visibleOrder.length; i++){
          const cand = visibleOrder[i];
          if (draggedSet.has(cand)) continue;
          anchorIdx = without.findIndex(t => t.id === cand);
          if (anchorIdx >= 0) break;
        }
      }
      if (anchorIdx < 0){
        // Primary is at the visible tail OR couldn't resolve — append at end of `without`.
        return [...without, ...draggedInOrder];
      }
      return [...without.slice(0, anchorIdx), ...draggedInOrder, ...without.slice(anchorIdx)];
    });
  }, [updateTasks, isDescendantOf]);

  // Wire Sortable to the lpane-body. Re-init on project switch or groupBy change.
  useEffect(() => {
    if (typeof window === 'undefined' || !Sortable) return;
    if (!lpaneBodyRef.current) return;
    if (!activeProjectId) return;
    // Owner view drag is enabled — handlers branch on groupByRef.current.
    const sortable = Sortable.create(lpaneBodyRef.current, {
      // Whole row is the drag affordance — no grip handle.
      // `filter` excludes interactive children so clicks on them behave normally.
      draggable: '.task-row.is-child',
      filter: '.chk, .task-chv, .row-rename, .wbs, .group-row, .owner-group-row, .lane-row, .task-row-add',
      preventOnFilter: false, // let onClick on filtered elements proceed
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      animation: 150,
      fallbackOnBody: true,
      onStart: handleDragStart,
      onMove: (evt, originalEvent) => handleDragMove(evt, originalEvent),
      onEnd: handleDragEnd,
    });
    return () => { try { sortable.destroy(); } catch(e){} };
  }, [activeProjectId, laneMode, handleDragStart, handleDragMove, handleDragEnd]);

  const updateActiveProject = useCallback((updates) => {
    commitMutation('edit project', ps => ps.map(p => p.id === activeProjectId ? {...p, ...updates} : p));
  }, [activeProjectId, commitMutation]);

  const updateProjectById = useCallback((id, updates) => {
    commitMutation('edit project', ps => ps.map(p => p.id === id ? {...p, ...updates} : p));
  }, [commitMutation]);

  // ── Group row kebab handlers ──
  const commitGroupRename = useCallback(() => {
    setGroupRenaming(cur => {
      if(!cur) return null;
      const v = cur.value.trim();
      if(v) {
        if(cur.kind === 'project') {
          // project groups are task-level sub-projects — update the task title
          updateTasks(ts => ts.map(t => t.id === cur.id ? {...t, title: v} : t));
        } else {
          // cur.id is 'owner-Alex'; strip prefix to get the actual owner name
          const ownerName = cur.id.startsWith('owner-') ? cur.id.slice(6) : cur.id;
          updateTasks(ts => ts.map(t => t.owner === ownerName ? {...t, owner: v} : t));
          setCollapsed(c => {
            if(!c.has(cur.id)) return c;
            const n = new Set(c); n.delete(cur.id); n.add('owner-'+v); return n;
          });
        }
      }
      return null;
    });
  }, [updateTasks]);

  const addTaskToGroup = useCallback(({kind, groupId, title}) => {
    if(kind === 'project') {
      addTask(groupId);
    } else {
      // owner group: add a loose task then set its owner
      const newId = 't-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
      const newTask = {id:newId,parent:null,title:'New task',owner:title,start:todayStr,end:addDays(todayStr,2),priority:'p2',progress:0,done:false,status:'todo',deps:[],tags:[],comments:[]};
      updateTasks(ts => [...ts, newTask]);
    }
  }, [addTask, updateTasks, todayStr]);

  const clearOwnerGroup = useCallback((ownerName) => {
    updateTasks(ts => ts.map(t => t.owner === ownerName ? {...t, owner: ''} : t));
  }, [updateTasks]);

  const setGroupColor = useCallback((kind, groupId, title, hex) => {
    if(kind === 'project') {
      // store on the project task itself; group dot reads r.color
      updateTasks(ts => ts.map(t => t.id === groupId ? {...t, color: hex||null} : t));
    } else {
      // store in project-level ownerColors map
      const oc = {...(activeProject?.ownerColors||{})};
      if(hex) oc[title] = hex; else delete oc[title];
      updateActiveProject({ownerColors: oc});
    }
  }, [updateTasks, updateActiveProject, activeProject]);

  const deleteGroupTasks = useCallback(async (groupId, title) => {
    const confirmed = await customConfirm(`Delete "${title}"?`, 'This will delete the set and all its tasks. This cannot be undone.', {okLabel: 'Delete', destructive: true});
    if(!confirmed) return;
    const allTasks = tasksRef.current;
    const toDelete = new Set([groupId]);
    const collect = (pid) => {
      allTasks.forEach(t => {
        if(t.parent === pid && !toDelete.has(t.id)) { toDelete.add(t.id); collect(t.id); }
      });
    };
    collect(groupId);
    updateTasks(ts => ts
      .filter(tt => !toDelete.has(tt.id))
      .map(tt => {
        const list = depList(tt);
        if(!list.some(d => toDelete.has(d.id))) return tt;
        return {...tt, deps: list.filter(d => !toDelete.has(d.id))};
      })
    );
    setSelected(null);
    setSelectedSet(new Set());
  }, [customConfirm, updateTasks]);

  const addGroup = useCallback(() => {
    const newId = 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    updateTasks(ts => [...ts, {id: newId, parent: null, kind: 'project', title: 'New set', start: todayStr, end: addDays(todayStr, 30), priority: 'p2', progress: 0}]);
    setGroupRenaming({id: newId, kind: 'project', value: 'New set'});
  }, [updateTasks]);

  // Reorder a set (project task) to a new index among other project tasks.
  // Children (any task with parent === groupId, transitively) travel with the project.
  // targetIndex is the desired position in the projects-only ordering after the move.
  const reorderGroupTo = useCallback((groupId, targetIndex) => {
    updateTasks(ts => {
      const projects = ts.filter(t => t.kind === 'project').map(t => t.id);
      const curIdx = projects.indexOf(groupId);
      if (curIdx < 0) return ts;
      const clamped = Math.max(0, Math.min(projects.length - 1, targetIndex));
      if (clamped === curIdx) return ts;
      // Collect transitive descendants of groupId
      const childIds = new Set();
      const stack = [groupId];
      while (stack.length) {
        const cur = stack.pop();
        for (const t of ts) if (t.parent === cur && t.id !== groupId) {
          if (!childIds.has(t.id)) { childIds.add(t.id); stack.push(t.id); }
        }
      }
      // Block = [project, ...descendants in their original relative order]
      const block = ts.filter(t => t.id === groupId || childIds.has(t.id));
      const rest  = ts.filter(t => t.id !== groupId && !childIds.has(t.id));
      // Among rest, find anchor: the project at the new index in projects-only ordering, excluding the moved one
      const restProjects = rest.filter(t => t.kind === 'project').map(t => t.id);
      const anchorId = restProjects[clamped] ?? null;
      let insertAt;
      if (anchorId === null) {
        insertAt = rest.length; // append
      } else {
        insertAt = rest.findIndex(t => t.id === anchorId);
      }
      return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
    });
  }, [updateTasks]);

  // Group drag-handle reorder: custom pointer handling so it doesn't fight SortableJS on the same container.
  const beginGroupDrag = useCallback((e, groupId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const startName = document.querySelector(`.group-row[data-gid="${groupId}"] .group-name`)?.innerText || 'Set';
    const overlay = document.createElement('div');
    overlay.className = 'grp-drag-ghost';
    overlay.textContent = startName;
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:4px;padding:3px 9px;font:11px var(--font);color:var(--accent-2);box-shadow:0 4px 14px rgba(0,0,0,.18)';
    document.body.appendChild(overlay);
    const indicator = document.createElement('div');
    indicator.className = 'grp-drop-indicator';
    indicator.style.cssText = 'position:fixed;pointer-events:none;z-index:9998;height:2px;background:var(--accent-2);box-shadow:0 0 6px rgba(20,184,166,.6);display:none';
    document.body.appendChild(indicator);
    let dropTargetId = null;
    let dropBefore = true;
    const onMove = (me) => {
      overlay.style.left = (me.clientX + 14) + 'px';
      overlay.style.top  = (me.clientY + 10) + 'px';
      const els = document.elementsFromPoint(me.clientX, me.clientY);
      const gr = els.find(el => el.classList && el.classList.contains('group-row') && el.dataset && el.dataset.gid);
      if (gr && gr.dataset.gid !== groupId) {
        const r = gr.getBoundingClientRect();
        const above = me.clientY < r.top + r.height/2;
        indicator.style.display = 'block';
        indicator.style.left = r.left + 'px';
        indicator.style.width = r.width + 'px';
        indicator.style.top = (above ? r.top - 1 : r.bottom - 1) + 'px';
        dropTargetId = gr.dataset.gid;
        dropBefore = above;
      } else {
        indicator.style.display = 'none';
        dropTargetId = null;
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      overlay.remove(); indicator.remove();
      if (!dropTargetId || dropTargetId === groupId) return;
      const order = [...document.querySelectorAll('.group-row[data-gid]')].map(el => el.dataset.gid);
      const fromIdx = order.indexOf(groupId);
      const anchorIdx = order.indexOf(dropTargetId);
      if (fromIdx < 0 || anchorIdx < 0) return;
      // Convert anchor + before/after into a target index in projects-without-moved ordering
      // restProjects = order with groupId removed (length N-1, indexed 0..N-2)
      const restAnchorIdx = anchorIdx > fromIdx ? anchorIdx - 1 : anchorIdx;
      const target = dropBefore ? restAnchorIdx : restAnchorIdx + 1;
      reorderGroupTo(groupId, target);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  }, [reorderGroupTo]);

  const moveGroup = useCallback((groupId, dir) => {
    updateTasks(ts => {
      const projects = ts.filter(t => t.kind === 'project').map(t => t.id);
      const idx = projects.indexOf(groupId);
      if (idx < 0) return ts;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= projects.length) return ts;
      // Inline the reorder logic for atomicity
      const childIds = new Set();
      const stack = [groupId];
      while (stack.length) {
        const cur = stack.pop();
        for (const t of ts) if (t.parent === cur && t.id !== groupId) {
          if (!childIds.has(t.id)) { childIds.add(t.id); stack.push(t.id); }
        }
      }
      const block = ts.filter(t => t.id === groupId || childIds.has(t.id));
      const rest  = ts.filter(t => t.id !== groupId && !childIds.has(t.id));
      const restProjects = rest.filter(t => t.kind === 'project').map(t => t.id);
      const anchorId = restProjects[target] ?? null;
      const insertAt = anchorId === null ? rest.length : rest.findIndex(t => t.id === anchorId);
      return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
    });
  }, [updateTasks]);

  // ── Phase B2: Saved views ──
  // A view captures viewMode + laneMode + filter (q/owners/priorities/status).
  // Sets are converted to arrays for JSON serialization and back on apply.
  const snapshotCurrentView = useCallback(() => ({
    viewMode: tw.viewMode === 'list' || tw.viewMode === 'calendar' ? tw.viewMode : 'gantt',
    laneMode: laneMode || 'off',
    filter: {
      q: filter.q || '',
      owners: Array.from(filter.owners || []),
      priorities: Array.from(filter.priorities || []),
      status: filter.status || 'all',
    },
  }), [tw.viewMode, laneMode, filter]);

  // ── Baseline handlers ──
  const saveBaseline = useCallback(async () => {
    if (!activeProject) return;
    const n = baselines.length + 1;
    const name = await customPrompt('Save Baseline', `Baseline ${n}`);
    if (!name) return;
    const id = genId('bl-');
    const snapshot = Object.fromEntries(tasks.map(t => [t.id, {start: t.start, end: t.end}]));
    const entry = { id, name: name.trim() || `Baseline ${n}`, createdAt: todayStr, snapshot };
    updateActiveProject({ baselines: [...baselines, entry], activeBaselineId: id });
  }, [activeProject, baselines, tasks, customPrompt, updateActiveProject]);

  const activateBaseline = useCallback((id) => {
    updateActiveProject({ activeBaselineId: id });
  }, [updateActiveProject]);

  const renameBaseline = useCallback((id, name) => {
    updateActiveProject({ baselines: baselines.map(b => b.id === id ? {...b, name} : b) });
  }, [baselines, updateActiveProject]);

  const deleteBaseline = useCallback((id) => {
    const next = baselines.filter(b => b.id !== id);
    const nextActiveId = activeBaselineId === id ? (next.length > 0 ? next[next.length-1].id : null) : activeBaselineId;
    updateActiveProject({ baselines: next, activeBaselineId: nextActiveId });
  }, [baselines, activeBaselineId, updateActiveProject]);

  const saveCurrentView = useCallback(async (nameArg) => {
    const name = nameArg ?? await customPrompt('Save View', 'My view');
    if (!name) return;
    const snap = snapshotCurrentView();
    const view = { id: genId('view-'), name, ...snap };
    updateActiveProject({ savedViews: [...(activeProject?.savedViews || []), view] });
  }, [customPrompt, snapshotCurrentView, activeProject, updateActiveProject]);

  const applyView = useCallback((view) => {
    if (!view) return;
    if (view.viewMode) setTweak('viewMode', view.viewMode);
    if (view.laneMode) { setLaneMode(view.laneMode); setLaneCollapsed(new Set()); setDirty(true); }
    if (view.filter){
      setFilter({
        q: view.filter.q || '',
        owners: new Set(view.filter.owners || []),
        priorities: new Set(view.filter.priorities || []),
        status: view.filter.status || 'all',
      });
    }
  }, [setTweak]);

  const deleteSavedView = useCallback((id) => {
    if (!activeProject) return;
    updateActiveProject({ savedViews: (activeProject.savedViews || []).filter(v => v.id !== id) });
  }, [activeProject, updateActiveProject]);

  // ── Workspace actions ──
  // Batch 5: load error modal — surfaces parse/migration errors to the user.
  // Shape: {title, message} | null
  const [loadError, setLoadError] = useState(null);
  // Hidden file input for browsers without File System Access API (Firefox/Safari).
  const fileInputRef = useRef(null);

  // Classify an Error thrown by parseWorkspace / migrateWorkspace into a
  // user-friendly title + message. Falls back to a generic invalid-shape note.
  const classifyLoadError = useCallback((err) => {
    const msg = String(err?.message || err || '');
    if (err instanceof SyntaxError || /JSON/i.test(msg)) {
      return { title: "Can't open this file",
        message: "This file isn't valid JSON. It may be corrupted or wasn't saved by Timeline." };
    }
    if (/newer version of Timeline/i.test(msg)) {
      return { title: 'File is too new', message: msg };
    }
    if (/Invalid workspace file|No migration available/i.test(msg)) {
      return { title: "Can't open this file",
        message: "This file doesn't look like a Timeline workspace. (Missing required fields.)" };
    }
    return { title: "Can't open this file",
      message: "This file doesn't look like a Timeline workspace. (Missing required fields.)" };
  }, []);

  // Common hydration after a successful parseWorkspace — used by both the FSA
  // path and the <input type=file> fallback.
  const hydrateFromWorkspace = useCallback((ws, handle) => {
    setFileHandle(handle || null);
    if (handle) { idbPut(CURRENT_HANDLE_KEY, handle).catch(()=>{}); }
    else        { idbDel(CURRENT_HANDLE_KEY).catch(()=>{}); }
    const migrated = migrateOrphans(ws.projects);
    setProjects(migrated);
    const aid = ws.activeProjectId && migrated.find(p => p.id === ws.activeProjectId)
      ? ws.activeProjectId
      : (migrated[0]?.id ?? null);
    setActiveProjectId(aid);
    setLaneMode(ws.laneMode || 'off');
    setLanes(Array.isArray(ws.lanes) ? ws.lanes : []);
    setStageRegistry(Array.isArray(ws.stageRegistry) ? ws.stageRegistry : []);
    setLaneCollapsed(new Set());
    setShowWelcome(false);
    setDirty(false);
    setCollapsed(new Set());
    setSelected(null);
    setSelectedSet(new Set());
    resetUndoHistory();
    try {
      const lm = ws.laneMode || 'off';
      const ln = Array.isArray(ws.lanes) ? ws.lanes : [];
      const sr = Array.isArray(ws.stageRegistry) ? ws.stageRegistry : [];
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        savedAt: Date.now(), fileName: (handle || null)?.name || null,
        dirty: false, payload: serializeWorkspace(migrated, aid, {laneMode:lm, lanes:ln, stageRegistry:sr}),
      }));
    } catch(_) {}
  }, [resetUndoHistory]);

  const openWorkspace = useCallback(async () => {
    if (dirty && projects.length > 0 && !await customConfirm('Discard Changes?', 'Your unsaved changes will be lost.', {okLabel:'Discard'})) return;
    // Non-FSA browsers: trigger hidden <input type=file>. The change handler
    // will read the file and call hydrateFromWorkspace / setLoadError.
    if (!FSA_AVAILABLE) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Timeline Workspace', accept: { 'application/json': ['.json'] } }]
      });
      const file = await handle.getFile();
      let ws;
      try { ws = parseWorkspace(await file.text()); }
      catch(parseErr) { setLoadError(classifyLoadError(parseErr)); return; }
      hydrateFromWorkspace(ws, handle);
      await pushRecent(handle.name, handle);
    } catch(e) {
      if (e?.name !== 'AbortError') {
        setLoadError(classifyLoadError(e));
      }
    }
  }, [dirty, projects.length, classifyLoadError, hydrateFromWorkspace, pushRecent]);

  // Handler wired to <input type=file>. Reads via FileReader so it works
  // in every modern browser (Firefox/Safari/Chrome).
  const onFileInputChange = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setLoadError({ title: "Can't open this file",
      message: "The browser couldn't read this file. Try again or pick a different file." });
    reader.onload = () => {
      try {
        const ws = parseWorkspace(String(reader.result || ''));
        hydrateFromWorkspace(ws, null);
        pushRecent(file.name, null);
      } catch(err) {
        setLoadError(classifyLoadError(err));
      }
    };
    reader.readAsText(file);
  }, [classifyLoadError, hydrateFromWorkspace, pushRecent]);

  const saveWorkspaceRef = useRef(null);
  const saveWorkspace = useCallback(async (forceAs = false) => {
    if (projects.length === 0) { await customAlert('Nothing to Save', 'Create a project first.'); return; }
    // Non-FSA browsers: trigger a download via Blob + <a download>. There is no
    // in-place handle in this mode, so every save downloads a fresh copy.
    if (!FSA_AVAILABLE) {
      try {
        const payload = serializeWorkspace(projects, activeProjectId, {laneMode:laneModeRef.current, lanes:lanesRef.current, stageRegistry:stageRegistryRef.current});
        const filename = activeProject?.name ? (activeProject.name + '.json') : 'workspace.json';
        downloadWorkspace(filename, payload);
        setDirty(false);
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
            savedAt: Date.now(),
            fileName: activeProject?.name ? (activeProject.name + '.json') : 'workspace.json',
            dirty: false, payload,
          }));
        } catch(_) {}
        pushRecent(activeProject?.name ? (activeProject.name + '.json') : 'workspace.json', null);
      } catch(e) {
        await customAlert('Download Failed', e?.message || String(e));
      }
      return;
    }
    let handle = fileHandle;
    if (!handle || forceAs) {
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: 'workspace.json',
          types: [{ description: 'Timeline Workspace', accept: { 'application/json': ['.json'] } }]
        });
        setFileHandle(handle);
        await pushRecent(handle.name, handle);
      } catch(e) { return; }
    }
    try {
      const writable = await handle.createWritable();
      const laneOpts = {laneMode:laneModeRef.current, lanes:lanesRef.current, stageRegistry:stageRegistryRef.current};
      await writable.write(serializeWorkspace(projects, activeProjectId, laneOpts));
      await writable.close();
      try { await idbPut(CURRENT_HANDLE_KEY, handle); } catch(_) {}
      setDirty(false);
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          savedAt: Date.now(), fileName: handle.name,
          dirty: false, payload: serializeWorkspace(projects, activeProjectId, laneOpts),
        }));
      } catch(_) {}
    } catch(e) {
      await customAlert('Save Failed', e?.message || String(e));
    }
  }, [fileHandle, projects, activeProjectId, activeProject, pushRecent]);
  saveWorkspaceRef.current = saveWorkspace;

  const openRecent = useCallback(async (id) => {
    if (dirty && projects.length > 0 && !await customConfirm('Discard Changes?', 'Your unsaved changes will be lost.', {okLabel:'Discard'})) return;
    const entry = recents.find(e => e.id === id);
    if (!entry) return;
    if (!entry.hasHandle) {
      // Name-only entry (non-FSA browser): fall back to normal picker
      openWorkspace();
      return;
    }
    let handle;
    try { handle = await idbGet(id); } catch(_) {}
    if (!handle) { await removeRecent(id); openWorkspace(); return; }
    // Re-acquire read permission — Chromium drops perms across sessions
    let perm;
    try { perm = await handle.queryPermission({ mode: 'read' }); } catch(_) { perm = 'prompt'; }
    if (perm !== 'granted') {
      try { perm = await handle.requestPermission({ mode: 'read' }); } catch(_) { perm = 'denied'; }
    }
    if (perm !== 'granted') {
      setLoadError({ title: 'Permission denied', message: "Couldn't open this file — permission was denied." });
      return;
    }
    try {
      const file = await handle.getFile();
      const ws = parseWorkspace(await file.text());
      hydrateFromWorkspace(ws, handle);
      await pushRecent(handle.name, handle); // bump to MRU top
    } catch (e) {
      await removeRecent(id); // file was moved or deleted
      setLoadError(classifyLoadError(e));
    }
  }, [dirty, projects.length, recents, openWorkspace, hydrateFromWorkspace, pushRecent, removeRecent, classifyLoadError]);

  const createNewProject = useCallback(async (nameArg) => {
    const name = nameArg ?? await customPrompt('New Project', 'New project');
    if (!name) return;
    const p = newProject(name);
    commitMutation('new project', ps => [...ps, p]);
    setActiveProjectId(p.id);
    setCollapsed(new Set());
    setSelected(null);
    setSelectedSet(new Set());
    setShowWelcome(false);
  }, [commitMutation]);

  const duplicateProject = useCallback((id) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    const idMap = new Map();
    const renamed = p.tasks.map(t => {
      const nid = t.id + '-' + Math.random().toString(36).slice(2,5);
      idMap.set(t.id, nid);
      return { ...t, id: nid };
    });
    const finalTasks = renamed.map(t => ({
      ...t,
      parent: t.parent ? (idMap.get(t.parent) ?? t.parent) : null,
      deps: (t.deps || []).map(d => {
        const nd = normalizeDep(d);
        if (!nd) return null;
        return {...nd, id: idMap.get(nd.id) ?? nd.id};
      }).filter(Boolean),
    }));
    const np = { id: genId('proj-'), name: p.name + ' (copy)', color: p.color, created: todayStr, baselines: [], activeBaselineId: null, tasks: finalTasks, owners: (p.owners||[]).map(o=>({...o})), calendar: p.calendar ? {workingDays:[...(p.calendar.workingDays||DEFAULT_CALENDAR.workingDays)], holidays:[...(p.calendar.holidays||[])]} : {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]}, autoSchedule: p.autoSchedule || 'cascade' };
    commitMutation('duplicate project', ps => [...ps, np]);
    setActiveProjectId(np.id);
  }, [projects, commitMutation]);

  const deleteProject = useCallback(async (id) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    if (!await customConfirm('Delete Project?', `"${p.name}" and all its tasks will be permanently removed.`, {destructive:true,okLabel:'Delete'})) return;
    let nextActive = activeProjectId;
    commitMutation('delete project', ps => {
      const next = ps.filter(x => x.id !== id);
      if (activeProjectId === id) nextActive = next[0]?.id ?? null;
      return next;
    });
    if (nextActive !== activeProjectId) setActiveProjectId(nextActive);
  }, [projects, activeProjectId, commitMutation]);

  const switchProject = useCallback((id) => {
    setActiveProjectId(id);
    setCollapsed(new Set());
    setSelected(null);
    setSelectedSet(new Set());
    setFocusChain(null);
    setFilter({q:'', owners:new Set(), priorities:new Set(), status:'all'});
  }, []);

  const loadSample = useCallback(async () => {
    if (dirty && projects.length > 0 && !await customConfirm('Load Sample Project?', 'Your unsaved changes will be lost.', {okLabel:'Load Sample'})) return;
    const ws = sampleWorkspace();
    const migrated = migrateOrphans(ws.projects);
    setProjects(migrated);
    setActiveProjectId(ws.activeProjectId);
    setLaneMode('off');
    setLanes([]);
    setStageRegistry([]);
    setLaneCollapsed(new Set());
    setFileHandle(null);
    idbDel(CURRENT_HANDLE_KEY).catch(()=>{});
    setShowWelcome(false);
    setDirty(false);
    setCollapsed(new Set());
    setSelected(null);
    setSelectedSet(new Set());
    resetUndoHistory();
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        savedAt: Date.now(), fileName: null,
        dirty: false, payload: serializeWorkspace(migrated, ws.activeProjectId, {laneMode:'off', lanes:[], stageRegistry:[]}),
      }));
    } catch(_) {}
  }, [dirty, projects.length, customConfirm, resetUndoHistory]);

  // ── Templates ──
  const saveActiveProjectAsTemplate = useCallback(async () => {
    if (!activeProject) { await customAlert('No Project Open', 'Open or select a project before saving as template.'); return; }
    const name = await customPrompt('Save Template', activeProject.name || 'Template');
    if (!name || !name.trim()) return;
    const sanitized = sanitizeForTemplate(activeProject);
    if (!sanitized) return;
    const entry = {
      id: 'tmpl-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      name: name.trim(),
      savedAt: Date.now(),
      project: sanitized,
    };
    const next = [...templates, entry];
    persistTemplates(next);
  }, [activeProject, templates, persistTemplates]);

  const createProjectFromTemplate = useCallback((template, name, startDate) => {
    const proj = instantiateTemplate(template, name, startDate);
    if (!proj) return;
    commitMutation('new project from template', ps => [...ps, proj]);
    setActiveProjectId(proj.id);
    setCollapsed(new Set());
    setSelected(null);
    setSelectedSet(new Set());
    setShowWelcome(false);
  }, [commitMutation]);

  const deleteTemplate = useCallback(async (id) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    if (!await customConfirm('Delete Template?', `"${t.name}" will be permanently removed.`, {destructive:true,okLabel:'Delete'})) return;
    persistTemplates(templates.filter(x => x.id !== id));
  }, [templates, persistTemplates]);

  // ── Recurrence on a task ──
  const setRecurrence = useCallback((taskId, recurrence) => {
    updateTasks(ts => ts.map(t => {
      if (t.id !== taskId) return t;
      if (recurrence == null) {
        const next = {...t};
        delete next.recurrence;
        return next;
      }
      return {...t, recurrence};
    }));
  }, [updateTasks]);

  // ── Template modal renderer (shared between welcome + main app) ──
  const renderTemplateModal = () => {
    if (!tmplModal) return null;
    const close = () => setTmplModal(null);
    const fmtDate = (ts) => { try { return new Date(ts).toLocaleString(); } catch(_) { return ''; } };

    if (tmplModal === 'pick') {
      return (
        <div className="tmpl-overlay" onMouseDown={close}>
          <div className="tmpl-modal" onMouseDown={e=>e.stopPropagation()}>
            <div className="tm-hdr"><h3>New project from template</h3><button className="tm-close" onClick={close}>×</button></div>
            <div className="tm-body">
              {templates.length === 0 && <div className="tmpl-empty">No saved templates yet.</div>}
              <div className="tmpl-list">
                {templates.map(t => (
                  <div key={t.id} className="tmpl-item" onClick={()=>setTmplModal({kind:'instantiate', template:t})}>
                    <div className="tmpl-item-info">
                      <div className="tmpl-item-name">{t.name}</div>
                      <div className="tmpl-item-meta">{(t.project?.tasks||[]).length} tasks · saved {fmtDate(t.savedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="tm-foot"><button className="tm-btn" onClick={close}>Cancel</button></div>
          </div>
        </div>
      );
    }

    if (tmplModal === 'manage') {
      return (
        <div className="tmpl-overlay" onMouseDown={close}>
          <div className="tmpl-modal" onMouseDown={e=>e.stopPropagation()}>
            <div className="tm-hdr"><h3>Manage templates</h3><button className="tm-close" onClick={close}>×</button></div>
            <div className="tm-body">
              {templates.length === 0 && <div className="tmpl-empty">No saved templates yet.</div>}
              <div className="tmpl-list">
                {templates.map(t => (
                  <div key={t.id} className="tmpl-item no-hover">
                    <div className="tmpl-item-info">
                      <div className="tmpl-item-name">{t.name}</div>
                      <div className="tmpl-item-meta">{(t.project?.tasks||[]).length} tasks · saved {fmtDate(t.savedAt)}</div>
                    </div>
                    <button className="tm-btn danger" onClick={()=>deleteTemplate(t.id)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="tm-foot"><button className="tm-btn" onClick={close}>Done</button></div>
          </div>
        </div>
      );
    }

    if (tmplModal && tmplModal.kind === 'instantiate') {
      return <TemplateInstantiateModal template={tmplModal.template}
        onCancel={close}
        onCreate={(name, startDate)=>{ createProjectFromTemplate(tmplModal.template, name, startDate); close(); }}/>;
    }
    return null;
  };

  // ── Autosave / crash recovery ──
  const AUTOSAVE_KEY = 'timeline-autosave-v1';
  const [autosaveOffer, setAutosaveOffer] = useState(null);
  const hydratedRef = useRef(false);
  // Batch 5: track last successful autosave timestamp so we can use a variable
  // debounce: 500ms for the first write after a dirty-flip / idle stretch,
  // 1500ms for sustained editing (avoids hammering localStorage on every keystroke).
  const lastAutosaveRef = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      let obj;
      try { obj = JSON.parse(raw); }
      catch(_){
        // Corrupt autosave payload — silently drop it and move on.
        console.warn('Discarding corrupt autosave payload');
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch(__){}
        return;
      }
      if (!obj || !obj.payload || typeof obj.payload !== 'string') {
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch(__){}
        return;
      }
      // Auto-restore last session — skip the welcome screen prompt
      try {
        const ws = parseWorkspace(obj.payload);
        hydratedRef.current = true;
        const migrated = migrateOrphans(ws.projects);
        setProjects(migrated);
        const aid = ws.activeProjectId && migrated.find(p => p.id === ws.activeProjectId)
          ? ws.activeProjectId
          : (migrated[0]?.id ?? null);
        setActiveProjectId(aid);
        setLaneMode(ws.laneMode || 'off');
        setLanes(Array.isArray(ws.lanes) ? ws.lanes : []);
        setStageRegistry(Array.isArray(ws.stageRegistry) ? ws.stageRegistry : []);
        setLaneCollapsed(new Set());
        setFileHandle(null);
        idbGet(CURRENT_HANDLE_KEY).then(h => { if (h) setFileHandle(h); }).catch(()=>{});
        setShowWelcome(false);
        setDirty(obj.dirty !== false);
        setCollapsed(new Set());
        setSelected(null);
        setSelectedSet(new Set());
        resetUndoHistory();
      } catch(e) {
        console.warn('Discarding unrestorable autosave', e?.message || e);
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch(__){}
      }
    } catch(_){}
  }, []);

  const restoreAutosave = useCallback(() => {
    if (!autosaveOffer) return;
    try {
      const ws = parseWorkspace(autosaveOffer.payload);
      hydratedRef.current = true;
      const migrated = migrateOrphans(ws.projects);
      setProjects(migrated);
      const aid = ws.activeProjectId && migrated.find(p => p.id === ws.activeProjectId)
        ? ws.activeProjectId
        : (migrated[0]?.id ?? null);
      setActiveProjectId(aid);
      setLaneMode(ws.laneMode || 'off');
      setLanes(Array.isArray(ws.lanes) ? ws.lanes : []);
      setStageRegistry(Array.isArray(ws.stageRegistry) ? ws.stageRegistry : []);
      setLaneCollapsed(new Set());
      setFileHandle(null);
      idbGet(CURRENT_HANDLE_KEY).then(h => { if (h) setFileHandle(h); }).catch(()=>{});
      setShowWelcome(false);
      setDirty(true);
      setCollapsed(new Set());
      setSelected(null);
      setSelectedSet(new Set());
      resetUndoHistory();
      setAutosaveOffer(null);
    } catch(e) {
      // Corrupt or unmigratable autosave — silently drop it (don't bother user).
      console.warn('Discarding unrestoreable autosave payload', e?.message || e);
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch(_){}
      setAutosaveOffer(null);
    }
  }, [autosaveOffer, resetUndoHistory]);

  const discardAutosave = useCallback(() => {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch(_){}
    setAutosaveOffer(null);
  }, []);

  const toggleAutosave = useCallback(() => {
    const next = !tw.autosaveEnabled;
    setTweak('autosaveEnabled', next);
  }, [tw.autosaveEnabled, setTweak]);

  useEffect(() => {
    if (showWelcome) return;
    if (!dirty) return;
    if (!projects || projects.length === 0) return;
    if (!tw.autosaveEnabled) return;
    // Variable debounce: 500ms when we're starting fresh (last write >5s ago),
    // 1500ms during sustained editing to reduce serialization cost.
    const now = Date.now();
    const idle = now - (lastAutosaveRef.current || 0) > 5000;
    const delay = idle ? 500 : 1500;
    const tid = setTimeout(() => {
      try {
        const payload = serializeWorkspace(projects, activeProjectId, {
          laneMode: laneModeRef.current,
          lanes: lanesRef.current,
          stageRegistry: stageRegistryRef.current,
        });
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          savedAt: Date.now(),
          fileName: fileHandle?.name || null,
          dirty: true,
          payload,
        }));
        lastAutosaveRef.current = Date.now();
      } catch(_){}
    }, delay);
    return () => clearTimeout(tid);
  }, [projects, activeProjectId, laneMode, lanes, stageRegistry, showWelcome, fileHandle, dirty, tw.autosaveEnabled]);

  const formatAgo = (ts) => {
    const d = Math.max(0, Date.now() - ts);
    const s = Math.floor(d/1000);
    if (s < 60) return s + 's ago';
    const m = Math.floor(s/60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m/60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h/24) + 'd ago';
  };

  // ── beforeunload warning ──
  useEffect(() => {
    const fn = (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);

  // ── Global save / undo / redo shortcuts (work even when input focused) ──
  const undoRef = useRef(null); useEffect(()=>{ undoRef.current = undo; }, [undo]);
  const redoRef = useRef(null); useEffect(()=>{ redoRef.current = redo; }, [redo]);
  const axisRef  = useRef(axis);  useEffect(()=>{ axisRef.current  = axis;  }, [axis]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveWorkspaceRef.current?.(e.shiftKey);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoRef.current?.();
        return;
      }
      if (mod && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (e.key === 'y' || e.key === 'Y'))) {
        e.preventDefault();
        redoRef.current?.();
        return;
      }
      // Batch 5: ? (Shift+/) toggles help overlay — but not when typing in inputs.
      if (e.key === '?' && !mod) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
        e.preventDefault();
        setHelpOpen(o => !o);
        return;
      }
      // Phase B1: Cmd/Ctrl+K opens the command palette (works inside inputs too —
      // it's the universal "do anything" shortcut).
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      // F — one-shot fit: scale dayWidth so the whole project fills the viewport
      if (!mod && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
        e.preventDefault();
        const el = gridScrollRef.current;
        const real = tasksRef.current.filter(t=>t.kind!=='project'&&t.start&&t.end);
        if (el && real.length) {
          const minStart=real.reduce((m,t)=>t.start<m?t.start:m,real[0].start);
          const maxEnd  =real.reduce((m,t)=>t.end  >m?t.end  :m,real[0].end);
          const span=diffDays(minStart,maxEnd)+1+14;
          setTweak('dayWidth', Math.max(4, Math.min(200, Math.floor(el.clientWidth/span))));
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Dynamic axis (relative to today) — moved to src/hooks/useAxis.js ──
  const { axis, totalW, xForDay } = useAxis(dayW);

  // ── Derived analysis ──
  // Expand recurring tasks into virtual instances for rendering + analysis.
  // Source task fields like deps stay on the source only; instances inherit deps:[]
  // so the scheduler doesn't try to reshape them.
  const expandedTasks = useMemo(()=>expandRecurring(tasks, calendar),[tasks, calendar]);

  // ── Filter computation (Batch 4) ──
  // Active task filter — produces a Set<id> of tasks that match the filter. A
  // project group is considered visible if any of its non-project children match.
  const filterActive = useMemo(() => {
    return !!debouncedQ || (filter.owners?.size>0) || (filter.priorities?.size>0) || (filter.status && filter.status !== 'all') || !!tw.hideDone;
  }, [debouncedQ, filter.owners, filter.priorities, filter.status, tw.hideDone]);

  const filteredTaskIds = useMemo(() => {
    if (!filterActive) {
      // All tasks visible — return null to short-circuit downstream
      return null;
    }
    const q = (debouncedQ || '').trim().toLowerCase();
    const ownersSel = filter.owners || new Set();
    const prisSel = filter.priorities || new Set();
    const status = filter.status || 'all';
    const matchesTask = (t) => {
      if (t.kind === 'project') return false; // project rows aren't direct matches
      if (tw.hideDone && t.done) return false;
      if (q && !(t.title || '').toLowerCase().includes(q)) return false;
      if (ownersSel.size > 0 && !ownersSel.has(t.owner)) return false;
      if (prisSel.size > 0 && !prisSel.has(t.priority || 'p3')) return false;
      if (status !== 'all'){
        const st = classifyStatus(t);
        if (st !== status) return false;
      }
      return true;
    };
    const out = new Set();
    for (const t of expandedTasks){
      if (matchesTask(t)) out.add(t.id);
    }
    // Promote ancestor projects if any child matched
    const byId = new Map(expandedTasks.map(t => [t.id, t]));
    const projHasMatch = new Set();
    for (const id of out){
      let cur = byId.get(id);
      while (cur && cur.parent){
        const par = byId.get(cur.parent);
        if (!par) break;
        if (par.kind === 'project') projHasMatch.add(par.id);
        cur = par;
      }
    }
    for (const pid of projHasMatch) out.add(pid);
    return out;
  }, [filterActive, debouncedQ, filter.owners, filter.priorities, filter.status, tw.hideDone, expandedTasks]);

  // Tasks fed into buildRows. When the filter is active we drop non-matching tasks;
  // buildRows will naturally drop projects with no remaining children.
  const tasksForRows = useMemo(() => {
    if (!filteredTaskIds) return expandedTasks;
    return expandedTasks.filter(t => filteredTaskIds.has(t.id));
  }, [expandedTasks, filteredTaskIds]);

  const ownerColors = activeProject?.ownerColors || {};
  const rows = useMemo(
    ()=>buildRows(tasksForRows,collapsed,laneMode,lanes,stageRegistry,laneCollapsed,ownerColors),
    [tasksForRows,collapsed,laneMode,lanes,stageRegistry,laneCollapsed,ownerColors]
  );

  // Count for "N of M tasks" — excludes project rows and recurring instances.
  const totalTaskCount = useMemo(() => {
    return expandedTasks.filter(t => t.kind !== 'project' && !t.recurrenceParent).length;
  }, [expandedTasks]);
  const visibleTaskCount = useMemo(() => {
    if (!filteredTaskIds) return totalTaskCount;
    let c = 0;
    for (const t of expandedTasks){
      if (t.kind === 'project' || t.recurrenceParent) continue;
      if (filteredTaskIds.has(t.id)) c++;
    }
    return c;
  }, [filteredTaskIds, expandedTasks, totalTaskCount]);
  const critical  = useMemo(()=>showCritical?computeCriticalPath(expandedTasks,calendar):{nodes:new Set(),edges:new Set(),floatMap:new Map()},[expandedTasks,showCritical,calendar]);
  const atRisk    = useMemo(()=>computeAtRisk(expandedTasks),[expandedTasks]);
  const floatMap  = useMemo(()=>showFloat?(showCritical&&critical.floatMap.size?critical.floatMap:computeFloat(expandedTasks,calendar)):new Map(),[expandedTasks,showFloat,showCritical,critical,calendar]);
  const conflicts = useMemo(()=>showConflicts?detectConflicts(expandedTasks):new Set(),[expandedTasks,showConflicts]);
  const wbsMap    = useMemo(()=>computeWbsMap(expandedTasks),[expandedTasks]);
  const owners    = activeProject?.owners ?? [];
  const costRoll  = useMemo(()=>computeCostRollup(expandedTasks, owners),[expandedTasks, owners]);

  const hoverChain = useMemo(()=>{
    if(!hoveredBarId||focusChain) return null;
    const c=getDepChain(tasks,hoveredBarId);
    return c.size>1?c:null;
  },[hoveredBarId,focusChain,tasks]);
  const rowIndexById = useMemo(()=>new Map(rows.map((r,i)=>[r.id,i])),[rows]);
  const isInspectorOpen = useMemo(()=>{
    if(!selected) return false;
    const r = rows.find(x=>x.id===selected) || expandedTasks.find(x=>x.id===selected);
    if (!r) return false;
    if (r.isProject||r.isOwnerGroup||r.isLane||r.kind==='project'||renaming?.id===r.id) return false;
    if (r.recurrenceParent) return false;
    return true;
  },[selected, rows, expandedTasks, renaming]);

  const sprintBands = useMemo(()=>{
    const b=[]; let n=0;
    axis.days.forEach((d,i)=>{
      if(parseYmd(d).getDay()!==1) return;
      b.push({dayIdx:i,n,isEven:n%2===0,label:`S${n+1}`}); n++;
    });
    return b;
  },[axis.days]);

  const monthSpans = useMemo(()=>{
    const out=[]; let i=0;
    while(i<axis.days.length){
      const start=axis.days[i], m=parseYmd(start).getMonth(); let j=i+1;
      while(j<axis.days.length&&parseYmd(axis.days[j]).getMonth()===m) j++;
      out.push({idx:i,len:j-i,label:MONTHS[m],year:parseYmd(start).getFullYear()}); i=j;
    }
    return out;
  },[axis.days]);

  // ── Refs + scroll sync ──
  const hdrScrollRef   = useRef(null);
  const gridScrollRef  = useRef(null);
  const savedScrollRef = useRef({left:0, top:0}); // persists scroll position across view switches
  const lpaneBodyRef   = useRef(null);
  const syncingRef     = useRef(false);
  const dragStateRef   = useRef(null); // SortableJS drag state (taskId, startX, currentDepth, etc.)

  const onGridScroll = e=>{
    savedScrollRef.current={left:e.target.scrollLeft, top:e.target.scrollTop};
    if(hdrScrollRef.current) hdrScrollRef.current.scrollLeft=e.target.scrollLeft;
    if(!syncingRef.current&&lpaneBodyRef.current){
      syncingRef.current=true;
      lpaneBodyRef.current.scrollTop=e.target.scrollTop;
      syncingRef.current=false;
    }
  };
  const onLpaneScroll = e=>{
    if(!syncingRef.current&&gridScrollRef.current){
      syncingRef.current=true;
      gridScrollRef.current.scrollTop=e.target.scrollTop;
      syncingRef.current=false;
    }
  };

  // Center on today whenever axis or active project changes
  useEffect(()=>{
    const el=gridScrollRef.current; if(!el) return;
    const idx=diffDays(axis.start,todayStr);
    const left=Math.max(0,idx*dayW-el.clientWidth/3);
    el.scrollLeft=left;
    savedScrollRef.current={left, top:savedScrollRef.current.top};
    if(hdrScrollRef.current) hdrScrollRef.current.scrollLeft=left;
  },[axis.start, activeProjectId]); // eslint-disable-line

  // Re-anchor scroll on manual dayWidth changes so today stays centred in the viewport
  const prevDayWRef = useRef(null);
  useLayoutEffect(()=>{
    if(prevDayWRef.current===null){ prevDayWRef.current=dayW; return; } // skip mount
    if(prevDayWRef.current===dayW) return;
    prevDayWRef.current=dayW;
    const el=gridScrollRef.current; if(!el) return;
    const todayPx=diffDays(axis.start,todayStr)*dayW;
    const left=Math.max(0,todayPx-el.clientWidth/2);
    el.scrollLeft=left;
    savedScrollRef.current={left, top:savedScrollRef.current.top};
    if(hdrScrollRef.current) hdrScrollRef.current.scrollLeft=left;
  },[dayW]); // eslint-disable-line

  // Autofit: when tw.fitWidth is on, recompute dayWidth so actual task span fits the viewport
  useEffect(()=>{
    if(!tw.fitWidth) return;
    const el=gridScrollRef.current; if(!el) return;
    const compute=()=>{
      const real=tasks.filter(t=>t.kind!=='project'&&t.start&&t.end);
      if(!real.length) return;
      const minStart=real.reduce((m,t)=>t.start<m?t.start:m,real[0].start);
      const maxEnd  =real.reduce((m,t)=>t.end  >m?t.end  :m,real[0].end);
      const span=diffDays(minStart,maxEnd)+1+14; // +14 = 7 days padding each side
      const target=Math.max(4,Math.min(200,Math.floor(el.clientWidth/span)));
      if(target!==dayW) setTweak('dayWidth',target);
    };
    compute();
    const ro=new ResizeObserver(compute);
    ro.observe(el);
    return ()=>ro.disconnect();
  },[tw.fitWidth,tasks,activeProjectId]); // eslint-disable-line

  // Restore scroll position when returning to the Gantt view
  useLayoutEffect(()=>{
    if(viewMode!=='gantt') return;
    const el=gridScrollRef.current; if(!el) return;
    el.scrollLeft=savedScrollRef.current.left;
    el.scrollTop=savedScrollRef.current.top;
    if(hdrScrollRef.current) hdrScrollRef.current.scrollLeft=savedScrollRef.current.left;
  },[viewMode]); // eslint-disable-line

  // ── Live preview (drag visuals) ──
  const livePreview = t=>{
    if(!drag) return null;
    if(drag.kind==='group-move'&&selectedSet.has(t.id)){
      const orig=drag.groupOffsets?.[t.id]; if(!orig) return null;
      const d=drag.deltaDays;
      return {start:addDays(orig.start,d),end:addDays(orig.end,d)};
    }
    if(drag.id!==t.id||drag.kind==='alt-move') return null;
    const d=drag.deltaDays;
    if(drag.kind==='move') return {start:addDays(t.start,d),end:addDays(t.end,d)};
    if(drag.kind==='l'){let ns=addDays(t.start,d);if(ns>t.end)ns=t.end;return{start:ns,end:t.end};}
    if(drag.kind==='r'){let ne=addDays(t.end,d);if(ne<t.start)ne=t.start;return{start:t.start,end:ne};}
    return null;
  };

  // ── Drag begin ──
  const beginBarDrag = useCallback((e,t,kind)=>{
    if(e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    // Recurring instances are not individually editable — ignore drag attempts.
    if (t.recurrenceParent){ return; }
    // Locked tasks are immovable anchors.
    if (t.locked && (kind==='move'||kind==='l'||kind==='r')){
      showToast('Task is locked — unlock it first.', 'warn'); return;
    }
    const rect=gridScrollRef.current.getBoundingClientRect();
    const inGroup=selectedSet.has(t.id)&&selectedSet.size>1;

    if(e.altKey&&kind==='move'){
      setDrag({id:t.id,kind:'alt-move',startClientX:e.clientX,startClientY:e.clientY,
        origStart:t.start,origEnd:t.end,gridLeft:rect.left,gridScrollLeft:gridScrollRef.current.scrollLeft,
        dx:0,deltaDays:0,currentClientX:e.clientX,currentClientY:e.clientY});
      if(!e.shiftKey){setSelected(t.id);setSelectedSet(new Set([t.id]));}
      return;
    }
    if(inGroup&&kind==='move'){
      const offsets={};
      for(const id of selectedSet){const tt=tasks.find(x=>x.id===id);if(tt&&!tt.locked)offsets[id]={start:tt.start,end:tt.end};}
      setDrag({id:t.id,kind:'group-move',startClientX:e.clientX,startClientY:e.clientY,
        groupOffsets:offsets,gridLeft:rect.left,gridScrollLeft:gridScrollRef.current.scrollLeft,
        dx:0,deltaDays:0,snapped:false,currentClientX:e.clientX,currentClientY:e.clientY});
      return;
    }
    setDrag({id:t.id,kind,startClientX:e.clientX,startClientY:e.clientY,
      origStart:t.start,origEnd:t.end,gridLeft:rect.left,gridScrollLeft:gridScrollRef.current.scrollLeft,
      dx:0,deltaDays:0,snapped:false,hoverDay:t.start,currentClientX:e.clientX,currentClientY:e.clientY});
    if(e.shiftKey){
      setSelectedSet(p=>{const n=new Set(p);n.has(t.id)?n.delete(t.id):n.add(t.id);return n;});
    } else {
      setSelected(t.id); setSelectedSet(new Set([t.id]));
    }
  },[selectedSet,tasks,showToast]);

  const beginDepDrag = useCallback((e,t,endpoint='end')=>{
    e.preventDefault(); e.stopPropagation();
    if (t.recurrenceParent){ return; }
    const rect=gridScrollRef.current.getBoundingClientRect();
    setDrag({id:t.id,kind:'dep',depEndpoint:endpoint,startClientX:e.clientX,startClientY:e.clientY,
      gridLeft:rect.left,gridTop:rect.top,
      gridScrollLeft:gridScrollRef.current.scrollLeft,gridScrollTop:gridScrollRef.current.scrollTop,
      currentClientX:e.clientX,currentClientY:e.clientY});
  },[]);

  // Pick up either endpoint of an existing dep arrow; drop on bar = rewire, drop on empty = delete.
  const beginDepEdit = useCallback((e,fromId,toId,endpoint)=>{
    e.preventDefault(); e.stopPropagation();
    const rect=gridScrollRef.current.getBoundingClientRect();
    setDrag({kind:'dep-edit', fromId, toId, endpoint,
      startClientX:e.clientX, startClientY:e.clientY,
      currentClientX:e.clientX, currentClientY:e.clientY,
      gridLeft:rect.left, gridTop:rect.top,
      gridScrollLeft:gridScrollRef.current.scrollLeft,
      gridScrollTop:gridScrollRef.current.scrollTop});
  },[]);

  const beginProgDrag = useCallback((e,t)=>{
    e.preventDefault(); e.stopPropagation();
    if (t.recurrenceParent){ return; }
    const rect=gridScrollRef.current.getBoundingClientRect();
    const barX=diffDays(axis.start,t.start)*dayW, barW=(diffDays(t.start,t.end)+1)*dayW-2;
    setDrag({id:t.id,kind:'prog',startClientX:e.clientX,startClientY:e.clientY,
      gridLeft:rect.left,gridScrollLeft:gridScrollRef.current.scrollLeft,
      barX,barW,liveProgress:t.progress||0,currentClientX:e.clientX,currentClientY:e.clientY});
  },[axis.start,dayW]);

  const onGridPointerDown = useCallback(e=>{
    if(e.target.closest('[data-bar-id]')||e.target.closest('.bar-handle')||e.target.closest('.dep-knob')) return;
    const grid=gridScrollRef.current; if(!grid) return;
    const rect=grid.getBoundingClientRect();
    const sl=grid.scrollLeft, st=grid.scrollTop;
    const lx=e.clientX-rect.left+sl, ly=e.clientY-rect.top+st;

    if(e.shiftKey){
      e.preventDefault();
      setLasso({x1:lx,y1:ly,x2:lx,y2:ly});
      setDrag({kind:'lasso',startClientX:e.clientX,startClientY:e.clientY,
        gridLeft:rect.left,gridTop:rect.top,gridScrollLeft:sl,gridScrollTop:st,
        currentClientX:e.clientX,currentClientY:e.clientY});
      return;
    }
    e.preventDefault();
    grid.classList.add('panning');
    if(!drawerPinned){ setSelected(null); setSelectedSet(new Set()); }
    setDrag({kind:'pan',startClientX:e.clientX,startClientY:e.clientY,
      startScrollLeft:sl,startScrollTop:st});
  },[drawerPinned]);

  const onGridDblClick = useCallback(e=>{
    if(e.target.closest('[data-bar-id],.bar-handle,.dep-knob')) return;
    const grid=gridScrollRef.current; if(!grid) return;
    const rect=grid.getBoundingClientRect();
    const lx=e.clientX-rect.left+grid.scrollLeft;
    const ly=e.clientY-rect.top+grid.scrollTop;
    const dayIdx=Math.max(0,Math.min(axis.days.length-1,Math.floor(lx/dayW)));
    const rowIdx=Math.max(0,Math.min(rows.length-1,Math.floor(ly/rowH)));
    const row=rows[rowIdx];
    if(!row||row.isProject||row.isOwnerGroup) return;
    const clickDay=axis.days[dayIdx];
    const s=isWorkingDay(clickDay,calendar)?clickDay:addWorkingDays(clickDay,0,calendar);
    const en=addWorkingDays(s,2,calendar);
    let proj=row.project||null;
    if(proj==null){
      for(let i=tasks.length-1;i>=0;i--){
        const tt=tasks[i];
        if(tt.kind!=='project'&&tt.project){proj=tt.project;break;}
      }
    }
    const nid='task-'+Date.now().toString(36);
    const nt={id:nid,parent:row.parent||null,project:proj,title:'New task',
      start:s,end:en,priority:'p3',progress:0,color:'#96c6e8'};
    updateTasks(ts=>[...ts,nt]);
    setSelected(nid); setRenaming({id:nid,value:nt.title});
  },[rows,axis.days,dayW,rowH,tasks,calendar]);

  // ── Main drag effect ──
  useEffect(()=>{
    if(!drag) return;
    const onMove=e=>{
      const grid=gridScrollRef.current; if(!grid) return;
      const rect=grid.getBoundingClientRect();
      const lx=e.clientX-rect.left+grid.scrollLeft, ly=e.clientY-rect.top+grid.scrollTop;

      if(drag.kind==='pan'){
        const dx=e.clientX-drag.startClientX;
        const dy=e.clientY-drag.startClientY;
        if(Math.abs(dx)>5||Math.abs(dy)>5){
          grid.scrollLeft=drag.startScrollLeft-dx;
          grid.scrollTop=drag.startScrollTop-dy;
        }
        return;
      }
      if(drag.kind==='prog'){
        const p=Math.max(0,Math.min(1,(lx-drag.barX)/drag.barW));
        setDrag(d=>d&&({...d,liveProgress:p,currentClientX:e.clientX,currentClientY:e.clientY})); return;
      }
      if(drag.kind==='lasso'){
        setLasso(l=>l&&({...l,x2:lx,y2:ly}));
        setDrag(d=>d&&({...d,currentClientX:e.clientX,currentClientY:e.clientY})); return;
      }
      if(drag.kind==='create'){
        const di=Math.max(0,Math.min(axis.days.length-1,Math.floor(lx/dayW)));
        setDrag(d=>d&&({...d,endDay:axis.days[di],currentClientX:e.clientX,currentClientY:e.clientY})); return;
      }
      if(drag.kind==='dep'||drag.kind==='dep-edit'){
        setDrag(d=>d&&({...d,currentClientX:e.clientX,currentClientY:e.clientY})); return;
      }
      const dx=e.clientX-drag.startClientX;
      const snap=tw.snapToDay!==false;
      let days=snap?Math.round(dx/dayW):dx/dayW, snapped=false;

      if(drag.kind==='move'||drag.kind==='group-move'){
        const t=tasks.find(x=>x.id===drag.id);
        const taskDeps = depList(t);
        if(taskDeps.length){
          const origStart=drag.origStart||(drag.groupOffsets?.[drag.id]?.start);
          if(origStart){
            const byId=new Map(tasks.map(x=>[x.id,x]));
            const newStart=addDays(origStart,days);
            for(const dEdge of taskDeps){
              const dep=byId.get(dEdge.id); if(!dep) continue;
              const ideal = dEdge.type === 'SS' ? addWorkingDays(dep.start, dEdge.lag, calendar)
                          : dEdge.type === 'FF' ? addDays(addWorkingDays(dep.end, dEdge.lag, calendar), -diffDays(t.start,t.end))
                          : dEdge.type === 'SF' ? addDays(addWorkingDays(dep.start, dEdge.lag, calendar), -diffDays(t.start,t.end))
                          : addWorkingDays(dep.end, 1 + dEdge.lag, calendar);
              if(Math.abs(diffDays(newStart,ideal))<=1){
                days=diffDays(origStart,ideal); snapped=true;
                const ri=rows.findIndex(r=>r.id===drag.id);
                setSnapInfo({x:xForDay(ideal),y:ri*rowH,label:`${dEdge.lag}d ${dEdge.type}`});
                break;
              }
            }
          }
        }
        if(!snapped) setSnapInfo(null);
      }
      const ri=Math.floor(ly/rowH);
      const di=Math.max(0,Math.min(axis.days.length-1,Math.floor(lx/dayW)));
      setDrag(d=>d&&({...d,dx,deltaDays:days,snapped,currentClientX:e.clientX,currentClientY:e.clientY,hoverRowIdx:ri,hoverDay:axis.days[di]}));
    };

    const onUp=e=>{
      setSnapInfo(null);
      gridScrollRef.current?.classList.remove('panning');
      if(drag.kind==='pan'){ setDrag(null); return; }
      const dx=e.clientX-drag.startClientX;
      const days=Math.round(dx/dayW);

      if(drag.kind==='prog'){
        const grid=gridScrollRef.current; if(!grid){setDrag(null);return;}
        const lx=e.clientX-grid.getBoundingClientRect().left+grid.scrollLeft;
        const p=Math.max(0,Math.min(1,(lx-drag.barX)/drag.barW));
        updateTasks(ts=>ts.map(t=>t.id===drag.id?{...t,progress:p>=.98?1:p,done:p>=.98,status:p>=.98?'done':t.status}:t));
        setDrag(null); return;
      }

      if(drag.kind==='lasso'){
        if(lasso){
          const x1=Math.min(lasso.x1,lasso.x2),x2=Math.max(lasso.x1,lasso.x2);
          const y1=Math.min(lasso.y1,lasso.y2),y2=Math.max(lasso.y1,lasso.y2);
          const sel=new Set();
          rows.forEach((r,i)=>{
            if(r.isProject||r.isOwnerGroup||r.isLane) return;
            const bx=diffDays(axis.start,r.start)*dayW;
            const bw=r.milestone?dayW:(diffDays(r.start,r.end)+1)*dayW;
            if(bx<x2&&bx+bw>x1&&i*rowH<y2&&(i+1)*rowH>y1) sel.add(r.id);
          });
          setSelectedSet(sel); if(sel.size===1) setSelected([...sel][0]);
        }
        setLasso(null); setDrag(null); return;
      }

      if(drag.kind==='create'){
        let s=drag.startDay,en=drag.endDay;
        if(s>en){const tmp=s;s=en;en=tmp;}
        // Default duration of 3 working days on click-create (drag with no width).
        if(diffDays(s,en)===0){
          const ws = isWorkingDay(s, calendar) ? s : addWorkingDays(s, 0, calendar);
          s = ws; en = addWorkingDays(ws, 2, calendar);
        }
        if(diffDays(s,en)>=0){
          const nid='task-'+Date.now().toString(36);
          const nt={id:nid,parent:drag.parentId,project:drag.project,title:'New task',
            start:s,end:en,priority:'p3',progress:0,color:'#96c6e8'};
          updateTasks(ts=>[...ts,nt]);
          setSelected(nid); setRenaming({id:nid,value:nt.title,source:'bar'});
        }
        setDrag(null); return;
      }

      if(drag.kind==='dep-edit'){
        const target=document.elementFromPoint(e.clientX,e.clientY);
        const barEl=target?.closest?.('[data-bar-id]');
        const tid=barEl?.getAttribute('data-bar-id');
        const {fromId, toId, endpoint} = drag;
        if(!tid){
          // Dropped on empty space → delete the dep
          deleteDependency(fromId, toId);
        } else if(endpoint==='to' && tid!==toId && tid!==fromId){
          // Move dep to a new successor — preserve type & lag
          if(wouldCreateCycle(tasks, fromId, tid)){
            showToast('Circular dependency — cannot move this dep here.', 'err');
          } else {
            const oldChild = tasks.find(t=>t.id===toId);
            const existingEdge = oldChild ? depList(oldChild).find(d=>d.id===fromId) : null;
            const carry = existingEdge ? {type:existingEdge.type, lag:existingEdge.lag} : {type:'FS',lag:0};
            updateTasks(ts=>applySchedule(ts.map(t=>{
              if(t.id===toId) return {...t, deps: depList(t).filter(d=>d.id!==fromId)};
              if(t.id===tid){
                const list = depList(t);
                if(list.some(d=>d.id===fromId)) return t;
                return {...t, deps:[...list, {id:fromId, ...carry}]};
              }
              return t;
            }), tid));
          }
        } else if(endpoint==='from' && tid!==fromId && tid!==toId){
          // Rewire predecessor — keep edge on toId, swap its .id field
          if(wouldCreateCycle(tasks, tid, toId)){
            showToast('Circular dependency — cannot rewire to this task.', 'err');
          } else {
            updateTasks(ts=>applySchedule(ts.map(t=>{
              if(t.id!==toId) return t;
              return {...t, deps: depList(t).map(d=>d.id===fromId?{...d,id:tid}:d)};
            }), toId));
          }
        }
        setDrag(null); return;
      }

      if(drag.kind==='dep'){
        const target=document.elementFromPoint(e.clientX,e.clientY);
        const barEl=target?.closest?.('[data-bar-id]');
        const tid=barEl?.getAttribute('data-bar-id');
        if(tid&&tid!==drag.id){
          // Left knob: drag.id is successor, tid is predecessor. Right knob: reversed.
          const [predId, succId] = drag.depEndpoint==='start' ? [tid, drag.id] : [drag.id, tid];
          if(wouldCreateCycle(tasks, predId, succId)){
            const srcTitle = tasks.find(t=>t.id===predId)?.title||predId;
            const dstTitle = tasks.find(t=>t.id===succId)?.title||succId;
            showToast(`Circular dependency — "${dstTitle}" already has a path back to "${srcTitle}".`, 'err');
          } else {
            updateTasks(ts=>applySchedule(ts.map(t=>{
              if(t.id!==succId) return t;
              const existing = depList(t);
              if (existing.some(d => d.id === predId)) return t;
              return {...t, deps:[...existing, {id: predId, type:'FS', lag:0}]};
            }), succId));
          }
        } else if(!tid){
          if(drag.depEndpoint!=='start'){
            const src=tasks.find(t=>t.id===drag.id);
            if(src){
              const nid='task-'+Date.now().toString(36);
              const ns=addWorkingDays(src.end,1,calendar);
              const ne=addWorkingDays(ns,2,calendar);
              const nt={id:nid,parent:src.parent,project:src.project,title:'New successor',
                start:ns,end:ne,priority:'p3',progress:0,color:src.color||'#96c6e8',deps:[{id:drag.id,type:'FS',lag:0}]};
              updateTasks(ts=>[...ts,nt]); setSelected(nid); setRenaming({id:nid,value:nt.title});
            }
          }
        }
        setDrag(null); return;
      }

      const applyMove=ts=>{
        if(drag.kind==='move'&&days!==0){
          const next=ts.map(t=>t.id!==drag.id?t:{...t,start:addDays(drag.origStart,days),end:addDays(drag.origEnd,days)});
          return applySchedule(next,drag.id);
        }
        if(drag.kind==='alt-move'){
          if(!days)return ts;
          const t=ts.find(x=>x.id===drag.id); if(!t)return ts;
          const nid=t.id+'-c'+Math.random().toString(36).slice(2,5);
          const copy={...t,id:nid,title:t.title+' (copy)',start:addDays(drag.origStart,days),end:addDays(drag.origEnd,days),deps:[{id:t.id,type:'FS',lag:0}],done:false,progress:0};
          setTimeout(()=>setSelected(nid),0);
          return [...ts,copy];
        }
        if(drag.kind==='group-move'&&days!==0){
          let next=ts.map(t=>{ const o=drag.groupOffsets?.[t.id]; return o&&!t.locked?{...t,start:addDays(o.start,days),end:addDays(o.end,days)}:t; });
          if (autoSchedule === 'full') next = fullAutoSchedule(next, calendar);
          else if (autoSchedule === 'cascade') for(const id of Object.keys(drag.groupOffsets||{})) next=cascadeAfterMove(next,id,calendar);
          return next;
        }
        if(drag.kind==='l'&&days!==0){
          return ts.map(t=>{ if(t.id!==drag.id)return t; let ns=addDays(drag.origStart,days); if(ns>t.end)ns=t.end; return{...t,start:ns}; });
        }
        if(drag.kind==='r'&&days!==0){
          const next=ts.map(t=>{ if(t.id!==drag.id)return t; let ne=addDays(drag.origEnd,days); if(ne<t.start)ne=t.start; return{...t,end:ne}; });
          return applySchedule(next,drag.id);
        }
        return ts;
      };

      updateTasks(ts=>applyMove(ts));
      setDrag(null);
    };

    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp,{once:true});
    return ()=>{ window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp); };
  },[drag,lasso,dayW,rowH,axis,tw.snapToDay,rows,tasks,xForDay,updateTasks,applySchedule,autoSchedule,calendar,showToast]);

  // ── Task operations ──
  const toggleLock = useCallback(id=>{
    updateTasks(ts=>ts.map(t=>t.id===id?{...t,locked:!t.locked}:t));
  },[updateTasks]);

  const splitTask=useCallback(id=>{
    updateTasks(ts=>{
      const idx=ts.findIndex(t=>t.id===id); if(idx<0)return ts;
      const t=ts[idx]; const dur=diffDays(t.start,t.end)+1;
      if(dur<2||t.milestone||t.kind==='project')return ts;
      const half=Math.floor(dur/2);
      const nid=t.id+'-b'+Math.random().toString(36).slice(2,5);
      const next=[...ts]; next[idx]={...t,end:addDays(t.start,half-1)};
      const b={...t,id:nid,start:addDays(t.start,half),end:t.end,title:t.title+' (cont.)',deps:[{id:t.id,type:'FS',lag:0}],progress:0,done:false};
      next.splice(idx+1,0,b);
      // Rewrite downstream deps pointing at t -> b, preserving type/lag.
      return next.map((x,i)=>{
        if(i<=idx+1)return x;
        const list = depList(x);
        if(!list.some(d=>d.id===t.id)) return x;
        return {...x, deps: list.map(d=> d.id===t.id ? {...d, id: nid} : d)};
      });
    });
  },[updateTasks]);

  const toggleMilestone=useCallback(id=>{ updateTasks(ts=>ts.map(t=>{ if(t.id!==id||t.kind==='project')return t; return t.milestone?{...t,milestone:false,end:addDays(t.start,2)}:{...t,milestone:true,end:t.start}; })); },[updateTasks]);
  // Update lag uniformly across all incoming deps for a task (best approximation of old per-task lag behavior).
  const setLagOnIncoming=useCallback((id,lag)=>{ updateTasks(ts=>ts.map(t=>t.id===id?{...t,deps:depList(t).map(d=>({...d,lag}))}:t)); },[updateTasks]);
  const toggleBlocking=useCallback(id=>{ updateTasks(ts=>ts.map(t=>t.id===id?{...t,blocking:!t.blocking}:t)); },[updateTasks]);

  const duplicateTask=useCallback(id=>{
    updateTasks(ts=>{
      const idx=ts.findIndex(t=>t.id===id); if(idx<0)return ts;
      const t=ts[idx]; if(t.kind==='project')return ts;
      const dur=diffDays(t.start,t.end);
      const nid=t.id+'-dup'+Math.random().toString(36).slice(2,5);
      const copy={...t,id:nid,title:t.title+' (copy)',start:addDays(t.end,1),end:addDays(t.end,1+dur),deps:[{id:t.id,type:'FS',lag:0}],done:false,progress:0};
      const next=[...ts]; next.splice(idx+1,0,copy); return next;
    });
  },[updateTasks]);

  const inferParentForNewTask=useCallback(()=>{
    if(!selected) return null;
    const t=tasks.find(x=>x.id===selected);
    if(!t) return null;
    if(t.kind==='project') return t.id;
    return t.parent||null;
  },[selected,tasks]);

  const addTask=useCallback((parentId)=>{
    const pid=parentId===undefined?null:parentId;
    const newId='t-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const newTask={id:newId,parent:pid,title:'New task',start:todayStr,end:addDays(todayStr,2),priority:'p2',progress:0,done:false,status:'todo',deps:[],tags:[],comments:[]};
    updateTasks(ts=>{
      if(!pid) return [...ts,newTask];
      let lastIdx=-1;
      ts.forEach((t,i)=>{ if(t.parent===pid) lastIdx=i; });
      if(lastIdx<0){
        const pIdx=ts.findIndex(t=>t.id===pid);
        const out=[...ts]; out.splice(pIdx>=0?pIdx+1:ts.length,0,newTask); return out;
      }
      const out=[...ts]; out.splice(lastIdx+1,0,newTask); return out;
    });
    setSelected(newId);
    setSelectedSet(new Set([newId]));
    setRenaming({id:newId,value:'New task'});
  },[updateTasks,setSelected,setSelectedSet,setRenaming]);

  const focusDepSubtree=useCallback(id=>{
    setFocusChain(prev=>{ const c=getDepChain(tasks,id); return(prev&&prev.size===c.size&&[...c].every(x=>prev.has(x)))?null:c; });
  },[tasks]);

  // ── Bulk operations (multi-select) ──
  const bulkDelete=useCallback((ids)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    updateTasks(ts=>ts
      .filter(tt=>!idset.has(tt.id))
      .map(tt=>{
        const list = depList(tt);
        if (!list.some(d=>idset.has(d.id))) return tt;
        return {...tt, deps: list.filter(d=>!idset.has(d.id))};
      }));
    setSelected(null); setSelectedSet(new Set());
  },[updateTasks]);

  const bulkSetField=useCallback((ids, field, value)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    updateTasks(ts=>ts.map(t=>idset.has(t.id)?{...t,[field]:value}:t));
  },[updateTasks]);

  const bulkDuplicate=useCallback((ids)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    const newIds = new Set();
    updateTasks(ts=>{
      const src = ts.filter(t=>idset.has(t.id) && t.kind!=='project');
      const idMap = new Map();
      const copies = src.map(t=>{
        const nid = t.id + '-dup' + Math.random().toString(36).slice(2,5);
        idMap.set(t.id, nid); newIds.add(nid);
        const dur = diffDays(t.start, t.end);
        const ns = addDays(t.end, 1);
        return {...t, id:nid, title:t.title+' (copy)', start:ns, end:addDays(ns,dur), deps:[{id:t.id,type:'FS',lag:0}], done:false, progress:0};
      });
      return [...ts, ...copies];
    });
    setTimeout(()=>{ setSelectedSet(newIds); if(newIds.size===1) setSelected([...newIds][0]); }, 0);
  },[updateTasks]);

  // Adds an owner to the active project's owners list (idempotent)
  const addOwnerToList=useCallback((name)=>{
    if (!name || !activeProject) return;
    const list = activeProject.owners || [];
    if (list.some(o => o.name === name)) return;
    updateActiveProject({ owners: [...list, { name }] });
  },[activeProject, updateActiveProject]);

  // ── Right-click helpers ──

  // Set task duration in calendar days (1d, 3d, 1w, etc.). Keeps start; updates end via applySchedule.
  const setTaskDuration=useCallback((id, days)=>{
    const n = Math.max(1, parseInt(days,10)||1);
    updateTasks(ts=>applySchedule(ts.map(t=>t.id===id&&!t.milestone&&t.kind!=='project'
      ? {...t, end: addDays(t.start, n-1)}
      : t
    ), id));
  },[updateTasks,applySchedule]);

  // Move a task to a different project. Clear parent (it belonged to old project's hierarchy).
  const moveTaskToProject=useCallback((id, projectId)=>{
    if(!projectId) return;
    updateTasks(ts=>ts.map(t=>t.id===id?{...t, project:projectId, parent:null}:t));
  },[updateTasks]);

  // Insert a sibling task above or below a reference task. Inherits parent + project.
  const insertSiblingTask=useCallback((refId, position /* 'above'|'below' */)=>{
    const newId='t-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    updateTasks(ts=>{
      const idx=ts.findIndex(t=>t.id===refId); if(idx<0) return ts;
      const ref=ts[idx];
      const ns=ref.start, ne=ref.start; // default to a one-day task on ref's start
      const fresh={
        id:newId, parent:ref.parent||null,
        ...(ref.project?{project:ref.project}:{}),
        title:'New task', start:ns, end:ne,
        priority:ref.priority||'p3', progress:0, done:false, status:'todo',
        deps:[], tags:[], comments:[]
      };
      const out=[...ts];
      out.splice(position==='above'?idx:idx+1, 0, fresh);
      return out;
    });
    setSelected(newId); setSelectedSet(new Set([newId]));
    setRenaming({id:newId,value:'New task'});
  },[updateTasks]);

  // Indent: set parent to previous sibling (with same parent) above this task.
  const indentTask=useCallback((id)=>{
    const t=tasks.find(x=>x.id===id);
    if(!t||t.kind==='project'||t.recurrenceParent) return;
    const tIdx=tasks.findIndex(x=>x.id===id);
    let prev=null;
    for(let i=tIdx-1;i>=0;i--){
      const x=tasks[i];
      if((x.parent||null)===(t.parent||null) && x.kind!=='project' && x.id!==id){ prev=x; break; }
    }
    if(!prev) return;
    updateTasks(ts=>ts.map(tt=>tt.id===id?{...tt,parent:prev.id}:tt));
    setCollapsed(c=>{ if(!c.has(prev.id))return c; const n=new Set(c); n.delete(prev.id); return n; });
  },[tasks,updateTasks]);

  // Outdent: set parent to current parent's parent (or null if grandparent is a project).
  const outdentTask=useCallback((id)=>{
    const t=tasks.find(x=>x.id===id);
    if(!t||t.kind==='project'||t.recurrenceParent||!t.parent) return;
    const curParent=tasks.find(x=>x.id===t.parent);
    if(!curParent||curParent.kind==='project') return;
    const newParent=curParent.parent||null;
    updateTasks(ts=>ts.map(tt=>tt.id===id?{...tt,parent:newParent}:tt));
  },[tasks,updateTasks]);

  // Batch indent: walk ids in document order so each task's "previous sibling" lookup
  // sees the in-progress mutation (a task moved earlier in the loop may itself become
  // the previous sibling of a later one). Single updateTasks call → one undo step.
  const indentTasks=useCallback((ids)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    if(!idset.size) return;
    updateTasks(ts=>{
      const orderedIds = ts.filter(t=>idset.has(t.id)).map(t=>t.id);
      let next = ts;
      for(const id of orderedIds){
        const t = next.find(x=>x.id===id);
        if(!t || t.kind==='project' || t.recurrenceParent) continue;
        const tIdx = next.findIndex(x=>x.id===id);
        let prev = null;
        for(let i=tIdx-1; i>=0; i--){
          const x = next[i];
          if((x.parent||null)===(t.parent||null) && x.kind!=='project' && x.id!==id){ prev = x; break; }
        }
        if(!prev) continue;
        next = next.map(tt=>tt.id===id?{...tt,parent:prev.id}:tt);
      }
      return next;
    });
    // Auto-expand the new parents so the moved rows stay visible
    setCollapsed(c=>{
      const n = new Set(c); let changed = false;
      idset.forEach(id=>{
        const t = tasksRef.current.find(x=>x.id===id);
        if(t && t.parent && n.has(t.parent)){ n.delete(t.parent); changed = true; }
      });
      return changed ? n : c;
    });
  },[updateTasks]);

  // Batch outdent: iterate in REVERSE document order so a parent's outdent doesn't
  // shift its still-pending children out from under us.
  const outdentTasks=useCallback((ids)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    if(!idset.size) return;
    updateTasks(ts=>{
      const orderedIds = ts.filter(t=>idset.has(t.id)).map(t=>t.id).reverse();
      let next = ts;
      for(const id of orderedIds){
        const t = next.find(x=>x.id===id);
        if(!t || t.kind==='project' || t.recurrenceParent || !t.parent) continue;
        const curParent = next.find(x=>x.id===t.parent);
        if(!curParent || curParent.kind==='project') continue;
        const newParent = curParent.parent || null;
        next = next.map(tt=>tt.id===id?{...tt,parent:newParent}:tt);
      }
      return next;
    });
  },[updateTasks]);

  // Copy: deep clone selected tasks into clipboard state.
  const copyTasks=useCallback((ids)=>{
    const idset = ids instanceof Set ? ids : new Set(ids);
    const cloned = tasks.filter(t=>idset.has(t.id) && t.kind!=='project').map(t=>JSON.parse(JSON.stringify(t)));
    if(!cloned.length) return;
    setClipboard({tasks:cloned, ts:Date.now()});
  },[tasks]);

  // Paste: clone clipboard tasks with new ids, optionally shifted to a target start day.
  const pasteTasks=useCallback((atDay /* yyyy-mm-dd or null */)=>{
    if(!clipboard || !clipboard.tasks?.length) return;
    const newIds=new Set();
    const idMap=new Map();
    let dayShift=0;
    if(atDay && clipboard.tasks[0].start){
      dayShift = diffDays(clipboard.tasks[0].start, atDay);
    }
    updateTasks(ts=>{
      const fresh = clipboard.tasks.map((t,i)=>{
        const nid='t-'+Date.now().toString(36)+i+Math.random().toString(36).slice(2,4);
        idMap.set(t.id,nid); newIds.add(nid);
        return {
          ...JSON.parse(JSON.stringify(t)),
          id:nid,
          title:t.title+' (copy)',
          start: dayShift ? addDays(t.start, dayShift) : t.start,
          end:   dayShift ? addDays(t.end,   dayShift) : t.end,
          deps: [],   // strip cross-clipboard deps
          done:false, progress:0,
        };
      });
      return [...ts, ...fresh];
    });
    setTimeout(()=>{ setSelectedSet(newIds); if(newIds.size===1) setSelected([...newIds][0]); },0);
  },[clipboard,updateTasks]);

  // Dependency-arrow helpers
  const deleteDependency=useCallback((fromId, toId)=>{
    updateTasks(ts=>applySchedule(ts.map(t=>t.id===toId?{...t, deps: depList(t).filter(d=>d.id!==fromId)}:t), toId));
  },[updateTasks,applySchedule]);
  const setDepType=useCallback((fromId, toId, type)=>{
    updateTasks(ts=>applySchedule(ts.map(t=>t.id===toId?{...t, deps: depList(t).map(d=>d.id===fromId?{...d,type}:d)}:t), toId));
  },[updateTasks,applySchedule]);
  const setDepLag=useCallback((fromId, toId, lag)=>{
    updateTasks(ts=>applySchedule(ts.map(t=>t.id===toId?{...t, deps: depList(t).map(d=>d.id===fromId?{...d,lag}:d)}:t), toId));
  },[updateTasks,applySchedule]);

  // Create a new task at a specific day (from right-click on empty grid).
  const addTaskAtDay=useCallback((day, contextRow)=>{
    const newId='t-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const inherit = contextRow && contextRow.kind!=='project'
      ? { parent: contextRow.parent||null, ...(contextRow.project?{project:contextRow.project}:{}) }
      : (contextRow && contextRow.kind==='project'
        ? { parent: contextRow.id, ...(contextRow.project?{project:contextRow.project}:{}) }
        : (activeProject ? { parent:null, project:activeProject.id } : { parent:null }));
    const fresh={
      id:newId, ...inherit,
      title:'New task', start:day, end:day,
      priority:'p3', progress:0, done:false, status:'todo',
      deps:[], tags:[], comments:[]
    };
    updateTasks(ts=>[...ts, fresh]);
    setSelected(newId); setSelectedSet(new Set([newId]));
    setRenaming({id:newId,value:'New task',source:'bar'});
  },[updateTasks,activeProject]);


  const commitRename=useCallback(()=>{
    setRenaming(r=>{ if(!r)return null; const v=r.value.trim(); if(v)updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,title:v}:t)); return null; });
  },[updateTasks]);

  // Click-away commit for inline rename inputs (bar-rename / row-rename).
  // onBlur alone can be skipped if the input unmounts before blur fires
  // (e.g. another bar's onClick triggers a re-render). Capture-phase pointerdown
  // outside any rename input commits the pending rename.
  useEffect(()=>{
    if(!renaming) return;
    const onDown=(e)=>{
      if(e.target?.closest?.('.row-rename, .bar-rename, .ins-title-input')) return;
      commitRename();
    };
    window.addEventListener('pointerdown', onDown, true);
    return ()=>window.removeEventListener('pointerdown', onDown, true);
  },[renaming, commitRename]);

  // Auto-commit duration buffer
  useEffect(()=>{
    if(!durationBuf||!selected)return;
    const tid=setTimeout(()=>{
      const n=parseInt(durationBuf,10);
      if(!isNaN(n)&&n>0) updateTasks(ts=>{ const next=ts.map(t=>t.id===selected&&!t.milestone&&t.kind!=='project'?{...t,end:addDays(t.start,n-1)}:t); return applySchedule(next,selected); });
      setDurationBuf('');
    },700);
    return ()=>clearTimeout(tid);
  },[durationBuf,selected,updateTasks,applySchedule]);

  // ── Keyboard ──
  useEffect(()=>{
    const onKey=e=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
      if(e.key==='Escape'){
        setFocusChain(null);setCtxMenu(null);setRenaming(null);setDurationBuf('');setFileMenuOpen(false);setProjCtxMenu(null);setBulkPicker(null);setRecurEditor(null);setTmplModal(null);setHelpOpen(false);setLoadError(null);setGridCtxMenu(null);setDepCtxMenu(null);setCtxSubmenu(null);
        // Respect pin: don't dismiss the drawer (selection) when pinned
        if(!drawerPinned){ setSelected(null); setSelectedSet(new Set()); selAnchorRef.current = null; }
        return;
      }
      if(!selected)return;
      // If selected is a recurring instance (no source-task match), ignore keyboard ops.
      const t=tasks.find(x=>x.id===selected); if(!t)return;
      // Tab / Shift+Tab — indent / outdent selected task (keyboard equivalent of drag-to-indent)
      if(e.key==='Tab'){
        e.preventDefault();
        if(t.kind==='project'||t.recurrenceParent)return;
        // Multi-select: batch-apply via indentTasks / outdentTasks (single undo step)
        if(selectedSet.size > 1){
          if(e.shiftKey) outdentTasks(selectedSet);
          else           indentTasks(selectedSet);
          return;
        }
        if(e.shiftKey){
          // Outdent: set parent = current parent's parent (or null if at root)
          const curParent = t.parent ? tasks.find(x=>x.id===t.parent) : null;
          if(!curParent || curParent.kind==='project')return; // already a top-level child
          const newParent = curParent.parent || null;
          updateTasks(ts=>ts.map(tt=>tt.id===selected?{...tt,parent:newParent}:tt));
        } else {
          // Indent: set parent = previous sibling (must exist with same parent)
          const sameParentSiblings = tasks.filter(x=>(x.parent||null)===(t.parent||null) && x.id!==selected && x.kind!=='project');
          if(!sameParentSiblings.length)return;
          // Find prev sibling = the sibling immediately before `t` in the tasks array
          const tIdx = tasks.findIndex(x=>x.id===selected);
          let prev=null;
          for(let i=tIdx-1;i>=0;i--){
            const x=tasks[i];
            if((x.parent||null)===(t.parent||null) && x.kind!=='project' && x.id!==selected){ prev=x; break; }
          }
          if(!prev)return;
          updateTasks(ts=>ts.map(tt=>tt.id===selected?{...tt,parent:prev.id}:tt));
          // Auto-expand the new parent so the moved task stays visible
          setCollapsed(c=>{ if(!c.has(prev.id))return c; const n=new Set(c); n.delete(prev.id); return n; });
        }
        return;
      }
      const mod=e.metaKey||e.ctrlKey;
      if(mod&&(e.key==='s'||e.key==='S')) return; // handled by global effect
      if(mod&&(e.key==='d'||e.key==='D')){e.preventDefault();duplicateTask(selected);return;}
      if(mod&&(e.key==='e'||e.key==='E')){e.preventDefault();focusDepSubtree(selected);return;}
      if(e.key==='F2'||(e.key==='Enter'&&!durationBuf)){e.preventDefault();setRenaming({id:selected,value:t.title});return;}
      if(e.key==='Enter'&&durationBuf){
        e.preventDefault(); const n=parseInt(durationBuf,10);
        if(!isNaN(n)&&n>0) updateTasks(ts=>applySchedule(ts.map(tt=>tt.id===selected&&!tt.milestone&&tt.kind!=='project'?{...tt,end:addDays(tt.start,n-1)}:tt),selected));
        setDurationBuf(''); return;
      }
      if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.shiftKey){
        e.preventDefault(); const d=e.key==='ArrowLeft'?-1:1;
        updateTasks(ts=>{ const next=ts.map(tt=>{ if(tt.id!==selected||tt.kind==='project'||tt.milestone)return tt; const ne=addDays(tt.end,d); return parseYmd(ne)<parseYmd(tt.start)?tt:{...tt,end:ne}; }); return applySchedule(next,selected); }); return;
      }
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
        e.preventDefault(); const d=e.key==='ArrowLeft'?-1:1;
        updateTasks(ts=>applySchedule(ts.map(tt=>tt.id===selected?{...tt,start:addDays(tt.start,d),end:addDays(tt.end,d)}:tt),selected)); return;
      }
      if(/^[0-9]$/.test(e.key)&&!mod&&!t.milestone&&t.kind!=='project'){e.preventDefault();setDurationBuf(b=>(b+e.key).slice(0,3));return;}
      if((e.key==='Backspace'||e.key==='Delete')&&durationBuf){e.preventDefault();setDurationBuf(b=>b.slice(0,-1));return;}
      if(mod&&(e.key==='Delete'||e.key==='Backspace')){
        e.preventDefault();
        const ids = selectedSet.size>1 ? new Set(selectedSet) : new Set([selected]);
        updateTasks(ts=>ts.map(tt=>ids.has(tt.id)?{...tt,deps:[]}:tt));
        return;
      }
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();
        const ids = selectedSet.size>1 ? new Set(selectedSet) : new Set([selected]);
        updateTasks(ts=>ts.filter(tt=>!ids.has(tt.id)).map(tt=>{
          const list = depList(tt);
          if (!list.some(d=>ids.has(d.id))) return tt;
          return {...tt, deps: list.filter(d=>!ids.has(d.id))};
        }));
        setSelected(null); setSelectedSet(new Set());
        return;
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[selected,selectedSet,tasks,durationBuf,duplicateTask,focusDepSubtree,updateTasks,applySchedule,drawerPinned,indentTasks,outdentTasks]);

  // Escape key to dismiss custom modal
  useEffect(()=>{
    if(!modal)return;
    const onKey=e=>{ if(e.key==='Escape') closeModal(modal.type==='confirm'?false:null); };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[modal,closeModal]);

  // Click-away for ctx menus and file menu and bulk picker
  useEffect(()=>{
    if(!ctxMenu&&!projCtxMenu&&!fileMenuOpen&&!bulkPicker&&!gridCtxMenu&&!depCtxMenu&&!ctxSubmenu&&!groupCtxMenu&&!predPicker)return;
    const fn=(e)=>{
      if(e.target?.closest('.ctx-menu,.bulk-picker,.file-menu-drop,.pred-picker'))return;
      setCtxMenu(null);setProjCtxMenu(null);setFileMenuOpen(false);setBulkPicker(null);setGridCtxMenu(null);setDepCtxMenu(null);setCtxSubmenu(null);setGroupCtxMenu(null);setPredPicker(null);
    };
    window.addEventListener('pointerdown',fn,true); window.addEventListener('scroll',fn,true);
    return ()=>{ window.removeEventListener('pointerdown',fn,true); window.removeEventListener('scroll',fn,true); };
  },[ctxMenu,projCtxMenu,fileMenuOpen,bulkPicker,gridCtxMenu,depCtxMenu,ctxSubmenu,groupCtxMenu,predPicker]);

  // Click-away for the inspector drawer (overlay mode). Capture-phase so it runs
  // before bar onClick handlers, but explicit guards let those still re-select.
  // When pinned, click-away is disabled — drawer stays open until × or another bar selection.
  useEffect(()=>{
    if(!selected || drawerPinned) return;
    const onDown = (e)=>{
      if(drawerRef.current?.contains(e.target)) return;
      // selecting another bar/row/dep — let those handlers run; they'll setSelected themselves
      if(e.target.closest?.('[data-bar-id], .bar, .task-row, .proj-item, .dep-path, .ctx-menu, .bulk-picker, .cmod-overlay, .tmpl-overlay, .recur-popover')) return;
      setSelected(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return ()=>document.removeEventListener('pointerdown', onDown, true);
  },[selected, drawerPinned]);

  // ── Render ──
  const tinyCol  = dayW<10;
  const smallCol = dayW<20;
  const currentZoom = dayW>=36?'D':dayW>=16?'W':dayW>=8?'M':'Q';

  // ─── Welcome / first launch ───
  if(showWelcome){
    return (
      <Fragment>
        <div className="welcome-overlay">
          <div className="welcome-card">
            <div className="welcome-logo">TL</div>
            <div className="welcome-title">Timeline</div>
            <div className="welcome-subtitle">Plan projects on a timeline. Save them anywhere.</div>
            {autosaveOffer && (
              <div style={{margin:'0 0 16px',padding:'10px 12px',background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:3,fontSize:12,color:'var(--t1)',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <div style={{flex:'1 1 200px',minWidth:0}}>
                  <div style={{fontWeight:600}}>Unsaved work found</div>
                  <div style={{color:'var(--t3)',fontSize:11,marginTop:2}}>
                    Last edit {formatAgo(autosaveOffer.savedAt)}{autosaveOffer.fileName?` · ${autosaveOffer.fileName}`:''}
                  </div>
                </div>
                <button className="welcome-btn" style={{padding:'6px 12px',fontSize:11}} onClick={restoreAutosave}>Restore</button>
                <button className="welcome-btn" style={{padding:'6px 12px',fontSize:11}} onClick={discardAutosave}>Discard</button>
              </div>
            )}
            {recents.length > 0 && (
              <div style={{width:'100%',marginBottom:14}}>
                <div style={{fontSize:11,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6,paddingLeft:2}}>Recent</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {recents.slice(0,4).map(r => (
                    <button key={r.id} className="welcome-btn"
                            style={{justifyContent:'flex-start',padding:'0 14px',fontSize:12}}
                            title={r.name + ' · ' + formatAgo(r.savedAt)}
                            onClick={()=>openRecent(r.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14,opacity:.7,flexShrink:0}}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                      <span style={{flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</span>
                      <span style={{fontSize:10,color:'var(--t4)',marginLeft:8,flexShrink:0}}>{formatAgo(r.savedAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="welcome-actions">
              <button className="welcome-btn primary" onClick={()=>createNewProject()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                New project
              </button>
              <button className="welcome-btn" onClick={openWorkspace}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                Open workspace…
              </button>
              <button className="welcome-btn" onClick={loadSample}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
                Open sample project
              </button>
              {templates.length > 0 && (
                <button className="welcome-btn" onClick={()=>setTmplModal('pick')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>
                  New from template…
                </button>
              )}
            </div>
            {!FSA_AVAILABLE && <div className="welcome-warn">Saving works via downloads in this browser. For best experience use Chrome or Edge (in-place save).</div>}
            <div className="welcome-hint">Local app. Your data stays on your machine.</div>
          </div>
        </div>
        <ModalsHost
          templateModal={renderTemplateModal()}
          fsaAvailable={FSA_AVAILABLE}
          fileInputRef={fileInputRef}
          onFileInputChange={onFileInputChange}
          loadError={loadError}
          setLoadError={setLoadError}
          modal={modal}
          closeModal={closeModal}
          modalInputRef={modalInputRef}
          tweaks={
            <GanttTweaks tw={tw} setTweak={setTweak} activeProject={activeProject} updateActiveProject={updateActiveProject} customConfirm={customConfirm}
              laneMode={laneMode} lanes={lanes} stageRegistry={stageRegistry}
              setLaneMode={setLaneMode} setLanes={setLanes} setStageRegistry={setStageRegistry}
              setLaneCollapsed={setLaneCollapsed} setDirty={setDirty}/>
          }
        />
      </Fragment>
    );
  }

  // ─── Main app ───
  return (
    <Fragment>
    <div className="app">

      {/* Topbar moved to src/components/Topbar.jsx */}
      <Topbar
        fileMenu={
          <FileMenu
            fileMenuOpen={fileMenuOpen} setFileMenuOpen={setFileMenuOpen}
            fileRecentSubOpen={fileRecentSubOpen} setFileRecentSubOpen={setFileRecentSubOpen}
            fileTmplSubOpen={fileTmplSubOpen} setFileTmplSubOpen={setFileTmplSubOpen}
            createNewProject={createNewProject} openWorkspace={openWorkspace} saveWorkspace={saveWorkspace}
            recents={recents} openRecent={openRecent} formatAgo={formatAgo}
            FSA_AVAILABLE={FSA_AVAILABLE}
            activeProject={activeProject} templates={templates}
            saveActiveProjectAsTemplate={saveActiveProjectAsTemplate} setTmplModal={setTmplModal}
            undo={undo} redo={redo} undoStackRef={undoStackRef} redoStackRef={redoStackRef}
            dirty={dirty} projects={projects} customConfirm={customConfirm} setShowWelcome={setShowWelcome}
            toggleAutosave={toggleAutosave} autosaveEnabled={tw.autosaveEnabled}/>
        }
        fileHandle={fileHandle} activeProject={activeProject} projects={projects}
        tw={tw} setTweak={setTweak}
        viewMode={viewMode} setViewMode={setViewMode}
        dayW={dayW} currentZoom={currentZoom}
        viewsMenuOpen={viewsMenuOpen} setViewsMenuOpen={setViewsMenuOpen}
        applyView={applyView} deleteSavedView={deleteSavedView} saveCurrentView={saveCurrentView}
        gridScrollRef={gridScrollRef} axis={axis}
        baselines={baselines} activeBaseline={activeBaseline} setBaselinesOpen={setBaselinesOpen}
        showCritical={showCritical}
        conflicts={conflicts}
        updateTasks={updateTasks} tasksRef={tasksRef} customConfirm={customConfirm} showToast={showToast}
        setSortToast={setSortToast} sortToastTimerRef={sortToastTimerRef}
        now={now}
        setHelpOpen={setHelpOpen}
        calendar={calendar}
        tasks={tasks} selected={selected} setSelected={setSelected} setRenaming={setRenaming}/>

      {/* ── Body ── */}
      <div className="body">

        {/* Project panel */}
        <div className={`proj-panel${projectPanelOpen?'':' collapsed'}`}>
          <div className="proj-panel-hdr">
            {projectPanelOpen && <span className="proj-panel-title">Projects</span>}
            <button className="proj-panel-toggle" onClick={()=>setProjectPanelOpen(o=>!o)}
                    title={projectPanelOpen?'Collapse':'Expand'}>
              {projectPanelOpen?'‹':'›'}
            </button>
          </div>
          {projectPanelOpen && (
            <div className="proj-panel-body">
              {projects.length===0 && <div className="proj-empty">No projects yet</div>}
              {projects.map(p=>{
                const isRenaming = projRenaming?.id===p.id;
                const cnt = p.tasks.filter(t=>!t.kind).length;
                return (
                  <div key={p.id}
                       className={`proj-item${activeProjectId===p.id?' active':''}`}
                       onClick={()=>switchProject(p.id)}
                       onDoubleClick={()=>setProjRenaming({id:p.id,value:p.name})}
                       onContextMenu={e=>{e.preventDefault();setProjCtxMenu({x:e.clientX,y:e.clientY,projectId:p.id});}}>
                    <span className="proj-item-dot" style={{background:p.color||'#96c6e8'}}/>
                    {isRenaming
                      ? <input className="proj-rename-input" autoFocus
                          value={projRenaming.value}
                          onChange={e=>setProjRenaming({...projRenaming,value:e.target.value})}
                          onBlur={()=>{const v=projRenaming.value.trim();if(v)updateProjectById(p.id,{name:v});setProjRenaming(null);}}
                          onKeyDown={e=>{
                            if(e.key==='Enter'){const v=projRenaming.value.trim();if(v)updateProjectById(p.id,{name:v});setProjRenaming(null);}
                            if(e.key==='Escape')setProjRenaming(null);
                            e.stopPropagation();
                          }}
                          onClick={e=>e.stopPropagation()}/>
                      : <>
                          <span className="proj-item-name">{p.name}</span>
                          <span className="proj-item-cnt">{cnt}</span>
                        </>
                    }
                  </div>
                );
              })}
              <button className="proj-add-btn" onClick={()=>createNewProject()}>+ New project</button>
            </div>
          )}
        </div>

        {/* Work area: shared filter strip above the LP+RP row so both panes have equal header overhead */}
        <div className={"work-area"+(drawerPinned&&isInspectorOpen?" inspector-docked":"")}>
          {/* Filter strip (Batch 4) — moved out of rpane so LP/RP alignment is wrap-proof */}
          {activeProject && (
            <SearchFilterBar filter={filter} setFilter={setFilter} owners={owners}
              totalCount={totalTaskCount} visibleCount={visibleTaskCount}/>
          )}
          <div className="work-row">

        {/* Left task pane */}
        <div className="lpane">
          <div className="lpane-hdr">
            <h2>Tasks</h2>
            <button className="lpane-add-btn" title="New set" aria-label="New set" disabled={!activeProject} onClick={addGroup}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New set
            </button>
            <span className="pill">{tasks.filter(t=>!t.kind).length} items</span>
          </div>
          {viewMode === 'gantt' && showMinimap && activeProject && rows.length>0 && (
            <div className="lpane-minimap-spacer" aria-hidden="true"/>
          )}
          <div className="lpane-body" ref={lpaneBodyRef} onScroll={onLpaneScroll} style={{minWidth:0}}>
            {!activeProject && (
              <div style={{padding:'24px 14px',color:'var(--t4)',fontSize:11,fontStyle:'italic'}}>
                Select a project on the left, or create a new one.
              </div>
            )}
            {rows.map((r)=>{
              if(r.isProject){
                const open=!collapsed.has(r.id);
                const cnt = r.id==='__loose'
                  ? tasks.filter(t=>!t.parent && t.kind!=='project').length
                  : tasks.filter(t=>t.parent===r.id).length;
                const projCost = costRoll.perTask.get(r.id) || 0;
                return (
                  <div className="group-row" data-pid={r.project} data-gid={r.id} key={r.id}
                    style={r.color?{boxShadow:`inset 3px 0 0 ${r.color}`}:undefined}
                    onClick={()=>setCollapsed(c=>{const n=new Set(c);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}>
                    <span className="grp-drag" title="Drag to reorder set" aria-label="Drag to reorder set"
                      onPointerDown={e=>beginGroupDrag(e,r.id)}
                      onClick={e=>e.stopPropagation()}>⋮⋮</span>
                    <svg className={`group-chv${open?' open':''}`} viewBox="0 0 24 24" fill="none" stroke={r.color||'currentColor'} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    <span className="group-dot" style={r.color?{background:r.color}:undefined}/>
                    {groupRenaming?.id===r.id
                      ? <input className="row-rename" autoFocus onFocus={e=>e.target.select()} value={groupRenaming.value}
                          onChange={e=>setGroupRenaming(g=>({...g,value:e.target.value}))}
                          onKeyDown={e=>{if(e.key==='Enter')commitGroupRename();if(e.key==='Escape')setGroupRenaming(null);e.stopPropagation();}}
                          onBlur={commitGroupRename}
                          onClick={e=>e.stopPropagation()}/>
                      : <span className="group-name">{r.title}</span>
                    }
                    {projCost>0 && <span className="group-cost" title={`Rollup cost`}>{formatCost(projCost)} total</span>}
                    <div className="grp-add" title="Add task to this set"
                      onClick={e=>{e.stopPropagation();addTaskToGroup({kind:'project',groupId:r.id,title:r.title});}}>+</div>
                    <div className="grp-kebab" title="Set options" role="button" aria-label="Set options"
                      onClick={e=>{e.stopPropagation();setGroupCtxMenu({x:e.clientX,y:e.clientY,groupId:r.id,kind:'project',title:r.title});}}>&#xFE19;</div>
                    <span className="group-cnt">{cnt}</span>
                  </div>
                );
              }
              if(r.isOwnerGroup){
                const open=!collapsed.has(r.id);
                const cnt=tasks.filter(t=>!t.kind&&t.owner===r.owner).length;
                return (
                  <div className="owner-group-row" key={r.id} data-owner={r.owner}
                    onClick={()=>setCollapsed(c=>{const n=new Set(c);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}>
                    <svg className={`group-chv${open?' open':''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    <div className="owner-avatar" style={{background:r.color+'33',borderColor:r.color+'88',color:r.color}}>{r.owner.slice(0,2).toUpperCase()}</div>
                    {groupRenaming?.id===r.id
                      ? <input className="row-rename" autoFocus onFocus={e=>e.target.select()} value={groupRenaming.value}
                          onChange={e=>setGroupRenaming(g=>({...g,value:e.target.value}))}
                          onKeyDown={e=>{if(e.key==='Enter')commitGroupRename();if(e.key==='Escape')setGroupRenaming(null);e.stopPropagation();}}
                          onBlur={commitGroupRename}
                          onClick={e=>e.stopPropagation()}/>
                      : <span className="group-name">{r.owner}</span>
                    }
                    <div className="grp-add" title="Add task to this set"
                      onClick={e=>{e.stopPropagation();addTaskToGroup({kind:'owner',groupId:r.id,title:r.owner});}}>+</div>
                    <div className="grp-kebab" title="Set options" role="button" aria-label="Set options"
                      onClick={e=>{e.stopPropagation();setGroupCtxMenu({x:e.clientX,y:e.clientY,groupId:r.id,kind:'owner',title:r.owner});}}>&#xFE19;</div>
                    <span className="group-cnt">{cnt}</span>
                  </div>
                );
              }
              if(r.isLane){
                const open=!laneCollapsed.has(r.id);
                return (
                  <div key={r.id} className={`lane-row lane-row--${r.laneMode}`} data-lane-id={r.id}
                    onClick={()=>setLaneCollapsed(c=>{const n=new Set(c);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;})}>
                    <svg className={`lane-chv${open?' open':''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <span className="lane-dot" style={{background:r.color}}/>
                    <span className="lane-ttl">{r.title}</span>
                  </div>
                );
              }
              const sel=selected===r.id||selectedSet.has(r.id), isRen=renaming?.id===r.id;
              const wbsCode = wbsMap.get(r.id);
              const isRecurInst = !!r.recurrenceParent;
              return (
                <div className={`task-row is-child${r.done?' done':''}${sel?' selected':''}${selectedSet.has(r.id)&&selectedSet.size>1?' multi-sel':''}${hoverRow===r.id?' hover':''}`} key={r.id}
                  data-task-id={r.id} data-depth={r.depth||1}
                  style={{paddingLeft: 22 + ((r.depth||1) * INDENT_PX), ...(isRecurInst?{opacity:.6}:null)}}
                  onMouseEnter={()=>setHoverRow(r.id)} onMouseLeave={()=>setHoverRow(null)}
                  onClick={(e)=>{
                    const mod = e.metaKey || e.ctrlKey;
                    if(e.shiftKey && selAnchorRef.current){
                      // Shift+click: range select between anchor and clicked row over the
                      // currently visible task rows (skip project / owner section headers).
                      const ids = rows.filter(rr => rr.id && !rr.isProject && !rr.isOwnerGroup && !rr.isLane).map(rr => rr.id);
                      const a = ids.indexOf(selAnchorRef.current);
                      const b = ids.indexOf(r.id);
                      if(a >= 0 && b >= 0){
                        const lo = Math.min(a,b), hi = Math.max(a,b);
                        setSelectedSet(new Set(ids.slice(lo, hi+1)));
                        setSelected(r.id);
                        return;
                      }
                      // Anchor stale (row no longer visible) — fall through to single-select
                    }
                    if(mod){
                      // Ctrl/Cmd+click: toggle individual row in the set; anchor follows the click.
                      setSelectedSet(prev=>{
                        const n=new Set(prev);
                        if(n.has(r.id)){
                          n.delete(r.id);
                          if(selected===r.id){ const next=n.values().next().value; setSelected(next||null); }
                        } else {
                          n.add(r.id);
                          setSelected(r.id);
                        }
                        return n;
                      });
                      selAnchorRef.current = r.id;
                      return;
                    }
                    setSelected(r.id);
                    setSelectedSet(new Set([r.id]));
                    selAnchorRef.current = r.id;
                  }}
                  onDoubleClick={()=>{ if(isRecurInst) return; setRenaming({id:r.id,value:r.title}); }}
                  onContextMenu={e=>{e.preventDefault();if(isRecurInst)return;if(!selectedSet.has(r.id)){setSelectedSet(new Set([r.id]));selAnchorRef.current=r.id;}setCtxMenu({x:e.clientX,y:e.clientY,taskId:r.id});}}>
                  {r.isSummary && (
                    <span className={`task-chv${collapsed.has(r.id)?'':' open'}`}
                          title={collapsed.has(r.id)?'Expand':'Collapse'}
                          style={{left: (22 + ((r.depth||1)-1)*INDENT_PX - 2) + 'px'}}
                          onClick={e=>{e.stopPropagation();setCollapsed(c=>{const n=new Set(c);n.has(r.id)?n.delete(r.id):n.add(r.id);return n;});}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  )}
                  <span className={`chk${r.done?' done':''}`} onClick={e=>{e.stopPropagation();if(isRecurInst)return;updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,done:!t.done,status:!t.done?'done':'todo',progress:!t.done?1:(t.progress||0)}:t));}}/>
                  {wbsCode && <span className="wbs" title={`WBS ${wbsCode}`}>{wbsCode}</span>}
                  {isRen
                    ?<input className="row-rename" autoFocus={renaming.source!=='bar'} onFocus={e=>e.target.select()} value={renaming.value} onChange={e=>setRenaming({...renaming,value:e.target.value})} onBlur={commitRename} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Enter')commitRename();if(e.key==='Escape')setRenaming(null);e.stopPropagation();}}/>
                    :<span className="ttl">{isRecurInst && <span style={{color:'var(--accent-2)',marginRight:4}}>↻</span>}{r.title}</span>
                  }
                  <span className="pri" title={`Priority ${r.priority}`}>
                    {[3,6,9].slice(0,r.priority==='p1'?3:r.priority==='p2'?2:1).map((h,i)=>(
                      <span key={i} className="pri-bar" style={{height:h+'px',background:r.priority==='p1'?'var(--p1)':r.priority==='p2'?'var(--p2)':'var(--p3)'}}/>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane */}
        <div className="rpane">

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && activeProject && (
            <ListView tasks={tasks} expandedTasks={tasksForRows}
              wbsMap={wbsMap} owners={owners}
              selected={selected} selectedSet={selectedSet}
              setSelected={setSelected} setSelectedSet={setSelectedSet}
              updateTasks={updateTasks} applySchedule={applySchedule}
              calendar={calendar} setCtxMenu={setCtxMenu} addOwnerToList={addOwnerToList}/>
          )}

          {/* ── CALENDAR VIEW ── */}
          {viewMode === 'calendar' && activeProject && (
            <CalendarView tasks={tasks} expandedTasks={tasksForRows}
              calendar={calendar}
              selected={selected} selectedSet={selectedSet}
              setSelected={setSelected} setSelectedSet={setSelectedSet}
              setCtxMenu={setCtxMenu}/>
          )}

          {viewMode === 'gantt' && showMinimap && activeProject && rows.length>0 && <Minimap rows={rows} axis={axis} dayW={dayW} totalW={totalW} gridScrollRef={gridScrollRef}/>}

          {/* Timeline header — Gantt only. Moved to src/grid/Header.jsx */}
          {viewMode === 'gantt' && (
            <Header axis={axis} monthSpans={monthSpans} dayW={dayW} totalW={totalW}
              tinyCol={tinyCol} smallCol={smallCol} hdrScrollRef={hdrScrollRef}/>
          )}

          {/* Grid */}
          {viewMode === 'gantt' && (<div className="grid-scroll" ref={gridScrollRef} onScroll={onGridScroll} onPointerDown={onGridPointerDown} onDoubleClick={onGridDblClick}
            onContextMenu={e=>{
              // Let bar / dep-path / handle handlers win on their own elements
              if(e.target.closest && e.target.closest('[data-bar-id], .bar, .bar-handle, .dep-path, .dep-knob')) return;
              const grid=gridScrollRef.current; if(!grid) return;
              const rect=grid.getBoundingClientRect();
              const lx=e.clientX-rect.left+grid.scrollLeft;
              const ly=e.clientY-rect.top+grid.scrollTop;
              const dayIdx=Math.max(0,Math.min(axis.days.length-1,Math.floor(lx/dayW)));
              const rowIdx=Math.floor(ly/rowH);
              const day=axis.days[dayIdx];
              if(!day) return;
              e.preventDefault();
              setGridCtxMenu({x:e.clientX,y:e.clientY,day,rowIdx});
            }}>
            <div className="grid-track" style={{width:totalW+'px',height:Math.max(200, rows.length*rowH)+'px'}}>

              {!activeProject && (
                <div className="empty-state">
                  <h3>No project selected</h3>
                  <div>Pick or create a project on the left.</div>
                </div>
              )}
              {activeProject && rows.length===0 && !onboardDismissed && (
                <div className="onboard-hint" onMouseDown={e=>e.stopPropagation()}>
                  <button className="onboard-close" title="Dismiss" onClick={()=>{ try{ localStorage.setItem('onboardingHintDismissed','1'); }catch(e){} setOnboardDismissed(true); }}>×</button>
                  <h3>{activeProject.name}</h3>
                  <p>Drag on an empty row to create a task — or use + New task.</p>
                </div>
              )}

              {/* Background layer */}
              <div className="grid-bg">
                {axis.days.map((d,i)=>{
                  const we=isWeekend(d)&&tw.showWeekends!==false, ms=parseYmd(d).getDate()===1;
                  return <div key={d} className={`grid-col${we?' weekend':''}${ms?' month-start':''}`} style={{left:i*dayW+'px',width:dayW+'px'}}/>;
                })}
                <TodayLine now={now} xForDay={xForDay} dayW={dayW} todayLineLive={tw.todayLineLive}/>
                {sprintBands.map(band=>(
                  <Fragment key={'sb'+band.dayIdx}>
                    {band.isEven&&<div className="sprint-band even" style={{left:band.dayIdx*dayW+'px',width:Math.min(7,axis.days.length-band.dayIdx)*dayW+'px'}}/>}
                    <div className={`sprint-bound${band.n%2===0?' release':''}`} data-label={band.label} style={{left:band.dayIdx*dayW+'px'}}/>
                  </Fragment>
                ))}
                {!hideMilestoneLines&&rows.filter(r=>r.milestone).map(ms=>(
                  <div key={'rib-'+ms.id} className={`milestone-ribbon${ms.done?' done-ribbon':''}`} data-label={ms.title}
                    style={{left:xForDay(ms.start)+dayW/2-1+'px','--ribbon-c':ms.color||'#96c6e8'}}/>
                ))}
                {hoveredBarId&&(()=>{ const row=rows.find(r=>r.id===hoveredBarId); if(!row||row.isProject)return null; return <div className="hover-guide-band" style={{left:xForDay(row.start)+'px',width:(row.milestone?dayW:(diffDays(row.start,row.end)+1)*dayW)+'px'}}/>; })()}
                {rows.map((r,i)=>(
                  <div key={r.id} className={`row-line${r.isProject||r.isOwnerGroup?' group':''}${r.isLane?' lane':''}${selected===r.id?' selected-row':''}${hoverRow===r.id?' hover':''}`} style={{top:i*rowH+'px'}}/>
                ))}
                {showNowCurtain && <NowCurtain now={now} xForDay={xForDay} dayW={dayW}/>}
                {showFloat&&rows.map((r,i)=>{
                  if(r.isProject||r.isOwnerGroup||r.isLane||r.milestone||r.done)return null;
                  const fl=floatMap.get(r.id)||0; if(fl<=0)return null;
                  const live=livePreview(r); const end=live?live.end:r.end;
                  const bg=r.color||'#96c6e8';
                  return <div key={'fg-'+r.id} className="float-ghost" style={{left:xForDay(addDays(end,1))+'px',width:fl*dayW+'px',top:i*rowH+(rowH-22)/2+'px',background:`linear-gradient(to right,${bg}55,transparent)`}}/>;
                })}
                {showProbBars&&rows.map((r,i)=>{
                  if(!r.pessimistic||r.isProject||r.isLane||r.milestone)return null;
                  const live=livePreview(r); const end=live?live.end:r.end;
                  const bg=r.color||'#96c6e8';
                  return <div key={'pt-'+r.id} className="prob-tail" style={{left:xForDay(end)+'px',width:r.pessimistic*dayW+'px',top:i*rowH+(rowH-22)/2+'px',background:`linear-gradient(to right,${bg}99,${bg}33,transparent)`}}/>;
                })}
                {activeBaseline&&rows.map((r,i)=>{
                  if(r.isProject||r.isOwnerGroup||r.isLane||r.milestone)return null;
                  const bl=activeBaseline.snapshot[r.id]; if(!bl)return null;
                  if(bl.start===r.start&&bl.end===r.end)return null;
                  const slip=bl.end<r.end;
                  return <div key={'bl-'+r.id} className="baseline-bar" title={`${activeBaseline.name}: ${fmtShort(bl.start)} → ${fmtShort(bl.end)}`}
                    style={{left:xForDay(bl.start)+'px',width:(diffDays(bl.start,bl.end)+1)*dayW-2+'px',top:i*rowH+(rowH-22)/2+20+'px',background:slip?'var(--p2)':'var(--t4)'}}/>;
                })}
                {snapInfo&&<div className="snap-guide-mag" style={{left:snapInfo.x+'px'}}/>}
              </div>

              {/* Dependency SVG — moved to src/grid/DepArrows.jsx */}
              {tw.showDeps!==false && (
                <DepArrows
                  rows={rows} rowH={rowH} dayW={dayW} axis={axis} totalW={totalW}
                  rowIndexById={rowIndexById}
                  showCritical={showCritical} critical={critical} showAllDeps={showAllDeps}
                  focusChain={focusChain} hoverChain={hoverChain}
                  drag={drag}
                  hoveredDepEdge={hoveredDepEdge} setHoveredDepEdge={setHoveredDepEdge}
                  setDepCtxMenu={setDepCtxMenu}
                  beginDepEdit={beginDepEdit}
                  livePreview={livePreview} xForDay={xForDay}
                  gridScrollRef={gridScrollRef}/>
              )}

              {/* Bar layer */}
              <div className="bar-layer">
                {drag?.kind==='alt-move'&&drag.deltaDays!==0&&(()=>{
                  const t=tasks.find(x=>x.id===drag.id); if(!t)return null;
                  const ri=rows.findIndex(r=>r.id===drag.id); if(ri<0)return null;
                  const x=xForDay(addDays(drag.origStart,drag.deltaDays));
                  const w=(diffDays(drag.origStart,drag.origEnd)+1)*dayW-2;
                  return <div className="alt-ghost" style={{left:x+'px',top:ri*rowH+(rowH-22)/2+'px',width:w+'px',background:t.color||'#96c6e8'}}/>;
                })()}
                {drag?.kind==='create'&&(()=>{
                  let s=drag.startDay,en=drag.endDay; if(s>en){const tmp=s;s=en;en=tmp;}
                  const x=xForDay(s), w=(diffDays(s,en)+1)*dayW;
                  const top=drag.rowIdx*rowH+(rowH-22)/2;
                  return <div className="drag-create-hint" style={{left:x+'px',top:top+'px',width:Math.max(dayW,w)+'px'}}>{w>60?`${diffDays(s,en)+1}d`:''}</div>;
                })()}

                {/* Bar rendering moved to src/grid/Bar.jsx */}
                {rows.map((r,i)=>(
                  <Bar key={r.id} row={r} rowIdx={i}
                    dayW={dayW} rowH={rowH} xForDay={xForDay} labelPos={labelPos}
                    tw={tw}
                    selected={selected} selectedSet={selectedSet}
                    focusChain={focusChain} hoverChain={hoverChain}
                    atRisk={atRisk} conflicts={conflicts}
                    critical={critical} showCritical={showCritical}
                    showConflicts={showConflicts} showOwners={showOwners}
                    drag={drag} renaming={renaming} costRoll={costRoll}
                    livePreview={livePreview}
                    beginBarDrag={beginBarDrag} beginDepDrag={beginDepDrag} beginProgDrag={beginProgDrag}
                    setHoveredBarId={setHoveredBarId} setSelected={setSelected}
                    setSelectedSet={setSelectedSet} setRenaming={setRenaming}
                    setCtxMenu={setCtxMenu}
                    commitRename={commitRename}
                    calendar={calendar}/>
                ))}
              </div>

              {snapInfo&&<div className="snap-badge" style={{left:snapInfo.x+6+'px',top:snapInfo.y+rowH/2-11+'px'}}>{snapInfo.label}</div>}
              {lasso&&<div className="lasso-rect" style={{left:Math.min(lasso.x1,lasso.x2)+'px',top:Math.min(lasso.y1,lasso.y2)+'px',width:Math.abs(lasso.x2-lasso.x1)+'px',height:Math.abs(lasso.y2-lasso.y1)+'px'}}/>}
            </div>
          </div>)}
        </div>
          </div>{/* /.work-row */}
        </div>{/* /.work-area */}
      </div>

      {/* Status bar */}
      <div className="sbar">
        <span className="dot"/>
        <span>
          {activeProject ? `${activeProject.name} · ` : ''}
          {tasks.length} tasks · {tasks.filter(t=>t.deps?.length).length} deps
          {conflicts.size>0?(
            <button className="sbar-conflict-btn" title="Focus first conflict" aria-label="Focus first conflict"
              onClick={()=>{
                const firstId = [...conflicts][0];
                if (!firstId) return;
                setSelected(firstId);
                // Scroll the conflict bar into view
                requestAnimationFrame(()=>{
                  const bar = document.querySelector(`.bar[data-bar-id="${firstId}"]`);
                  if (bar) bar.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
                });
              }}>{` · ⚠ ${conflicts.size} conflicts`}</button>
          ):null}
          {selectedSet.size>1?` · ${selectedSet.size} selected`:''}
          {dirty?' · unsaved':''}
        </span>
        <span className="right">
          <span><kbd>drag empty row</kbd> create</span>
          <span><kbd>⇧+drag</kbd> lasso</span>
          <span><kbd>⌥+drag</kbd> duplicate</span>
          <span><kbd>Ctrl+S</kbd> save</span>
          <span><kbd>0–9</kbd> dur</span>
          <span><kbd>F2</kbd> rename</span>
        </span>
      </div>
    </div>

    {/* Drag tooltip */}
    {drag&&(drag.kind==='move'||drag.kind==='l'||drag.kind==='r'||drag.kind==='group-move'||drag.kind==='alt-move')&&(()=>{
      const t=tasks.find(tt=>tt.id===drag.id); if(!t)return null;
      const live=livePreview(t); if(!live)return null;
      const durLabel = formatDuration(live.start, live.end, calendar);
      const verb=drag.kind==='group-move'?`Group ×${selectedSet.size}`:drag.kind==='alt-move'?'Duplicate':drag.kind==='l'?'Resize start':drag.kind==='r'?'Resize end':'Move';
      return (
        <div className="drag-tooltip" style={{left:drag.currentClientX+14+'px',top:drag.currentClientY+14+'px'}}>
          <div className="dt-meta">{verb} · {drag.deltaDays>0?'+':''}{drag.deltaDays}d{drag.snapped?' 🔒 snapped':''}</div>
          <div className="dt-dates">{fmtShort(live.start)} → {fmtShort(live.end)} ({durLabel})</div>
        </div>
      );
    })()}

    {/* Progress drag tooltip */}
    {drag?.kind==='prog'&&(
      <div className="drag-tooltip" style={{left:drag.currentClientX+14+'px',top:drag.currentClientY+14+'px'}}>
        <div className="dt-meta">{Math.round((drag.liveProgress??0)*100)}%</div>
      </div>
    )}

    {/* Inspector moved to src/components/Inspector.jsx */}
    <Inspector ref={drawerRef}
      isInspectorOpen={isInspectorOpen} drawerPinned={drawerPinned} setDrawerPinned={setDrawerPinned}
      selected={selected} setSelected={setSelected}
      rows={rows} expandedTasks={expandedTasks} tasks={tasks}
      renaming={renaming} setRenaming={setRenaming}
      viewMode={viewMode} livePreview={livePreview} calendar={calendar}
      showCritical={showCritical} critical={critical}
      owners={owners} floatMap={floatMap} conflicts={conflicts}
      laneMode={laneMode} lanes={lanes} stageRegistry={stageRegistry}
      updateTasks={updateTasks} applySchedule={applySchedule} toggleLock={toggleLock}
      addOwnerToList={addOwnerToList} deleteDependency={deleteDependency} setRecurrence={setRecurrence}
      setRecurEditor={setRecurEditor}
      setPredPicker={setPredPicker} setPredFilter={setPredFilter}
      markDonePrompt={markDonePrompt} setMarkDonePrompt={setMarkDonePrompt} markDonePromptTimerRef={markDonePromptTimerRef}
      insOpen={insOpen} setInsOpen={setInsOpen}
      customPrompt={customPrompt}
      focusChain={focusChain} focusDepSubtree={focusDepSubtree} duplicateTask={duplicateTask} beginDepDrag={beginDepDrag}/>

    {/* Task Context menu */}
    {ctxMenu&&(()=>{
      const t=tasks.find(tt=>tt.id===ctxMenu.taskId); if(!t)return null;
      const cx=Math.min(ctxMenu.x,window.innerWidth-280);
      // Position the menu so the full content fits whenever any direction has
      // room. Falls back to a top-of-viewport anchor when neither above nor
      // below the click fits the menu, so the bottom items (Delete!) never
      // clip even with a click in the dead-zone middle of the screen.
      // FULL_H is sized for the worst case (every conditional item rendered).
      const FULL_H=700;
      const spaceBelow=window.innerHeight-ctxMenu.y-8, spaceAbove=ctxMenu.y-8;
      let flipUp=false, anchorTop=false, cy, menuMaxH;
      if (spaceBelow >= FULL_H){ cy=Math.max(8,ctxMenu.y); menuMaxH=spaceBelow; }
      else if (spaceAbove >= FULL_H){ flipUp=true; menuMaxH=spaceAbove; cy=Math.max(8,ctxMenu.y-menuMaxH); }
      else { anchorTop=true; cy=8; menuMaxH=window.innerHeight-16; }

      // Submenu position (just to the right of the parent menu).
      const subX = Math.min(cx + 224, window.innerWidth - 240);
      const closeAll = ()=>{ setCtxMenu(null); setCtxSubmenu(null); };

      // Single-task menu — capability flags for conditional items
      const tIdx = tasks.findIndex(x=>x.id===t.id);
      const hasPrevSibling = (()=>{
        for(let i=tIdx-1;i>=0;i--){ const x=tasks[i];
          if((x.parent||null)===(t.parent||null) && x.kind!=='project' && x.id!==t.id) return true;
        }
        return false;
      })();
      const canIndent  = hasPrevSibling && t.kind!=='project' && !t.recurrenceParent;
      const canOutdent = !!t.parent && t.kind!=='project' && !t.recurrenceParent && (()=>{ const p=tasks.find(x=>x.id===t.parent); return p && p.kind!=='project'; })();
      const otherProjects = (projects||[]).filter(p=>p.id!==t.project);
      const predIds = depList(t).map(d=>d.id);
      const dependentTasks = tasks.filter(x=>depList(x).some(d=>d.id===t.id));

      const multiIds = selectedSet.size>1 ? selectedSet : new Set([t.id]);
      return (
        <div className="ctx-menu" style={flipUp?{left:cx+'px',bottom:(window.innerHeight-ctxMenu.y)+'px',maxHeight:menuMaxH+'px'}:{left:cx+'px',top:cy+'px',maxHeight:menuMaxH+'px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="ctx-hdr">{selectedSet.size>1?`${selectedSet.size} tasks selected`:t.title}</div><div className="ctx-sep"/>

          {/* Quick edits — colour / priority / duration */}
          <div className="ctx-item has-sub" onClick={()=>{ setBulkPicker({x:subX,y:cy,kind:'color',ids:multiIds}); setCtxSubmenu(null); }}>Colour…<span className="chev">▸</span></div>
          <div className="ctx-item has-sub" onClick={()=>{ setBulkPicker({x:subX,y:cy,kind:'priority',ids:multiIds}); setCtxSubmenu(null); }}>Priority…<span className="chev">▸</span></div>
          {!t.milestone && t.kind!=='project' && (
            <div className="ctx-item has-sub" onClick={()=>setCtxSubmenu({x:subX, y:cy, kind:'duration', taskId:t.id})}>Set duration…<span className="chev">▸</span></div>
          )}
          <div className="ctx-sep"/>

          {/* Structure — insert / split / milestone / recurrence */}
          <div className="ctx-item" onClick={()=>{ insertSiblingTask(t.id,'above'); closeAll(); }}>Insert task above</div>
          <div className="ctx-item" onClick={()=>{ insertSiblingTask(t.id,'below'); closeAll(); }}>Insert task below</div>
          <div className="ctx-item" onClick={()=>{splitTask(t.id);closeAll();}}>Split task</div>
          <div className="ctx-item" onClick={()=>{toggleMilestone(t.id);closeAll();}}>{t.milestone?'Unset milestone':'→ Milestone'}</div>
          {t.kind!=='project' && !t.recurrence && (
            <div className="ctx-item" onClick={()=>{setRecurEditor({taskId:t.id,draft:{pattern:'weekly',interval:1,count:4}});closeAll();}}>Make recurring…</div>
          )}
          {t.kind!=='project' && t.recurrence && (
            <div className="ctx-item" onClick={()=>{setRecurEditor({taskId:t.id,draft:{...t.recurrence}});closeAll();}}>Edit recurrence…<span className="kbd">↻</span></div>
          )}
          <div className="ctx-item" onClick={async ()=>{const cur = depList(t)[0]?.lag || 0; const v=await customPrompt('Set Lag — All Incoming',String(cur),'Applies to all incoming dependencies.');if(v!==null){const n=parseInt(v,10);if(!isNaN(n))setLagOnIncoming(t.id,n);}closeAll();}}>Set lag (all incoming)…<span className="kbd">{(()=>{const l=depList(t)[0]?.lag||0; return l?`${l>0?'+':''}${l}d`:'0d';})()}</span></div>
          <div className="ctx-item" onClick={()=>{toggleBlocking(t.id);closeAll();}}>{t.blocking?'Unmark blocking':'Mark blocking'}</div>
          <div className="ctx-item" onClick={()=>{toggleLock(t.id);closeAll();}}>{t.locked?'Unlock task':'Lock task'}<span className="kbd">{t.locked?'🔓':'🔒'}</span></div>
          <div className="ctx-sep"/>

          {/* Clipboard */}
          <div className="ctx-item" onClick={()=>{ copyTasks(multiIds); closeAll(); }}>Copy{selectedSet.size>1&&<span className="kbd">×{selectedSet.size}</span>}<span className="kbd">Ctrl C</span></div>
          {clipboard && clipboard.tasks?.length>0 && (
            <div className="ctx-item" onClick={()=>{ pasteTasks(null); closeAll(); }}>Paste ({clipboard.tasks.length})<span className="kbd">Ctrl V</span></div>
          )}

          {/* Hierarchy */}
          {otherProjects.length>0 && (
            <div className="ctx-item has-sub" onClick={()=>setCtxSubmenu({x:subX, y:cy, kind:'move', taskId:t.id})}>Move to project…<span className="chev">▸</span></div>
          )}
          {canIndent  && <div className="ctx-item" onClick={()=>{ if(selectedSet.size>1) indentTasks(selectedSet); else indentTask(t.id); closeAll(); }}>Indent{selectedSet.size>1?<span className="kbd">×{selectedSet.size}</span>:<span className="kbd">Tab</span>}</div>}
          {canOutdent && <div className="ctx-item" onClick={()=>{ if(selectedSet.size>1) outdentTasks(selectedSet); else outdentTask(t.id); closeAll(); }}>Outdent{selectedSet.size>1?<span className="kbd">×{selectedSet.size}</span>:<span className="kbd">⇧Tab</span>}</div>}
          <div className="ctx-sep"/>

          {/* Navigate */}
          {predIds.length>0 && (
            <div className="ctx-item has-sub" onClick={()=>setCtxSubmenu({x:subX, y:cy, kind:'jump-pred', taskId:t.id})}>Jump to predecessor…<span className="chev">▸</span></div>
          )}
          {dependentTasks.length>0 && (
            <div className="ctx-item has-sub" onClick={()=>setCtxSubmenu({x:subX, y:cy, kind:'jump-dep', taskId:t.id})}>Jump to dependent…<span className="chev">▸</span></div>
          )}
          <div className="ctx-item" onClick={()=>{focusDepSubtree(t.id);closeAll();}}>Focus dep chain<span className="kbd">Ctrl E</span></div>
          <div className="ctx-item" onClick={()=>{duplicateTask(t.id);closeAll();}}>Duplicate<span className="kbd">Ctrl D</span></div>
          <div className="ctx-item" onClick={()=>{setRenaming({id:t.id,value:t.title});closeAll();}}>Rename<span className="kbd">F2</span></div>
          <div className="ctx-sep"/>
          <div className="ctx-item danger" onClick={()=>{updateTasks(ts=>ts.filter(tt=>!multiIds.has(tt.id)).map(tt=>{ const list=depList(tt); if(!list.some(d=>multiIds.has(d.id)))return tt; return {...tt, deps: list.filter(d=>!multiIds.has(d.id))}; }));setSelected(null);closeAll();}}>Delete{selectedSet.size>1?<span className="kbd">×{selectedSet.size}</span>:<span className="kbd">⌫</span>}</div>
        </div>
      );
    })()}

    {/* Generic ctx submenu (duration / move-to-project / jump-pred / jump-dep / dep-type) */}
    {ctxSubmenu&&(()=>{
      const cx=Math.min(ctxSubmenu.x,window.innerWidth-240), cy=Math.min(ctxSubmenu.y,window.innerHeight-260);
      const closeAll=()=>{ setCtxMenu(null); setDepCtxMenu(null); setGridCtxMenu(null); setCtxSubmenu(null); };

      if(ctxSubmenu.kind==='duration'){
        const tid=ctxSubmenu.taskId;
        const presets=[{l:'1 day',n:1},{l:'3 days',n:3},{l:'1 week',n:7},{l:'2 weeks',n:14},{l:'1 month',n:30}];
        return (
          <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'180px'}} onMouseDown={e=>e.stopPropagation()}>
            <div className="ctx-hdr">Set duration</div><div className="ctx-sep"/>
            {presets.map(p=>(
              <div key={p.n} className="ctx-item" onClick={()=>{ setTaskDuration(tid,p.n); closeAll(); }}>{p.l}<span className="kbd">{p.n}d</span></div>
            ))}
            <div className="ctx-sep"/>
            <div className="ctx-item" onClick={async ()=>{
              const v = await customPrompt('Set Duration','','Days from start (1+).');
              if(v!==null){ const n=parseInt(v,10); if(!isNaN(n)&&n>0) setTaskDuration(tid,n); }
              closeAll();
            }}>Custom…</div>
          </div>
        );
      }
      if(ctxSubmenu.kind==='move'){
        const tid=ctxSubmenu.taskId;
        const t=tasks.find(x=>x.id===tid);
        const others=(projects||[]).filter(p=>p.id!==t?.project);
        return (
          <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'180px'}} onMouseDown={e=>e.stopPropagation()}>
            <div className="ctx-hdr">Move to project</div><div className="ctx-sep"/>
            {others.map(p=>(
              <div key={p.id} className="ctx-item" onClick={()=>{ moveTaskToProject(tid,p.id); closeAll(); }}>{p.name}</div>
            ))}
            {others.length===0 && <div className="ctx-item" style={{color:'var(--t4)',cursor:'default'}}>No other projects</div>}
          </div>
        );
      }
      if(ctxSubmenu.kind==='jump-pred'){
        const t=tasks.find(x=>x.id===ctxSubmenu.taskId);
        const preds=depList(t||{deps:[]}).map(d=>({id:d.id,title:tasks.find(x=>x.id===d.id)?.title||d.id, type:d.type||'FS', lag:d.lag||0}));
        return (
          <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'220px',maxHeight:'320px',overflowY:'auto'}} onMouseDown={e=>e.stopPropagation()}>
            <div className="ctx-hdr">Predecessors</div><div className="ctx-sep"/>
            {preds.map(p=>(
              <div key={p.id} className="ctx-item" onClick={()=>{ setSelected(p.id); setSelectedSet(new Set([p.id])); closeAll(); }}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</span>
                <span className="kbd">{p.type}{p.lag?` ${p.lag>0?'+':''}${p.lag}d`:''}</span>
              </div>
            ))}
          </div>
        );
      }
      if(ctxSubmenu.kind==='jump-dep'){
        const tid=ctxSubmenu.taskId;
        const deps=tasks.filter(x=>depList(x).some(d=>d.id===tid));
        return (
          <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'220px',maxHeight:'320px',overflowY:'auto'}} onMouseDown={e=>e.stopPropagation()}>
            <div className="ctx-hdr">Dependents</div><div className="ctx-sep"/>
            {deps.map(p=>(
              <div key={p.id} className="ctx-item" onClick={()=>{ setSelected(p.id); setSelectedSet(new Set([p.id])); closeAll(); }}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</span>
              </div>
            ))}
          </div>
        );
      }
      if(ctxSubmenu.kind==='depType'){
        const {fromId,toId}=ctxSubmenu;
        const types=[{c:'FS',l:'Finish → Start (default)'},{c:'SS',l:'Start → Start'},{c:'FF',l:'Finish → Finish'},{c:'SF',l:'Start → Finish'}];
        return (
          <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'220px'}} onMouseDown={e=>e.stopPropagation()}>
            <div className="ctx-hdr">Dependency type</div><div className="ctx-sep"/>
            {types.map(tt=>(
              <div key={tt.c} className="ctx-item" onClick={()=>{ setDepType(fromId,toId,tt.c); closeAll(); }}>{tt.l}<span className="kbd">{tt.c}</span></div>
            ))}
          </div>
        );
      }
      return null;
    })()}

    {/* Right-click on empty grid */}
    {gridCtxMenu&&(()=>{
      const cx=Math.min(gridCtxMenu.x,window.innerWidth-240), cy=Math.min(gridCtxMenu.y,window.innerHeight-200);
      const closeAll=()=>{ setGridCtxMenu(null); setCtxSubmenu(null); };
      const dayLabel = gridCtxMenu.day ? fmtShort(gridCtxMenu.day) : '';
      const contextRow = gridCtxMenu.rowIdx>=0 ? rows[gridCtxMenu.rowIdx] : null;
      return (
        <div className="ctx-menu" style={{left:cx+'px',top:cy+'px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="ctx-hdr">Grid · {dayLabel}</div><div className="ctx-sep"/>
          <div className="ctx-item" onClick={()=>{ addTaskAtDay(gridCtxMenu.day, contextRow); closeAll(); }}>New task here</div>
          {clipboard && clipboard.tasks?.length>0 && (
            <div className="ctx-item" onClick={()=>{ pasteTasks(gridCtxMenu.day); closeAll(); }}>Paste here ({clipboard.tasks.length})</div>
          )}
        </div>
      );
    })()}

    {/* Right-click on dependency arrow */}
    {depCtxMenu&&(()=>{
      const cx=Math.min(depCtxMenu.x,window.innerWidth-240), cy=Math.min(depCtxMenu.y,window.innerHeight-220);
      const {fromId,toId} = depCtxMenu;
      const fromT=tasks.find(x=>x.id===fromId), toT=tasks.find(x=>x.id===toId);
      const dep = toT ? depList(toT).find(d=>d.id===fromId) : null;
      const subX = Math.min(cx+224, window.innerWidth-240);
      const closeAll=()=>{ setDepCtxMenu(null); setCtxSubmenu(null); };
      return (
        <div className="ctx-menu" style={{left:cx+'px',top:cy+'px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="ctx-hdr">{fromT?.title||'?'} → {toT?.title||'?'}</div><div className="ctx-sep"/>
          <div className="ctx-item has-sub" onClick={()=>setCtxSubmenu({x:subX,y:cy,kind:'depType',fromId,toId})}>Change type ({dep?.type||'FS'})<span className="chev">▸</span></div>
          <div className="ctx-item" style={{gap:'6px'}}>
            <span>Lag (days)</span>
            <input type="number" style={{width:'54px',font:'11px var(--mono)',background:'var(--surface-2)',color:'var(--t1)',border:'1px solid var(--accent-border)',borderRadius:'3px',padding:'1px 4px'}}
              defaultValue={dep?.lag||0}
              onClick={e=>e.stopPropagation()}
              onKeyDown={e=>{ if(e.key==='Enter'){ const n=parseInt(e.target.value,10); if(!isNaN(n)) setDepLag(fromId,toId,n); closeAll(); } if(e.key==='Escape') closeAll(); }}
              onBlur={e=>{ const n=parseInt(e.target.value,10); if(!isNaN(n)) setDepLag(fromId,toId,n); }}/>
          </div>
          <div className="ctx-sep"/>
          <div className="ctx-item danger" onClick={()=>{ deleteDependency(fromId,toId); closeAll(); }}>Delete dependency<span className="kbd">⌫</span></div>
        </div>
      );
    })()}

    {/* Bulk picker popover */}
    {bulkPicker&&(()=>{
      const cx=Math.min(bulkPicker.x,window.innerWidth-260), cy=Math.min(bulkPicker.y,window.innerHeight-260);
      const ids=bulkPicker.ids;
      const close=()=>setBulkPicker(null);
      return (
        <div className="bulk-picker" style={{left:cx+'px',top:cy+'px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="bp-title">Apply to {ids.size} tasks</div>
          {bulkPicker.kind==='owner' && (
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <select className="ins-select" defaultValue="" onChange={e=>{ const v=e.target.value; bulkSetField(ids,'owner', v||undefined); close(); }}>
                <option value="">— none / clear —</option>
                {owners.map(o=><option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
              <input className="ins-input" placeholder="+ new owner & assign" onKeyDown={e=>{
                if(e.key==='Enter'){
                  const v=e.target.value.trim();
                  if(v){ addOwnerToList(v); bulkSetField(ids,'owner',v); close(); }
                }
              }}/>
            </div>
          )}
          {bulkPicker.kind==='color' && (
            <div className="ins-swatches">
              {COLOR_PRESETS.map(c=>(
                <button key={c} className="ins-swatch" style={{background:c}} title={c}
                  onClick={()=>{ bulkSetField(ids,'color',c); close(); }}/>
              ))}
            </div>
          )}
          {bulkPicker.kind==='priority' && (
            <div className="ins-seg">
              {['p1','p2','p3'].map(p=>(
                <button key={p} className={p} onClick={()=>{ bulkSetField(ids,'priority',p); close(); }}>{p.toUpperCase()}</button>
              ))}
            </div>
          )}
        </div>
      );
    })()}

    {/* Project Context menu */}
    {projCtxMenu&&(()=>{
      const p=projects.find(x=>x.id===projCtxMenu.projectId); if(!p)return null;
      const cx=Math.min(projCtxMenu.x,window.innerWidth-200), cy=Math.min(projCtxMenu.y,window.innerHeight-200);
      return (
        <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'180px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="ctx-hdr">{p.name}</div><div className="ctx-sep"/>
          <div className="ctx-item" onClick={()=>{setProjRenaming({id:p.id,value:p.name});setProjCtxMenu(null);}}>Rename<span className="kbd">F2</span></div>
          <div className="ctx-item" onClick={()=>{duplicateProject(p.id);setProjCtxMenu(null);}}>Duplicate</div>
          <div className="ctx-sep"/>
          <div className="ctx-item danger" onClick={()=>{deleteProject(p.id);setProjCtxMenu(null);}}>Delete</div>
        </div>
      );
    })()}

    {/* Group row kebab context menu */}
    {groupCtxMenu&&(()=>{
      const isProject=groupCtxMenu.kind==='project';
      const isOpen=!collapsed.has(groupCtxMenu.groupId);
      const cx=Math.min(groupCtxMenu.x,window.innerWidth-220), cy=Math.min(groupCtxMenu.y,window.innerHeight-280);
      // current color: project task's color field, or owner's color from ownerColors
      const curColor = isProject
        ? tasks.find(t=>t.id===groupCtxMenu.groupId)?.color||null
        : (activeProject?.ownerColors||{})[groupCtxMenu.title]||null;
      return (
        <div className="ctx-menu" style={{left:cx+'px',top:cy+'px',minWidth:'200px'}} onMouseDown={e=>e.stopPropagation()}>
          <div className="ctx-hdr">{groupCtxMenu.title}</div>
          <div className="ctx-sep"/>
          <div className="ctx-item" onClick={()=>{setGroupRenaming({id:groupCtxMenu.groupId,kind:groupCtxMenu.kind,value:groupCtxMenu.title});setGroupCtxMenu(null);}}>
            Rename<span className="kbd">F2</span>
          </div>
          <div className="ctx-sep"/>
          <div style={{padding:'2px 8px 2px',fontSize:'9.5px',fontFamily:'var(--mono)',color:'var(--t4)',letterSpacing:'.06em',textTransform:'uppercase'}}>Color</div>
          <div className="ctx-swatch-row">
            {COLOR_PRESETS.map(hex=>(
              <button key={hex} className={`ctx-swatch${curColor===hex?' active':''}`}
                style={{background:hex}}
                title={hex}
                onClick={()=>setGroupColor(groupCtxMenu.kind,groupCtxMenu.groupId,groupCtxMenu.title,hex)}/>
            ))}
            <button className={`ctx-swatch clr${!curColor?' active':''}`}
              title="Clear color"
              onClick={()=>setGroupColor(groupCtxMenu.kind,groupCtxMenu.groupId,groupCtxMenu.title,null)}/>
          </div>
          <div className="ctx-sep"/>
          <div className="ctx-item" onClick={()=>{setCollapsed(c=>{const n=new Set(c);isOpen?n.add(groupCtxMenu.groupId):n.delete(groupCtxMenu.groupId);return n;});setGroupCtxMenu(null);}}>
            {isOpen?'Collapse':'Expand'}
          </div>
          {isProject&&(()=>{
            const projOrder=tasks.filter(t=>t.kind==='project').map(t=>t.id);
            const pIdx=projOrder.indexOf(groupCtxMenu.groupId);
            const canUp=pIdx>0, canDown=pIdx>=0&&pIdx<projOrder.length-1;
            return <>
              <div className="ctx-sep"/>
              <div className={`ctx-item${canUp?'':' disabled'}`} onClick={()=>{if(canUp){moveGroup(groupCtxMenu.groupId,'up');setGroupCtxMenu(null);}}}>Move up</div>
              <div className={`ctx-item${canDown?'':' disabled'}`} onClick={()=>{if(canDown){moveGroup(groupCtxMenu.groupId,'down');setGroupCtxMenu(null);}}}>Move down</div>
            </>;
          })()}
          {isProject&&<>
            <div className="ctx-sep"/>
            <div className="ctx-item danger" onClick={()=>{const {groupId,title}=groupCtxMenu;setGroupCtxMenu(null);deleteGroupTasks(groupId,title);}}>Delete set…</div>
          </>}
          {!isProject&&<>
            <div className="ctx-sep"/>
            <div className="ctx-item danger" onClick={()=>{clearOwnerGroup(groupCtxMenu.title);setGroupCtxMenu(null);}}>Remove owner from tasks</div>
          </>}
        </div>
      );
    })()}

    {/* Predecessor picker popover */}
    {predPicker&&(()=>{
      const {taskId, anchor} = predPicker;
      const currentTask = tasks.find(t=>t.id===taskId); if(!currentTask) return null;
      const existingPredIds = new Set(depList(currentTask).map(d=>d.id));
      const candidates = tasks
        .filter(t=>t.id!==taskId && t.kind!=='project' && !existingPredIds.has(t.id))
        .filter(t=>!predFilter || t.title.toLowerCase().includes(predFilter.toLowerCase()))
        .sort((a,b)=>a.start.localeCompare(b.start))
        .slice(0,40);
      const addPred = (predId) => {
        if(wouldCreateCycle(tasks, predId, taskId)){
          showToast(`Circular dependency — would create a cycle.`, 'err');
        } else {
          updateTasks(ts=>applySchedule(ts.map(t=>{
            if(t.id!==taskId) return t;
            const existing=depList(t);
            if(existing.some(d=>d.id===predId)) return t;
            return {...t, deps:[...existing,{id:predId,type:'FS',lag:0}]};
          }), taskId));
        }
        setPredPicker(null);
      };
      return (
        <div className="pred-picker" style={{left:Math.min(anchor.x,window.innerWidth-292)+'px',top:Math.min(anchor.y,window.innerHeight-280)+'px'}}
          onMouseDown={e=>e.stopPropagation()}>
          <input autoFocus className="pred-picker-input" placeholder="Search tasks…"
            value={predFilter} onChange={e=>setPredFilter(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Escape'){ e.stopPropagation(); setPredPicker(null); }}}/>
          <div className="pred-picker-list">
            {candidates.length===0&&<div style={{padding:'6px 8px',fontSize:'11px',color:'var(--t4)'}}>No matches</div>}
            {candidates.map(t=>(
              <div key={t.id} className="pred-picker-item" onClick={()=>addPred(t.id)}>{t.title}</div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* App toast notifications */}
    {toasts.length>0&&(
      <div className="app-toast-wrap">
        {toasts.map(t=><div key={t.id} className={`app-toast${t.kind==='err'?' err':t.kind==='warn'?' warn':''}`}>{t.msg}</div>)}
      </div>
    )}

    {/* Duration toast */}
    {durationBuf&&selected&&(()=>{
      const i=rows.findIndex(r=>r.id===selected); if(i<0)return null;
      const r=rows[i]; if(r.isProject||r.milestone)return null;
      const grid=gridScrollRef.current; if(!grid)return null;
      const gRect=grid.getBoundingClientRect();
      const x=gRect.left+xForDay(r.start)-grid.scrollLeft;
      const y=gRect.top+i*rowH+rowH/2-grid.scrollTop-14;
      const w=(diffDays(r.start,r.end)+1)*dayW;
      return <div className="dur-toast" style={{left:Math.min(x+w+12,window.innerWidth-120)+'px',top:Math.max(y,gRect.top+6)+'px'}}>{durationBuf}d<span className="hint"> ↵ apply</span></div>;
    })()}

    {/* Focus chain banner */}
    {focusChain&&(
      <div className="focus-banner">
        <span>Dep subtree · <strong>{focusChain.size}</strong> tasks</span>
        <kbd>Ctrl E</kbd> toggle <kbd>Esc</kbd> exit
        <button className="clear" onClick={()=>setFocusChain(null)}>clear</button>
      </div>
    )}

    {/* Recurrence editor popover */}
    {recurEditor&&(()=>{
      const t = tasks.find(x => x.id === recurEditor.taskId);
      if (!t) { return null; }
      const draft = recurEditor.draft;
      const close = () => setRecurEditor(null);
      const apply = () => {
        const pattern = draft.pattern || 'weekly';
        const interval = Math.max(1, parseInt(draft.interval, 10) || 1);
        const count = Math.max(1, parseInt(draft.count, 10) || 1);
        setRecurrence(t.id, { pattern, interval, count });
        close();
      };
      const cx = Math.min(window.innerWidth/2 - 120, window.innerWidth - 280);
      const cy = Math.min(window.innerHeight/2 - 100, window.innerHeight - 240);
      return (
        <div className="tmpl-overlay" onMouseDown={close}>
          <div className="recur-popover" style={{position:'relative',left:0,top:0}} onMouseDown={e=>e.stopPropagation()}>
            <div className="rp-title">{t.recurrence?'Edit recurrence':'Make recurring'} — "{t.title}"</div>
            <div className="rp-row"><label>Pattern</label>
              <select value={draft.pattern} onChange={e=>setRecurEditor({...recurEditor,draft:{...draft,pattern:e.target.value}})}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="rp-row"><label>Every</label>
              <input type="number" min="1" value={draft.interval}
                onChange={e=>setRecurEditor({...recurEditor,draft:{...draft,interval:e.target.value}})}/>
            </div>
            <div className="rp-row"><label>Count</label>
              <input type="number" min="1" value={draft.count}
                onChange={e=>setRecurEditor({...recurEditor,draft:{...draft,count:e.target.value}})}/>
            </div>
            <div style={{fontSize:10,color:'var(--t4)',marginTop:4}}>
              Generates {Math.max(0,(parseInt(draft.count,10)||1)-1)} additional instances after the source.
            </div>
            <div className="rp-acts">
              {t.recurrence && <button className="rp-btn" onClick={()=>{ setRecurrence(t.id, null); close(); }}>Clear</button>}
              <button className="rp-btn" onClick={close}>Cancel</button>
              <button className="rp-btn primary" onClick={apply}>Save</button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Baselines panel */}
    {baselinesOpen && activeProject && (
      <BaselinesPanel
        baselines={baselines}
        activeBaselineId={activeBaselineId}
        tasks={tasks}
        onClose={()=>setBaselinesOpen(false)}
        onSaveNew={saveBaseline}
        onActivate={activateBaseline}
        onRename={renameBaseline}
        onDelete={deleteBaseline}/>
    )}

    {/* Batch 5: Keyboard help overlay */}
    {helpOpen && <HelpModal onClose={()=>setHelpOpen(false)} fsaAvailable={FSA_AVAILABLE}/>}

    {/* Phase B1: Command palette (Cmd/Ctrl+K) — fuzzy-search every action. */}
    {paletteOpen && (
      <CommandPalette onClose={()=>setPaletteOpen(false)} commands={[
        // File
        { id:'file.new',  group:'File', label:'New project…',    shortcut:'',          keywords:['create','start'], run:()=>createNewProject() },
        { id:'file.open', group:'File', label:'Open workspace…', shortcut:'',          keywords:['load','import'], run:()=>openWorkspace() },
        { id:'file.save', group:'File', label:FSA_AVAILABLE?'Save':'Download', shortcut:'Ctrl+S',  keywords:['write','export'], run:()=>saveWorkspaceRef.current?.(false) },
        ...(FSA_AVAILABLE ? [{ id:'file.saveas', group:'File', label:'Save as…', shortcut:'Ctrl+Shift+S', run:()=>saveWorkspaceRef.current?.(true) }] : []),
        // Edit
        { id:'edit.undo', group:'Edit', label:'Undo', shortcut:'Ctrl+Z',      run:()=>undoRef.current?.() },
        { id:'edit.redo', group:'Edit', label:'Redo', shortcut:'Ctrl+Shift+Z', run:()=>redoRef.current?.() },
        // View
        { id:'view.gantt',    group:'View', label:'Switch to Gantt view',    keywords:['timeline','bars'],    run:()=>setViewMode('gantt') },
        { id:'view.list',     group:'View', label:'Switch to List view',     keywords:['table','rows'],       run:()=>setViewMode('list') },
        { id:'view.calendar', group:'View', label:'Switch to Calendar view', keywords:['month','dates'],      run:()=>setViewMode('calendar') },
        // Saved views (Phase B2) — dynamic per project.
        { id:'view.save',     group:'View', label:'Save current view as…',   keywords:['bookmark','snapshot'], run:()=>saveCurrentView() },
        ...((activeProject?.savedViews) || []).map(v => ({
          id:'view.apply.'+v.id, group:'View', label:`Switch to view "${v.name}"`,
          keywords:['saved',v.viewMode,v.laneMode||''], run:()=>applyView(v)
        })),
        // Help
        { id:'help.shortcuts', group:'Help', label:'Show keyboard shortcuts', shortcut:'?', run:()=>setHelpOpen(true) },
      ]}/>
    )}

    {/* Modal stack shared with welcome — see src/components/modals/ModalsHost.jsx */}
    <ModalsHost
      templateModal={renderTemplateModal()}
      fsaAvailable={FSA_AVAILABLE}
      fileInputRef={fileInputRef}
      onFileInputChange={onFileInputChange}
      loadError={loadError}
      setLoadError={setLoadError}
      modal={modal}
      closeModal={closeModal}
      modalInputRef={modalInputRef}
      tweaks={
        <GanttTweaks tw={tw} setTweak={setTweak} activeProject={activeProject} updateActiveProject={updateActiveProject} customConfirm={customConfirm}
          laneMode={laneMode} lanes={lanes} stageRegistry={stageRegistry}
          setLaneMode={setLaneMode} setLanes={setLanes} setStageRegistry={setStageRegistry}
          setLaneCollapsed={setLaneCollapsed} setDirty={setDirty}/>
      }
    />

    {sortToast && (
      <div className="sort-toast" role="status">
        <span>Sorted by start date</span>
        <button className="sort-toast-undo" onClick={()=>{
          if (sortToastTimerRef.current) clearTimeout(sortToastTimerRef.current);
          const prev = sortToast.prevTasks;
          setSortToast(null);
          if (prev) updateTasks(()=>prev);
        }}>Undo</button>
      </div>
    )}
    </Fragment>
  );
}


export default App;
