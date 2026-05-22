import { ymd, parseYmd, addDays } from './dates.js';

// Add n months to a ymd date. Preserves day-of-month where possible; if the
// target month is shorter, snaps to the last day of that month (e.g. Jan 31 + 1mo = Feb 28).
export function addMonths(s, n){
  const d = parseYmd(s);
  const targetMonth = d.getMonth() + n;
  const targetY = d.getFullYear() + Math.floor(targetMonth / 12);
  const targetM = ((targetMonth % 12) + 12) % 12;
  const dayOrig = d.getDate();
  const lastDay = new Date(targetY, targetM + 1, 0).getDate();
  const day = Math.min(dayOrig, lastDay);
  const nd = new Date(targetY, targetM, day);
  return ymd(nd);
}

// ── Recurring task expansion ──
// For each task with task.recurrence != null, generate count-1 additional virtual
// instances (recurrenceParent: sourceId, recurrence: null, derived id/title).
// Virtual instances inherit all other fields; deps are stripped on instances so
// the cascade/scheduler doesn't try to reshape them.
export function expandRecurring(tasks, calendar){
  const out = [];
  for (const t of tasks){
    out.push(t);
    const r = t.recurrence;
    if (!r || !r.pattern || !r.count || r.count < 2) continue;
    const interval = Math.max(1, r.interval || 1);
    const count = Math.max(1, Math.floor(r.count));
    for (let n = 1; n < count; n++){
      let nStart, nEnd;
      if (r.pattern === 'daily'){
        nStart = addDays(t.start, n * interval);
        nEnd   = addDays(t.end,   n * interval);
      } else if (r.pattern === 'weekly'){
        nStart = addDays(t.start, n * interval * 7);
        nEnd   = addDays(t.end,   n * interval * 7);
      } else if (r.pattern === 'monthly'){
        nStart = addMonths(t.start, n * interval);
        nEnd   = addMonths(t.end,   n * interval);
      } else {
        continue;
      }
      out.push({
        ...t,
        id: `${t.id}-occ-${n}`,
        title: `${t.title} (${n+1}/${count})`,
        start: nStart,
        end: nEnd,
        recurrenceParent: t.id,
        recurrence: null,
        baselineEnd: undefined,
        deps: [],
      });
    }
  }
  return out;
}
