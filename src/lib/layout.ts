import type { Edge, Node } from '@xyflow/react';
import type { MindNodeData } from '../types';

const X_STEP = 280;
const Y_STEP = 120;

export function positionTree(
  nodes: Node<MindNodeData>[],
  edges: Edge[]
): Node<MindNodeData>[] {
  const childrenMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = childrenMap.get(edge.source) ?? [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  const targets = new Set(edges.map((edge) => edge.target));
  const roots = nodes.filter((node) => !targets.has(node.id));

  if (roots.length === 0) {
    return nodes;
  }

  const nextNodes = nodes.map((node) => ({ ...node }));
  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let row = 0;

  const walk = (nodeId: string, depth: number): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const node = nextNodeMap.get(nodeId);
    if (!node) {
      return;
    }

    node.position = { x: depth * X_STEP, y: row * Y_STEP };
    row += 1;

    const children = childrenMap.get(nodeId) ?? [];
    children.forEach((childId) => walk(childId, depth + 1));
  };

  roots.forEach((root) => walk(root.id, 0));

  nextNodes.forEach((node) => {
    if (!visited.has(node.id)) {
      node.position = { x: 0, y: row * Y_STEP };
      row += 1;
    }
  });

  return nextNodes;
}
