import React, { Fragment } from 'react';
import { addDays, diffDays, fmtClock, todayStr, isWorkingDay, addWorkingDays } from '../data/dates.js';
import { depList } from '../data/rollups.js';
import { autoStagger, autoSort } from '../data/scheduling.js';

export function Topbar({
  fileMenu,                  // pre-rendered <FileMenu .../> ReactNode
  fileHandle, activeProject, projects,
  tw, setTweak,
  viewMode, setViewMode,
  dayW, currentZoom,
  viewsMenuOpen, setViewsMenuOpen, applyView, deleteSavedView, saveCurrentView,
  gridScrollRef, axis,
  baselines, activeBaseline, setBaselinesOpen,
  showCritical,
  conflicts,
  updateTasks, tasksRef, customConfirm, showToast,
  setSortToast, sortToastTimerRef,
  now,
  setHelpOpen,
  calendar,
  tasks, selected, setSelected, setRenaming,
}) {
  return (
    <div className="topbar">
      <div className="tb-logo"><span className="tb-icon">TL</span><span>Timeline</span></div>
      <span className="tb-sep"/>

      {fileMenu}

      <span className="tb-sep"/>
      <div className="tb-crumb">
        <span title={fileHandle?.name ? `Saved to ${fileHandle.name}` : 'Auto-saved to browser. Click File > Save to export.'}>{fileHandle?.name || 'Unsaved'}</span>
        <span>›</span>
        <span className="tb-crumb-active">{activeProject?.name || '—'}</span>
      </div>

      <div className="tb-spacer"/>

      {/* Zoom presets — Gantt-only; hiding off-Gantt prevents dayWidth drift while in List/Calendar */}
      {viewMode === 'gantt' && (<Fragment>
        <div className="zoom-presets" title="Zoom level">
          <button className={`zp-btn${tw.fitWidth?' active':''}`} onClick={()=>setTweak('fitWidth',!tw.fitWidth)} title="Fit entire project in viewport (auto-resizes)" aria-label="Fit width">Fit</button>
          {[['Q',4,'Quarter'],['M',8,'Month'],['W',20,'Week'],['D',48,'Day']].map(([k,w,lbl])=>(
            <button key={k} className={`zp-btn${!tw.fitWidth&&currentZoom===k?' active':''}`}
              onClick={()=>{setTweak('fitWidth',false);setTweak('dayWidth',w);}}
              title={`${lbl} zoom`} aria-label={`${lbl} zoom`}>{k}</button>
          ))}
        </div>

        <div className="zoom-pill" title="Day width">
          <button onClick={()=>{setTweak('fitWidth',false);setTweak('dayWidth',Math.max(4,dayW-4));}}>−</button>
          <div className="label">{dayW}px</div>
          <button onClick={()=>{setTweak('fitWidth',false);setTweak('dayWidth',Math.min(200,dayW+4));}}>+</button>
        </div>
      </Fragment>)}

      {/* View switcher — Gantt / List / Calendar */}
      <div className="view-switcher" title="Switch view">
        <button className={`vs-btn${viewMode==='gantt'?' active':''}`} onClick={()=>setViewMode('gantt')} title="Gantt timeline view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="9" height="3" rx="1"/><rect x="8" y="11" width="11" height="3" rx="1"/><rect x="5" y="17" width="8" height="3" rx="1"/></svg>
          Gantt
        </button>
        <button className={`vs-btn${viewMode==='list'?' active':''}`} onClick={()=>setViewMode('list')} title="List / table view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
          List
        </button>
        <button className={`vs-btn${viewMode==='calendar'?' active':''}`} onClick={()=>setViewMode('calendar')} title="Calendar / month view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
          Cal
        </button>
      </div>

      {/* Saved views dropdown */}
      <div className="views-menu-wrap">
        <button className={`views-menu-btn${(activeProject?.savedViews?.length)?' active':''}`}
          title="Saved views — capture filter + grouping + view type"
          onClick={()=>setViewsMenuOpen(o=>!o)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Views{(activeProject?.savedViews?.length)?` (${activeProject.savedViews.length})`:''}
        </button>
        {viewsMenuOpen && (
          <>
            <div style={{position:'fixed',inset:0,zIndex:499}} onClick={()=>setViewsMenuOpen(false)}/>
            <div className="views-menu-drop">
              {(activeProject?.savedViews || []).length === 0 ? (
                <div className="vm-empty">No saved views yet.</div>
              ) : (activeProject.savedViews.map(v => (
                <div key={v.id} className="vm-item" onClick={()=>{ applyView(v); setViewsMenuOpen(false); }}>
                  <span className="vm-name" title={`Switch to "${v.name}" (${v.viewMode}${v.laneMode&&v.laneMode!=='off'?' · lanes: '+v.laneMode:''})`}>{v.name}</span>
                  <button className="vm-del" title="Delete view"
                    onClick={e=>{ e.stopPropagation(); deleteSavedView(v.id); }}>×</button>
                </div>
              )))}
              <div className="vm-sep"/>
              <div className="vm-save" onClick={()=>{ setViewsMenuOpen(false); saveCurrentView(); }}>+ Save current view as…</div>
            </div>
          </>
        )}
      </div>

      <button className="tb-btn" onClick={()=>{ const el=gridScrollRef.current; const idx=diffDays(axis.start,todayStr); el?.scrollTo({left:Math.max(0,idx*dayW-el.clientWidth/3),behavior:'smooth'}); }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg> Today
      </button>

      <span className="tb-sep"/>

      {/* Baselines */}
      <button className={`tb-btn${activeBaseline?' active':''}`}
              disabled={!activeProject}
              title="Manage baseline snapshots"
              onClick={()=>setBaselinesOpen(true)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'middle',marginRight:4}}><path d="M3 6h18M3 12h18M3 18h18"/><path d="M7 6v12M17 6v12" strokeWidth="1.5" strokeDasharray="2 2"/></svg>
        Baselines{baselines.length>0?` (${baselines.length})`:''}
      </button>

      {/* Critical path */}
      <button className={`tb-btn${showCritical?' active':''}`}
              disabled={!activeProject}
              title="Highlight critical-path tasks and their dependency arrows"
              onClick={()=>setTweak('showCritical', !showCritical)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'middle',marginRight:4}}>
          <polyline points="3 17 9 11 13 15 21 7" strokeDasharray="3 2"/>
        </svg>
        Critical path
      </button>

      {/* Auto-stagger */}
      {conflicts.size>0&&(
        <button className="tb-btn" style={{color:'var(--p2)',borderColor:'rgba(245,158,11,.4)'}} title="Auto-stagger overlapping owner tasks"
          onClick={()=>updateTasks(ts=>autoStagger(ts))}>
          ⚡ Stagger
        </button>
      )}

      {/* Compress schedule */}
      <button className="tb-btn" disabled={!activeProject} title="Pull all successors back to remove gaps (keeps In-progress and Done tasks fixed)"
        onClick={async ()=>{
          const ok = await customConfirm('Compress schedule', 'Tasks with predecessors will be pulled to their earliest valid start. In-progress and Done tasks stay put.', {okLabel:'Compress'});
          if (!ok) return;
          const summary = { moved: 0, totalDays: 0 };
          const compressFn = (ts)=>{
            const byId = new Map(ts.map(t=>[t.id,{...t}]));
            const indeg = new Map();
            for (const t of ts) indeg.set(t.id, 0);
            for (const t of ts) for (const d of depList(t)) if (byId.has(d.id)) indeg.set(t.id, (indeg.get(t.id)||0)+1);
            const queue = [];
            for (const [id,n] of indeg) if (n===0) queue.push(id);
            const succs = new Map();
            for (const t of ts) for (const d of depList(t)) {
              if (!byId.has(d.id)) continue;
              if (!succs.has(d.id)) succs.set(d.id, []);
              succs.get(d.id).push(t.id);
            }
            const order = [];
            while (queue.length){
              const id = queue.shift();
              order.push(id);
              for (const s of (succs.get(id)||[])){
                indeg.set(s, indeg.get(s)-1);
                if (indeg.get(s)===0) queue.push(s);
              }
            }
            for (const id of order){
              const t = byId.get(id);
              if (!t || t.kind==='project' || t.locked) continue;
              if (t.status==='inprogress' || t.status==='review' || t.status==='done') continue;
              let maxMinStart = null;
              for (const d of depList(t)){
                const pred = byId.get(d.id); if (!pred) continue;
                const type = d.type || 'FS';
                const lag = d.lag || 0;
                const predEffEnd = pred.leadTimeAfter ? addDays(pred.end, pred.leadTimeAfter) : pred.end;
                const childLTB = t.leadTimeBefore || 0;
                const dur = diffDays(t.start, t.end);
                let depMinStart = null;
                if (type === 'FS') depMinStart = addDays(addWorkingDays(predEffEnd, 1 + lag, calendar), childLTB);
                else if (type === 'SS') depMinStart = addDays(addWorkingDays(pred.start, lag, calendar), childLTB);
                else if (type === 'FF') {
                  const minEnd = addWorkingDays(predEffEnd, lag, calendar);
                  depMinStart = addDays(minEnd, -dur);
                } else if (type === 'SF') {
                  const minEnd = addWorkingDays(pred.start, lag, calendar);
                  depMinStart = addDays(minEnd, -dur);
                }
                if (depMinStart && (maxMinStart === null || depMinStart > maxMinStart)) {
                  maxMinStart = depMinStart;
                }
              }
              if (maxMinStart){
                const dur = diffDays(t.start, t.end);
                const shift = diffDays(maxMinStart, t.start);
                if (shift > 0) {
                  summary.moved += 1;
                  summary.totalDays += shift;
                  t.start = maxMinStart;
                  t.end = addDays(maxMinStart, dur);
                }
              }
            }
            return Array.from(byId.values());
          };
          const newTasks = compressFn(tasksRef.current || []);
          updateTasks(() => newTasks);
          if (typeof showToast === 'function') {
            if (summary.moved === 0) showToast('Schedule already compact — no gaps to remove.', 'info');
            else if (summary.moved === 1) showToast(`Compressed 1 task by ${summary.totalDays}d.`, 'info');
            else showToast(`Compressed ${summary.moved} tasks · ${summary.totalDays} task-days reclaimed.`, 'info');
          }
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{verticalAlign:'middle',marginRight:4}}>
          <polyline points="20 12 4 12"/><polyline points="14 6 4 12 14 18"/>
        </svg>
        Compress
      </button>

      {/* Auto-sort */}
      <button className="tb-btn" disabled={!activeProject} title="Sort tasks: active first, then by start date and priority"
        onClick={()=>{
          const rowsBefore = Array.from(document.querySelectorAll('.lpane-body [data-task-id]'));
          const posBefore = new Map();
          for (const el of rowsBefore) posBefore.set(el.dataset.taskId, el.getBoundingClientRect().top);
          let prevSnapshot = null;
          updateTasks(ts=>{ prevSnapshot = ts; return autoSort(ts); });
          requestAnimationFrame(()=>requestAnimationFrame(()=>{
            const rowsAfter = Array.from(document.querySelectorAll('.lpane-body [data-task-id]'));
            for (const el of rowsAfter) {
              const id = el.dataset.taskId;
              const before = posBefore.get(id);
              if (before == null) continue;
              const after = el.getBoundingClientRect().top;
              const delta = before - after;
              if (Math.abs(delta) < 1) continue;
              el.style.transition = 'none';
              el.style.transform = `translateY(${delta}px)`;
              requestAnimationFrame(()=>{
                el.style.transition = 'transform 300ms cubic-bezier(.2,.7,.3,1)';
                el.style.transform = '';
                setTimeout(()=>{ el.style.transition=''; el.style.transform=''; }, 350);
              });
            }
          }));
          if (sortToastTimerRef.current) clearTimeout(sortToastTimerRef.current);
          setSortToast({ prevTasks: prevSnapshot });
          sortToastTimerRef.current = setTimeout(()=>setSortToast(null), 5000);
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{verticalAlign:'middle',marginRight:4}}>
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>
        </svg>
        Sort
      </button>

      {/* Live clock */}
      {tw.showClock!==false&&(
        <div className="topbar-clock" title="Local time">{fmtClock(now)}</div>
      )}

      {/* Keyboard help */}
      <button className="tb-icon-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={()=>setHelpOpen(true)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>

      {/* Dark / light mode toggle */}
      <button className="tb-icon-btn"
        title={tw.theme==='dark'?'Switch to light mode':'Switch to dark mode'}
        aria-label={tw.theme==='dark'?'Switch to light mode':'Switch to dark mode'}
        onClick={()=>setTweak('theme', tw.theme==='dark'?'things':'dark')}>
        {tw.theme==='dark'
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
      </button>

      {/* Settings */}
      <button className="tb-icon-btn" title="Settings (Ctrl/Cmd+,)" aria-label="Settings" onClick={()=>window.postMessage({type:'__toggle_edit_mode'},'*')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>

      <button className="tb-btn primary"
              disabled={!activeProject}
              onClick={()=>{
                if(!activeProject) return;
                const nid='task-'+Date.now().toString(36);
                let proj = null;
                if (selected) {
                  const st = tasks.find(t => t.id === selected);
                  if (st && st.kind !== 'project' && st.project) proj = st.project;
                }
                if (proj == null) {
                  for (let i = tasks.length - 1; i >= 0; i--) {
                    const t = tasks[i];
                    if (t.kind !== 'project' && t.project) { proj = t.project; break; }
                  }
                }
                const startD = isWorkingDay(todayStr, calendar) ? todayStr : addWorkingDays(todayStr, 0, calendar);
                const endD = addWorkingDays(startD, 2, calendar);
                const nt={id:nid,parent:null,project:proj,title:'New task',start:startD,end:endD,priority:'p3',progress:0,color:'#96c6e8'};
                updateTasks(ts=>[...ts,nt]); setSelected(nid); setRenaming({id:nid,value:nt.title});
              }}>+ New task</button>
    </div>
  );
}
