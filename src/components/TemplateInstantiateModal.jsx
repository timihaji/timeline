import React, { useState } from 'react';
import { todayStr } from '../data/dates.js';

export function TemplateInstantiateModal({ template, onCancel, onCreate }){
  const [name, setName] = useState(template?.name || 'New project');
  const [startDate, setStartDate] = useState(todayStr);
  const canCreate = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  return (
    <div className="tmpl-overlay" onMouseDown={onCancel}>
      <div className="tmpl-modal" onMouseDown={e=>e.stopPropagation()} style={{minWidth:380}}>
        <div className="tm-hdr"><h3>Create from "{template?.name}"</h3><button className="tm-close" onClick={onCancel}>×</button></div>
        <div className="tm-body">
          <div className="tmpl-field">
            <label>Project name</label>
            <input autoFocus value={name} onChange={e=>setName(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter' && canCreate) onCreate(name.trim(), startDate); }}/>
          </div>
          <div className="tmpl-field">
            <label>Start date</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
          </div>
          <div style={{fontSize:11,color:'var(--t4)',marginTop:4}}>
            {(template?.project?.tasks||[]).length} tasks · all dates offset from this start.
          </div>
        </div>
        <div className="tm-foot">
          <button className="tm-btn" onClick={onCancel}>Cancel</button>
          <button className="tm-btn primary" disabled={!canCreate} onClick={()=>onCreate(name.trim(), startDate)}>Create project</button>
        </div>
      </div>
    </div>
  );
}
