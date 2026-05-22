import React, { useState, useMemo } from 'react';
import { diffDays, addDays, fmtShort } from '../data/dates.js';
import { classifyStatus } from '../data/rollups.js';
import { formatCost } from '../utils/format.js';

export function ListView({ tasks, expandedTasks, wbsMap, owners, selected, selectedSet, setSelected, setSelectedSet,
                   updateTasks, applySchedule, calendar, setCtxMenu, addOwnerToList }){
  const [sortKey, setSortKey] = useState('wbs');
  const [sortDir, setSortDir] = useState('asc');
  const [editing, setEditing] = useState(null); // {id, field, value}

  // Only source rows (no recurring instances), and no project group rows
  const rows = useMemo(() => {
    return expandedTasks.filter(t => !t.recurrenceParent && t.kind !== 'project');
  }, [expandedTasks]);

  const ownersByName = useMemo(() => new Map((owners||[]).map(o => [o.name, o])), [owners]);

  const sorted = useMemo(() => {
    const dur = (t) => Math.max(1, diffDays(t.start, t.end) + 1);
    const cost = (t) => {
      if (typeof t.cost === 'number' && !isNaN(t.cost)) return t.cost;
      if (t.owner && ownersByName.has(t.owner)){
        const o = ownersByName.get(t.owner);
        if (typeof o.hourlyRate === 'number') return o.hourlyRate * dur(t) * 8;
      }
      return 0;
    };
    const depsN = (t) => (t.deps||[]).length;
    const priRank = { p1:0, p2:1, p3:2 };
    const stRank = { overdue:0, atrisk:1, active:2, done:3 };
    const get = (t) => {
      switch(sortKey){
        case 'wbs': {
          const w = wbsMap.get(t.id) || '';
          return w.split('.').map(n => parseInt(n,10) || 0);
        }
        case 'title': return (t.title||'').toLowerCase();
        case 'owner': return (t.owner||'').toLowerCase();
        case 'start': return t.start || '';
        case 'end':   return t.end || '';
        case 'dur':   return dur(t);
        case 'pri':   return priRank[t.priority] ?? 99;
        case 'status':return stRank[classifyStatus(t)] ?? 99;
        case 'cost':  return cost(t);
        case 'deps':  return depsN(t);
        case 'color': return (t.color||'').toLowerCase();
        default: return 0;
      }
    };
    const arr = [...rows];
    arr.sort((a,b) => {
      const va = get(a), vb = get(b);
      let cmp = 0;
      if (Array.isArray(va) && Array.isArray(vb)){
        const len = Math.max(va.length, vb.length);
        for (let i=0;i<len;i++){ const x = va[i]||0, y = vb[i]||0; if (x !== y){ cmp = x<y?-1:1; break; } }
      } else if (typeof va === 'string' && typeof vb === 'string'){
        cmp = va.localeCompare(vb);
      } else {
        cmp = (va||0) - (vb||0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir, wbsMap, ownersByName]);

  const onSort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const arr = (k) => sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '';

  const commitEdit = (t) => {
    if (!editing) return;
    const v = editing.value;
    if (editing.field === 'title'){
      const trimmed = (v||'').trim();
      if (trimmed) updateTasks(ts => ts.map(x => x.id === t.id ? {...x, title: trimmed} : x));
    } else if (editing.field === 'start'){
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)){
        updateTasks(ts => applySchedule(ts.map(x => {
          if (x.id !== t.id) return x;
          const d0 = diffDays(x.start, x.end);
          const ne = addDays(v, d0);
          return {...x, start: v, end: ne < v ? v : ne};
        }), t.id));
      }
    } else if (editing.field === 'end'){
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)){
        updateTasks(ts => applySchedule(ts.map(x => x.id === t.id ? {...x, end: v < x.start ? x.start : v} : x), t.id));
      }
    }
    setEditing(null);
  };

  const onRowClick = (e, t) => {
    if (e.shiftKey){
      setSelectedSet(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
    } else {
      setSelected(t.id);
      setSelectedSet(new Set([t.id]));
    }
  };

  if (!sorted.length){
    return (
      <div className="list-view">
        <div className="list-view-empty">
          <h3>No tasks match</h3>
          <div>Try clearing filters, or create a task in the Gantt view.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-view-scroll">
        <table>
          <colgroup>
            <col style={{width:'56px'}}/>
            <col/>
            <col style={{width:'110px'}}/>
            <col style={{width:'110px'}}/>
            <col style={{width:'110px'}}/>
            <col style={{width:'70px'}}/>
            <col style={{width:'74px'}}/>
            <col style={{width:'90px'}}/>
            <col style={{width:'82px'}}/>
            <col style={{width:'60px'}}/>
          </colgroup>
          <thead>
            <tr>
              <th className="sortable" onClick={()=>onSort('wbs')}>WBS<span className="sort-arr">{arr('wbs')}</span></th>
              <th className="sortable" onClick={()=>onSort('title')}>Title<span className="sort-arr">{arr('title')}</span></th>
              <th className="sortable" onClick={()=>onSort('owner')}>Owner<span className="sort-arr">{arr('owner')}</span></th>
              <th className="sortable" onClick={()=>onSort('start')}>Start<span className="sort-arr">{arr('start')}</span></th>
              <th className="sortable" onClick={()=>onSort('end')}>End<span className="sort-arr">{arr('end')}</span></th>
              <th className="sortable numeric" onClick={()=>onSort('dur')}>Dur<span className="sort-arr">{arr('dur')}</span></th>
              <th className="sortable" onClick={()=>onSort('pri')}>Pri<span className="sort-arr">{arr('pri')}</span></th>
              <th className="sortable" onClick={()=>onSort('status')}>Status<span className="sort-arr">{arr('status')}</span></th>
              <th className="sortable numeric" onClick={()=>onSort('cost')}>Cost<span className="sort-arr">{arr('cost')}</span></th>
              <th className="sortable numeric" onClick={()=>onSort('deps')}>Deps<span className="sort-arr">{arr('deps')}</span></th>
              <th className="sortable" onClick={()=>onSort('color')}>Colour<span className="sort-arr">{arr('color')}</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const isSel = selected === t.id || selectedSet.has(t.id);
              const wbs = wbsMap.get(t.id) || '';
              const dur = Math.max(1, diffDays(t.start, t.end) + 1);
              const st = classifyStatus(t);
              const cost = (() => {
                if (typeof t.cost === 'number' && !isNaN(t.cost)) return t.cost;
                if (t.owner && ownersByName.has(t.owner)){
                  const o = ownersByName.get(t.owner);
                  if (typeof o.hourlyRate === 'number') return o.hourlyRate * dur * 8;
                }
                return 0;
              })();
              const editingThis = (field) => editing && editing.id === t.id && editing.field === field;
              const bg = t.color ? (t.color + '0F') : 'transparent';
              return (
                <tr key={t.id} className={`${isSel?'selected':''} ${t.done?'done':''}`}
                    style={{background:bg}}
                    onClick={e=>onRowClick(e, t)}
                    onContextMenu={e=>{e.preventDefault(); if(!selectedSet.has(t.id)){setSelectedSet(new Set([t.id]));} setCtxMenu({x:e.clientX,y:e.clientY,taskId:t.id});}}>
                  <td className="lv-wbs">{wbs}</td>
                  <td className="lv-title-cell"
                      onDoubleClick={()=>setEditing({id:t.id, field:'title', value:t.title})}>
                    <span className="lv-color-dot" style={{background: t.color || 'var(--t4)'}}/>
                    {t.recurrence && <span className="lv-recur" title="Recurring source">↻</span>}
                    {editingThis('title')
                      ? <input className="lv-rename" autoFocus value={editing.value}
                          onChange={e=>setEditing({...editing, value:e.target.value})}
                          onBlur={()=>commitEdit(t)}
                          onClick={e=>e.stopPropagation()}
                          onKeyDown={e=>{ if(e.key==='Enter') commitEdit(t); if(e.key==='Escape') setEditing(null); e.stopPropagation(); }}/>
                      : <span className="lv-title-text">{t.title}</span>
                    }
                  </td>
                  <td onDoubleClick={()=>setEditing({id:t.id, field:'owner', value:t.owner||''})}>
                    {editingThis('owner') ? (
                      <select className="lv-inline-input" autoFocus value={editing.value}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>{
                          const v = e.target.value;
                          updateTasks(ts => ts.map(x => x.id === t.id ? {...x, owner: v||undefined} : x));
                          setEditing(null);
                        }}
                        onBlur={()=>setEditing(null)}>
                        <option value="">— none —</option>
                        {(owners||[]).map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                        {t.owner && !(owners||[]).some(o=>o.name===t.owner) && <option value={t.owner}>{t.owner}</option>}
                      </select>
                    ) : (t.owner || <span style={{color:'var(--t4)'}}>—</span>)}
                  </td>
                  <td onDoubleClick={()=>setEditing({id:t.id, field:'start', value:t.start})}>
                    {editingThis('start') ? (
                      <input className="lv-inline-input" autoFocus type="date" value={editing.value}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>setEditing({...editing, value:e.target.value})}
                        onBlur={()=>commitEdit(t)}
                        onKeyDown={e=>{ if(e.key==='Enter') commitEdit(t); if(e.key==='Escape') setEditing(null); e.stopPropagation(); }}/>
                    ) : fmtShort(t.start)}
                  </td>
                  <td onDoubleClick={()=>setEditing({id:t.id, field:'end', value:t.end})}>
                    {editingThis('end') ? (
                      <input className="lv-inline-input" autoFocus type="date" value={editing.value}
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>setEditing({...editing, value:e.target.value})}
                        onBlur={()=>commitEdit(t)}
                        onKeyDown={e=>{ if(e.key==='Enter') commitEdit(t); if(e.key==='Escape') setEditing(null); e.stopPropagation(); }}/>
                    ) : fmtShort(t.end)}
                  </td>
                  <td className="numeric">{t.milestone ? '◆' : dur+'d'}</td>
                  <td onDoubleClick={()=>setEditing({id:t.id, field:'pri', value:t.priority||'p3'})}>
                    {editingThis('pri') ? (
                      <span className="lv-inline-seg" onClick={e=>e.stopPropagation()}>
                        {['p1','p2','p3'].map(p => (
                          <button key={p} className={`${p}${(editing.value===p)?' active':''}`}
                            onClick={()=>{
                              updateTasks(ts => ts.map(x => x.id === t.id ? {...x, priority: p} : x));
                              setEditing(null);
                            }}>{p.toUpperCase()}</button>
                        ))}
                      </span>
                    ) : (
                      <span style={{
                        font:'10px var(--mono)',
                        color: t.priority==='p1'?'var(--p1)':t.priority==='p2'?'var(--p2)':'var(--t3)',
                        fontWeight:600, letterSpacing:'.04em'
                      }}>{(t.priority||'p3').toUpperCase()}</span>
                    )}
                  </td>
                  <td><span className={`lv-status-pill ${st}`}>{st === 'atrisk' ? 'AT-RISK' : st.toUpperCase()}</span></td>
                  <td className="numeric">{cost > 0 ? formatCost(cost) : <span style={{color:'var(--t4)'}}>—</span>}</td>
                  <td className="numeric">{(t.deps||[]).length || <span style={{color:'var(--t4)'}}>0</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
