import { DEFAULT_CALENDAR, DEP_TYPES, DEMO_TASKS, CURRENT_VERSION } from './constants.js';
import { todayStr } from './dates.js';
import { genId } from '../utils/ids.js';

export function newProject(name){
  // Same 8 Things-3 pastels as COLOR_PRESETS — keeps drawer + project dots visually consistent
  const palette = ['#f9a8a8','#fac89a','#f5dc88','#b2e0ac','#9dd8d5','#96c6e8','#c3b2e8','#f5bad0'];
  return { id: genId('proj-'), name: name || 'Untitled project', color: palette[Math.floor(Math.random()*palette.length)], created: todayStr, baselines: [], activeBaselineId: null, tasks: [], owners: [], calendar: {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]}, autoSchedule: 'cascade', tagRegistry: [], savedViews: [] };
}

export function sampleWorkspace(){
  const owners = [
    { name: 'Alex',   hourlyRate: 110, color: '#96c6e8', calendar: null, pto: [], allocationPct: 100 },
    { name: 'Sam',    hourlyRate: 95,  color: '#f5dc88', calendar: null, pto: [], allocationPct: 100 },
    { name: 'Jordan', hourlyRate: 85,  color: '#b2e0ac', calendar: null, pto: [], allocationPct: 100 },
    { name: 'Chris',  hourlyRate: 120, color: '#f5bad0', calendar: null, pto: [], allocationPct: 100 },
  ];
  const p = { id: 'proj-mpc6cybsp07', name: 'Sample workspace', color: '#b2e0ac', created: '2026-05-19', baselines: [], activeBaselineId: null, tasks: DEMO_TASKS, owners, calendar: {...DEFAULT_CALENDAR, holidays: [...DEFAULT_CALENDAR.holidays]}, autoSchedule: 'cascade', tagRegistry: [] };
  return { version: CURRENT_VERSION, projects: [p], activeProjectId: p.id, laneMode: 'off', lanes: [], stageRegistry: [] };
}

export const nextDepType = t => DEP_TYPES[(DEP_TYPES.indexOf(t||'FS') + 1) % DEP_TYPES.length];
