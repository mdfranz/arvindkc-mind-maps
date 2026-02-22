import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { loadLocalMaps, saveLocalMaps, type StoredMindMap } from '../lib/localStore';
import { createEmptyMap, sortMapsByUpdatedAt, upsertMap } from '../lib/vault';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

type MindGraph = {
  nodes: MindModelNode[];
  edges: Edge[];
};

export default function useVault() {
  const [title, setTitle] = useState('Mind Map 1');
  const [status, setStatus] = useState('Ready');

  const [savedMaps, setSavedMaps] = useState<StoredMindMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [loadGraph, setLoadGraph] = useState<MindGraph | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  const hydratedRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const requestLoadGraph = useCallback((graph: MindGraph) => {
    setLoadGraph(graph);
    setLoadVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const maps = await loadLocalMaps();
        const ordered = sortMapsByUpdatedAt(maps);
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
        setIsHydrated(true);
      }
    };

    void hydrate();
  }, []);

  const createNewMap = useCallback(() => {
    const empty = createEmptyMap();
    requestLoadGraph(empty);

    let maxNumber = 0;
    for (const map of savedMaps) {
      const match = map.title.match(/^Mind Map (\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
    setTitle(`Mind Map ${maxNumber + 1}`);

    setSelectedMapId(crypto.randomUUID());
    setStatus('Started new mind map. Previous maps stay in local storage.');
  }, [requestLoadGraph, savedMaps]);

  const loadSavedMapById = useCallback(
    (mapId: string) => {
      const map = savedMaps.find((item) => item.id === mapId);
      if (!map) {
        return;
      }

      requestLoadGraph({ nodes: map.nodes, edges: map.edges });
      setSelectedMapId(map.id);
      setTitle(map.title);
      setStatus(`Loaded map: ${map.title}`);
    },
    [requestLoadGraph, savedMaps]
  );

  const renameSavedMap = useCallback(
    (mapId: string, nextTitle: string) => {
      setSavedMaps((current) => {
        const updated = current.map((map) => (map.id === mapId ? { ...map, title: nextTitle } : map));
        void saveLocalMaps(updated);
        return updated;
      });

      if (selectedMapId === mapId) {
        setTitle(nextTitle);
      }

      setStatus(`Renamed map to "${nextTitle}".`);
    },
    [selectedMapId]
  );

  const deleteSavedMap = useCallback(
    async (mapId: string) => {
      const remaining = savedMaps.filter((map) => map.id !== mapId);
      setSavedMaps(remaining);
      await saveLocalMaps(remaining);

      if (selectedMapId === mapId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          requestLoadGraph({ nodes: next.nodes, edges: next.edges });
          setSelectedMapId(next.id);
          setTitle(next.title);
          setStatus(`Loaded map: ${next.title}`);
        } else {
          createNewMap();
        }
      } else {
        setStatus('Deleted saved map.');
      }
    },
    [createNewMap, requestLoadGraph, savedMaps, selectedMapId]
  );

  const persistAutosave = useCallback(
    (params: { nodes: MindModelNode[]; edges: Edge[]; mapId: string | null }) => {
      const id = params.mapId ?? crypto.randomUUID();
      const selectedSavedMap = savedMaps.find((item) => item.id === id);
      const effectiveTitle = selectedSavedMap?.title ?? (title.trim() || 'Untitled Mind Map');

      const map: StoredMindMap = {
        id,
        title: effectiveTitle,
        updatedAt: new Date().toISOString(),
        nodes: params.nodes,
        edges: params.edges
      };

      setSelectedMapId(id);
      setSavedMaps((current) => {
        const updated = upsertMap(current, map);
        void saveLocalMaps(updated);
        return updated;
      });
      setStatus('Auto-saved locally.');
    },
    [savedMaps, title]
  );

  return {
    isHydrated,
    title,
    setTitle,
    status,
    setStatus,
    savedMaps,
    setSavedMaps,
    selectedMapId,
    setSelectedMapId,
    loadGraph,
    loadVersion,
    requestLoadGraph,
    createNewMap,
    loadSavedMapById,
    renameSavedMap,
    deleteSavedMap,
    persistAutosave
  };
}
