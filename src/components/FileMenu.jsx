import React from 'react';

export function FileMenu({
  fileMenuOpen, setFileMenuOpen,
  fileRecentSubOpen, setFileRecentSubOpen,
  fileTmplSubOpen, setFileTmplSubOpen,
  createNewProject, openWorkspace, saveWorkspace,
  recents, openRecent, formatAgo,
  FSA_AVAILABLE,
  activeProject, templates, saveActiveProjectAsTemplate, setTmplModal,
  undo, redo, undoStackRef, redoStackRef,
  dirty, projects, customConfirm, setShowWelcome,
  toggleAutosave, autosaveEnabled,
}) {
  return (
    <div className="file-menu-wrap">
      <button className={`tb-btn${fileMenuOpen?' active':''}`}
              onMouseDown={e=>e.stopPropagation()}
              onClick={()=>setFileMenuOpen(o=>!o)}>
        File
      </button>
      {fileMenuOpen && (
        <div className="file-menu-drop" onMouseDown={e=>e.stopPropagation()}>
          <div className="file-menu-item" onClick={()=>{createNewProject();setFileMenuOpen(false);}}>New project…</div>
          <div className="file-menu-item" onClick={()=>{openWorkspace();setFileMenuOpen(false);}}>Open workspace…</div>
          <div className="file-menu-sep"/>
          <div className="file-menu-item" onClick={()=>{saveWorkspace(false);setFileMenuOpen(false);}}>
            {FSA_AVAILABLE ? 'Save' : 'Download'}<span className="kbd">Ctrl S</span>
          </div>
          {FSA_AVAILABLE && (
            <div className="file-menu-item" onClick={()=>{saveWorkspace(true);setFileMenuOpen(false);}}>
              Save as…<span className="kbd">Ctrl ⇧ S</span>
            </div>
          )}
          <div className="file-menu-sep"/>
          <div className="file-menu-item has-sub"
            onMouseEnter={()=>setFileRecentSubOpen(true)}
            onMouseLeave={()=>setFileRecentSubOpen(false)}>
            Recent files
            {fileRecentSubOpen && (
              <div className="file-menu-sub" onMouseDown={e=>e.stopPropagation()}>
                {recents.length === 0
                  ? <div className="file-menu-item" style={{opacity:.4,pointerEvents:'none'}}>No recent files</div>
                  : recents.map(r => (
                      <div key={r.id} className="file-menu-item"
                           title={r.name + ' · ' + formatAgo(r.savedAt)}
                           onClick={()=>{openRecent(r.id);setFileMenuOpen(false);setFileRecentSubOpen(false);}}>
                        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</span>
                        <span style={{marginLeft:12,fontSize:10,color:'var(--t4)',flexShrink:0}}>{formatAgo(r.savedAt)}</span>
                      </div>
                    ))
                }
              </div>
            )}
          </div>
          <div className="file-menu-item has-sub"
            onMouseEnter={()=>setFileTmplSubOpen(true)}
            onMouseLeave={()=>setFileTmplSubOpen(false)}>
            Templates
            {fileTmplSubOpen && (
              <div className="file-menu-sub" onMouseDown={e=>e.stopPropagation()}>
                <div className={`file-menu-item${!activeProject?' disabled':''}`}
                  style={!activeProject?{opacity:.4,pointerEvents:'none'}:null}
                  onClick={()=>{saveActiveProjectAsTemplate();setFileMenuOpen(false);setFileTmplSubOpen(false);}}>
                  Save active project as template…
                </div>
                <div className={`file-menu-item${templates.length===0?' disabled':''}`}
                  style={templates.length===0?{opacity:.4,pointerEvents:'none'}:null}
                  onClick={()=>{setTmplModal('pick');setFileMenuOpen(false);setFileTmplSubOpen(false);}}>
                  New project from template…
                </div>
                <div className={`file-menu-item${templates.length===0?' disabled':''}`}
                  style={templates.length===0?{opacity:.4,pointerEvents:'none'}:null}
                  onClick={()=>{setTmplModal('manage');setFileMenuOpen(false);setFileTmplSubOpen(false);}}>
                  Manage templates…
                </div>
              </div>
            )}
          </div>
          <div className="file-menu-sep"/>
          <div className={`file-menu-item${undoStackRef.current.length===0?' disabled':''}`}
               style={undoStackRef.current.length===0?{opacity:.4,pointerEvents:'none'}:null}
               onClick={()=>{undo();setFileMenuOpen(false);}}>
            Undo<span className="kbd">Ctrl Z</span>
          </div>
          <div className={`file-menu-item${redoStackRef.current.length===0?' disabled':''}`}
               style={redoStackRef.current.length===0?{opacity:.4,pointerEvents:'none'}:null}
               onClick={()=>{redo();setFileMenuOpen(false);}}>
            Redo<span className="kbd">Ctrl ⇧ Z</span>
          </div>
          <div className="file-menu-sep"/>
          <div className="file-menu-item" onClick={async ()=>{ if(dirty&&projects.length>0&&!await customConfirm('Go to Home Screen?','Your unsaved changes will be lost.',{okLabel:'Continue'}))return; setShowWelcome(true);setFileMenuOpen(false);}}>Home screen</div>
          <div className="file-menu-sep"/>
          <div className="file-menu-item" onClick={()=>{toggleAutosave();setFileMenuOpen(false);}}>
            <span style={{width:14,display:'inline-block',flexShrink:0}}>{autosaveEnabled ? '✓' : ''}</span>
            Auto-save
          </div>
        </div>
      )}
    </div>
  );
}
