import React from 'react';
import { depList } from '../data/rollups.js';
import { buildArrowPath } from '../data/arrows.js';

// SVG layer with dependency paths between bars + drag previews for
// new-dep and dep-edit interactions. Sits between .grid-bg and .bar-layer.
export function DepArrows({
  rows, rowH, dayW, axis, totalW,
  rowIndexById,
  showCritical, critical, showAllDeps,
  focusChain, hoverChain,
  drag, hoveredDepEdge, setHoveredDepEdge, setDepCtxMenu,
  beginDepEdit,
  livePreview, xForDay,
  gridScrollRef,
}) {
  return (
    <svg className="dep-svg" width={totalW} height={rows.length * rowH}>
      <defs>
        <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/>
        </marker>
        <marker id="dep-arrow-preview" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#14b8a6"/>
        </marker>
      </defs>
      {rows.flatMap((r, i) => {
        const list = depList(r);
        if (!list.length) return [];
        const live = livePreview(r);
        const childStartX = xForDay(live ? live.start : r.start);
        const childEndX = xForDay(live ? live.end : r.end) + dayW;
        return list.flatMap(dep => {
          const depId = dep.id;
          const pi = rowIndexById.get(depId) ?? -1;
          if (pi < 0) return [];
          const par = rows[pi];
          const liveP = livePreview(par);
          const parStartX = xForDay(liveP ? liveP.start : par.start);
          const parEndX = xForDay(liveP ? liveP.end : par.end) + dayW;
          const type = dep.type || 'FS';
          let parentX, childX;
          if (type === 'SS')      { parentX = parStartX; childX = childStartX - 4; }
          else if (type === 'FF') { parentX = parEndX;   childX = childEndX + 4; }
          else if (type === 'SF') { parentX = parStartX; childX = childEndX + 4; }
          else                    { parentX = parEndX;   childX = childStartX - 4; }
          const isCrit = showCritical && critical.edges.has(depId + '→' + r.id);
          const focusDim = focusChain && (!focusChain.has(r.id) || !focusChain.has(depId));
          const inHover = hoverChain && hoverChain.has(r.id) && hoverChain.has(depId);
          const hoverDim = hoverChain && !inHover;
          const isEditingThis = drag?.kind === 'dep-edit' && drag.fromId === depId && drag.toId === r.id;
          const isHoveredEdge = hoveredDepEdge?.fromId === depId && hoveredDepEdge?.toId === r.id;
          const approachFromLeft = type === 'FS' || type === 'SS';
          const path = buildArrowPath(pi, i, parentX, childX, rows, axis.start, dayW, rowH, approachFromLeft);
          const pY = pi * rowH + rowH / 2, cY = i * rowH + rowH / 2;
          const handleStyle = (isHoveredEdge || isEditingThis) ? { opacity: 1 } : { opacity: 0, pointerEvents: 'none' };
          return [
            <path key={r.id + '-' + depId + '-' + type}
              className={`dep-path${isCrit ? ' critical' : ''}${(focusDim || hoverDim) ? ' dimmed' : ''}${(inHover && !isCrit) ? ' hover-lit' : ''}${showAllDeps && !focusDim && !hoverDim ? ' show-all' : ''}${isEditingThis ? ' editing' : ''}`}
              d={path}
              onMouseEnter={() => setHoveredDepEdge({ fromId: depId, toId: r.id })}
              onMouseLeave={() => setHoveredDepEdge(p => p && p.fromId === depId && p.toId === r.id ? null : p)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setDepCtxMenu({ x: e.clientX, y: e.clientY, fromId: depId, toId: r.id }); }}/>,
            <circle key={r.id + '-' + depId + '-from'} className="dep-handle"
              cx={parentX} cy={pY} r={5} style={handleStyle}
              onMouseEnter={() => setHoveredDepEdge({ fromId: depId, toId: r.id })}
              onMouseLeave={() => setHoveredDepEdge(p => p && p.fromId === depId && p.toId === r.id ? null : p)}
              onPointerDown={e => beginDepEdit(e, depId, r.id, 'from')}/>,
            <circle key={r.id + '-' + depId + '-to'} className="dep-handle"
              cx={childX} cy={cY} r={5} style={handleStyle}
              onMouseEnter={() => setHoveredDepEdge({ fromId: depId, toId: r.id })}
              onMouseLeave={() => setHoveredDepEdge(p => p && p.fromId === depId && p.toId === r.id ? null : p)}
              onPointerDown={e => beginDepEdit(e, depId, r.id, 'to')}/>
          ];
        });
      })}
      {drag?.kind === 'dep' && (() => {
        const fromRow = rows.findIndex(r => r.id === drag.id);
        if (fromRow < 0) return null;
        const ft = rows[fromRow];
        const isStart = drag.depEndpoint === 'start';
        const x1 = isStart ? xForDay(ft.start) : xForDay(ft.end) + dayW;
        const y1 = fromRow * rowH + rowH / 2;
        const gr = gridScrollRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        const x2 = drag.currentClientX - gr.left + gridScrollRef.current.scrollLeft;
        const y2 = drag.currentClientY - gr.top + gridScrollRef.current.scrollTop;
        if (isStart) {
          return <path className="dep-path preview" d={`M${x2} ${y2} L${Math.min(x1 - 8, x2 + 12)} ${y2} L${Math.min(x1 - 8, x2 + 12)} ${y1} L${x1} ${y1}`}/>;
        }
        return <path className="dep-path preview" d={`M${x1} ${y1} L${Math.max(x1 + 8, x2 - 12)} ${y1} L${Math.max(x1 + 8, x2 - 12)} ${y2} L${x2} ${y2}`}/>;
      })()}
      {drag?.kind === 'dep-edit' && (() => {
        const { fromId, toId, endpoint } = drag;
        const anchorId = endpoint === 'to' ? fromId : toId;
        const ri = rows.findIndex(rr => rr.id === anchorId);
        if (ri < 0) return null;
        const rA = rows[ri];
        const lA = livePreview(rA);
        const aStart = xForDay(lA ? lA.start : rA.start);
        const aEnd = xForDay(lA ? lA.end : rA.end) + dayW;
        const x1 = endpoint === 'to' ? aEnd : aStart;
        const y1 = ri * rowH + rowH / 2;
        const gr = gridScrollRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        const x2 = drag.currentClientX - gr.left + gridScrollRef.current.scrollLeft;
        const y2 = drag.currentClientY - gr.top + gridScrollRef.current.scrollTop;
        const dirX = x2 >= x1 ? Math.max(x1 + 8, x2 - 12) : Math.min(x1 - 8, x2 + 12);
        return <path className="dep-path preview" d={`M${x1} ${y1} L${dirX} ${y1} L${dirX} ${y2} L${x2} ${y2}`}/>;
      })()}
    </svg>
  );
}
