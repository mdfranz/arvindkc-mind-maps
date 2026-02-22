import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { loadLocalMaps, saveLocalMaps, type StoredMindMap } from '../lib/localStore';
import { createEmptyMap, sortMapsByUpdatedAt, upsertMap } from '../lib/vault';
import { listMindMaps, createMindMap, updateMindMap, deleteMindMap } from '../lib/api';
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
  const [selectedMapId, setSelectedMapId] = useState<string | number | null>(null);
  const [loadGraph, setLoadGraph] = useState<MindGraph | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  const hydratedRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const requestLoadGraph = useCallback((graph: MindGraph) => {
    setLoadGraph(graph);
    setLoadVersion((current) => current + 1);
  }, []);

  const syncWithBackend = useCallback(async () => {
    try {
      const backendMaps = await listMindMaps();
      const formattedBackendMaps: StoredMindMap[] = backendMaps.map(m => ({
        id: m.id,
        title: m.title,
        updatedAt: m.updated_at,
        nodes: m.nodes,
        edges: m.edges
      }));
      
      const localMaps = await loadLocalMaps();
      // Merge or prefer backend for now
      const merged = sortMapsByUpdatedAt([...formattedBackendMaps, ...localMaps.filter(lm => typeof lm.id === 'string')]);
      setSavedMaps(merged);
      return merged;
    } catch (error) {
      console.error('Failed to sync with backend:', error);
      const localMaps = await loadLocalMaps();
      const ordered = sortMapsByUpdatedAt(localMaps);
      setSavedMaps(ordered);
      return ordered;
    }
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const maps = await syncWithBackend();

        if (maps.length > 0) {
          const latest = maps[0];
          setLoadGraph({ nodes: latest.nodes, edges: latest.edges });
          setLoadVersion(1);
          setSelectedMapId(latest.id);
          setTitle(latest.title);
          setStatus(`Loaded most recent map: ${latest.title}`);
        } else {
          setStatus('Ready');
        }
      } catch (error) {
        setStatus(
          `Initialization error: ${error instanceof Error ? error.message : 'Unexpected error.'}`
        );
      } finally {
        hydratedRef.current = true;
        setIsHydrated(true);
      }
    };

    void hydrate();
  }, [syncWithBackend]);

  const createNewMap = useCallback(async () => {
    const empty = createEmptyMap();
    
    let nextTitle = 'Mind Map 1';
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
    nextTitle = `Mind Map ${maxNumber + 1}`;

    try {
      const created = await createMindMap({
        title: nextTitle,
        nodes: empty.nodes,
        edges: empty.edges
      });
      
      const newMap: StoredMindMap = {
        id: created.id,
        title: created.title,
        updatedAt: created.updated_at,
        nodes: created.nodes,
        edges: created.edges
      };

      setSavedMaps(current => sortMapsByUpdatedAt([newMap, ...current]));
      setSelectedMapId(created.id);
      setTitle(created.title);
      requestLoadGraph(empty);
      setStatus('Created new map on server.');
    } catch (error) {
      console.error('Failed to create on backend, falling back to local:', error);
      const id = crypto.randomUUID();
      setSelectedMapId(id);
      setTitle(nextTitle);
      requestLoadGraph(empty);
      setStatus('Started new local mind map (Server unreachable).');
    }
  }, [requestLoadGraph, savedMaps]);

  const loadSavedMapById = useCallback(
    (mapId: string | number) => {
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
    async (mapId: string | number, nextTitle: string) => {
      const map = savedMaps.find(m => m.id === mapId);
      if (!map) return;

      setSavedMaps((current) => {
        const updated = current.map((m) => (m.id === mapId ? { ...m, title: nextTitle } : m));
        // Also save to local if it was a local map
        if (typeof mapId === 'string') {
          void saveLocalMaps(updated.filter(m => typeof m.id === 'string'));
        }
        return updated;
      });

      if (selectedMapId === mapId) {
        setTitle(nextTitle);
      }

      if (typeof mapId === 'number') {
        try {
          await updateMindMap(mapId, { title: nextTitle });
          setStatus(`Renamed map to "${nextTitle}" on server.`);
        } catch (error) {
          setStatus(`Renamed locally, but server update failed.`);
        }
      } else {
        setStatus(`Renamed local map to "${nextTitle}".`);
      }
    },
    [savedMaps, selectedMapId]
  );

  const deleteSavedMap = useCallback(
    async (mapId: string | number) => {
      const remaining = savedMaps.filter((map) => map.id !== mapId);
      setSavedMaps(remaining);

      if (typeof mapId === 'number') {
        try {
          await deleteMindMap(mapId);
        } catch (error) {
          console.error('Failed to delete from server:', error);
        }
      } else {
        await saveLocalMaps(remaining.filter(m => typeof m.id === 'string'));
      }

      if (selectedMapId === mapId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          requestLoadGraph({ nodes: next.nodes, edges: next.edges });
          setSelectedMapId(next.id);
          setTitle(next.title);
          setStatus(`Loaded map: ${next.title}`);
        } else {
          await createNewMap();
        }
      } else {
        setStatus('Deleted saved map.');
      }
    },
    [createNewMap, requestLoadGraph, savedMaps, selectedMapId]
  );

  const persistAutosave = useCallback(
    async (params: { nodes: MindModelNode[]; edges: Edge[]; mapId: string | number | null }) => {
      const id = params.mapId;
      if (id === null) return; // Should have an ID by now

      const selectedSavedMap = savedMaps.find((item) => item.id === id);
      const effectiveTitle = selectedSavedMap?.title ?? (title.trim() || 'Untitled Mind Map');

      if (typeof id === 'number') {
        try {
          const updated = await updateMindMap(id, {
            nodes: params.nodes,
            edges: params.edges
          });
          
          setSavedMaps((current) => {
            const nextMap: StoredMindMap = {
              id: updated.id,
              title: updated.title,
              updatedAt: updated.updated_at,
              nodes: updated.nodes,
              edges: updated.edges
            };
            return upsertMap(current, nextMap);
          });
          setStatus('Auto-saved to server.');
        } catch (error) {
          setStatus('Server auto-save failed.');
        }
      } else {
        // Local only
        const map: StoredMindMap = {
          id,
          title: effectiveTitle,
          updatedAt: new Date().toISOString(),
          nodes: params.nodes,
          edges: params.edges
        };

        setSavedMaps((current) => {
          const updated = upsertMap(current, map);
          void saveLocalMaps(updated.filter(m => typeof m.id === 'string'));
          return updated;
        });
        setStatus('Auto-saved locally.');
      }
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
