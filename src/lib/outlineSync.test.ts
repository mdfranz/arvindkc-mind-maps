import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { deriveOutlineDraft } from './outlineSync';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

function node(id: string, label: string, position: { x: number; y: number }): MindModelNode {
  return { id, type: 'mind', position, data: { label } };
}

describe('outlineSync', () => {
  it('returns the current draft when focused', () => {
    const nodes: MindModelNode[] = [node('root', 'Root', { x: 0, y: 0 })];
    const edges: Edge[] = [];

    expect(
      deriveOutlineDraft({
        nodes,
        edges,
        isFocused: true,
        currentDraft: '- Working Draft'
      })
    ).toBe('- Working Draft');
  });

  it('derives draft from the graph when not focused', () => {
    const nodes: MindModelNode[] = [
      node('root', 'Root', { x: 0, y: 0 }),
      node('a', 'A', { x: 0, y: 10 })
    ];
    const edges: Edge[] = [{ id: 'root-a', source: 'root', target: 'a' }];

    expect(
      deriveOutlineDraft({
        nodes,
        edges,
        isFocused: false,
        currentDraft: ''
      })
    ).toBe(`- Root\n  - A`);
  });

  it('falls back to a default outline when the graph is empty', () => {
    expect(
      deriveOutlineDraft({
        nodes: [],
        edges: [],
        isFocused: false,
        currentDraft: ''
      })
    ).toBe('- Central Idea');
  });
});

