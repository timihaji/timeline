import { DAY_MS, CLOCK_DAYS, MONTHS, DEFAULT_CALENDAR } from './constants.js';

const _today = new Date(); _today.setHours(0,0,0,0);
export const TODAY = _today;

export function ymd(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
export function parseYmd(s){ return new Date(s+'T00:00:00'); }
export function addDays(s,n){ const d=parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); }
export function diffDays(a,b){ return Math.round((parseYmd(b)-parseYmd(a))/DAY_MS); }
export function fmtShort(s){ return parseYmd(s).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
export function isWeekend(s){ const d=parseYmd(s).getDay(); return d===0||d===6; }
export const todayStr = ymd(TODAY);

export function fmtClock(d){
  const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${mm} · ${CLOCK_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function getCalendar(c){
  if(!c) return DEFAULT_CALENDAR;
  const wd = Array.isArray(c.workingDays) && c.workingDays.length ? c.workingDays : DEFAULT_CALENDAR.workingDays;
  const hd = Array.isArray(c.holidays) ? c.holidays : [];
  return { workingDays: wd, holidays: hd };
}
export function isWorkingDay(s, calendar){
  const cal = getCalendar(calendar);
  if (cal.holidays.includes(s)) return false;
  const dow = parseYmd(s).getDay();
  return cal.workingDays.includes(dow);
}
// Inclusive working-day count between two dates. If end < start returns negative.
export function workingDaysBetween(start, end, calendar){
  if (!start || !end) return 0;
  const cal = getCalendar(calendar);
  const a = parseYmd(start), b = parseYmd(end);
  const sign = a <= b ? 1 : -1;
  let s = sign > 0 ? a : b;
  const e = sign > 0 ? b : a;
  let count = 0, cur = ymd(s);
  while (parseYmd(cur) <= e){
    if (isWorkingDay(cur, cal)) count++;
    cur = addDays(cur, 1);
    if (count > 99999) break;
  }
  return sign * count;
}
// Returns ymd string n working days after start. n may be 0 (returns start
// snapped forward to next working day), positive, or negative.
export function addWorkingDays(start, n, calendar){
  const cal = getCalendar(calendar);
  let cur = start;
  if (n === 0) {
    let safety = 0;
    while (!isWorkingDay(cur, cal) && safety++ < 4000) cur = addDays(cur, 1);
    return cur;
  }
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let safety = 0;
  while (remaining > 0 && safety++ < 40000){
    cur = addDays(cur, step);
    if (isWorkingDay(cur, cal)) remaining--;
  }
  return cur;
}
export function formatDuration(start, end, calendar){
  const total = diffDays(start, end) + 1;
  const work = workingDaysBetween(start, end, calendar);
  if (work === total) return `${total}d`;
  return `${work}d (${total} total)`;
}
