import React from 'react';

export function SearchFilterBar({ filter, setFilter, owners, totalCount, visibleCount }){
  const q = filter.q || '';
  const ownersSel = filter.owners || new Set();
  const prisSel = filter.priorities || new Set();
  const status = filter.status || 'all';
  const anyActive = !!q || ownersSel.size>0 || prisSel.size>0 || status !== 'all';

  const ownerNames = (owners||[]).map(o => o.name).filter(Boolean);

  const toggleOwner = (n) => {
    const next = new Set(ownersSel);
    next.has(n) ? next.delete(n) : next.add(n);
    setFilter(f => ({...f, owners: next}));
  };
  const togglePri = (p) => {
    const next = new Set(prisSel);
    next.has(p) ? next.delete(p) : next.add(p);
    setFilter(f => ({...f, priorities: next}));
  };

  return (
    <div className="filter-strip">
      <div className="fs-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input placeholder="Search tasks…" value={q}
          onChange={e=>setFilter(f=>({...f, q: e.target.value}))}/>
        {q && <button className="fs-clear-x" title="Clear search" onClick={()=>setFilter(f=>({...f, q:''}))}>×</button>}
      </div>
      {ownerNames.length>0 && (
        <>
          <span className="fs-sep"/>
          <span className="fs-lbl">Owner</span>
          <div className="fs-chips">
            {ownerNames.map(n => {
              const o = (owners||[]).find(x=>x.name===n);
              const on = ownersSel.has(n);
              return (
                <button key={n} className={`fs-chip${on?' on':''}`} onClick={()=>toggleOwner(n)} title={`Toggle ${n}`}>
                  <span className="fs-dot" style={{background: o?.color||'#96c6e8'}}/>{n}
                </button>
              );
            })}
          </div>
        </>
      )}
      <span className="fs-sep"/>
      <span className="fs-lbl">Pri</span>
      <div className="fs-chips">
        {['p1','p2','p3'].map(p => {
          const on = prisSel.has(p);
          return (
            <button key={p} className={`fs-chip pri ${p}${on?' on':''}`} onClick={()=>togglePri(p)}>{p.toUpperCase()}</button>
          );
        })}
      </div>
      <span className="fs-sep"/>
      <span className="fs-lbl">Status</span>
      <select className={`fs-status${status!=='all'?' on':''}`}
        value={status} onChange={e=>setFilter(f=>({...f, status:e.target.value}))}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="done">Done</option>
        <option value="overdue">Overdue</option>
        <option value="atrisk">At-risk</option>
      </select>
      {anyActive && (
        <button className="fs-clear" onClick={()=>setFilter({q:'',owners:new Set(),priorities:new Set(),status:'all'})}>Clear filters</button>
      )}
      <span className="fs-count"><strong>{visibleCount}</strong> of {totalCount} tasks</span>
    </div>
  );
}
