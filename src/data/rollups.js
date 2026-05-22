import { DAY_MS, STATUSES, DEFAULT_CALENDAR } from './constants.js';
import { todayStr, parseYmd, diffDays, addDays } from './dates.js';

// ── Status helpers ──
export function normalizeStatus(s, doneFallback){
  if (typeof s === 'string' && STATUSES.includes(s)) return s;
  return doneFallback ? 'done' : 'todo';
}
export function syncDoneFromStatus(t){
  // Mutates and returns t with done aligned to status.
  t.done = t.status === 'done';
  if (t.status === 'done') t.progress = 100;
  return t;
}

// ── Subtask helpers ──
// "Children" = tasks whose `parent` field names another task as parent.
// "Descendants" = recursive children.
export function taskChildren(tasks, parentId){
  const out = [];
  for (const t of tasks) if (t.parent === parentId) out.push(t);
  return out;
}
export function taskHasChildren(tasks, parentId){
  for (const t of tasks) if (t.parent === parentId) return true;
  return false;
}
export function taskDescendants(tasks, rootId){
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(t);
  }
  const out = [];
  const walk = (id) => {
    const kids = byParent.get(id) || [];
    for (const k of kids){ out.push(k); walk(k.id); }
  };
  walk(rootId);
  return out;
}
// Compute roll-ups for every task that has descendants. Returns Map<id, {start,end,progress}>.
// Leaves are not included. Caller decides whether to display rolled-up or stored values.
export function computeSubtaskRollup(tasks){
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(t);
  }
  const out = new Map();
  const visit = (id) => {
    const kids = byParent.get(id) || [];
    if (!kids.length) return null; // leaf
    let minS = null, maxE = null, wSum = 0, wDur = 0;
    for (const k of kids){
      const child = visit(k.id);
      const s = child ? child.start : k.start;
      const e = child ? child.end   : k.end;
      const p = child ? child.progress : (typeof k.progress === 'number' ? k.progress : 0);
      if (minS === null || s < minS) minS = s;
      if (maxE === null || e > maxE) maxE = e;
      // Duration-weighted progress so a 10-day child counts 10× a 1-day child.
      const dur = Math.max(1, diffDays(s, e) + 1);
      wDur += dur; wSum += p * dur;
    }
    const roll = { start: minS, end: maxE, progress: wDur > 0 ? wSum / wDur : 0 };
    out.set(id, roll);
    return roll;
  };
  for (const t of tasks) visit(t.id);
  return out;
}

// ── Per-resource availability ──
// Resolve the effective working calendar for an owner: if owner.calendar is null,
// fall back to the project's calendar. PTO blocks act as extra holidays.
export function getEffectiveCalendarForOwner(owner, projectCalendar){
  const base = (owner && owner.calendar) || projectCalendar || DEFAULT_CALENDAR;
  if (!owner || !Array.isArray(owner.pto) || owner.pto.length === 0){
    return base;
  }
  const extraHolidays = new Set(Array.isArray(base.holidays) ? base.holidays : []);
  for (const block of owner.pto){
    if (!block || !block.start || !block.end) continue;
    let cur = block.start;
    while (cur <= block.end){
      extraHolidays.add(cur);
      cur = addDays(cur, 1);
    }
  }
  return { ...base, holidays: Array.from(extraHolidays) };
}

// ── Dep helpers (v3 shape: [{id, type, lag}]) ──
export function normalizeDep(d){
  if (!d) return null;
  if (typeof d === 'string') return {id: d, type: 'FS', lag: 0};
  return {id: d.id, type: d.type || 'FS', lag: typeof d.lag === 'number' ? d.lag : 0};
}
export function depList(t){
  return (t?.deps || []).map(normalizeDep).filter(Boolean);
}

