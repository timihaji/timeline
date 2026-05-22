import { diffDays, addDays, addWorkingDays, workingDaysBetween } from './dates.js';
import { depList } from './rollups.js';

// ── Critical path — proper CPM forward/backward pass ──
// Returns {nodes, edges, floatMap} where nodes = all tasks with total float = 0,
// edges = dependency edges connecting two critical nodes, floatMap = Map<id, calendarDays>.
export function computeCriticalPath(tasks, calendar){
  const byId=new Map(tasks.map(t=>[t.id,t]));
  const regular=tasks.filter(t=>t.kind!=='project');
  if(!regular.length) return {nodes:new Set(),edges:new Set(),floatMap:new Map()};

  const succs=new Map();
  for(const t of regular) for(const d of depList(t)){
    if(!byId.has(d.id)) continue;
    if(!succs.has(d.id)) succs.set(d.id,[]);
    succs.get(d.id).push({childId:t.id,dep:d});
  }

  const indeg=new Map(regular.map(t=>[t.id,0]));
  for(const t of regular) for(const d of depList(t)){
    if(byId.has(d.id)) indeg.set(t.id,(indeg.get(t.id)||0)+1);
  }
  const q=regular.filter(t=>(indeg.get(t.id)||0)===0).map(t=>t.id);
  const order=[];
  while(q.length){
    const id=q.shift(); order.push(id);
    for(const {childId} of (succs.get(id)||[])){
      indeg.set(childId,indeg.get(childId)-1);
      if(indeg.get(childId)===0) q.push(childId);
    }
  }
  if(order.length<regular.length) return {nodes:new Set(),edges:new Set(),floatMap:new Map()};

  // Forward pass: ES (earliest start) and EF (earliest finish) as date strings.
  // Date string comparison is valid since format is fixed-length yyyy-mm-dd.
  const ES=new Map(),EF=new Map();
  for(const id of order){
    const t=byId.get(id); if(!t) continue;
    const dur=diffDays(t.start,t.end);
    let minES=t.start,minEF=t.end;
    for(const d of depList(t)){
      const pred=byId.get(d.id); if(!pred) continue;
      const predES=ES.get(d.id)??pred.start;
      const predEF=EF.get(d.id)??pred.end;
      const lag=d.lag||0,type=d.type||'FS';
      const predEFeff=pred.leadTimeAfter?addDays(predEF,pred.leadTimeAfter):predEF;
      if(type==='FS'){      const c=addDays(predEFeff,1+lag); if(c>minES) minES=c; }
      else if(type==='SS'){ const c=addDays(predES,lag);      if(c>minES) minES=c; }
      else if(type==='FF'){ const c=addDays(predEFeff,lag);   if(c>minEF) minEF=c; }
      else if(type==='SF'){ const c=addDays(predES,lag);      if(c>minEF) minEF=c; }
    }
    const fromES=addDays(minES,dur);
    ES.set(id,minES); EF.set(id,fromES>minEF?fromES:minEF);
  }

  const projEnd=regular.reduce((mx,t)=>{const e=EF.get(t.id)??t.end;return e>mx?e:mx;},'2000-01-01');

  const LF=new Map();
  for(const id of [...order].reverse()){
    const t=byId.get(id); if(!t) continue;
    const dur=diffDays(t.start,t.end);
    let maxLF=projEnd;
    for(const {childId,dep} of (succs.get(id)||[])){
      const childLF=LF.get(childId); if(childLF===undefined) continue;
      const child=byId.get(childId); if(!child) continue;
      const childDur=diffDays(child.start,child.end);
      const lag=dep.lag||0,type=dep.type||'FS';
      let c;
      if(type==='FS')       c=addDays(childLF,-childDur-1-lag-(t.leadTimeAfter||0));
      else if(type==='SS')  c=addDays(childLF,-childDur-lag+dur);
      else if(type==='FF')  c=addDays(childLF,-lag);
      else if(type==='SF')  c=addDays(childLF,-lag+dur);
      if(c!==undefined && c<maxLF) maxLF=c;
    }
    LF.set(id,maxLF);
  }

  const floatMap=new Map();
  const nodes=new Set();
  for(const t of regular){
    const ef=EF.get(t.id)??t.end, lf=LF.get(t.id)??t.end;
    const fl=diffDays(ef,lf);
    floatMap.set(t.id,Math.max(0,fl));
    if(fl<=0) nodes.add(t.id);
  }

  const edges=new Set();
  for(const t of regular){
    if(!nodes.has(t.id)) continue;
    for(const d of depList(t)) if(nodes.has(d.id)) edges.add(d.id+'→'+t.id);
  }

  return {nodes,edges,floatMap};
}

