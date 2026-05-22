import React from 'react';
import { DOW } from '../data/constants.js';
import { isWeekend, parseYmd, todayStr } from '../data/dates.js';

// Timeline day/month header. Shares the same axis as Grid (via the useAxis
// hook) — column N's left offset MUST equal Grid's column N. Memory:
// project_lp_rp_alignment_invariant.
export function Header({ axis, monthSpans, dayW, totalW, tinyCol, smallCol, hdrScrollRef }) {
  return (
    <div className="timeline-hdr">
      <div className="hdr-scroll" ref={hdrScrollRef}>
        <div className="hdr-track" style={{ width: totalW + 'px' }}>
          {monthSpans.map((m, i) => (
            <div key={i} className="hdr-month" style={{ left: m.idx * dayW + 'px', width: m.len * dayW + 'px' }}>
              {m.label}<span className="yr">{m.year}</span>
            </div>
          ))}
          {axis.days.map((d, i) => {
            const we = isWeekend(d);
            const dt = parseYmd(d);
            const isToday = d === todayStr;
            const ms = dt.getDate() === 1;
            return (
              <div key={d}
                   className={`hdr-day${we ? ' weekend' : ''}${isToday ? ' today' : ''}${ms ? ' month-start' : ''}${tinyCol ? ' tiny' : ''}`}
                   style={{ left: i * dayW + 'px', width: dayW + 'px' }}>
                {!tinyCol && <div className="dow">{smallCol ? DOW[dt.getDay()][0] : DOW[dt.getDay()]}</div>}
                {!tinyCol && <div className="dom">{dt.getDate()}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
