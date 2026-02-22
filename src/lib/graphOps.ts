import type { Edge, Node } from '@xyflow/react';
import { chooseRootChildSide } from './layout';
import type { MindNodeModelData } from '../types';

export type MindModelNode = Node<MindNodeModelData, 'mind'>;

export function getRootId(nodes: MindModelNode[], edges: Edge[]): string | null {
  const targets = new Set(edges.map((edge) => edge.target));
  return (nodes.find((node) => !targets.has(node.id)) ?? nodes[0])?.id ?? null;
}

export function getParentId(nodeId: string, edges: Edge[]): string | null {
  return edges.find((edge) => edge.target === nodeId)?.source ?? null;
}

export function getChildrenOf(parentId: string, edges: Edge[]): string[] {
  return edges.filter((edge) => edge.source === parentId).map((edge) => edge.target);
}

export function getTraversalOrder(nodes: MindModelNode[], edges: Edge[]): string[] {
  const childrenMap = new Map<string, string[]>();
  const targets = new Set<string>();

  edges.forEach((edge) => {
    targets.add(edge.target);
    const children = childrenMap.get(edge.source) ?? [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => !targets.has(node.id));
  const visited = new Set<string>();
  const order: string[] = [];

  const walk = (id: string): void => {
    if (visited.has(id)) {
      return;
    }

    visited.add(id);
    order.push(id);

    const children = (childrenMap.get(id) ?? []).sort((aId, bId) => {
      const a = nodeMap.get(aId);
      const b = nodeMap.get(bId);
      if (!a || !b) {
        return 0;
      }
      return a.position.y - b.position.y;
    });

    children.forEach((childId) => walk(childId));
  };

  roots.forEach((root) => walk(root.id));

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      order.push(node.id);
    }
  });

  return order;
}

export function createBranchColorLookup(
  nodes: MindModelNode[],
  edges: Edge[],
  branchColors: string[]
): Map<string, string> {
  const targets = new Set(edges.map((edge) => edge.target));
  const root = nodes.find((node) => !targets.has(node.id)) ?? nodes[0];
  const lookup = new Map<string, string>();

  if (!root) {
    return lookup;
  }

  lookup.set(root.id, '#111827');

  const rootChildren = getChildrenOf(root.id, edges)
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is MindModelNode => Boolean(node))
    .sort((a, b) => a.position.y - b.position.y);

  const parentByNode = new Map<string, string>();
  edges.forEach((edge) => {
    parentByNode.set(edge.target, edge.source);
  });

  rootChildren.forEach((childNode, index) => {
    lookup.set(childNode.id, branchColors[index % branchColors.length]);
  });

  nodes.forEach((node) => {
    if (lookup.has(node.id)) {
      return;
    }

    let current = node.id;
    let parent = parentByNode.get(current);

    while (parent && parent !== root.id) {
      current = parent;
      parent = parentByNode.get(current);
    }

    if (parent === root.id) {
      lookup.set(node.id, lookup.get(current) ?? branchColors[0]);
    } else {
      lookup.set(node.id, branchColors[0]);
    }
  });

  return lookup;
}

export function addChildNode(params: {
  nodes: MindModelNode[];
  edges: Edge[];
  parentId: string;
  canvasWidth: number;
  canvasHeight: number;
  createNodeId: () => string;
}): { nodes: MindModelNode[]; edges: Edge[]; newNodeId: string } {
  const newId = params.createNodeId();
  const parentNode = params.nodes.find((node) => node.id === params.parentId);
  const rootId = getRootId(params.nodes, params.edges);
  const rootCenterX =
    params.nodes.find((node) => node.id === rootId)?.position.x ?? params.canvasWidth * 0.5;

  const side =
    params.parentId === rootId
      ? chooseRootChildSide(params.parentId, params.nodes, params.edges, params.canvasWidth, rootCenterX)
      : parentNode?.data.side === 'left'
        ? 'left'
        : 'right';

  const initialX =
    (parentNode?.position.x ?? params.canvasWidth * 0.5) + (side === 'left' ? -140 : 140);
  const initialY = parentNode?.position.y ?? params.canvasHeight * 0.5;

  const newNode: MindModelNode = {
    id: newId,
    type: 'mind',
    selected: true,
    data: { label: 'New Topic', side },
    position: { x: initialX, y: initialY }
  };

  const nextEdges = params.edges.concat({
    id: `${params.parentId}-${newId}`,
    source: params.parentId,
    target: newId,
    type: 'smoothstep'
  });

  const nextNodes = [...params.nodes.map((node) => ({ ...node, selected: false as const })), newNode];
  return { nodes: nextNodes, edges: nextEdges, newNodeId: newId };
}

export function removeNodeAndAdoptChildren(params: {
  nodes: MindModelNode[];
  edges: Edge[];
  nodeId: string;
}): { nodes: MindModelNode[]; edges: Edge[]; selectedAfterDeleteId: string | null } {
  const parentId = getParentId(params.nodeId, params.edges);
  const childIds = params.edges
    .filter((edge) => edge.source === params.nodeId)
    .map((edge) => edge.target);

  const nextNodes = params.nodes.filter((node) => node.id !== params.nodeId);
  const baseEdges = params.edges.filter(
    (edge) => edge.source !== params.nodeId && edge.target !== params.nodeId
  );

  const adoptedEdges =
    parentId === null
      ? []
      : childIds
          .filter(
            (childId) => !baseEdges.some((edge) => edge.source === parentId && edge.target === childId)
          )
          .map(
            (childId): Edge => ({
              id: `${parentId}-${childId}`,
              source: parentId,
              target: childId,
              type: 'smoothstep'
            })
          );

  const nextEdges = [...baseEdges, ...adoptedEdges];
  const selectedAfterDeleteId = parentId ?? nextNodes[0]?.id ?? null;

  return { nodes: nextNodes, edges: nextEdges, selectedAfterDeleteId };
}

