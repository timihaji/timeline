import React from 'react';
import { addDays, diffDays, fmtShort, formatDuration } from '../data/dates.js';
import { depList, computeTaskCost } from '../data/rollups.js';
import { formatCost } from '../utils/format.js';
import { STATUSES, STATUS_META } from '../data/constants.js';
import { DateField } from './DateField.jsx';

const COLOR_PRESETS = ['#f9a8a8','#fac89a','#f5dc88','#b2e0ac','#9dd8d5','#96c6e8','#c3b2e8','#f5bad0'];

export const Inspector = React.forwardRef(function Inspector({
  isInspectorOpen, drawerPinned, setDrawerPinned,
  selected, setSelected,
  rows, expandedTasks, tasks,
  renaming, setRenaming,
  viewMode, livePreview, calendar,
  showCritical, critical,
  owners, floatMap, conflicts,
  laneMode, lanes, stageRegistry,
  updateTasks, applySchedule, toggleLock,
  addOwnerToList, deleteDependency, setRecurrence,
  setRecurEditor,
  setPredPicker, setPredFilter,
  markDonePrompt, setMarkDonePrompt, markDonePromptTimerRef,
  insOpen, setInsOpen,
  customPrompt,
  focusChain, focusDepSubtree, duplicateTask, beginDepDrag,
}, drawerRef) {
  return (
    <div ref={drawerRef}
         className={"inspector"+(isInspectorOpen?" open":"")+(drawerPinned?" docked":"")}
         onPointerDown={e=>e.stopPropagation()}>
    {selected&&(()=>{
      let r = rows.find(x=>x.id===selected) || expandedTasks.find(x=>x.id===selected);
      if (!r) return null;
      if (r.isProject||r.isOwnerGroup||r.isLane||r.kind==='project'||renaming?.id===r.id) return null;
      if (r.recurrenceParent) return null;
      const taskLive = tasks.find(t=>t.id===r.id) || r;
      const live = viewMode === 'gantt' ? livePreview(r) : null;
      const start=live?live.start:r.start, end=live?live.end:r.end;
      const isCrit=showCritical&&critical.nodes.has(r.id);
      const insDurLabel = formatDuration(start, end, calendar);

      const ownersByName=new Map(owners.map(o=>[o.name,o]));
      const computedCost=computeTaskCost(taskLive, ownersByName);
      const hasExplicitCost=typeof taskLive.cost==='number' && !isNaN(taskLive.cost);
      const links=Array.isArray(taskLive.links)?taskLive.links:[];
      const cf=taskLive.customFields && typeof taskLive.customFields==='object' ? taskLive.customFields : {};
      const cfEntries=Object.entries(cf);

      const setPriority = (p) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,priority:p}:t));
      const setColor = (c) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,color:c}:t));
      const setStatus = (s) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,status:s,done:s==='done',progress:s==='done'?1:(t.progress||0)}:t));
      const setStart = (s) => updateTasks(ts=>applySchedule(ts.map(t=>{
        if(t.id!==r.id) return t;
        const dur0 = diffDays(t.start, t.end);
        const ne = addDays(s, dur0);
        return {...t, start:s, end: ne < s ? s : ne };
      }), r.id));
      const setEnd = (e) => updateTasks(ts=>applySchedule(ts.map(t=>{
        if(t.id!==r.id) return t;
        return {...t, end: e < t.start ? t.start : e };
      }), r.id));
      const setOwner = (name) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,owner:name||undefined}:t));
      const setNotes = (v) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,notes:v}:t));
      const setCost = (v) => {
        const n = v === '' ? null : Number(v);
        if (n != null && (isNaN(n) || !isFinite(n))) return;
        updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,cost: n==null?null:n}:t));
      };
      const updateLinks = (next) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,links:next}:t));
      const updateCustom = (next) => updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,customFields:next}:t));
      const setProgress = (pct) => {
        const v = Math.max(0, Math.min(100, Math.round(pct/5)*5)) / 100;
        const wasNotDone = r.status !== 'done';
        updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,progress:v}:t));
        if (v >= 1 && wasNotDone) {
          setMarkDonePrompt(r.id);
          if (markDonePromptTimerRef.current) clearTimeout(markDonePromptTimerRef.current);
          markDonePromptTimerRef.current = setTimeout(()=>setMarkDonePrompt(p=>p===r.id?null:p), 5000);
        } else if (v < 1) {
          if (markDonePrompt === r.id) setMarkDonePrompt(null);
        }
      };
      const acceptMarkDone = () => {
        if (markDonePromptTimerRef.current) clearTimeout(markDonePromptTimerRef.current);
        setMarkDonePrompt(null);
        updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,status:'done',done:true,progress:1}:t));
      };
      const declineMarkDone = () => {
        if (markDonePromptTimerRef.current) clearTimeout(markDonePromptTimerRef.current);
        setMarkDonePrompt(null);
      };

      return (
        <>
          <div className="ins-title">
            <input className="ins-title-input" value={taskLive.title} title="Click to rename"
              onChange={e=>updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,title:e.target.value}:t))}
              onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.target.blur();}}/>
            {isCrit&&<span className="ins-crit">CRITICAL</span>}
            <button
              className={"ins-pin"+(drawerPinned?" active":"")}
              title={drawerPinned?"Unpin — drawer will close on click-away / Esc":"Pin — drawer stays open until ×"}
              aria-label={drawerPinned?"Unpin inspector":"Pin inspector"}
              aria-pressed={drawerPinned}
              onClick={()=>setDrawerPinned(p=>!p)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17v5"/>
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
              </svg>
            </button>
            <button
              className={"ins-pin"+(r.locked?" active":"")}
              title={r.locked?"Unlock task — dates editable again":"Lock task — freeze dates, scheduler skips"}
              onClick={()=>toggleLock(r.id)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>
            </button>
            <button className="ins-close" title="Close (Esc)" aria-label="Close inspector" onClick={()=>{ setSelected(null); }}>×</button>
          </div>
          <div className="ins-row"><span className="lbl">Dates</span><span className="val">{fmtShort(start)} → {fmtShort(end)}</span><span className="dur-pill" style={{marginLeft:'auto'}}>{r.milestone?'◆':insDurLabel}</span></div>
          <div className="ins-row ins-deps-row"><span className="lbl">Deps</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:'3px',alignItems:'center',flex:1}}>
            {!(taskLive.deps?.length)?<span className="ins-dep-empty">none</span>:depList(taskLive).map((dep)=>{
              const dt=tasks.find(t=>t.id===dep.id);
              const updateDep = (patch) => updateTasks(ts=>applySchedule(ts.map(t=>{
                if (t.id !== r.id) return t;
                const list = depList(t);
                const nx = list.map(d => d.id===dep.id ? {...d, ...patch} : d);
                return {...t, deps: nx};
              }), r.id));
              return (
                <span key={dep.id} className="ins-dep-chip" title={`Jump to ${dt?.title||dep.id}`} onClick={()=>setSelected(dep.id)}>
                  <span className="ins-dep-chip-ttl">{(dt?.title||dep.id).slice(0,16)}</span>
                  <select className="ins-dep-type-sel" value={dep.type||'FS'}
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>{e.stopPropagation();updateDep({type:e.target.value});}}>
                    {['FS','SS','FF','SF'].map(tc=><option key={tc} value={tc}>{tc}</option>)}
                  </select>
                  <input type="number" className="ins-dep-lag-input"
                    value={dep.lag||0}
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>{const n=parseInt(e.target.value,10);if(!isNaN(n))updateDep({lag:n});}}
                    title="Lag in days (negative = lead time)"/>
                  <button className="ins-dep-del" title="Remove this dependency"
                    onClick={e=>{e.stopPropagation();deleteDependency(dep.id,r.id);}}>×</button>
                </span>
              );
            })}
            <button className="ins-dep-add" onClick={e=>{e.stopPropagation();
              const btn=e.currentTarget; const rect=btn.getBoundingClientRect();
              setPredPicker({taskId:r.id, anchor:{x:rect.left,y:rect.bottom+4}});
              setPredFilter('');
            }}>+ Add predecessor</button>
            </div>
          </div>
          {floatMap.has(r.id)&&floatMap.get(r.id)>0&&<div className="ins-row"><span className="lbl">Float</span><span className="val" style={{color:'var(--accent-2)'}}>{floatMap.get(r.id)}d slack</span></div>}

          <div className="ins-fields">
            {/* Date pickers */}
            {!r.milestone && (
              <div className="ins-row-2">
                <div className="ins-field">
                  <span className="ins-field-lbl">Start</span>
                  <DateField className="ins-date" value={taskLive.start} onChange={v=>{ if(v) setStart(v); }}/>
                </div>
                <div className="ins-field">
                  <span className="ins-field-lbl">End</span>
                  <DateField className="ins-date" value={taskLive.end} onChange={v=>{ if(v) setEnd(v); }}/>
                </div>
              </div>
            )}
            {r.milestone && (
              <div className="ins-field">
                <span className="ins-field-lbl">Milestone date</span>
                <DateField className="ins-date" value={taskLive.start} onChange={v=>{ if(v) updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,start:v,end:v}:t)); }}/>
              </div>
            )}

            {/* Lead time */}
            {!r.milestone && (
              <div className="ins-row-2">
                <div className="ins-field">
                  <span className="ins-field-lbl">Lead before</span>
                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                    <input className="ins-num" type="number" min="0" style={{width:'54px'}}
                      value={taskLive.leadTimeBefore||''}
                      placeholder="0"
                      onChange={e=>{const v=parseInt(e.target.value,10);const ltb=isNaN(v)?0:Math.max(0,v);updateTasks(ts=>{const updated=ts.map(t=>t.id===r.id?{...t,leadTimeBefore:ltb}:t);const self=updated.find(t=>t.id===r.id)||r;const predIds=depList(self).map(d=>d.id);return predIds.length>0?predIds.reduce((acc,pid)=>applySchedule(acc,pid),updated):updated;});}}/>
                    <span style={{fontSize:'10px',color:'var(--t3)'}}>days</span>
                  </div>
                </div>
                <div className="ins-field">
                  <span className="ins-field-lbl">Lead after</span>
                  <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                    <input className="ins-num" type="number" min="0" style={{width:'54px'}}
                      value={taskLive.leadTimeAfter||''}
                      placeholder="0"
                      onChange={e=>{const v=parseInt(e.target.value,10);updateTasks(ts=>applySchedule(ts.map(t=>t.id===r.id?{...t,leadTimeAfter:isNaN(v)?0:Math.max(0,v)}:t),r.id));}}/>
                    <span style={{fontSize:'10px',color:'var(--t3)'}}>days</span>
                  </div>
                </div>
              </div>
            )}

            {/* Priority */}
            <div className="ins-field">
              <span className="ins-field-lbl">Priority</span>
              <div className="ins-seg">
                {['p1','p2','p3'].map(p=>(
                  <button key={p} className={`${p}${taskLive.priority===p?' active':''}`}
                    onClick={()=>setPriority(p)}>{p.toUpperCase()}</button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="ins-field">
              <span className="ins-field-lbl">Status</span>
              <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'2px'}}>
                {STATUSES.map(s=>{
                  const meta=STATUS_META[s];
                  const active=taskLive.status===s;
                  return (
                    <button key={s} onClick={()=>setStatus(s)} title={meta.label}
                      style={{display:'flex',alignItems:'center',gap:'5px',padding:'3px 8px',borderRadius:'3px',
                        border:`1px solid ${active?meta.color:'var(--border-s)'}`,
                        background:active?meta.color+'28':'transparent',
                        color:active?meta.color:'var(--t3)',
                        font:'10px var(--mono)',cursor:'pointer',whiteSpace:'nowrap',letterSpacing:'.03em'}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:meta.color,flexShrink:0,display:'inline-block'}}/>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress */}
            {!r.milestone && (
              <div className="ins-field">
                <span className="ins-field-lbl">Progress</span>
                <div className="ins-prog-wrap">
                  <input type="range" className="ins-slider" min={0} max={100} step={5}
                    value={Math.round((taskLive.progress||0)*100)}
                    style={{background:`linear-gradient(to right,var(--accent-2) ${Math.round((taskLive.progress||0)*100)}%,var(--surface-3) ${Math.round((taskLive.progress||0)*100)}%)`}}
                    onChange={e=>setProgress(Number(e.target.value))}/>
                  <input type="number" className="ins-num ins-prog-num" min={0} max={100} step={5}
                    value={Math.round((taskLive.progress||0)*100)}
                    onChange={e=>setProgress(Number(e.target.value))}
                    onBlur={e=>setProgress(Number(e.target.value))}/>
                </div>
                {markDonePrompt === r.id && (
                  <div className="ins-mark-done">
                    <span>Mark as done?</span>
                    <button className="ins-mark-done-btn yes" onClick={acceptMarkDone}>Yes</button>
                    <button className="ins-mark-done-btn no" onClick={declineMarkDone}>No</button>
                  </div>
                )}
              </div>
            )}

            {/* Owner */}
            <div className="ins-field">
              <span className="ins-field-lbl">Owner</span>
              <div className="ins-row-2">
                <select className="ins-select" value={taskLive.owner||''} onChange={e=>setOwner(e.target.value)}>
                  <option value="">— none —</option>
                  {owners.map(o=><option key={o.name} value={o.name}>{o.name}{typeof o.hourlyRate==='number'?` ($${o.hourlyRate}/h)`:''}</option>)}
                  {taskLive.owner && !owners.some(o=>o.name===taskLive.owner) && <option value={taskLive.owner}>{taskLive.owner} (ad-hoc)</option>}
                </select>
                <input className="ins-input" placeholder="+ new owner" onKeyDown={e=>{
                  if(e.key==='Enter'){
                    const v=e.target.value.trim();
                    if(v){ addOwnerToList(v); setOwner(v); e.target.value=''; }
                  }
                }}/>
              </div>
              {conflicts.has(r.id)&&<span style={{color:'var(--p2)',font:'9px var(--mono)',marginTop:'2px'}}>⚠ owner double-booked</span>}
            </div>

            {/* Lane (manual mode) */}
            {laneMode==='manual'&&(
              <div className="ins-field">
                <span className="ins-field-lbl">Lane</span>
                <select className="ins-select" value={taskLive.laneId||''}
                  onChange={e=>updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,laneId:e.target.value||null}:t))}>
                  <option value="">— unassigned —</option>
                  {lanes.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            {/* Stage */}
            {laneMode==='stage'&&(
              <div className="ins-field">
                <span className="ins-field-lbl">Stage</span>
                <select className="ins-select" value={taskLive.stage||''}
                  onChange={e=>updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,stage:e.target.value||null}:t))}>
                  <option value="">— none —</option>
                  {stageRegistry.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Color */}
            <div className="ins-field">
              <span className="ins-field-lbl">Color</span>
              <div className="ins-swatches">
                {COLOR_PRESETS.map(c=>(
                  <button key={c} className={`ins-swatch${taskLive.color===c?' active':''}`}
                    style={{background:c}} title={c} onClick={()=>setColor(c)}/>
                ))}
              </div>
              <input className="ins-input ins-hex" type="text" placeholder="#hex" value={taskLive.color||''}
                onChange={e=>{ const v=e.target.value.trim(); if(/^#[0-9a-fA-F]{3,8}$/.test(v)) setColor(v); else if(v==='') setColor(undefined); else if(v.length<=9){ updateTasks(ts=>ts.map(t=>t.id===r.id?{...t,color:v}:t)); }}}/>
            </div>

            {/* Cost */}
            <div className="ins-field">
              <span className="ins-field-lbl">Cost (number)</span>
              <input className="ins-num" type="number" step="any" placeholder="auto"
                value={hasExplicitCost ? String(taskLive.cost) : ''}
                onChange={e=>setCost(e.target.value)}/>
              {computedCost>0 && !hasExplicitCost && (
                <span className="ins-cost-line">Computed: <strong>{formatCost(computedCost)}</strong> (owner rate × duration × 8h)</span>
              )}
              {hasExplicitCost && (
                <span className="ins-cost-line">Explicit: <strong>{formatCost(taskLive.cost)}</strong></span>
              )}
            </div>

            {/* Recurrence */}
            {!r.milestone && r.kind !== 'project' && (
              <div className="ins-field">
                <span className="ins-field-lbl">Recurrence</span>
                <div className="ins-recur-row">
                  {taskLive.recurrence ? (
                    <>
                      <span className="recur-label">↻ Every {taskLive.recurrence.interval||1} {taskLive.recurrence.pattern}{(taskLive.recurrence.interval||1)>1?'s':''} × {taskLive.recurrence.count}</span>
                      <button className="recur-edit" onClick={()=>setRecurEditor({taskId:r.id,draft:{...taskLive.recurrence}})}>Edit…</button>
                      <button className="recur-clear" title="Clear recurrence" onClick={()=>setRecurrence(r.id, null)}>×</button>
                    </>
                  ) : (
                    <>
                      <span>One-off task</span>
                      <button className="recur-edit" onClick={()=>setRecurEditor({taskId:r.id,draft:{pattern:'weekly',interval:1,count:4}})}>Make recurring…</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notes (disclosure) */}
            <div>
              <div className={`ins-disclose${insOpen.notes?' open':''}`} onClick={()=>setInsOpen(o=>({...o,notes:!o.notes}))}>
                <span><span className="chv">▶</span> Notes</span>
                {!!taskLive.notes && <span className="ins-disclose-cnt">{taskLive.notes.length}c</span>}
              </div>
              {insOpen.notes && (
                <textarea className="ins-textarea" rows={3} placeholder="Description, context, links…"
                  value={taskLive.notes||''} onChange={e=>setNotes(e.target.value)}/>
              )}
            </div>

            {/* Links (disclosure) */}
            <div>
              <div className={`ins-disclose${insOpen.links?' open':''}`} onClick={()=>setInsOpen(o=>({...o,links:!o.links}))}>
                <span><span className="chv">▶</span> Links</span>
                {links.length>0 && <span className="ins-disclose-cnt">{links.length}</span>}
              </div>
              {insOpen.links && (
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:3}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {links.map((l,idx)=>(
                      <span key={idx} className="ins-link-chip">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>{l.label||l.url.replace(/^https?:\/\//,'').slice(0,22)}</a>
                        <button className="del" title="Remove" onClick={()=>updateLinks(links.filter((_,j)=>j!==idx))}>×</button>
                      </span>
                    ))}
                  </div>
                  <button className="ins-add-btn" onClick={async ()=>{
                    const url=await customPrompt('Add Link','https://');
                    if(!url||!url.trim()) return;
                    const lbl=await customPrompt('Link Label','','Optional display text (leave blank to show URL)');
                    const next=[...links,{url:url.trim(), label:(lbl||'').trim()||undefined}];
                    updateLinks(next);
                  }}>+ add link</button>
                </div>
              )}
            </div>

            {/* Custom fields (disclosure) */}
            <div>
              <div className={`ins-disclose${insOpen.custom?' open':''}`} onClick={()=>setInsOpen(o=>({...o,custom:!o.custom}))}>
                <span><span className="chv">▶</span> Custom fields</span>
                {cfEntries.length>0 && <span className="ins-disclose-cnt">{cfEntries.length}</span>}
              </div>
              {insOpen.custom && (
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:3}}>
                  {cfEntries.map(([k,v],idx)=>(
                    <div key={idx} className="ins-cf-row">
                      <input className="ins-input" value={k} onChange={e=>{
                        const newKey=e.target.value;
                        if(newKey===k) return;
                        const next={};
                        cfEntries.forEach(([kk,vv],j)=>{ next[j===idx?newKey:kk]=vv; });
                        updateCustom(next);
                      }}/>
                      <input className="ins-input" value={v} placeholder="value" onChange={e=>{
                        updateCustom({...cf,[k]:e.target.value});
                      }}/>
                      <button className="del" title="Remove" onClick={()=>{
                        const next={...cf}; delete next[k]; updateCustom(next);
                      }}>×</button>
                    </div>
                  ))}
                  <button className="ins-add-btn" onClick={()=>{
                    let base='field', i=1;
                    while(Object.prototype.hasOwnProperty.call(cf,`${base}${i}`)) i++;
                    updateCustom({...cf,[`${base}${i}`]:''});
                  }}>+ add field</button>
                </div>
              )}
            </div>
          </div>

          <div className="ins-acts">
            <button className="ins-btn link-btn" onPointerDown={e=>beginDepDrag(e,r)}>link</button>
            <button className="ins-btn" onClick={()=>setRenaming({id:r.id,value:taskLive.title})}>Rename</button>
            <button className="ins-btn" onClick={()=>focusDepSubtree(r.id)}>{focusChain?'Unfocus':'Focus chain'}</button>
            <button className="ins-btn" onClick={()=>duplicateTask(r.id)}>Duplicate</button>
          </div>
        </>
      );
    })()}
    </div>
  );
});
