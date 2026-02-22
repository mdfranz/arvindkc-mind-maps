import { useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import MindMapEditor from './components/MindMapEditor';
import { dataUrlToBlob, downloadDataUrl, exportMindMapToPng } from './lib/export';
import { exportToGoogleDoc } from './lib/googleDocs';
import { loadEncryptedMaps, saveEncryptedMaps, type StoredMindMap } from './lib/localStore';
import { buildOutline, outlineToText } from './lib/outline';
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

export default function App() {
  const [title, setTitle] = useState('Mind Map');
  const [nodes, setNodes] = useState<MindFlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [snapshotElement, setSnapshotElement] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState('Ready');
  const [docUrl, setDocUrl] = useState('');

  const [passphrase, setPassphrase] = useState('');
  const [savedMaps, setSavedMaps] = useState<StoredMindMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [loadGraph, setLoadGraph] = useState<{ nodes: MindFlowNode[]; edges: Edge[] } | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [organizeVersion, setOrganizeVersion] = useState(0);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const outline = useMemo(() => buildOutline(nodes, edges), [nodes, edges]);

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

  const handleExportGoogleDoc = async () => {
    if (!snapshotElement) {
      setStatus('No mind map canvas found for export.');
      return;
    }

    try {
      setStatus('Rendering image and creating Google Doc...');
      setDocUrl('');
      const pngDataUrl = await exportMindMapToPng(snapshotElement);
      const imageBlob = dataUrlToBlob(pngDataUrl);
      const response = await exportToGoogleDoc({
        title,
        outline,
        imageBlob
      });
      setDocUrl(response.documentUrl);
      setStatus('Google Doc created.');
    } catch (error) {
      setStatus(
        `Export failed: ${error instanceof Error ? error.message : 'Unexpected error while exporting.'}`
      );
    }
  };

  const unlockStorage = async () => {
    if (!passphrase.trim()) {
      setStatus('Set an encryption passphrase to unlock local maps.');
      return;
    }

    try {
      const maps = await loadEncryptedMaps(passphrase);
      const ordered = [...maps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setSavedMaps(ordered);
      setStatus(`Encrypted storage unlocked (${ordered.length} maps).`);
    } catch (error) {
      setStatus(
        `Unlock failed: ${error instanceof Error ? error.message : 'Unable to decrypt local maps.'}`
      );
    }
  };

  const saveCurrentMap = async (forceNew = false): Promise<boolean> => {
    if (!passphrase.trim()) {
      setStatus('Set an encryption passphrase before saving.');
      return false;
    }

    const current = nodes.length > 0 ? { nodes, edges } : createEmptyMap();
    const now = new Date().toISOString();

    const nextMap: StoredMindMap = {
      id: forceNew ? crypto.randomUUID() : (selectedMapId ?? crypto.randomUUID()),
      title: title.trim() || 'Untitled Mind Map',
      updatedAt: now,
      nodes: current.nodes,
      edges: current.edges
    };

    const existingIndex = savedMaps.findIndex((map) => map.id === nextMap.id);
    const nextMaps = [...savedMaps];

    if (existingIndex >= 0) {
      nextMaps[existingIndex] = nextMap;
    } else {
      nextMaps.unshift(nextMap);
    }

    const ordered = [...nextMaps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    try {
      await saveEncryptedMaps(ordered, passphrase);
      setSavedMaps(ordered);
      setSelectedMapId(nextMap.id);
      setStatus(forceNew ? 'Mind map saved as new entry.' : 'Mind map saved to encrypted local storage.');
      return true;
    } catch (error) {
      setStatus(
        `Save failed: ${error instanceof Error ? error.message : 'Unable to save local map.'}`
      );
      return false;
    }
  };

  const saveAsNewMap = async () => {
    await saveCurrentMap(true);
  };

  const createNewMap = async () => {
    let autoSaved = false;

    if (nodes.length > 0 && passphrase.trim()) {
      autoSaved = await saveCurrentMap(true);
    }

    const empty = createEmptyMap();
    setLoadGraph(empty);
    setLoadVersion((current) => current + 1);
    setTitle('Mind Map');
    setSelectedMapId(null);

    if (autoSaved) {
      setStatus('Started new map. Previous map was saved in encrypted local storage.');
    } else {
      setStatus('Started new map. Set passphrase and use Save to keep maps locally.');
    }
  };

  const loadSavedMap = (map: StoredMindMap) => {
    setLoadGraph({ nodes: map.nodes, edges: map.edges });
    setLoadVersion((current) => current + 1);
    setSelectedMapId(map.id);
    setTitle(map.title);
    setStatus(`Loaded map: ${map.title}`);
  };

  const deleteSavedMap = async (mapId: string) => {
    if (!passphrase.trim()) {
      setStatus('Set an encryption passphrase before deleting.');
      return;
    }

    const nextMaps = savedMaps.filter((map) => map.id !== mapId);

    try {
      await saveEncryptedMaps(nextMaps, passphrase);
      setSavedMaps(nextMaps);
      if (selectedMapId === mapId) {
        setSelectedMapId(null);
      }
      setStatus('Saved map deleted from encrypted storage.');
    } catch (error) {
      setStatus(
        `Delete failed: ${error instanceof Error ? error.message : 'Unable to delete local map.'}`
      );
    }
  };

  return (
    <div className="app-shell">
      <main
        className={`workspace workspace-3col ${leftCollapsed ? 'left-collapsed' : ''} ${
          rightCollapsed ? 'right-collapsed' : ''
        }`}
      >
        <aside className={`side-panel left-panel ${leftCollapsed ? 'is-collapsed' : ''}`}>
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
                <button type="button" onClick={() => void createNewMap()}>
                  New Mind Map
                </button>
                <button type="button" onClick={() => setOrganizeVersion((current) => current + 1)}>
                  Organize
                </button>
              </div>

              <label className="panel-field">
                Document title
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>

              <div className="actions">
                <button type="button" onClick={handleExportPng}>
                  Export PNG
                </button>
                <button type="button" className="primary" onClick={handleExportGoogleDoc}>
                  Export to Google Doc
                </button>
              </div>

              <div className="vault-panel">
                <h3>Encrypted Local Storage</h3>
                <input
                  type="password"
                  className="vault-input"
                  placeholder="Encryption passphrase"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
                <div className="vault-actions">
                  <button type="button" onClick={() => void unlockStorage()}>
                    Unlock
                  </button>
                  <button type="button" onClick={() => void saveCurrentMap()}>
                    Save
                  </button>
                  <button type="button" onClick={() => void saveAsNewMap()}>
                    Save As New
                  </button>
                </div>
                <div className="vault-list">
                  {savedMaps.length === 0 ? <p>No saved maps in local encrypted storage.</p> : null}
                  {savedMaps.map((map) => (
                    <div key={map.id} className="vault-item">
                      <button
                        type="button"
                        className={`vault-load ${selectedMapId === map.id ? 'is-selected' : ''}`}
                        onClick={() => loadSavedMap(map)}
                      >
                        {map.title}
                      </button>
                      <small>{new Date(map.updatedAt).toLocaleString()}</small>
                      <button
                        type="button"
                        className="vault-delete"
                        onClick={() => void deleteSavedMap(map.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shortcuts-panel">
                <h3>Shortcuts</h3>
                <p><code>Enter</code>: Add child</p>
                <p><code>Tab</code>: Add sibling</p>
                <p><code>F2</code>: Rename</p>
                <p><code>Ctrl/Cmd+N</code>: New map</p>
                <p><code>Ctrl/Cmd+L</code>: Organize</p>
              </div>
            </div>
          ) : null}
        </aside>

        <section className="canvas-panel center-panel">
          <MindMapEditor
            loadGraph={loadGraph}
            loadVersion={loadVersion}
            organizeVersion={organizeVersion}
            onCreateNewMap={() => void createNewMap()}
            onSnapshotReady={setSnapshotElement}
            onExportPng={handleExportPng}
            onExportDoc={handleExportGoogleDoc}
            onStateChange={(nextNodes, nextEdges) => {
              setNodes(nextNodes);
              setEdges(nextEdges);
            }}
          />

        </section>

        <aside className={`side-panel right-panel ${rightCollapsed ? 'is-collapsed' : ''}`}>
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
              <pre>{outline.length > 0 ? outlineToText(outline) : 'Add topics to build your outline.'}</pre>
              <p className="status">{status}</p>
              {docUrl ? (
                <a href={docUrl} target="_blank" rel="noreferrer">
                  Open Google Doc
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
