import React from 'react';

function isoToDDMMYYYY(iso){
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function parseDDMMYYYY(str){
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str||'').trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo-1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo-1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export function DateField({ value, onChange, className }) {
  const [text, setText] = React.useState(isoToDDMMYYYY(value));
  const [open, setOpen] = React.useState(false);
  const [shake, setShake] = React.useState(false);
  const [focused, setFocused] = React.useState(value || new Date().toISOString().slice(0,10));
  const wrapRef = React.useRef(null);
  React.useEffect(()=>{ setText(isoToDDMMYYYY(value)); }, [value]);
  React.useEffect(()=>{
    if (!open) return;
    const onDocDown = (e)=>{ if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    return ()=>document.removeEventListener('mousedown', onDocDown);
  }, [open]);
  const commit = (newText)=>{
    const iso = parseDDMMYYYY(newText);
    if (iso) { onChange(iso); setText(isoToDDMMYYYY(iso)); }
    else if ((newText||'').trim() === '') { setText(isoToDDMMYYYY(value)); }
    else { setShake(true); setTimeout(()=>setShake(false), 300); setText(isoToDDMMYYYY(value)); }
  };
  const shift = (days, units)=>{
    const base = parseDDMMYYYY(text) || value || new Date().toISOString().slice(0,10);
    const d = new Date(base+'T00:00:00');
    if (units === 'd') d.setDate(d.getDate()+days);
    else if (units === 'm') d.setMonth(d.getMonth()+days);
    else if (units === 'y') d.setFullYear(d.getFullYear()+days);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setFocused(iso);
    return iso;
  };
  const onKey = (e)=>{
    if (e.key === 'Enter') { commit(text); setOpen(false); e.preventDefault(); }
    else if (e.key === 'Escape') { setText(isoToDDMMYYYY(value)); setOpen(false); }
    else if (open) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setFocused(shift(-1,'d')); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setFocused(shift(1,'d')); }
      else if (e.key === 'ArrowUp')    { e.preventDefault(); setFocused(shift(-7,'d')); }
      else if (e.key === 'ArrowDown')  { e.preventDefault(); setFocused(shift(7,'d')); }
      else if (e.key === 'PageUp')     { e.preventDefault(); setFocused(shift(e.shiftKey?-1:-1, e.shiftKey?'y':'m')); }
      else if (e.key === 'PageDown')   { e.preventDefault(); setFocused(shift(e.shiftKey?1:1, e.shiftKey?'y':'m')); }
    }
  };
  const renderCal = ()=>{
    const cur = new Date((focused||value||new Date().toISOString().slice(0,10))+'T00:00:00');
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1);
    const firstDow = (first.getDay()+6)%7;
    const start = new Date(y, m, 1 - firstDow);
    const cells = [];
    for (let i=0;i<42;i++){
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
      cells.push(d);
    }
    const monthName = cur.toLocaleString('default',{month:'long'});
    const isFocused = (d)=> d.getFullYear()===cur.getFullYear()&&d.getMonth()===cur.getMonth()&&d.getDate()===cur.getDate();
    const isSelected = (d)=> {
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return iso === value;
    };
    return (
      <div className="datefield-cal" onMouseDown={e=>e.stopPropagation()}>
        <div className="datefield-cal-head">
          <button type="button" className="datefield-nav" onClick={()=>shift(-1,'m')}>‹</button>
          <span className="datefield-month">{monthName} {y}</span>
          <button type="button" className="datefield-nav" onClick={()=>shift(1,'m')}>›</button>
        </div>
        <div className="datefield-cal-grid">
          {['M','T','W','T','F','S','S'].map((d,i)=><div key={'h'+i} className="datefield-dow">{d}</div>)}
          {cells.map((d,i)=>{
            const inMonth = d.getMonth()===m;
            const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const cls = ['datefield-day'];
            if (!inMonth) cls.push('outside');
            if (isFocused(d)) cls.push('focused');
            if (isSelected(d)) cls.push('selected');
            return <button type="button" key={iso+i} className={cls.join(' ')} onClick={()=>{ onChange(iso); setText(isoToDDMMYYYY(iso)); setOpen(false); }}>{d.getDate()}</button>;
          })}
        </div>
      </div>
    );
  };
  return (
    <div className={`datefield-wrap${shake?' shake':''}`} ref={wrapRef}>
      <input
        type="text"
        className={(className||'')+' datefield-input'}
        value={text}
        placeholder="DD/MM/YYYY"
        onChange={e=>setText(e.target.value)}
        onFocus={()=>setFocused(value||new Date().toISOString().slice(0,10))}
        onBlur={()=>{ commit(text); setTimeout(()=>setFocused(value||new Date().toISOString().slice(0,10)), 0); }}
        onKeyDown={onKey}
      />
      <button type="button" className="datefield-icon" tabIndex={-1} title="Open calendar" onMouseDown={e=>{ e.preventDefault(); setOpen(o=>!o); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </button>
      {open && renderCal()}
    </div>
  );
}