// Compute child start/end given a predecessor + dep edge, respecting type and lag.
// Returns {start, end} the child must satisfy (minimum start; for FF/SF, end constraint).
export function applyDepConstraint(child, pred, dep, calendar){
  const dur = diffDays(child.start, child.end);
  const type = dep.type || 'FS';
  const lag = dep.lag || 0;
  // pred's leadTimeAfter extends its effective end (calendar days — procurement/delivery windows)
  const predEffEnd = pred.leadTimeAfter ? addDays(pred.end, pred.leadTimeAfter) : pred.end;
  // child's leadTimeBefore delays its earliest start after the predecessor constraint
  const childLTB = child.leadTimeBefore || 0;
  if (type === 'FS'){
    const minStart = addDays(addWorkingDays(predEffEnd, 1 + lag, calendar), childLTB);
    if (child.start < minStart) {
      const ns = minStart;
      return { start: ns, end: addDays(ns, dur) };
    }
  } else if (type === 'SS'){
    const minStart = addDays(addWorkingDays(pred.start, lag, calendar), childLTB);
    if (child.start < minStart) {
      const ns = minStart;
      return { start: ns, end: addDays(ns, dur) };
    }
  } else if (type === 'FF'){
    const minEnd = addWorkingDays(predEffEnd, lag, calendar);
    if (child.end < minEnd) {
      const ne = minEnd;
      return { start: addDays(ne, -dur), end: ne };
    }
  } else if (type === 'SF'){
    const minEnd = addWorkingDays(pred.start, lag, calendar);
    if (child.end < minEnd) {
      const ne = minEnd;
      return { start: addDays(ne, -dur), end: ne };
    }
  }
  return null;
}

// ── Cascade shift dependents ──
export function cascadeAfterMove(tasks, movedId, calendar){
  const byId=new Map(tasks.map(t=>[t.id,{...t}]));
  const dependents=new Map();
  for(const t of tasks) for(const d of depList(t)){
    if(!dependents.has(d.id)) dependents.set(d.id,[]);
    dependents.get(d.id).push({childId: t.id, dep: d});
  }
  const stack=[movedId]; const seen=new Set();
  while(stack.length){
    const id=stack.pop(); if(seen.has(id)) continue; seen.add(id);
    const t=byId.get(id); if(!t) continue;
    for(const {childId, dep} of (dependents.get(id)||[])){
      const child=byId.get(childId); if(!child) continue;
      if(child.locked) continue; // locked tasks are immovable anchors
      // Skip successors already started or completed — they stay put, conflict arrow surfaces it
      if(child.status==='inprogress' || child.status==='review' || child.status==='done') continue;
      const adj = applyDepConstraint(child, t, dep, calendar);
      if (adj){
        child.start = adj.start; child.end = adj.end;
        stack.push(childId);
      }
    }
  }
  return Array.from(byId.values());
}

