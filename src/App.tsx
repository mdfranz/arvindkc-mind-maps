import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Edge, Node } from '@xyflow/react';
import MindMapEditor from './components/MindMapEditor';
import OutlinePanel from './components/OutlinePanel';
import VaultPanel from './components/VaultPanel';
import { downloadDataUrl, exportMindMapToPng } from './lib/export';
import { exportMindMapToSql } from './lib/api';
import type { StoredMindMap } from './lib/localStore';
import type { MindNodeModelData } from './types';
import useAutosave from './hooks/useAutosave';
import useNowMs from './hooks/useNowMs';
import useOutline from './hooks/useOutline';
import useVault from './hooks/useVault';

type MindFlowNode = Node<MindNodeModelData, 'mind'>;

export default function App() {
  const [nodes, setNodes] = useState<MindFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [snapshotElement, setSnapshotElement] = useState<HTMLElement | null>(null);

  const {
    isHydrated,
    title,
    status,
    setStatus,
    savedMaps,
    selectedMapId,
    loadGraph,
    loadVersion,
    requestLoadGraph,
    createNewMap,
    loadSavedMapById: loadSavedMapFromVault,
    renameSavedMap,
    deleteSavedMap: deleteSavedMapFromVault,
    persistAutosave
  } = useVault();
  const nowMs = useNowMs();
  const [organizeVersion, setOrganizeVersion] = useState(0);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(300);
  const [renameMapId, setRenameMapId] = useState<string | number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [focusOnLoad, setFocusOnLoad] = useState(true);

  const { outlineDraft, handleOutlineChange, handleOutlineFocusChange } = useOutline({
    nodes,
    edges,
    onRequestLoadGraph: requestLoadGraph,
    onSetFocusOnLoad: setFocusOnLoad
  });

  useAutosave({
    enabled: isHydrated,
    blocked: Boolean(renameMapId && renameMapId === selectedMapId),
    nodes,
    edges,
    selectedMapId,
    persist: persistAutosave
  });

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

  const handleExportSql = async () => {
    if (typeof selectedMapId !== 'number') {
      setStatus('SQL export is only available for maps saved to the vault.');
      return;
    }

    try {
      setStatus('Generating SQL...');
      const sqlText = await exportMindMapToSql(selectedMapId);
      const blob = new Blob([sqlText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'mindmap'}.sql`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('SQL downloaded.');
    } catch (error) {
      setStatus(
        `SQL export failed: ${error instanceof Error ? error.message : 'Unexpected error while exporting.'}`
      );
    }
  };

  const loadSavedMapById = (mapId: string | number) => {
    setFocusOnLoad(true);
    loadSavedMapFromVault(mapId);
    setRenameMapId(null);
  };

  const beginRenameMap = (map: StoredMindMap) => {
    setRenameMapId(map.id);
    setRenameDraft(map.title);
  };

  const commitRenameMap = (mapId: string | number) => {
    const nextTitle = renameDraft.trim() || 'Untitled Mind Map';
    const existing = savedMaps.some((map) => map.id === mapId);
    if (existing) {
      void renameSavedMap(mapId, nextTitle);
    }
    setRenameMapId(null);
  };

  const deleteSavedMap = async (mapId: string | number) => {
    setRenameMapId(null);
    await deleteSavedMapFromVault(mapId);
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
        <VaultPanel
          collapsed={leftCollapsed}
          width={leftWidth}
          savedMaps={savedMaps}
          selectedMapId={selectedMapId}
          renameMapId={renameMapId}
          renameDraft={renameDraft}
          nowMs={nowMs}
          onToggleCollapsed={() => setLeftCollapsed((current) => !current)}
          onCreateNewMap={() => {
            setFocusOnLoad(true);
            createNewMap();
          }}
          onSelectMap={loadSavedMapById}
          onBeginRename={beginRenameMap}
          onRenameDraftChange={setRenameDraft}
          onCommitRename={commitRenameMap}
          onCancelRename={() => setRenameMapId(null)}
          onDeleteMap={(mapId) => void deleteSavedMap(mapId)}
          onStartResize={startResize('left')}
        />

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
              title="Export SQL"
              aria-label="Export SQL"
              onClick={handleExportSql}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16v12H4z" />
                <path d="M4 10h16M12 10v8" />
                <path d="M12 6v4" />
                <text x="6" y="15" fontSize="6" fontWeight="bold">SQL</text>
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
              createNewMap();
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
        <OutlinePanel
          collapsed={rightCollapsed}
          width={rightWidth}
          outlineDraft={outlineDraft}
          onToggleCollapsed={() => setRightCollapsed((current) => !current)}
          onCopyOutline={() => void copyOutline()}
          onOutlineChange={handleOutlineChange}
          onOutlineFocusChange={handleOutlineFocusChange}
        />
      </main>
      <div className="status-bar">
        <p className="status">{status}</p>
      </div>
    </div>
  );
}
