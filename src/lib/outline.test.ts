import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { buildOutline, outlineToGraph, outlineToText, parseOutlineText } from './outline';
import type { MindNodeModelData, OutlineItem } from '../types';

type MindFlowNode = Node<MindNodeModelData, 'mind'>;

describe('outline', () => {
  it('normalizes outline indentation so depth cannot jump by more than 1', () => {
    const parsed = parseOutlineText(`- Root
      - Child
            - Too Deep
  - Sibling`);

    expect(parsed.map((item) => item.depth)).toEqual([0, 1, 2, 1]);
  });

  it('serializes an outline back to markdown-ish text', () => {
    const outline: OutlineItem[] = [
      { text: 'Root', depth: 0 },
      { text: 'Child', depth: 1 }
    ];

    expect(outlineToText(outline)).toBe(`- Root\n  - Child`);
  });

  it('converts outline items into a connected graph', () => {
    const outline: OutlineItem[] = [
      { text: 'Root', depth: 0 },
      { text: 'A', depth: 1 },
      { text: 'B', depth: 1 },
      { text: 'B.1', depth: 2 }
    ];

    const graph = outlineToGraph(outline);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(graph.nodes[0].id).toBe('root');
  });

  it('builds an outline from nodes and edges', () => {
    const nodes: MindFlowNode[] = [
      { id: 'root', type: 'mind', position: { x: 0, y: 0 }, data: { label: 'Root' } },
      { id: 'a', type: 'mind', position: { x: 0, y: 10 }, data: { label: 'A' } },
      { id: 'b', type: 'mind', position: { x: 0, y: 20 }, data: { label: 'B' } }
    ];

    const edges: Edge[] = [
      { id: 'root-a', source: 'root', target: 'a' },
      { id: 'root-b', source: 'root', target: 'b' }
    ];

    expect(buildOutline(nodes, edges)).toEqual([
      { text: 'Root', depth: 0 },
      { text: 'A', depth: 1 },
      { text: 'B', depth: 1 }
    ]);
  });
});
