import React, { useState, useMemo } from 'react';
import { ymd, parseYmd, todayStr, fmtShort } from '../data/dates.js';
import { MONTHS, DEFAULT_CALENDAR } from '../data/constants.js';

export function CalendarView({ tasks, expandedTasks, calendar, selected, selectedSet,
                       setSelected, setSelectedSet, setCtxMenu }){
  const [cursor, setCursor] = useState(() => {
    const d = parseYmd(todayStr);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const cal = calendar || DEFAULT_CALENDAR;
  const workingDays = Array.isArray(cal.workingDays) ? cal.workingDays : DEFAULT_CALENDAR.workingDays;
  const holidays = new Set(Array.isArray(cal.holidays) ? cal.holidays : []);
  // Determine week start: if Mon (1) is a working day use Mon-first, else Sun-first.
  const weekStart = workingDays.includes(1) ? 1 : 0;
  const dowLabels = weekStart === 1
    ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const isWeekendDow = (dow) => !workingDays.includes(dow);

  // Build month grid (weeks of 7 days)
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const last = new Date(cursor.y, cursor.m + 1, 0);
    const startDow = first.getDay();
    const offset = (startDow - weekStart + 7) % 7;
    const gridStart = new Date(cursor.y, cursor.m, 1 - offset);
    // End at week containing last day
    const lastDow = last.getDay();
    const tailPad = 6 - ((lastDow - weekStart + 7) % 7);
    const gridEnd = new Date(cursor.y, cursor.m, last.getDate() + tailPad);
    const days = [];
    let cur = new Date(gridStart);
    while (cur <= gridEnd){
      days.push({
        date: new Date(cur),
        ymd: ymd(cur),
        dom: cur.getDate(),
        dow: cur.getDay(),
        isCurMonth: cur.getMonth() === cursor.m,
      });
      cur.setDate(cur.getDate() + 1);
    }
    // Split into weeks
    const weeks = [];
    for (let i=0;i<days.length;i+=7) weeks.push(days.slice(i, i+7));
    return weeks;
  }, [cursor, weekStart]);

  // Tasks intersecting this month: any task overlapping [gridStart..gridEnd]
  const monthStart = grid.length ? grid[0][0].ymd : todayStr;
  const monthEnd = grid.length ? grid[grid.length-1][6].ymd : todayStr;
  const visibleTasks = useMemo(() => {
    return expandedTasks.filter(t => {
      if (t.kind === 'project') return false;
      return t.start <= monthEnd && t.end >= monthStart;
    });
  }, [expandedTasks, monthStart, monthEnd]);

  // For each task, compute strip segments per week.
  const weekSegments = useMemo(() => {
    const perWeek = grid.map(() => []);
    for (const t of visibleTasks){
      grid.forEach((week, wi) => {
        const wStart = week[0].ymd;
        const wEnd = week[6].ymd;
        if (t.end < wStart || t.start > wEnd) return;
        const segStart = t.start < wStart ? wStart : t.start;
        const segEnd = t.end > wEnd ? wEnd : t.end;
        const startCol = week.findIndex(d => d.ymd === segStart);
        const endCol = week.findIndex(d => d.ymd === segEnd);
        if (startCol < 0 || endCol < 0) return;
        perWeek[wi].push({
          task: t,
          startCol,
          endCol,
          continuesLeft: t.start < wStart,
          continuesRight: t.end > wEnd,
        });
      });
    }
    // Lane assignment per week
    return perWeek.map(segs => {
      segs.sort((a,b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
      const lanes = []; // array of lane end cols
      for (const s of segs){
        let lane = 0;
        while (lane < lanes.length && lanes[lane] >= s.startCol) lane++;
        if (lane === lanes.length) lanes.push(s.endCol);
        else lanes[lane] = s.endCol;
        s.lane = lane;
      }
      return segs;
    });
  }, [grid, visibleTasks]);

  const monthLabel = MONTHS[cursor.m] + ' ' + cursor.y;
  const prevMonth = () => setCursor(c => {
    const m = c.m - 1; if (m < 0) return { y: c.y - 1, m: 11 };
    return { y: c.y, m };
  });
  const nextMonth = () => setCursor(c => {
    const m = c.m + 1; if (m > 11) return { y: c.y + 1, m: 0 };
    return { y: c.y, m };
  });
  const goToday = () => {
    const d = parseYmd(todayStr);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const today = todayStr;

  const onChipClick = (e, t) => {
    e.stopPropagation();
    if (e.shiftKey){
      setSelectedSet(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
    } else {
      setSelected(t.id);
      setSelectedSet(new Set([t.id]));
    }
  };
  const onChipCtx = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    if (t.recurrenceParent) return;
    if (!selectedSet.has(t.id)){ setSelected(t.id); setSelectedSet(new Set([t.id])); }
    setCtxMenu({x:e.clientX, y:e.clientY, taskId:t.id});
  };

  const MAX_LANES_VISIBLE = 4;

  return (
    <div className="calendar-view">
      <div className="calendar-view-hdr">
        <button className="cv-nav-btn" title="Previous month" onClick={prevMonth}>‹</button>
        <button className="cv-nav-btn" title="Next month" onClick={nextMonth}>›</button>
        <div className="cv-title">{monthLabel}</div>
        <button className="cv-today-btn" onClick={goToday}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>
          Today
        </button>
        <span className="cv-meta">{visibleTasks.length} task{visibleTasks.length===1?'':'s'} this month</span>
      </div>
      <div className="calendar-grid">
        <div className="calendar-dow-row">
          {dowLabels.map((lbl,i) => {
            const dow = (weekStart + i) % 7;
            return <div key={i} className={`cv-dow${isWeekendDow(dow)?' weekend':''}`}>{lbl}</div>;
          })}
        </div>
        <div className="calendar-weeks">
          {grid.length === 0 ? (
            <div className="calendar-empty">
              <h3>Empty month</h3>
              <div>No grid to render.</div>
            </div>
          ) : grid.map((week, wi) => {
            const segs = weekSegments[wi] || [];
            return (
              <div key={wi} className="calendar-week">
                {week.map((d, di) => {
                  const isToday = d.ymd === today;
                  const isWE = isWeekendDow(d.dow);
                  const isHol = holidays.has(d.ymd);
                  return (
                    <div key={di} className={`calendar-cell${isWE?' weekend':''}${d.isCurMonth?'':' other-month'}${isToday?' today':''}${isHol?' holiday':''}`}
                         title={isHol?'Holiday':''}>
                      <span className="cv-date-num">{d.dom}</span>
                    </div>
                  );
                })}
                {/* Strips overlay */}
                {segs.slice().sort((a,b)=>a.lane-b.lane).filter(s => s.lane < MAX_LANES_VISIBLE).map((s, idx) => {
                  const t = s.task;
                  const left = (s.startCol / 7) * 100;
                  const right = ((s.endCol + 1) / 7) * 100;
                  const width = right - left;
                  const top = 22 + s.lane * 17;
                  const isSel = selected === t.id || selectedSet.has(t.id);
                  const bg = t.color || '#96c6e8';
                  return (
                    <div key={t.id + '-' + wi + '-' + idx}
                      className={`calendar-strip${t.done?' done':''}${t.milestone?' milestone':''}${s.continuesLeft?' continues-left':''}${s.continuesRight?' continues-right':''}${t.recurrenceParent?' recur-i':''}${isSel?' selected':''}`}
                      style={{position:'absolute', left:`calc(${left}% + 2px)`, width:`calc(${width}% - 4px)`, top:top+'px', background: bg}}
                      title={`${t.title} · ${fmtShort(t.start)} → ${fmtShort(t.end)}${t.owner?' · '+t.owner:''}`}
                      onClick={(e)=>onChipClick(e, t)}
                      onContextMenu={(e)=>onChipCtx(e, t)}>
                      {t.milestone ? '◆ ' : ''}{t.title}{t.recurrenceParent ? ' ↻' : ''}
                    </div>
                  );
                })}
                {(() => {
                  const hidden = segs.filter(s => s.lane >= MAX_LANES_VISIBLE).length;
                  if (!hidden) return null;
                  return (
                    <div key={'more-'+wi} className="cv-strip-more"
                      style={{position:'absolute', right:6, bottom:3}}>+{hidden} more</div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
