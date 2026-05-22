import React from 'react';
import { shade } from '../utils/colors.js';
import { formatCost } from '../utils/format.js';
import { diffDays, fmtShort, formatDuration, todayStr } from '../data/dates.js';
import { getHealth } from '../data/rollups.js';

// One row's bar rendering. Branches: lane / project-group / milestone / task.
// Memory: project_grid_cursor_layer — bar-layer must keep cursor:inherit
// from grid-track for cursor changes to propagate. Bar itself sits inside
// .bar-layer.
export function Bar({
  row: r, rowIdx: i,
  dayW, rowH, xForDay, labelPos,
  tw,
  selected, selectedSet, focusChain, hoverChain,
  atRisk, conflicts, critical, showCritical, showConflicts, showOwners,
  drag, renaming, costRoll,
  livePreview,
  beginBarDrag, beginDepDrag, beginProgDrag,
  setHoveredBarId, setSelected, setSelectedSet, setRenaming, setCtxMenu,
  commitRename,
  calendar,
}) {
  const live = livePreview(r);
  const start = live ? live.start : r.start;
  const end = live ? live.end : r.end;
  const x = xForDay(start);
  const w = r.milestone ? dayW : (diffDays(start, end) + 1) * dayW - 2;
  const top = i * rowH + (rowH - 22) / 2;
  const dragging = drag && drag.id === r.id;
  const sel = selected === r.id;
  const multiSel = selectedSet.has(r.id);
  const isPast = !dragging && end < todayStr;

  if (r.isLane) {
    if (!r.start || !r.end || w <= 0) return null;
    const c = r.color || '#94a3b8';
    return (
      <div className="bar lane-bar"
        style={{ left: x + 'px', top: i * rowH + (rowH - 10) / 2 + 'px', width: w + 'px', height: '10px',
                 background: c + '28', border: `1px solid ${c}88`, borderRadius: '3px', pointerEvents: 'none' }}/>
    );
  }
  if (r.isProject || r.isOwnerGroup) {
    const isOwner = r.isOwnerGroup;
    const projCost = isOwner ? 0 : (costRoll.perTask.get(r.id) || 0);
    return (
      <div className={`bar project${isOwner ? ' owner-rollup' : ''}`}
        title={projCost > 0 ? `${r.title} · ${formatCost(projCost)} total` : r.title}
        style={{ left: x + 'px', top: i * rowH + (rowH - 12) / 2 + 'px', width: w + 'px', height: '12px' }}>
        {!isOwner && <span className="proj-cap"/>}
        <div className="bar-ttl">{r.title}</div>
      </div>
    );
  }

  const focusDimmed = focusChain && !focusChain.has(r.id);
  const hoverDimmed = !focusChain && hoverChain && !hoverChain.has(r.id);
  const isConflict = conflicts.has(r.id);
  const isRenaming = renaming?.id === r.id;
  const health = getHealth(r, atRisk.has(r.id));
  const liveProgress = (drag?.kind === 'prog' && drag.id === r.id) ? (drag.liveProgress ?? 0) : (r.progress || 0);
  const bg = r.done ? '#ebebed' : (r.color || '#96c6e8');

  if (r.milestone) {
    return (
      <div
        className={`bar milestone${dragging ? ' dragging' : ''}${sel ? ' selected' : ''}${multiSel ? ' multi-sel' : ''}${r.done ? ' done' : ''}${showCritical && critical.nodes.has(r.id) ? ' critical' : ''}${focusDimmed ? ' dimmed' : ''}${hoverDimmed ? ' hover-dim' : ''}${r.blocking ? ' blocking' : ''}`}
        data-bar-id={r.id} style={{ left: x + 'px', top: top + 'px', width: dayW + 'px' }}
        onPointerDown={e => { if (isRenaming) return; beginBarDrag(e, r, 'move'); }}
        onMouseEnter={() => setHoveredBarId(r.id)} onMouseLeave={() => setHoveredBarId(null)}
        onClick={e => { if (e.button !== 0) return; e.stopPropagation(); setSelected(r.id); }}
        onDoubleClick={e => { e.stopPropagation(); setRenaming({ id: r.id, value: r.title, source: 'bar' }); }}
        onContextMenu={e => { e.preventDefault(); if (!selectedSet.has(r.id)) { setSelectedSet(new Set([r.id])); } setCtxMenu({ x: e.clientX, y: e.clientY, taskId: r.id }); }}>
        <span className="diamond" style={{ background: r.done ? '#ebebed' : (r.color || '#96c6e8') }}/>
        {isRenaming
          ? <input className="row-rename bar-rename"
              style={{ position: 'absolute', left: '24px', width: '180px', background: 'var(--surface-2)', color: 'var(--t1)' }}
              value={renaming.value} onChange={e => setRenaming({ ...renaming, value: e.target.value })} onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}/>
          : <span className="bar-ttl">{r.title}</span>
        }
        <span className="dep-knob dep-knob-l" onPointerDown={e => beginDepDrag(e, r, 'start')} title="Drag to set predecessor ←"/>
        <span className="dep-knob" onPointerDown={e => beginDepDrag(e, r, 'end')} title="Drag to link successor →"/>
      </div>
    );
  }

  const durLabel = formatDuration(start, end, calendar);
  const isRecurInstance = !!r.recurrenceParent;
  const isRecurSource = !!r.recurrence;
  const isShort = w < 30;
  const extraEls = (w > 22 ? 28 : 0) + (r.locked ? 20 : 0);
  const showInsideLabel = labelPos === 'inside' || labelPos === 'both' || (labelPos === 'auto' && (w - 18 - extraEls) >= r.title.length * 6.5);

  return (
    <React.Fragment>
      {(r.leadTimeBefore > 0) && (
        <div className="bar-lead bar-lead-before"
          style={{ left: (x - (r.leadTimeBefore * dayW)) + 'px', top: top + 'px', width: (r.leadTimeBefore * dayW - 2) + 'px', background: bg }}>
          {r.leadTimeBefore * dayW > 28 && <span className="bar-lead-lbl">{r.leadTimeBefore}d</span>}
        </div>
      )}
      {(r.leadTimeAfter > 0) && (
        <div className="bar-lead bar-lead-after"
          style={{ left: (x + w + 2) + 'px', top: top + 'px', width: (r.leadTimeAfter * dayW - 2) + 'px', background: bg }}>
          {r.leadTimeAfter * dayW > 28 && <span className="bar-lead-lbl">{r.leadTimeAfter}d</span>}
        </div>
      )}
      <div
        className={`bar${dragging ? ' dragging' : ''}${sel ? ' selected' : ''}${multiSel ? ' multi-sel' : ''}${r.done ? ' done' : ''}${tw.compactBars ? ' compact' : ''}${tw.pillBars ? ' pill' : ''}${showCritical && critical.nodes.has(r.id) ? ' critical' : ''}${focusDimmed ? ' dimmed' : ''}${hoverDimmed ? ' hover-dim' : ''}${r.blocking ? ' blocking' : ''}${drag?.kind === 'prog' && drag.id === r.id ? ' prog-dragging' : ''}${isPast ? ' past' : ''}${isConflict && showConflicts ? ' conflict-bar' : ''}${isRecurInstance ? ' recur-instance' : ''}${isShort ? ' short' : ''}${r.locked ? ' bar-locked' : ''}`}
        data-bar-id={r.id}
        style={{ left: x + 'px', top: top + 'px', width: w + 'px',
                 ...(tw.pillBars
                   ? { background: shade(bg, .82), border: `1.5px solid ${shade(bg, -.15)}`, color: shade(bg, -.55) }
                   : { background: `linear-gradient(180deg,${bg},${shade(bg, -.18)})`, border: `1px solid ${shade(bg, -.35)}` }),
                 '--bar-c': bg, '--bar-c-d': shade(bg, -.35), '--bar-c-l': shade(bg, .32) }}
        onPointerDown={e => {
          if (isRenaming) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ox = e.clientX - rect.left, bw = rect.width;
          const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
          const edge = Math.min(coarse ? 22 : 16, bw * 0.3);
          let kind = 'move';
          if (!isRecurInstance && !isShort) {
            if (ox < edge) kind = 'l';
            else if (ox > bw - edge) kind = 'r';
          }
          beginBarDrag(e, r, kind);
        }}
        onPointerMove={e => {
          if (drag || isRenaming || isRecurInstance || isShort) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ox = e.clientX - rect.left, bw = rect.width;
          const coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
          const edge = Math.min(coarse ? 22 : 16, bw * 0.3);
          let zone = '';
          if (ox < edge) zone = 'l';
          else if (ox > bw - edge) zone = 'r';
          if (e.currentTarget.dataset.zone !== zone) {
            if (zone) e.currentTarget.dataset.zone = zone;
            else delete e.currentTarget.dataset.zone;
          }
        }}
        onPointerLeave={e => { if (e.currentTarget.dataset.zone) delete e.currentTarget.dataset.zone; }}
        onMouseEnter={() => setHoveredBarId(r.id)} onMouseLeave={() => setHoveredBarId(null)}
        onClick={e => { if (e.button !== 0) return; e.stopPropagation(); setSelected(r.id); }}
        onDoubleClick={e => { if (isRecurInstance) return; e.stopPropagation(); setRenaming({ id: r.id, value: r.title, source: 'bar' }); }}
        onContextMenu={e => { e.preventDefault(); if (isRecurInstance) return; if (!selectedSet.has(r.id)) { setSelectedSet(new Set([r.id])); } setCtxMenu({ x: e.clientX, y: e.clientY, taskId: r.id }); }}
        title={isRenaming ? '' : (isRecurInstance ? `${r.title} · recurring instance — edit the source task to change` : `${r.title} · ${fmtShort(start)} → ${fmtShort(end)} · ${durLabel}${r.owner ? ' · ' + r.owner : ''}${typeof r.cost === 'number' ? ' · ' + formatCost(r.cost) : ''}${isRecurSource ? ' · ↻ recurring source' : ''}${isShort ? ' · short bar — right-click or use the • dot for resize' : ''}`)}>
        {r.locked && (
          <span className="lock-icon" title="Locked — dates frozen">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="7" width="10" height="7" rx="1.5"/>
              <path d="M5 7V5a3 3 0 016 0v2"/>
            </svg>
          </span>
        )}
        {liveProgress > 0 && <div className="bar-prog" style={{ width: (liveProgress * 100) + '%', background: `${shade(bg, -.45)}66` }}/>}
        {!r.done && liveProgress > 0 && liveProgress < .99 && !isRecurInstance && (
          <div className="bar-prog-handle" style={{ left: `calc(${Math.max(6, Math.min(94, liveProgress * 100))}% - 1px)` }}
            onPointerDown={e => { e.stopPropagation(); beginProgDrag(e, r); }}/>
        )}
        {(isRecurInstance || isRecurSource) && (
          <div className="recur-icon" title={isRecurInstance ? 'Recurring instance — edit the source' : 'Recurring source'}>↻</div>
        )}
        {isRenaming && renaming.source === 'bar'
          ? <input className="bar-rename" autoFocus onFocus={e => e.target.select()}
              value={renaming.value}
              onChange={e => setRenaming({ ...renaming, value: e.target.value })}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}/>
          : <div className="bar-ttl">{isRenaming ? renaming.value : (showInsideLabel ? r.title : '')}</div>
        }
        {w > 22 && !isRenaming && <div className="bar-meta">{durLabel}</div>}
        {health && !isRenaming && (
          <div className={`health-pip ${health}`}
            title={health === 'green' ? 'On track' : health === 'amber' ? 'At risk — progress behind schedule' : 'Overdue — past end date'}/>
        )}
        {atRisk.has(r.id) && !r.done && <div className="bar-risk-edge"/>}
        {isConflict && showConflicts && <div className="conflict-dot" title="Owner double-booked">!</div>}
        {isShort && !isRecurInstance && (
          <div className="bar-short-dot" title="Resize / link options"
            onPointerDown={e => { e.stopPropagation(); }}
            onClick={e => {
              e.stopPropagation();
              if (!selectedSet.has(r.id)) { setSelectedSet(new Set([r.id])); }
              setCtxMenu({ x: e.clientX, y: e.clientY, taskId: r.id });
            }}>•••</div>
        )}
        {!isRecurInstance && !isShort && (
          <>
            <span className="bar-grip bar-grip-l" aria-hidden="true"/>
            <span className="bar-grip bar-grip-r" aria-hidden="true"/>
          </>
        )}
        {!isRecurInstance && (
          <>
            <span className="dep-knob dep-knob-l" onPointerDown={e => beginDepDrag(e, r, 'start')} title="Drag to set predecessor ←"/>
            <span className="dep-knob" onPointerDown={e => beginDepDrag(e, r, 'end')} title="Drag to link successor →"/>
          </>
        )}
      </div>
      {!isRenaming && (labelPos === 'both' || !showInsideLabel) && (
        <div className={`bar-ttl-ext${tw.compactBars ? ' compact' : ''}`} style={{ left: (x + w + 4) + 'px', top: top + 'px' }}>{r.title}</div>
      )}
      {showOwners && r.owner && !isRenaming && labelPos !== 'both' && showInsideLabel && (
        <div className="bar-owner-ext" style={{ left: (x + w + 4) + 'px', top: top + 'px' }}>{r.owner.slice(0, 2).toUpperCase()}</div>
      )}
    </React.Fragment>
  );
}
