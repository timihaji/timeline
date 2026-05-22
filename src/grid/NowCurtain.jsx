import React from 'react';
import { ymd } from '../data/dates.js';

// "Current moment" indicators inside .grid-bg:
//  • TodayLine: 1px line marking the current day (always rendered).
//  • NowCurtain: optional shaded overlay covering everything before now.
export function TodayLine({ now, xForDay, dayW, todayLineLive }) {
  const liveOffset = todayLineLive !== false
    ? (now.getHours() * 3600 + now.getMinutes() * 60) / 86400
    : 0.5;
  return (
    <div className="today-line"
      style={{ left: xForDay(ymd(now)) + dayW * liveOffset + 'px' }}/>
  );
}

export function NowCurtain({ now, xForDay, dayW }) {
  return (
    <div className="now-curtain"
      style={{ width: Math.max(0, xForDay(ymd(now)) + dayW / 2) + 'px' }}/>
  );
}
