import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { chooseRootChildSide, positionTree } from './layout';
import type { MindNodeModelData } from '../types';

type MindFlowNode = Node<MindNodeModelData, 'mind'>;

function node(id: string, label: string): MindFlowNode {
  return {
    id,
    type: 'mind',
    position: { x: 0, y: 0 },
    data: { label }
  };
}

function edge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target
  };
}

describe('layout', () => {
  it('positions the root at the provided center and assigns sides', () => {
    const nodes: MindFlowNode[] = [node('root', 'Root'), node('a', 'A'), node('b', 'B')];
    const edges: Edge[] = [edge('root', 'a'), edge('root', 'b')];

    const arranged = positionTree(nodes, edges, { centerX: 600, centerY: 400, canvasWidth: 1200 });
    const arrangedRoot = arranged.find((item) => item.id === 'root');
    const arrangedA = arranged.find((item) => item.id === 'a');
    const arrangedB = arranged.find((item) => item.id === 'b');

    expect(arrangedRoot?.position).toEqual({ x: 600, y: 400 });
    expect(arrangedRoot?.data.side).toBe('center');
    expect(arrangedA?.data.side).toMatch(/left|right/);
    expect(arrangedB?.data.side).toMatch(/left|right/);
  });

  it('defaults to placing a first root child on the left when balanced', () => {
    const nodes: MindFlowNode[] = [node('root', 'Root')];
    const edges: Edge[] = [];

    const side = chooseRootChildSide('root', nodes, edges, 1200, 600);
    expect(side).toBe('left');
  });
});
