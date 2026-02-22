import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  addChildNode,
  createBranchColorLookup,
  getTraversalOrder,
  removeNodeAndAdoptChildren,
  type MindModelNode
} from './graphOps';

function node(id: string, label: string, position: { x: number; y: number }): MindModelNode {
  return {
    id,
    type: 'mind',
    position,
    data: { label }
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target, type: 'smoothstep' };
}

describe('graphOps', () => {
  it('adds a child node with a deterministic id and links it to the parent', () => {
    const nodes: MindModelNode[] = [node('root', 'Root', { x: 600, y: 400 })];
    const edges: Edge[] = [];

    const next = addChildNode({
      nodes,
      edges,
      parentId: 'root',
      canvasWidth: 1200,
      canvasHeight: 800,
      createNodeId: () => 'child-1'
    });

    expect(next.newNodeId).toBe('child-1');
    expect(next.nodes.some((item) => item.id === 'child-1')).toBe(true);
    expect(next.edges).toEqual([edge('root', 'child-1')]);
  });

  it('removes a node and adopts its children to the parent', () => {
    const nodes: MindModelNode[] = [
      node('root', 'Root', { x: 0, y: 0 }),
      node('a', 'A', { x: 0, y: 10 }),
      node('b', 'B', { x: 0, y: 20 }),
      node('c', 'C', { x: 0, y: 30 }),
      node('d', 'D', { x: 0, y: 40 })
    ];
    const edges: Edge[] = [edge('root', 'a'), edge('a', 'b'), edge('a', 'c'), edge('root', 'd')];

    const next = removeNodeAndAdoptChildren({ nodes, edges, nodeId: 'a' });

    expect(next.nodes.map((item) => item.id).sort()).toEqual(['b', 'c', 'd', 'root']);
    expect(next.edges.map((item) => item.id).sort()).toEqual(['root-b', 'root-c', 'root-d']);
    expect(next.selectedAfterDeleteId).toBe('root');
  });

  it('creates a deterministic traversal order based on y position', () => {
    const nodes: MindModelNode[] = [
      node('root', 'Root', { x: 0, y: 0 }),
      node('a', 'A', { x: 0, y: 100 }),
      node('b', 'B', { x: 0, y: 10 }),
      node('c', 'C', { x: 0, y: 50 })
    ];
    const edges: Edge[] = [edge('root', 'a'), edge('root', 'b'), edge('root', 'c')];

    expect(getTraversalOrder(nodes, edges)).toEqual(['root', 'b', 'c', 'a']);
  });

  it('assigns branch colors based on root ordering', () => {
    const nodes: MindModelNode[] = [
      node('root', 'Root', { x: 0, y: 0 }),
      node('a', 'A', { x: 0, y: 100 }),
      node('b', 'B', { x: 0, y: 10 })
    ];
    const edges: Edge[] = [edge('root', 'a'), edge('root', 'b')];

    const lookup = createBranchColorLookup(nodes, edges, ['#aa0000', '#00aa00']);
    expect(lookup.get('root')).toBe('#111827');
    expect(lookup.get('b')).toBe('#aa0000');
    expect(lookup.get('a')).toBe('#00aa00');
  });
});

