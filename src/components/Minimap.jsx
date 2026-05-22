import React, { useRef, useState, useEffect, useCallback } from 'react';
import { diffDays, todayStr } from '../data/dates.js';

export function Minimap({ rows, axis, dayW, totalW, gridScrollRef }){
  const ref = useRef(null);
  const [vp, setVp] = useState({l:0,w:100});

  useEffect(()=>{
    const update = ()=>{
      const grid=gridScrollRef.current, cont=ref.current;
      if(!grid||!cont) return;
      const ratio=cont.clientWidth/totalW;
      setVp({l:grid.scrollLeft*ratio, w:Math.max(16,grid.clientWidth*ratio)});
    };
    const grid=gridScrollRef.current; if(!grid) return;
    grid.addEventListener('scroll',update,{passive:true});
    const ro=new ResizeObserver(update);
    if(ref.current) ro.observe(ref.current);
    update();
    return ()=>{ grid.removeEventListener('scroll',update); ro.disconnect(); };
  },[totalW,gridScrollRef]);

  const jump = useCallback((e)=>{
    const rect=ref.current?.getBoundingClientRect(), grid=gridScrollRef.current;
    if(!rect||!grid) return;
    const pct=(e.clientX-rect.left)/rect.width;
    grid.scrollTo({left:Math.max(0,pct*totalW-grid.clientWidth/2),behavior:'smooth'});
  },[totalW,gridScrollRef]);

  const nDays=axis.days.length;
  const toLeft = d=>`${diffDays(axis.start,d)/nDays*100}%`;
  const toPct  = (s,e)=>`${(diffDays(s,e)+1)/nDays*100}%`;
  const todayL = `${diffDays(axis.start,todayStr)/nDays*100}%`;

  const taskRows=rows.filter(r=>!r.isProject&&!r.isOwnerGroup&&!r.isLane);
  const barH=Math.min(4,Math.max(1.5, 32/Math.max(1,taskRows.length)));
  let y=0;
  const barItems=taskRows.map(r=>{ const my=y; y+=barH+0.5; return {r,my}; });

  return (
    <div className="minimap-strip" ref={ref} onClick={jump} title="Click to navigate">
      <div className="minimap-track">
        {barItems.map(({r,my})=>(
          <div key={r.id} className="minimap-bar" style={{
            left:toLeft(r.start),
            width:r.milestone?'3px':toPct(r.start,r.end),
            top:my+'px', height:barH+'px',
            background:r.done?'var(--t4)':(r.color||'#96c6e8'),
            opacity:r.done?.35:.85,
            borderRadius:r.milestone?'50%':'1px',
          }}/>
        ))}
        <div className="minimap-today" style={{left:todayL}}/>
        <div className="minimap-viewport" style={{left:vp.l+'px',width:vp.w+'px'}}/>
      </div>
    </div>
  );
}
