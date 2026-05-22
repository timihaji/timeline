import React, { Fragment } from 'react';

// Collapses the modal/overlay stack that previously rendered in TWO places
// (welcome-screen branch AND main-app return). Memory: project_modal_dual_render —
// keeping these in sync was a recurring footgun. Now there is one render site.
//
// `templateModal` and `tweaks` are passed as already-rendered ReactNodes so
// ModalsHost doesn't need to know how to construct GanttTweaks or the
// template-instantiate JSX (both still live inside App() and close over its state).
export function ModalsHost({
  templateModal,
  fsaAvailable,
  fileInputRef,
  onFileInputChange,
  loadError,
  setLoadError,
  modal,
  closeModal,
  modalInputRef,
  tweaks,
}) {
  return (
    <Fragment>
      {templateModal}

      {!fsaAvailable && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={onFileInputChange}
        />
      )}

      {loadError && (
        <div className="err-overlay" onMouseDown={() => setLoadError(null)}>
          <div className="err-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="e-hdr">
              <div className="e-icon">!</div>
              <div className="e-title">{loadError.title}</div>
            </div>
            <div className="e-body">{loadError.message}</div>
            <div className="e-foot">
              <button className="e-btn" autoFocus onClick={() => setLoadError(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="cmod-overlay" onMouseDown={() => closeModal(modal.type === 'confirm' ? false : null)}>
          <div className="cmod" onMouseDown={e => e.stopPropagation()}>
            <div className="cmod-head">
              <div className={`cmod-icon cmod-icon--${modal.type}${modal.destructive ? ' cmod-icon--danger' : ''}`}>
                {modal.type === 'confirm' && !modal.destructive && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                )}
                {modal.type === 'confirm' && modal.destructive && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6m4-6v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )}
                {modal.type === 'alert' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {modal.type === 'prompt' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                )}
              </div>
              <div className="cmod-title">{modal.title}</div>
            </div>
            {(modal.body || modal.type === 'prompt') && (
              <div className="cmod-body">
                {modal.body}
                {modal.type === 'prompt' && (
                  <input
                    ref={modalInputRef}
                    className="cmod-input"
                    defaultValue={modal.defaultValue}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') closeModal(modalInputRef.current?.value ?? null);
                      if (e.key === 'Escape') closeModal(null);
                    }}
                  />
                )}
              </div>
            )}
            <div className="cmod-foot">
              {modal.type !== 'alert' && (
                <button className="cmod-btn" onClick={() => closeModal(modal.type === 'confirm' ? false : null)}>
                  {modal.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                className={`cmod-btn primary${modal.destructive ? ' danger' : ''}`}
                autoFocus={modal.type !== 'prompt'}
                onClick={() => closeModal(
                  modal.type === 'prompt' ? (modalInputRef.current?.value ?? null) :
                  modal.type === 'confirm' ? true : undefined
                )}
              >{modal.okLabel || 'OK'}</button>
            </div>
          </div>
        </div>
      )}

      {tweaks}
    </Fragment>
  );
}
