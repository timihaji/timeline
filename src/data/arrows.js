import { diffDays } from './dates.js';

// ── Orthogonal dep-arrow routing ──
// approachFromLeft=true (FS/SS): arrowhead points right, last segment must go rightward into child
// approachFromLeft=false (FF/SF): arrowhead points left, last segment must go leftward into child
export function buildArrowPath(fromRowIdx, toRowIdx, parentX, childX, rows, axisStart, dayW, rowH, approachFromLeft=true){
  const fromY=fromRowIdx*rowH+rowH/2, toY=toRowIdx*rowH+rowH/2, CR=4;
  if(fromRowIdx===toRowIdx){
    const m=(parentX+childX)/2;
    return `M ${parentX} ${fromY} C ${m} ${fromY} ${m} ${toY} ${childX} ${toY}`;
  }
  const minR=Math.min(fromRowIdx,toRowIdx), maxR=Math.max(fromRowIdx,toRowIdx);
  const traversed=rows.slice(minR+1,maxR);
  const hitsBar=tx=>{
    for(const row of traversed){
      if(row.isProject||row.isOwnerGroup||row.milestone) continue;
      const bx=diffDays(axisStart,row.start)*dayW;
      const bw=(diffDays(row.start,row.end)+1)*dayW-2;
      if(tx>=bx-4&&tx<=bx+bw+4) return true;
    }
    return false;
  };

  let viaX=null;
  if(approachFromLeft){
    if(parentX < childX){
      for(let off=8;off<=320;off+=6){ const tx=parentX+off; if(tx>=childX) break; if(!hitsBar(tx)){viaX=tx;break;} }
    }
    if(viaX===null){ for(let off=8;off<=200;off+=6){ if(!hitsBar(childX-off)){viaX=childX-off;break;} } }
    if(viaX===null) viaX=childX-10;
  } else {
    if(parentX > childX){
      for(let off=8;off<=320;off+=6){ const tx=parentX-off; if(tx<=childX) break; if(!hitsBar(tx)){viaX=tx;break;} }
    }
    if(viaX===null){ for(let off=8;off<=200;off+=6){ if(!hitsBar(childX+off)){viaX=childX+off;break;} } }
    if(viaX===null) viaX=childX+10;
  }

  // "Backwards" case: viaX is on the far side of the parent → use 4-segment routing that escapes
  // vertically into the row gap toward the child before going horizontally, so the arrow doesn't
  // cross through the parent's own bar.
  const isBackwards = approachFromLeft ? (viaX < parentX) : (viaX > parentX);
  if(isBackwards){
    const goingDown = toY > fromY;
    const escapeY = fromY + (goingDown ? rowH/2 : -rowH/2);
    return `M ${parentX} ${fromY} L ${parentX} ${escapeY} L ${viaX} ${escapeY} L ${viaX} ${toY} L ${childX} ${toY}`;
  }

  const goingDown=toY>fromY;
  const cr=Math.min(CR,Math.abs(viaX-parentX)/2,Math.abs(childX-viaX)/2,Math.abs(toY-fromY)/2);
  const c1x=parentX<viaX?viaX-cr:viaX+cr, c1y=goingDown?fromY+cr:fromY-cr;
  const c2y=goingDown?toY-cr:toY+cr, c2x=viaX<childX?viaX+cr:viaX-cr;
  let p=`M ${parentX} ${fromY}`;
  if(cr>=1){
    p+=` L ${c1x} ${fromY} Q ${viaX} ${fromY} ${viaX} ${c1y}`;
    p+=` L ${viaX} ${c2y} Q ${viaX} ${toY} ${c2x} ${toY}`;
  } else { p+=` L ${viaX} ${fromY} L ${viaX} ${toY}`; }
  return p+` L ${childX} ${toY}`;
}