// Roll up set (project-kind) start/end from child task spans.
export function recomputeSetSpans(tasks){
  const sets = tasks.filter(t => t.kind === 'project');
  if (sets.length === 0) return tasks;
  const childrenBySet = new Map(sets.map(s => [s.id, []]));
  for (const t of tasks){
    if (t.kind === 'project') continue;
    if (t.parent && childrenBySet.has(t.parent)) childrenBySet.get(t.parent).push(t);
  }
  return tasks.map(t => {
    if (t.kind !== 'project') return t;
    const kids = childrenBySet.get(t.id);
    if (!kids || kids.length === 0) return t;
    let mn = kids[0].start, mx = kids[0].end;
    for (const k of kids){ if (k.start < mn) mn = k.start; if (k.end > mx) mx = k.end; }
    if (mn === t.start && mx === t.end) return t;
    return {...t, start: mn, end: mx};
  });
}

// ── Full forward pass auto-schedule ──
// Topological forward pass: every task starts at max(pred constraint) per its incoming deps.
// Locked tasks are treated as immovable anchors — constraints apply to their successors but
// the locked task's own dates are never modified.
// Cycles => bail without changes and surface a toast via the global __showToast hook.
export function fullAutoSchedule(tasks, calendar){
  const byId = new Map(tasks.map(t => [t.id, {...t}]));
  const indeg = new Map();
  for (const t of tasks) indeg.set(t.id, 0);
  for (const t of tasks) for (const d of depList(t)){
    if (byId.has(d.id)) indeg.set(t.id, (indeg.get(t.id)||0) + 1);
  }
  const queue = [];
  for (const [id, n] of indeg) if (n === 0) queue.push(id);
  const order = [];
  const succs = new Map();
  for (const t of tasks) for (const d of depList(t)){
    if (!byId.has(d.id)) continue;
    if (!succs.has(d.id)) succs.set(d.id, []);
    succs.get(d.id).push(t.id);
  }
  while (queue.length){
    const id = queue.shift();
    order.push(id);
    for (const s of (succs.get(id) || [])){
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  if (order.length !== tasks.length){
    const cycleNames = tasks.filter(t => !order.includes(t.id)).map(t => t.title).slice(0,3).join(', ');
    if (typeof window !== 'undefined' && window.__showToast) window.__showToast('Circular dependency detected: ' + cycleNames, 'err');
    return tasks;
  }
  for (const id of order){
    const t = byId.get(id);
    if (!t || t.kind === 'project' || t.locked) continue;
    for (const d of depList(t)){
      const pred = byId.get(d.id); if (!pred) continue;
      const adj = applyDepConstraint(t, pred, d, calendar);
      if (adj){ t.start = adj.start; t.end = adj.end; }
    }
  }
  return Array.from(byId.values());
}

// ── Slack / float ──
export function computeFloat(tasks, calendar){
  const byId=new Map(tasks.map(t=>[t.id,t]));
  const dependents=new Map();
  for(const t of tasks) for(const d of depList(t)){
    if(!dependents.has(d.id)) dependents.set(d.id,[]);
    dependents.get(d.id).push(t.id);
  }
  const projEnd=tasks.reduce((mx,t)=>t.end>mx?t.end:mx,'2020-01-01');
  const out=new Map();
  for(const t of tasks){
    if(t.kind==='project'||t.milestone){out.set(t.id,0);continue;}
    const succs=dependents.get(t.id)||[];
    if(!succs.length){out.set(t.id,Math.max(0,workingDaysBetween(t.end,projEnd,calendar)-1));continue;}
    let minF=Infinity;
    for(const sid of succs){ const s=byId.get(sid); if(s) minF=Math.min(minF, workingDaysBetween(t.end, s.start, calendar)-1); }
    out.set(t.id,Math.max(0,minF===Infinity?0:minF));
  }
  return out;
}

// ── Resource conflict detection ──
export function detectConflicts(tasks){
  const byOwner=new Map();
  for(const t of tasks){
    if(!t.owner||t.kind==='project'||t.milestone||t.done) continue;
    if(!byOwner.has(t.owner)) byOwner.set(t.owner,[]);
    byOwner.get(t.owner).push(t);
  }
  const conflicts=new Set();
  for(const [,ots] of byOwner){
    for(let i=0;i<ots.length;i++) for(let j=i+1;j<ots.length;j++){
      const a=ots[i],b=ots[j];
      if(a.start<=b.end&&b.start<=a.end){conflicts.add(a.id);conflicts.add(b.id);}
    }
  }
  return conflicts;
}

// ── Auto-stagger ──
export function autoStagger(tasks){
  const byOwner=new Map();
  for(const t of tasks){
    if(!t.owner||t.kind==='project'||t.milestone||t.done) continue;
    if(!byOwner.has(t.owner)) byOwner.set(t.owner,[]);
    byOwner.get(t.owner).push(t);
  }
  const updates=new Map();
  for(const [,ots] of byOwner){
    const sorted=[...ots].sort((a,b)=>a.start.localeCompare(b.start));
    let prevEnd=null;
    for(const t of sorted){
      if(prevEnd&&t.start<=prevEnd){
        const ns=addDays(prevEnd,1), dur=diffDays(t.start,t.end);
        updates.set(t.id,{start:ns,end:addDays(ns,dur)});
        prevEnd=addDays(ns,dur);
      } else { prevEnd=t.end; }
    }
  }
  if(!updates.size) return tasks;
  return tasks.map(t=>updates.has(t.id)?{...t,...updates.get(t.id)}:t);
}

// ── Auto-sort ──
// Sort siblings by walking dependency chains depth-first: roots (no incoming
// deps within this sibling group) are visited in start-date order, and for
// each root its successor chain is emitted before moving on. Within a chain
// siblings are ordered by start date, so A → B → C lands next to each other
// even when an unrelated task starts on the same day as A.
export function autoSort(tasks){
  const priOrd={p1:0,p2:1,p3:2};
  function cmp(a,b){
    if(a.start<b.start) return -1; if(a.start>b.start) return 1;
    const pd=(priOrd[a.priority]??1)-(priOrd[b.priority]??1); if(pd!==0) return pd;
    const ca=a.color||'', cb=b.color||''; if(ca<cb) return -1; if(ca>cb) return 1;
    return 0;
  }
  function sortSiblings(siblings){
    if(siblings.length<=1) return siblings.slice();
    const ids=new Set(siblings.map(t=>t.id));
    const byId=new Map(siblings.map(t=>[t.id,t]));
    const succOf=new Map(); for(const t of siblings) succOf.set(t.id,[]);
    const hasInDep=new Set();
    for(const t of siblings){
      for(const d of (t.deps||[])){
        if(ids.has(d.id)){ succOf.get(d.id).push(t.id); hasInDep.add(t.id); }
      }
    }
    const roots=siblings.filter(t=>!hasInDep.has(t.id)).sort(cmp);
    const visited=new Set(), out=[];
    function dfs(id){
      if(visited.has(id)) return;
      visited.add(id); out.push(byId.get(id));
      const succs=succOf.get(id).slice().sort((a,b)=>cmp(byId.get(a),byId.get(b)));
      for(const s of succs) dfs(s);
    }
    for(const r of roots) dfs(r.id);
    const left=siblings.filter(t=>!visited.has(t.id)).sort(cmp);
    for(const t of left) out.push(t);
    return out;
  }
  const childMap=new Map();
  for(const t of tasks){
    const k=t.parent||'__root__';
    if(!childMap.has(k)) childMap.set(k,[]);
    childMap.get(k).push(t);
  }
  function emitSorted(parentId){
    const kids=sortSiblings(childMap.get(parentId)||[]);
    const out=[];
    for(const k of kids){ out.push(k); out.push(...emitSorted(k.id)); }
    return out;
  }
  // Sets (kind:'project', parent:null) keep their original order.
  // Tasks within each set and their subtasks are sorted recursively.
  const result=[];
  const sets=(childMap.get('__root__')||[]);
  for(const s of sets){
    result.push(s);
    result.push(...emitSorted(s.id));
  }
  const seen=new Set(result.map(t=>t.id));
  tasks.filter(t=>!seen.has(t.id)).forEach(t=>result.push(t));
  return result;
}
