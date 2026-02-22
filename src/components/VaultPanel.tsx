import type { PointerEvent as ReactPointerEvent } from 'react';
import type { StoredMindMap } from '../lib/localStore';
import { formatRelativeTime } from '../lib/vault';

type VaultPanelProps = {
  collapsed: boolean;
  width: number;
  savedMaps: StoredMindMap[];
  selectedMapId: string | number | null;
  renameMapId: string | number | null;
  renameDraft: string;
  nowMs: number;
  onToggleCollapsed: () => void;
  onCreateNewMap: () => void;
  onSelectMap: (mapId: string | number) => void;
  onBeginRename: (map: StoredMindMap) => void;
  onRenameDraftChange: (nextDraft: string) => void;
  onCommitRename: (mapId: string | number) => void;
  onCancelRename: () => void;
  onDeleteMap: (mapId: string | number) => void;
  onStartResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export default function VaultPanel(props: VaultPanelProps) {
  return (
    <>
      <aside
        className={`side-panel left-panel ${props.collapsed ? 'is-collapsed' : ''}`}
        style={props.collapsed ? undefined : { width: props.width }}
      >
        <div className="side-header">
          {!props.collapsed ? <h2>My Mind Maps</h2> : null}
          <button
            type="button"
            className="collapse-btn"
            onClick={props.onToggleCollapsed}
            aria-label={props.collapsed ? 'Expand left panel' : 'Collapse left panel'}
          >
            {props.collapsed ? '›' : '‹'}
          </button>
        </div>

        {!props.collapsed ? (
          <div className="side-content">
            <div className="left-actions">
              <button
                type="button"
                className="icon-btn"
                title="New Mind Map"
                aria-label="New Mind Map"
                onClick={props.onCreateNewMap}
              >
                +
              </button>
            </div>
            <div className="vault-list">
              {props.savedMaps.length === 0 ? <p>No saved maps yet.</p> : null}
              {props.savedMaps.map((map) => (
                <div
                  key={map.id}
                  className={`vault-item ${props.selectedMapId === map.id ? 'is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (props.renameMapId === map.id) {
                      return;
                    }
                    props.onSelectMap(map.id);
                  }}
                  onKeyDown={(event) => {
                    if (props.renameMapId === map.id) {
                      return;
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      props.onSelectMap(map.id);
                    }
                  }}
                >
                  {props.renameMapId === map.id ? (
                    <div className="vault-main">
                      <input
                        autoFocus
                        className="vault-rename"
                        value={props.renameDraft}
                        onChange={(event) => props.onRenameDraftChange(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => props.onCommitRename(map.id)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            props.onCommitRename(map.id);
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault();
                            props.onCancelRename();
                          }
                        }}
                      />
                      <span className="vault-time">
                        {formatRelativeTime(map.updatedAt, props.nowMs)}
                      </span>
                    </div>
                  ) : (
                    <div className="vault-main">
                      <button
                        type="button"
                        className="vault-name-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onBeginRename(map);
                        }}
                      >
                        {map.title}
                      </button>
                      <span className="vault-time">{formatRelativeTime(map.updatedAt, props.nowMs)}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="vault-delete-btn"
                    aria-label={`Remove ${map.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onDeleteMap(map.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
      {!props.collapsed ? (
        <div className="panel-resizer" onPointerDown={props.onStartResize} aria-hidden="true" />
      ) : null}
    </>
  );
}

