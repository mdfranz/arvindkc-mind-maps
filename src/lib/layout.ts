import type { Edge, Node } from '@xyflow/react';
import type { MindBranchSide, MindNodeModelData } from '../types';

const BASE_X_STEP = 240;
const Y_STEP = 108;
const NODE_SLOT = 64;

type LayoutOptions = {
  centerX: number;
  centerY: number;
  canvasWidth: number;
};

type BranchCounts = {
  left: number;
  right: number;
};

function getRootId<T extends Node<MindNodeModelData>>(nodes: T[], edges: Edge[]): string | null {
  const targets = new Set(edges.map((edge) => edge.target));
  return (nodes.find((node) => !targets.has(node.id)) ?? nodes[0])?.id ?? null;
}

function getChildrenMap(edges: Edge[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    const children = childrenMap.get(edge.source) ?? [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });
  return childrenMap;
}

function getNodeMap<T extends Node<MindNodeModelData>>(nodes: T[]): Map<string, T> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function countSubtree(
  nodeId: string,
  childrenMap: Map<string, string[]>,
  memo: Map<string, number>
): number {
  const cached = memo.get(nodeId);
  if (cached) {
    return cached;
  }

  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    memo.set(nodeId, 1);
    return 1;
  }

  const total = 1 + children.reduce((sum, childId) => sum + countSubtree(childId, childrenMap, memo), 0);
  memo.set(nodeId, total);
  return total;
}

function subtreeSpan(
  nodeId: string,
  childrenMap: Map<string, string[]>,
  spanMemo: Map<string, number>
): number {
  const cached = spanMemo.get(nodeId);
  if (cached) {
    return cached;
  }

  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    spanMemo.set(nodeId, NODE_SLOT);
    return NODE_SLOT;
  }

  const childrenTotal = children.reduce((sum, childId) => sum + subtreeSpan(childId, childrenMap, spanMemo), 0);
  const total = Math.max(NODE_SLOT, childrenTotal + (children.length - 1) * 12);
  spanMemo.set(nodeId, total);
  return total;
}

function getDepth(nodeId: string, childrenMap: Map<string, string[]>, memo: Map<string, number>): number {
  const cached = memo.get(nodeId);
  if (cached) {
    return cached;
  }
  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    memo.set(nodeId, 1);
    return 1;
  }
  const depth = 1 + Math.max(...children.map((childId) => getDepth(childId, childrenMap, memo)));
  memo.set(nodeId, depth);
  return depth;
}

function computeXStep(
  canvasWidth: number,
  maxDepth: number,
  rootCenterX: number,
  hasLeft: boolean,
  hasRight: boolean
): number {
  const leftSpace = Math.max(180, rootCenterX - 80);
  const rightSpace = Math.max(180, canvasWidth - rootCenterX - 80);
  const sideDepth = Math.max(1, maxDepth - 1);

  if (hasLeft && hasRight) {
    return Math.max(150, Math.min(BASE_X_STEP, Math.min(leftSpace, rightSpace) / sideDepth));
  }

  if (hasLeft) {
    return Math.max(150, Math.min(BASE_X_STEP, leftSpace / sideDepth));
  }

  if (hasRight) {
    return Math.max(150, Math.min(BASE_X_STEP, rightSpace / sideDepth));
  }

  return BASE_X_STEP;
}

function placeSubtree<T extends Node<MindNodeModelData>>(
  nodeId: string,
  parentX: number,
  centerY: number,
  direction: -1 | 1,
  xStep: number,
  childrenMap: Map<string, string[]>,
  nodeMap: Map<string, T>,
  sideByNode: Map<string, MindBranchSide>,
  spanMemo: Map<string, number>
): void {
  const node = nodeMap.get(nodeId);
  if (!node) {
    return;
  }

  node.position = {
    x: parentX + direction * xStep,
    y: centerY
  };

  const side: MindBranchSide = direction === -1 ? 'left' : 'right';
  node.data = { ...node.data, side };
  sideByNode.set(nodeId, side);

  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    return;
  }

  const totalSpan = children.reduce((sum, childId) => sum + subtreeSpan(childId, childrenMap, spanMemo), 0);
  const totalWithGaps = totalSpan + (children.length - 1) * 12;
  let cursor = centerY - totalWithGaps / 2;

  children.forEach((childId) => {
    const childSpan = subtreeSpan(childId, childrenMap, spanMemo);
    const childCenter = cursor + childSpan / 2;
    placeSubtree(
      childId,
      node.position.x,
      childCenter,
      direction,
      xStep,
      childrenMap,
      nodeMap,
      sideByNode,
      spanMemo
    );
    cursor += childSpan + 12;
  });
}