// Returns true if adding fromId as a predecessor of toId would create a cycle.
export function wouldCreateCycle(tasks, fromId, toId){
  const byId = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set();
  const stack = [fromId];
  while (stack.length){
    const cur = stack.pop();
    if (cur === toId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const t = byId.get(cur);
    if (t) for (const d of depList(t)) stack.push(d.id);
  }
  return false;
}

// ── At-risk tasks ──
export function computeAtRisk(tasks){
  const byId=new Map(tasks.map(t=>[t.id,t]));
  const atRisk=new Set();
  for(const ms of tasks.filter(t=>t.milestone&&!t.done)){
    const stack=depList(ms).map(d=>d.id); const seen=new Set();
    while(stack.length){
      const id=stack.pop(); if(seen.has(id)) continue; seen.add(id);
      const t=byId.get(id); if(!t) continue;
      if(t.end>=ms.start) atRisk.add(id);
      for(const d of depList(t)) stack.push(d.id);
    }
  }
  return atRisk;
}

// ── Health pip ──
export function getHealth(t, isAtRisk){
  if(t.done||t.kind==='project'||t.milestone) return null;
  if(t.blocking) return 'red';
  const todayD=parseYmd(todayStr), endD=parseYmd(t.end);
  if(endD<todayD&&(t.progress||0)<1) return 'red';
  if(t.baselineEnd){ const slip=diffDays(t.baselineEnd,t.end); if(slip>=4) return 'red'; if(slip>=2) return 'amber'; }
  const startD=parseYmd(t.start), dur=Math.max(1,diffDays(t.start,t.end)+1);
  const elapsed=Math.max(0,(todayD-startD)/DAY_MS);
  const expected=Math.min(1,elapsed/dur), actual=t.progress||0;
  if(expected-actual>0.4) return 'red';
  if(expected-actual>0.2) return 'amber';
  if(isAtRisk) return 'amber';
  return 'green';
}

// ── Dep chain ──
export function getDepChain(tasks, id){
  const byId=new Map(tasks.map(t=>[t.id,t]));
  const dependents=new Map();
  for(const t of tasks) for(const d of depList(t)){
    if(!dependents.has(d.id)) dependents.set(d.id,[]);
    dependents.get(d.id).push(t.id);
  }
  const result=new Set([id]);
  const up=[id];
  while(up.length){ const cur=up.pop(); for(const d of depList(byId.get(cur))) if(!result.has(d.id)){result.add(d.id);up.push(d.id);} }
  const down=[id];
  while(down.length){ const cur=down.pop(); for(const c of (dependents.get(cur)||[])) if(!result.has(c)){result.add(c);down.push(c);} }
  return result;
}

// ── WBS numbering (auto from parent/child tree, project-order based) ──
export function computeWbsMap(tasks){
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(t);
  }
  const out = new Map();
  const roots = (byParent.get('__root')||[]).filter(t=>t.kind==='project');
  for (const proj of roots){
    out.set(proj.id, '');
    const walk = (parentId, prefix) => {
      const kids = byParent.get(parentId) || [];
      kids.forEach((k, i) => {
        const code = prefix ? `${prefix}.${i+1}` : `${i+1}`;
        out.set(k.id, code);
        walk(k.id, code);
      });
    };
    walk(proj.id, '');
  }
  const orphans = (byParent.get('__root')||[]).filter(t=>t.kind!=='project');
  orphans.forEach((o, i) => {
    out.set(o.id, `${i+1}`);
    const walk = (parentId, prefix) => {
      const kids = byParent.get(parentId) || [];
      kids.forEach((k, i) => {
        const code = `${prefix}.${i+1}`;
        out.set(k.id, code);
        walk(k.id, code);
      });
    };
    walk(o.id, `${i+1}`);
  });
  return out;
}

// ── Cost helpers ──
// Compute a single task's cost. Use explicit `cost` if set; else if task has an
// owner mapped to a known hourlyRate, compute rate × duration × 8h.
export function computeTaskCost(task, ownersByName){
  if (task == null) return 0;
  if (typeof task.cost === 'number' && !isNaN(task.cost)) return task.cost;
  if (task.owner && ownersByName){
    const o = ownersByName.get(task.owner);
    if (o && typeof o.hourlyRate === 'number' && !isNaN(o.hourlyRate)){
      const dur = Math.max(1, diffDays(task.start, task.end) + 1);
      return o.hourlyRate * dur * 8;
    }
  }
  return 0;
}

export function computeCostRollup(tasks, owners){
  const ownersByName = new Map((owners||[]).map(o => [o.name, o]));
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(t);
  }
  const total = new Map();
  const visit = (id) => {
    if (total.has(id)) return total.get(id);
    const kids = byParent.get(id) || [];
    let sum = 0;
    for (const k of kids){
      sum += visit(k.id);
    }
    const me = tasks.find(t => t.id === id);
    if (me && me.kind !== 'project') sum += computeTaskCost(me, ownersByName);
    total.set(id, sum);
    return sum;
  };
  for (const t of tasks) visit(t.id);
  let grand = 0;
  for (const t of tasks){
    if (t.kind === 'project') grand += total.get(t.id) || 0;
    else if (!t.parent) grand += total.get(t.id) || 0;
  }
  return { perTask: total, grand };
}

// ── Status classification ──
export function classifyStatus(t){
  if (t.done) return 'done';
  const today = todayStr;
  if (t.end < today && !t.done) return 'overdue';
  if (t.baselineEnd && diffDays(t.baselineEnd, t.end) >= 2) return 'atrisk';
  const startD = parseYmd(t.start), endD = parseYmd(t.end), todayD = parseYmd(today);
  if (endD >= todayD){
    const dur = Math.max(1, diffDays(t.start, t.end) + 1);
    const elapsed = Math.max(0, (todayD - startD) / 86400000);
    const expected = Math.min(1, elapsed/dur);
    const actual = t.progress || 0;
    if (expected - actual > 0.3) return 'atrisk';
  }
  return 'active';
}
