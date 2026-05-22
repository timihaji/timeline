import { STATUSES, STATUS_META } from './constants.js';

// Per-depth indent in the left-pane task list. Used both by the row renderer
// (padding-left = 22 + depth*INDENT_PX) and the drag-to-indent math.
export const INDENT_PX = 16;

// Lane mode constants
export const LANE_PRI_ORDER  = ['p1','p2','p3'];
export const LANE_PRI_LABELS = {p1:'High (P1)', p2:'Medium (P2)', p3:'Low (P3)'};
export const LANE_PRI_COLORS = {p1:'#ff3b30', p2:'#f5c43d', p3:'#9aa0a8'};

export function buildRows(tasks, collapsed, laneMode, lanes, stageRegistry, laneCollapsed, ownerColors){
  if (!laneMode || laneMode === 'off'){
    return buildRowsByProject(tasks, collapsed);
  }
  return buildRowsWithLanes(tasks, collapsed, laneMode, lanes, stageRegistry, laneCollapsed, ownerColors);
}

export function buildRowsByProject(tasks, collapsed){
  const out = [];
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k,[]);
    byParent.get(k).push(t);
  }
  // Phase A1 — recursive walk so arbitrarily deep subtask trees render.
  // Each level increments depth; collapse at any level hides that subtree.
  const walk = (parentId, depth) => {
    const kids = byParent.get(parentId) || [];
    for (const k of kids){
      // Flag rows whose own children are present so renderers can show a
      // summary marker / disclosure later. `isSummary` is derived, never stored.
      const isSummary = (byParent.get(k.id) || []).length > 0;
      out.push({...k, depth, isSummary});
      if (isSummary && !collapsed.has(k.id)) walk(k.id, depth + 1);
    }
  };
  const projects = (byParent.get('__root')||[]).filter(t=>t.kind==='project');
  for (const p of projects){
    out.push({...p, depth:0, isProject:true});
    if (!collapsed.has(p.id)) walk(p.id, 1);
  }
  // Orphan tasks (no parent, not a project) are migrated to a set on workspace load
  // via migrateOrphans(), so we don't render a synthetic "Loose tasks" group here.
  return out;
}

export function buildRowsWithLanes(tasks, collapsed, laneMode, lanes, stageRegistry, laneCollapsed, ownerColors={}){
  const out = [];
  const byParent = new Map();
  for (const t of tasks){
    const k = t.parent || '__root';
    if (!byParent.has(k)) byParent.set(k,[]);
    byParent.get(k).push(t);
  }

  function collectSetTasks(setId){
    const result = [];
    const stack = [...(byParent.get(setId)||[])];
    while (stack.length){
      const t = stack.pop();
      result.push(t);
      for (const kid of (byParent.get(t.id)||[])) stack.push(kid);
    }
    return result;
  }

  function getLaneKey(task){
    switch(laneMode){
      case 'owner':    return task.owner    || null;
      case 'status':   return task.status   || null;
      case 'priority': return task.priority || null;
      case 'stage':    return task.stage    || null;
      case 'manual':   return task.laneId   || null;
      default:         return null;
    }
  }

  function getLaneMeta(laneKey){
    switch(laneMode){
      case 'owner':
        return {title:laneKey, color:ownerColors[laneKey]||'#94a3b8'};
      case 'status':
        return {title:STATUS_META[laneKey]?.label||laneKey, color:STATUS_META[laneKey]?.color||'#94a3b8'};
      case 'priority':
        return {title:LANE_PRI_LABELS[laneKey]||laneKey, color:LANE_PRI_COLORS[laneKey]||'#94a3b8'};
      case 'stage':
        return {title:laneKey, color:'#8b9dc3'};
      case 'manual': {
        const ld = lanes.find(l=>l.id===laneKey);
        return {title:ld?.name||laneKey, color:ld?.color||'#94a3b8'};
      }
      default:
        return {title:laneKey, color:'#94a3b8'};
    }
  }

  function getLaneOrder(laneMap){
    switch(laneMode){
      case 'owner':    return [...laneMap.keys()].sort();
      case 'status':   return STATUSES.filter(k=>laneMap.has(k));
      case 'priority': return LANE_PRI_ORDER.filter(k=>laneMap.has(k));
      case 'stage': {
        const regNames = stageRegistry.map(s=>s.name);
        const ordered = regNames.filter(k=>laneMap.has(k));
        for (const k of laneMap.keys()) if (!ordered.includes(k)) ordered.push(k);
        return ordered;
      }
      case 'manual': {
        const ordered = [...lanes].sort((a,b)=>a.order-b.order).map(l=>l.id).filter(k=>laneMap.has(k));
        for (const k of laneMap.keys()) if (!ordered.includes(k)) ordered.push(k);
        return ordered;
      }
      default: return [...laneMap.keys()];
    }
  }

  const projects = (byParent.get('__root')||[]).filter(t=>t.kind==='project');
  for (const p of projects){
    out.push({...p, depth:0, isProject:true});
    if (collapsed.has(p.id)) continue;

    const setTasks = collectSetTasks(p.id);
    if (!setTasks.length) continue;

    // Group all set tasks by lane key (independent of parent-child hierarchy)
    const laneMap = new Map();
    const unassigned = [];
    for (const t of setTasks){
      const key = getLaneKey(t);
      if (!key){ unassigned.push(t); continue; }
      if (!laneMap.has(key)) laneMap.set(key,[]);
      laneMap.get(key).push(t);
    }

    // Unassigned tasks float to the top (no lane header)
    for (const t of unassigned) out.push({...t, depth:1, isSummary:false});

    const laneKeys = getLaneOrder(laneMap);
    for (const laneKey of laneKeys){
      const laneTasks = laneMap.get(laneKey)||[];
      const starts = laneTasks.map(t=>t.start).filter(Boolean).sort();
      const ends   = laneTasks.map(t=>t.end).filter(Boolean).sort();
      const lStart = starts[0]||p.start;
      const lEnd   = ends[ends.length-1]||p.end;
      const {title, color} = getLaneMeta(laneKey);
      const laneHdrId = 'lane-'+p.id+'-'+laneKey;
      out.push({id:laneHdrId, isLane:true, laneMode, laneKey, title, color,
        start:lStart, end:lEnd, depth:1, parentSetId:p.id});
      if (!laneCollapsed.has(laneHdrId)){
        for (const t of laneTasks) out.push({...t, depth:1, isSummary:false});
      }
    }
  }
  return out;
}
