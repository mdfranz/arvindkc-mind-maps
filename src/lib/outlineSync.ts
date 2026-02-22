import type { Edge, Node } from '@xyflow/react';
import { buildOutline, outlineToText } from './outline';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

export function deriveOutlineDraft(params: {
  nodes: MindModelNode[];
  edges: Edge[];
  isFocused: boolean;
  currentDraft: string;
}): string {
  if (params.isFocused) {
    return params.currentDraft;
  }

  const outline = buildOutline(params.nodes, params.edges);
  return outline.length > 0 ? outlineToText(outline) : '- Central Idea';
}

