import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Edge, Node } from '@xyflow/react';
import MindMapEditor from './components/MindMapEditor';
import { downloadDataUrl, exportMindMapToPng } from './lib/export';
import { loadLocalMaps, saveLocalMaps, type StoredMindMap } from './lib/localStore';
import { buildOutline, outlineToText, parseOutlineText, outlineToGraph } from './lib/outline';
import type { MindNodeData } from './types';

type MindFlowNode = Node<MindNodeData, 'mind'>;

function createEmptyMap(): { nodes: MindFlowNode[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: 'root',
        type: 'mind',
        position: { x: 40, y: 40 },
        selected: true,
        data: { label: 'Central Idea' }
      }
    ],
    edges: []
  };
}

function upsertMap(maps: StoredMindMap[], map: StoredMindMap): StoredMindMap[] {
  const index = maps.findIndex((item) => item.id === map.id);
  const next = [...maps];

  if (index >= 0) {
    next[index] = map;
  } else {
    next.push(map);
  }

  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function formatRelativeTime(updatedAtIso: string, nowMs: number): string {
  const deltaMs = Math.max(0, nowMs - new Date(updatedAtIso).getTime());
  const seconds = Math.floor(deltaMs / 1000);

  if (seconds < 45) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function App() {
  const [title, setTitle] = useState('Mind Map');
  const [nodes, setNodes] = useState<MindFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [snapshotElement, setSnapshotElement] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState('Ready');

  const [savedMaps, setSavedMaps] = useState<StoredMindMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [loadGraph, setLoadGraph] = useState<{ nodes: MindFlowNode[]; edges: Edge[] } | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [organizeVersion, setOrganizeVersion] = useState(0);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(300);
  const [renameMapId, setRenameMapId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [outlineDraft, setOutlineDraft] = useState('');
  const [isOutlineFocused, setIsOutlineFocused] = useState(false);
  const [focusOnLoad, setFocusOnLoad] = useState(true);

  const hydratedRef = useRef(false);
  const autosaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOutlineFocused) {
      const outline = buildOutline(nodes, edges);
      setOutlineDraft(outline.length > 0 ? outlineToText(outline) : '- Central Idea');
    }
  }, [nodes, edges, isOutlineFocused]);

  const handleOutlineChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setOutlineDraft(text);
    
    const parsed = parseOutlineText(text);
    const graph = outlineToGraph(parsed);
    
    setFocusOnLoad(false);
    setLoadGraph(graph);
    setLoadVersion((current) => current + 1);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const maps = await loadLocalMaps();
        const ordered = [...maps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setSavedMaps(ordered);

        if (ordered.length > 0) {
          const latest = ordered[0];
          setLoadGraph({ nodes: latest.nodes, edges: latest.edges });
          setLoadVersion(1);
          setSelectedMapId(latest.id);
          setTitle(latest.title);
          setStatus(`Loaded most recent local map: ${latest.title}`);
        } else {
          setStatus('Ready');
        }
      } catch (error) {
        setStatus(
          `Local storage unavailable: ${error instanceof Error ? error.message : 'Unexpected error.'}`
        );
      } finally {
        hydratedRef.current = true;
      }
    };

    void hydrate();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || nodes.length === 0) {
      return;
    }

    if (renameMapId && renameMapId === selectedMapId) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      const id = selectedMapId ?? crypto.randomUUID();
      const selectedSavedMap = savedMaps.find((item) => item.id === id);
      const effectiveTitle = selectedSavedMap?.title ?? (title.trim() || 'Untitled Mind Map');
      const map: StoredMindMap = {
        id,
        title: effectiveTitle,
        updatedAt: new Date().toISOString(),
        nodes,
        edges
      };

      setSelectedMapId(id);
      setSavedMaps((current) => {
        const updated = upsertMap(current, map);
        void saveLocalMaps(updated);
        return updated;
      });
      setStatus('Auto-saved locally.');
    }, 700);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [edges, nodes, renameMapId, savedMaps, selectedMapId, title]);

  const handleExportPng = async () => {
    if (!snapshotElement) {
      setStatus('No mind map canvas found for export.');
      return;
    }

    try {
      setStatus('Rendering image...');
      const pngDataUrl = await exportMindMapToPng(snapshotElement);
      downloadDataUrl(pngDataUrl, `${title.replace(/\s+/g, '-').toLowerCase() || 'mindmap'}.png`);
      setStatus('PNG downloaded.');
    } catch (error) {
      setStatus(
        `PNG export failed: ${error instanceof Error ? error.message : 'Unexpected error while exporting.'}`
      );
    }
  };

  const handleExportMarkdown = () => {
    try {
      const blob = new Blob([outlineDraft], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'mindmap'}.md`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Markdown downloaded.');
    } catch (error) {
      setStatus(
        `Markdown export failed: ${error instanceof Error ? error.message : 'Unexpected error while exporting.'}`
      );
    }
  };

  const createNewMap = () => {
    const empty = createEmptyMap();
    setLoadGraph(empty);
    setLoadVersion((current) => current + 1);
    setTitle('Mind Map');
    setSelectedMapId(crypto.randomUUID());
    setStatus('Started new mind map. Previous maps stay in local storage.');
  };

  const loadSavedMapById = (mapId: string) => {
    const map = savedMaps.find((item) => item.id === mapId);
    if (!map) {
      return;
    }

    setFocusOnLoad(true);
    setLoadGraph({ nodes: map.nodes, edges: map.edges });
    setLoadVersion((current) => current + 1);
    setSelectedMapId(map.id);
    setTitle(map.title);
    setRenameMapId(null);
    setStatus(`Loaded map: ${map.title}`);
  };

  const beginRenameMap = (map: StoredMindMap) => {
    setRenameMapId(map.id);
    setRenameDraft(map.title);
  };

  const commitRenameMap = (mapId: string) => {
    const nextTitle = renameDraft.trim() || 'Untitled Mind Map';
    let renamed = false;

    setSavedMaps((current) => {
      const updated = current.map((map) => {
        if (map.id !== mapId) {
          return map;
        }

        renamed = true;
        return {
          ...map,
          title: nextTitle
        };
      });

      void saveLocalMaps(updated);
      return updated;
    });

    if (selectedMapId === mapId) {
      setTitle(nextTitle);
    }

    setRenameMapId(null);
    if (renamed) {
      setStatus(`Renamed map to "${nextTitle}".`);
    }
  };

  const deleteSavedMap = async (mapId: string) => {
    const remaining = savedMaps.filter((map) => map.id !== mapId);
    setSavedMaps(remaining);
    await saveLocalMaps(remaining);
    setRenameMapId(null);

    if (selectedMapId === mapId) {
      if (remaining.length > 0) {
        setFocusOnLoad(true);
        setLoadGraph({ nodes: remaining[0].nodes, edges: remaining[0].edges });
        setLoadVersion((current) => current + 1);
        setSelectedMapId(remaining[0].id);
        setTitle(remaining[0].title);
        setStatus(`Loaded map: ${remaining[0].title}`);
      } else {
        createNewMap();
      }
    } else {
      setStatus('Deleted saved map.');
    }
  };

  const copyOutline = async () => {
    try {
      await navigator.clipboard.writeText(outlineDraft);
      setStatus('Outline copied as Markdown.');
    } catch {
      setStatus('Unable to copy outline in this browser context.');
    }
  };

  const startResize =
    (side: 'left' | 'right') => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = side === 'left' ? leftWidth : rightWidth;

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;

        if (side === 'left') {
          setLeftWidth(Math.max(240, Math.min(520, startWidth + delta)));
        } else {
          setRightWidth(Math.max(240, Math.min(520, startWidth - delta)));
        }
      };

      const onUp = () => {
        document.body.classList.remove('is-resizing-panels');
        window.removeEventListener('pointermove', onMove);
      };

      document.body.classList.add('is-resizing-panels');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    };

  return (
    <div className="app-shell font-inter">
      <main
        className={`workspace workspace-3col ${leftCollapsed ? 'left-collapsed' : ''} ${
          rightCollapsed ? 'right-collapsed' : ''
        }`}
      >
        <aside
          className={`side-panel left-panel ${leftCollapsed ? 'is-collapsed' : ''}`}
          style={leftCollapsed ? undefined : { width: leftWidth }}
        >
          <div className="side-header">
            {!leftCollapsed ? <h2>My Mind Maps</h2> : null}
            <button
              type="button"
              className="collapse-btn"
              onClick={() => setLeftCollapsed((current) => !current)}
              aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
            >
              {leftCollapsed ? '›' : '‹'}
            </button>
          </div>

          {!leftCollapsed ? (
            <div className="side-content">
              <div className="left-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="New Mind Map"
                  aria-label="New Mind Map"
                  onClick={() => void createNewMap()}
                >
                  +
                </button>
              </div>
              <div className="vault-list">
                {savedMaps.length === 0 ? <p>No saved maps yet.</p> : null}
                {savedMaps.map((map) => (
                  <div
                    key={map.id}
                    className={`vault-item ${selectedMapId === map.id ? 'is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (renameMapId === map.id) {
                        return;
                      }
                      loadSavedMapById(map.id);
                    }}
                    onKeyDown={(event) => {
                      if (renameMapId === map.id) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        loadSavedMapById(map.id);
                      }
                    }}
                  >
                    {renameMapId === map.id ? (
                      <div className="vault-main">
                        <input
                          autoFocus
                          className="vault-rename"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={() => commitRenameMap(map.id)}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitRenameMap(map.id);
                            }

                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setRenameMapId(null);
                            }
                          }}
                        />
                        <span className="vault-time">{formatRelativeTime(map.updatedAt, nowMs)}</span>
                      </div>
                    ) : (
                      <div className="vault-main">
                        <button
                          type="button"
                          className="vault-name-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginRenameMap(map);
                          }}
                        >
                          {map.title}
                        </button>
                        <span className="vault-time">{formatRelativeTime(map.updatedAt, nowMs)}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="vault-delete-btn"
                      aria-label={`Remove ${map.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteSavedMap(map.id);
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
        {!leftCollapsed ? (
          <div className="panel-resizer" onPointerDown={startResize('left')} aria-hidden="true" />
        ) : null}

        <section className="canvas-panel center-panel">
          <div className="canvas-icons">
            <button
              type="button"
              className="canvas-icon-btn"
              title="Organize"
              aria-label="Organize"
              onClick={() => setOrganizeVersion((current) => current + 1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
                <path d="M4 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
                <path d="M4 17c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
              </svg>
            </button>
            <button
              type="button"
              className="canvas-icon-btn"
              title="Export Markdown"
              aria-label="Export Markdown"
              onClick={handleExportMarkdown}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                <path d="M9 14l2-2 2 2" />
                <path d="M11 12v5" />
              </svg>
            </button>
            <button
              type="button"
              className="canvas-icon-btn"
              title="Export PNG"
              aria-label="Export PNG"
              onClick={handleExportPng}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v9" />
                <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
                <rect x="4" y="16" width="16" height="4" rx="1.5" ry="1.5" />
              </svg>
            </button>
          </div>

          <MindMapEditor
            loadGraph={loadGraph}
            loadVersion={loadVersion}
            organizeVersion={organizeVersion}
            focusOnLoad={focusOnLoad}
            onCreateNewMap={() => {
              setFocusOnLoad(true);
              void createNewMap();
            }}
            onSnapshotReady={setSnapshotElement}
            onExportPng={handleExportPng}
            onStateChange={(nextNodes, nextEdges) => {
              setNodes(nextNodes);
              setEdges(nextEdges);
            }}
          />
        </section>
        {!rightCollapsed ? (
          <div className="panel-resizer" onPointerDown={startResize('right')} aria-hidden="true" />
        ) : null}

        <aside
          className={`side-panel right-panel ${rightCollapsed ? 'is-collapsed' : ''}`}
          style={rightCollapsed ? undefined : { width: rightWidth }}
        >
          <div className="side-header">
            {!rightCollapsed ? <h2>Outline</h2> : null}
            <button
              type="button"
              className="collapse-btn"
              onClick={() => setRightCollapsed((current) => !current)}
              aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
            >
              {rightCollapsed ? '‹' : '›'}
            </button>
          </div>

          {!rightCollapsed ? (
            <div className="side-content">
              <div className="outline-head">
                <h3>Markdown</h3>
                <button
                  type="button"
                  className="outline-copy"
                  title="Copy outline"
                  aria-label="Copy outline"
                  onClick={() => void copyOutline()}
                >
                  ⧉
                </button>
              </div>
              <textarea
                className="outline-editor"
                value={outlineDraft}
                onChange={handleOutlineChange}
                onFocus={() => setIsOutlineFocused(true)}
                onBlur={() => setIsOutlineFocused(false)}
                aria-label="Edit Markdown Outline"
                spellCheck={false}
              />
            </div>
          ) : null}
        </aside>
      </main>
      <div className="status-bar">
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
