import { useCallback, useEffect, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { outlineToGraph, parseOutlineText } from '../lib/outline';
import { deriveOutlineDraft } from '../lib/outlineSync';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

type UseOutlineParams = {
  nodes: MindModelNode[];
  edges: Edge[];
  onRequestLoadGraph: (graph: { nodes: MindModelNode[]; edges: Edge[] }) => void;
  onSetFocusOnLoad: (nextFocusOnLoad: boolean) => void;
};

export default function useOutline(params: UseOutlineParams): {
  outlineDraft: string;
  isOutlineFocused: boolean;
  handleOutlineChange: (nextText: string) => void;
  handleOutlineFocusChange: (isFocused: boolean) => void;
} {
  const [outlineDraft, setOutlineDraft] = useState('');
  const [isOutlineFocused, setIsOutlineFocused] = useState(false);

  useEffect(() => {
    setOutlineDraft((currentDraft) =>
      deriveOutlineDraft({
        nodes: params.nodes,
        edges: params.edges,
        isFocused: isOutlineFocused,
        currentDraft
      })
    );
  }, [params.edges, params.nodes, isOutlineFocused]);

  const handleOutlineChange = useCallback(
    (nextText: string) => {
      setOutlineDraft(nextText);

      const parsed = parseOutlineText(nextText);
      const graph = outlineToGraph(parsed);

      params.onSetFocusOnLoad(false);
      params.onRequestLoadGraph(graph);
    },
    [params.onRequestLoadGraph, params.onSetFocusOnLoad]
  );

  const handleOutlineFocusChange = useCallback((isFocused: boolean) => {
    setIsOutlineFocused(isFocused);
  }, []);

  return { outlineDraft, isOutlineFocused, handleOutlineChange, handleOutlineFocusChange };
}