export function chooseRootChildSide<T extends Node<MindNodeModelData>>(
  parentId: string,
  nodes: T[],
  edges: Edge[],
  canvasWidth: number,
  rootCenterX: number
): MindBranchSide {
  const rootId = getRootId(nodes, edges);
  if (!rootId || parentId !== rootId) {
    const parent = nodes.find((node) => node.id === parentId);
    return parent?.data.side === 'left' ? 'left' : 'right';
  }

  const childrenMap = getChildrenMap(edges);
  const rootChildren = childrenMap.get(rootId) ?? [];
  const subtreeMemo = new Map<string, number>();
  const sideLoads: BranchCounts = { left: 0, right: 0 };

  rootChildren.forEach((childId, index) => {
    const node = nodes.find((item) => item.id === childId);
    const preferred = node?.data.side;
    const side: MindBranchSide =
      preferred === 'left' || preferred === 'right' ? preferred : index % 2 === 0 ? 'right' : 'left';
    sideLoads[side] += countSubtree(childId, childrenMap, subtreeMemo);
  });

  const leftRoom = rootCenterX - 120;
  const rightRoom = canvasWidth - rootCenterX - 120;

  if (leftRoom < 170 && rightRoom > leftRoom) {
    return 'right';
  }
  if (rightRoom < 170 && leftRoom > rightRoom) {
    return 'left';
  }

  return sideLoads.left <= sideLoads.right ? 'left' : 'right';
}

export function positionTree<T extends Node<MindNodeModelData>>(
  nodes: T[],
  edges: Edge[],
  options?: LayoutOptions
): T[] {
  const rootId = getRootId(nodes, edges);
  if (!rootId) {
    return nodes;
  }

  const childrenMap = getChildrenMap(edges);
  const nodeMap = getNodeMap(nodes);
  const nextNodes = nodes.map((node) => ({ ...node })) as T[];
  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const root = nextNodeMap.get(rootId);
  if (!root) {
    return nodes;
  }

  const canvasWidth = options?.canvasWidth ?? 1200;
  const centerX = options?.centerX ?? canvasWidth / 2;
  const centerY = options?.centerY ?? 380;

  root.position = { x: centerX, y: centerY };
  root.data = { ...root.data, side: 'center' };

  const rootChildren = childrenMap.get(rootId) ?? [];
  const left: string[] = [];
  const right: string[] = [];
  rootChildren.forEach((childId, index) => {
    const sourceNode = nodeMap.get(childId);
    const side = sourceNode?.data.side;
    if (side === 'left') {
      left.push(childId);
      return;
    }
    if (side === 'right') {
      right.push(childId);
      return;
    }
    if (index % 2 === 0) {
      right.push(childId);
    } else {
      left.push(childId);
    }
  });

  const depthMemo = new Map<string, number>();
  const maxDepth = getDepth(rootId, childrenMap, depthMemo);
  const xStep = computeXStep(canvasWidth, maxDepth, centerX, left.length > 0, right.length > 0);
  const spanMemo = new Map<string, number>();
  const sideByNode = new Map<string, MindBranchSide>([[rootId, 'center']]);

  const placeSide = (branchIds: string[], direction: -1 | 1) => {
    if (branchIds.length === 0) {
      return;
    }

    const totalSpan = branchIds.reduce((sum, id) => sum + subtreeSpan(id, childrenMap, spanMemo), 0);
    const totalWithGaps = totalSpan + (branchIds.length - 1) * Y_STEP * 0.25;
    let cursor = centerY - totalWithGaps / 2;

    branchIds.forEach((branchId) => {
      const span = subtreeSpan(branchId, childrenMap, spanMemo);
      const y = cursor + span / 2;
      placeSubtree(
        branchId,
        centerX,
        y,
        direction,
        xStep,
        childrenMap,
        nextNodeMap,
        sideByNode,
        spanMemo
      );
      cursor += span + Y_STEP * 0.25;
    });
  };

  placeSide(left, -1);
  placeSide(right, 1);

  nextNodes.forEach((node) => {
    if (sideByNode.has(node.id)) {
      return;
    }
    node.data = { ...node.data, side: node.id === rootId ? 'center' : 'right' };
  });

  return nextNodes;
}
