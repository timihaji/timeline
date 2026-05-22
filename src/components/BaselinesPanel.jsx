import React from 'react';
import { fmtShort } from '../data/dates.js';

export function BaselinesPanel({ baselines, activeBaselineId, tasks, onClose, onSaveNew, onActivate, onRename, onDelete }){
  const [renaming, setRenaming] = React.useState(null); // {id, value}
  return (
    <div className="bl-overlay" onMouseDown={onClose}>
      <div className="bl-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="bl-hdr">
          <h3>Baselines</h3>
          <button className="bl-close" onClick={onClose}>×</button>
        </div>
        <div className="bl-save-row" onClick={onSaveNew}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Save current plan as baseline
        </div>
        <div className="bl-list">
          {baselines.length === 0
            ? <div className="bl-empty">No baselines yet — save one to track schedule variance</div>
            : [...baselines].reverse().map(bl => (
              <div key={bl.id} className={`bl-item${bl.id===activeBaselineId?' active':''}`}>
                <div className={`bl-radio${bl.id===activeBaselineId?' on':''}`}
                     title={bl.id===activeBaselineId?'Active — click to hide':'Click to show on timeline'}
                     onClick={()=>onActivate(bl.id===activeBaselineId ? null : bl.id)}/>
                <div className="bl-item-info" onDoubleClick={()=>setRenaming({id:bl.id, value:bl.name})}>
                  <div className="bl-item-name">
                    {renaming?.id===bl.id
                      ? <input autoFocus value={renaming.value}
                          onChange={e=>setRenaming(r=>({...r, value:e.target.value}))}
                          onBlur={()=>{ const v=renaming.value.trim(); if(v) onRename(bl.id,v); setRenaming(null); }}
                          onKeyDown={e=>{ if(e.key==='Enter'){ const v=renaming.value.trim(); if(v) onRename(bl.id,v); setRenaming(null); } else if(e.key==='Escape') setRenaming(null); }}/>
                      : bl.name}
                  </div>
                  <div className="bl-item-date">{fmtShort(bl.createdAt)} · {Object.keys(bl.snapshot).length} tasks</div>
                </div>
                <button className="bl-del" title="Delete baseline" onClick={()=>onDelete(bl.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
