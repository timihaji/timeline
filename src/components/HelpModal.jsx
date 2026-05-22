import React from 'react';

export function HelpModal({ onClose, fsaAvailable }){
  const groups = [
    { name: 'File', rows: [
      { keys: [['Ctrl','S']], desc: fsaAvailable ? 'Save' : 'Download' },
      { keys: [['Ctrl','Shift','S']], desc: 'Save as…', hide: !fsaAvailable },
      { keys: [['Ctrl','Z']], desc: 'Undo' },
      { keys: [['Ctrl','Shift','Z'], ['Ctrl','Y']], desc: 'Redo' },
    ]},
    { name: 'Editing', rows: [
      { keys: [['F2'], ['Enter']], desc: 'Rename selected task' },
      { keys: [['Delete'], ['Backspace']], desc: 'Delete task' },
      { keys: [['Ctrl','Delete']], desc: 'Clear dependencies on selected' },
      { keys: [['Ctrl','D']], desc: 'Duplicate task' },
      { keys: [['Ctrl','E']], desc: 'Focus dependency chain' },
      { keys: [['0-9']], desc: 'Type digits then Enter to set duration (days)' },
      { keys: [['Shift','←'], ['Shift','→']], desc: 'Resize end by one day' },
      { keys: [['←'], ['→']], desc: 'Move task by one day (start + end)' },
    ]},
    { name: 'Selection', rows: [
      { keys: [['Shift','drag']], desc: 'Lasso select tasks' },
      { keys: [['Shift','click']], desc: 'Toggle task in selection' },
      { keys: [['Alt','drag']], desc: 'Duplicate as a successor (FS dep added)' },
    ]},
    { name: 'Navigation', rows: [
      { keys: [['?']], desc: 'Show this help' },
      { keys: [['Esc']], desc: 'Clear selection, menus, or close modal' },
    ]},
    { name: 'Views', rows: [
      { keys: [['topbar']], desc: 'Switch between Gantt / List / Calendar views via the topbar' },
    ]},
  ];

  const renderKeys = (combo) => {
    const out = [];
    combo.forEach((k, i) => {
      if (i > 0) out.push(<span key={'p'+i} className="h-plus">+</span>);
      out.push(<span key={'k'+i} className="kbd">{k}</span>);
    });
    return out;
  };

  return (
    <div className="help-overlay" onMouseDown={onClose}>
      <div className="help-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="h-hdr">
          <h3>Keyboard shortcuts</h3>
          <button className="h-close" onClick={onClose} title="Close">×</button>
        </div>
        <div className="h-body">
          {groups.map(g => (
            <div key={g.name} className="h-grp">
              <div className="h-grp-title">{g.name}</div>
              {g.rows.filter(r => !r.hide).map((r, i) => (
                <div key={i} className="h-row">
                  <div className="h-keys">
                    {r.keys.map((combo, j) => (
                      <React.Fragment key={j}>
                        {j > 0 && <span className="h-plus" style={{margin:'0 4px',color:'var(--t4)'}}>or</span>}
                        {renderKeys(combo)}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="h-desc">{r.desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="h-foot">
          <button className="h-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
