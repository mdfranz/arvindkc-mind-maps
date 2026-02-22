import { useEffect, useRef } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

type UseAutosaveParams = {
  enabled: boolean;
  blocked: boolean;
  nodes: MindModelNode[];
  edges: Edge[];
  selectedMapId: string | null;
  delayMs?: number;
  persist: (params: { nodes: MindModelNode[]; edges: Edge[]; mapId: string | null }) => void;
};

export default function useAutosave(params: UseAutosaveParams): void {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!params.enabled || params.blocked || params.nodes.length === 0) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      params.persist({ nodes: params.nodes, edges: params.edges, mapId: params.selectedMapId });
    }, params.delayMs ?? 700);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [
    params.blocked,
    params.delayMs,
    params.edges,
    params.enabled,
    params.nodes,
    params.persist,
    params.selectedMapId
  ]);
}

