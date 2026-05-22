// Pure constants extracted from App.jsx during Phase 2 of cloud-migration plan.
// No runtime dependencies; safe to import anywhere.

export const DAY_MS = 86400000;

// Workspace schema version — bumped whenever migrations.js gains an entry.
export const CURRENT_VERSION = 6;

export const DOW    = ['Su','Mo','Tu','We','Th','Fr','Sa'];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const CLOCK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const DEFAULT_CALENDAR = { workingDays: [1,2,3,4,5], holidays: [] };

export const STATUSES = ['backlog', 'todo', 'inprogress', 'review', 'done', 'blocked', 'onhold'];
export const STATUS_META = {
  backlog:    { label: 'Backlog',     color: '#64748b' },
  todo:       { label: 'To do',       color: '#94a3b8' },
  inprogress: { label: 'In progress', color: '#a5b4fc' },
  review:     { label: 'In review',   color: '#fcd34d' },
  done:       { label: 'Done',        color: '#86efac' },
  blocked:    { label: 'Blocked',     color: '#ef4444' },
  onhold:     { label: 'On hold',     color: '#cbd5e1' },
};

export const DEP_TYPES = ['FS','SS','FF','SF'];

export const DEMO_TASKS = [
  // Acme launch
  {id:'p1',   parent:null, project:'WORK',  kind:'project', title:'Acme — Q2 launch',    start:'2026-04-30',end:'2026-05-28',priority:'p1',progress:.55, status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'p1s1', parent:'p1', project:'WORK',  title:'Brief copywriter',                          start:'2026-04-30',end:'2026-05-02',priority:'p2',progress:1,   done:true,  color:'#c3b2e8',owner:'Sam',   status:'done', tags:[],comments:[],deps:[]},
  {id:'p1s2', parent:'p1', project:'WORK',  title:'Approve hero image',                        start:'2026-05-05',end:'2026-05-08',priority:'p2',progress:.7,  color:'#c3b2e8',owner:'Jordan',pessimistic:3, status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s1',type:'FS',lag:0}]},
  {id:'p1s3', parent:'p1', project:'WORK',  title:'Draft launch blog post',                    start:'2026-05-05',end:'2026-05-09',priority:'p1',progress:.85, color:'#96c6e8',owner:'Sam',   pessimistic:4, status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s1',type:'FS',lag:0}]},
  {id:'p1s4', parent:'p1', project:'WORK',  title:'Schedule social posts',                     start:'2026-05-12',end:'2026-05-15',priority:'p3',progress:.1,  color:'#96c6e8',owner:'Jordan',baselineEnd:'2026-05-13', status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s3',type:'FS',lag:0}]},
  {id:'p1s5', parent:'p1', project:'WORK',  title:'QA landing page on staging',                start:'2026-05-14',end:'2026-05-20',priority:'p2',progress:0,   color:'#f5dc88',owner:'Chris', pessimistic:5, baselineEnd:'2026-05-16', status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s2',type:'FS',lag:0}]},
  {id:'p1s6', parent:'p1', project:'WORK',  title:'Flip DNS to live',                          start:'2026-05-22',end:'2026-05-22',priority:'p1',progress:0,   color:'#f9a8a8',owner:'Alex',  milestone:true, status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s5',type:'FS',lag:0}]},
  {id:'p1s7', parent:'p1', project:'WORK',  title:'Launch day',                                start:'2026-05-23',end:'2026-05-23',priority:'p1',progress:0,   color:'#b2e0ac',owner:'Alex',  milestone:true, status:'todo', done:false, tags:[],comments:[],deps:[{id:'p1s6',type:'FS',lag:0},{id:'p1s4',type:'FS',lag:0}]},
  // Hyperion
  {id:'h1',   parent:null, project:'WORK',  kind:'project', title:'Hyperion — proposal',  start:'2026-05-07',end:'2026-05-16',priority:'p1',progress:.2,  status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'h1a',  parent:'h1', project:'WORK',  title:'Discovery call',                            start:'2026-05-07',end:'2026-05-07',priority:'p1',progress:0,   color:'#c3b2e8',owner:'Alex',  milestone:true, status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'h1b',  parent:'h1', project:'WORK',  title:'Pricing slide (Sam)',                       start:'2026-05-08',end:'2026-05-12',priority:'p1',progress:.4,  color:'#f5bad0',owner:'Sam',   pessimistic:2, baselineEnd:'2026-05-10', status:'todo', done:false, tags:[],comments:[],deps:[{id:'h1a',type:'FS',lag:0}]},
  {id:'h1c',  parent:'h1', project:'WORK',  title:'Draft proposal narrative',                  start:'2026-05-09',end:'2026-05-14',priority:'p1',progress:0,   color:'#96c6e8',owner:'Jordan',baselineEnd:'2026-05-12', status:'todo', done:false, tags:[],comments:[],deps:[{id:'h1a',type:'FS',lag:0}]},
  {id:'h1d',  parent:'h1', project:'WORK',  title:'Submit proposal',                           start:'2026-05-16',end:'2026-05-16',priority:'p1',progress:0,   color:'#b2e0ac',owner:'Alex',  milestone:true, status:'todo', done:false, tags:[],comments:[],deps:[{id:'h1b',type:'FS',lag:0},{id:'h1c',type:'FS',lag:0}]},
  // Admin
  {id:'a1',   parent:null, project:'ADMIN', kind:'project', title:'Q1 close + tax filing',     start:'2026-04-30',end:'2026-05-12',priority:'p1',progress:.45, status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'a1a',  parent:'a1', project:'ADMIN', title:'Send Northwind invoice',                    start:'2026-04-30',end:'2026-04-30',priority:'p2',progress:1,   done:true,  color:'#9dd8d5',owner:'Alex',  status:'done', tags:[],comments:[],deps:[]},
  {id:'a1b',  parent:'a1', project:'ADMIN', title:'Q1 books closed',                           start:'2026-04-30',end:'2026-05-08',priority:'p1',progress:.6,  color:'#f5dc88',owner:'Alex',  pessimistic:3, baselineEnd:'2026-05-05', status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'a1c',  parent:'a1', project:'ADMIN', title:'Gather receipts',                           start:'2026-05-05',end:'2026-05-08',priority:'p2',progress:.35, color:'#9dd8d5',owner:'Sam',   status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'a1d',  parent:'a1', project:'ADMIN', title:'Submit quarterly filing',                   start:'2026-05-09',end:'2026-05-12',priority:'p1',progress:0,   color:'#f5dc88',owner:'Alex',  status:'todo', done:false, tags:[],comments:[],deps:[{id:'a1b',type:'FS',lag:0},{id:'a1c',type:'FS',lag:0}]},
  // Life
  {id:'l1',   parent:null, project:'LIFE',  kind:'project', title:'Personal — month',     start:'2026-04-30',end:'2026-05-28',priority:'p3',progress:.3,  status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'l1a',  parent:'l1', project:'LIFE',  title:'Strength training',                         start:'2026-04-30',end:'2026-05-23',priority:'p3',progress:.45, color:'#b2e0ac',owner:'Jordan',status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'l1b',  parent:'l1', project:'LIFE',  title:'Coffee with mentor',                        start:'2026-05-02',end:'2026-05-02',priority:'p2',progress:1,   done:true,  color:'#b2e0ac',owner:'Jordan',milestone:true, status:'done', tags:[],comments:[],deps:[]},
  {id:'l1c',  parent:'l1', project:'LIFE',  title:'Dentist checkup',                           start:'2026-05-08',end:'2026-05-08',priority:'p2',progress:0,   color:'#b2e0ac',owner:'Jordan',milestone:true, status:'todo', done:false, tags:[],comments:[],deps:[]},
  {id:'l1d',  parent:'l1', project:'LIFE',  title:'Read a book',                               start:'2026-05-10',end:'2026-05-20',priority:'p3',progress:0,   color:'#b2e0ac',owner:'Chris', status:'todo', done:false, tags:[],comments:[],deps:[]},
];
