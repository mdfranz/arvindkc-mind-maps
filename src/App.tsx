import { useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import MindMapEditor from './components/MindMapEditor';
import { dataUrlToBlob, downloadDataUrl, exportMindMapToPng } from './lib/export';
import { exportToGoogleDoc } from './lib/googleDocs';
import { buildOutline, outlineToGraph, outlineToText, parseOutlineText } from './lib/outline';
import type { MindNodeData } from './types';

export default function App() {
  const [title, setTitle] = useState('Mind Map');
  const [nodes, setNodes] = useState<Node<MindNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [snapshotElement, setSnapshotElement] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState('Ready');
  const [docUrl, setDocUrl] = useState('');
  const [outlineDraft, setOutlineDraft] = useState('');
  const [outlineFocused, setOutlineFocused] = useState(false);
  const [externalGraphVersion, setExternalGraphVersion] = useState(0);

  const outline = useMemo(() => buildOutline(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (!outlineFocused) {
      setOutlineDraft(outline.length > 0 ? outlineToText(outline) : '- Central Idea');
    }
  }, [outline, outlineFocused]);

  const handleOutlineChange = (nextText: string) => {
    setOutlineDraft(nextText);

    const parsed = parseOutlineText(nextText);
    if (parsed.length === 0) {
      return;
    }

    const graph = outlineToGraph(parsed);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setExternalGraphVersion((current) => current + 1);
  };

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>MindMap Doc Exporter</h1>
        <label>
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
      </header>

      <main className="workspace">
        <section className="canvas-panel">
          <MindMapEditor
            nodes={nodes}
            edges={edges}
            graphVersion={externalGraphVersion}
            onSnapshotReady={setSnapshotElement}
            onExportPng={handleExportPng}
            onExportDoc={handleExportGoogleDoc}
            onStateChange={(nextNodes, nextEdges) => {
              setNodes(nextNodes);
              setEdges(nextEdges);
            }}
          />
        </section>

        <aside className="outline-panel">
          <h2>Outline</h2>
          <textarea
            className="outline-input"
            value={outlineDraft}
            onFocus={() => setOutlineFocused(true)}
            onBlur={() => setOutlineFocused(false)}
            onChange={(event) => handleOutlineChange(event.target.value)}
            spellCheck={false}
          />
          <p className="status">{status}</p>
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noreferrer">
              Open Google Doc
            </a>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
