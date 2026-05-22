import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export function CommandPalette({ commands, onClose }){
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(()=>{ inputRef.current?.focus(); }, []);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => {
      const hay = `${c.label} ${c.group||''} ${(c.keywords||[]).join(' ')}`.toLowerCase();
      // Split query so "save proj" matches "Save project as".
      return q.split(/\s+/).every(term => hay.includes(term));
    });
  }, [commands, query]);

  // Clamp active when filter shrinks the list.
  useEffect(()=>{ setActive(a => Math.min(a, Math.max(0, filtered.length - 1))); }, [filtered.length]);
  useEffect(()=>{
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = useCallback((cmd)=>{
    if (!cmd) return;
    onClose();
    setTimeout(() => { try { cmd.run(); } catch(e){ console.error('Command failed:', cmd.id, e); } }, 0);
  }, [onClose]);

  const onKey = useCallback((e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); run(filtered[active]); return; }
  }, [filtered, active, run, onClose]);

  const rows = useMemo(()=>{
    const out = [];
    let lastGroup = null;
    filtered.forEach((c, i) => {
      if (c.group && c.group !== lastGroup){ out.push({type:'group', label:c.group}); lastGroup = c.group; }
      else if (!c.group && lastGroup !== ''){ lastGroup = ''; }
      out.push({type:'item', cmd:c, idx:i});
    });
    return out;
  }, [filtered]);

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={e=>e.stopPropagation()}>
        <div className="p-input-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input ref={inputRef} className="p-input" placeholder="Type a command…" value={query}
            onChange={e=>setQuery(e.target.value)} onKeyDown={onKey}/>
          <span className="p-input-hint">{filtered.length}</span>
        </div>
        <div className="p-list" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <div className="p-empty">No commands match "{query}"</div>
          ) : rows.map((r, i) => r.type === 'group' ? (
            <div key={'g'+i} className="p-group-title">{r.label}</div>
          ) : (
            <div key={r.cmd.id} className={`p-item${r.idx===active?' active':''}`} data-idx={r.idx}
              role="option" aria-selected={r.idx===active}
              onMouseEnter={()=>setActive(r.idx)} onClick={()=>run(r.cmd)}>
              <span className="p-label">{r.cmd.label}</span>
              {r.cmd.shortcut && <span className="p-shortcut">{r.cmd.shortcut}</span>}
            </div>
          ))}
        </div>
        <div className="p-foot">
          <span><span className="p-key">↑↓</span>navigate</span>
          <span><span className="p-key">↵</span>run</span>
          <span><span className="p-key">Esc</span>close</span>
        </div>
      </div>
    </div>
  );
}
