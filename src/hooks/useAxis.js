import { useMemo, useCallback } from 'react';
import { DAY_MS } from '../data/constants.js';
import { ymd, parseYmd, addDays, diffDays, todayStr } from '../data/dates.js';

// Shared by Header and Grid. Protects the LP/RP alignment invariant —
// both panes derive column geometry from the same axis object.
export function useAxis(dayW) {
  const axis = useMemo(() => {
    const t0d = parseYmd(todayStr).getTime();
    const [bk, fw] = dayW >= 20 ? [30, 75] : dayW >= 8 ? [90, 180] : [180, 365];
    const start = ymd(new Date(t0d - bk * DAY_MS));
    const end   = ymd(new Date(t0d + fw * DAY_MS));
    const days = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return { start, end, days };
  }, [dayW]);

  const totalW = axis.days.length * dayW;
  const xForDay = useCallback(s => diffDays(axis.start, s) * dayW, [axis.start, dayW]);

  return { axis, totalW, xForDay };
}
