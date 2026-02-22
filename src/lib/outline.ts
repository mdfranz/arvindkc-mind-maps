import type { Edge, Node } from '@xyflow/react';
import { positionTree } from './layout';
import type { MindNodeModelData, OutlineItem } from '../types';

type MindFlowNode = Node<MindNodeModelData, 'mind'>;

export function buildOutline(nodes: MindFlowNode[], edges: Edge[]): OutlineItem[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childrenMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = childrenMap.get(edge.source) ?? [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  const targets = new Set(edges.map((edge) => edge.target));
  const roots = nodes.filter((node) => !targets.has(node.id));

  const outline: OutlineItem[] = [];

  const walk = (nodeId: string, depth: number): void => {
    const node = nodeMap.get(nodeId);

    if (!node) {
      return;
    }

    outline.push({ text: node.data.label, depth });

    const children = childrenMap.get(nodeId) ?? [];
    children.forEach((childId) => walk(childId, depth + 1));
  };

  roots.forEach((root) => walk(root.id, 0));

  return outline;
}

export function outlineToText(outline: OutlineItem[]): string {
  return outline.map((item) => `${'  '.repeat(item.depth)}- ${item.text}`).join('\n');
}

function parseOutlineLine(line: string): OutlineItem | null {
  if (!line.trim()) {
    return null;
  }

  const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';
  const tabDepth = [...leadingWhitespace].filter((char) => char === '\t').length;
  const spaceDepth = Math.floor([...leadingWhitespace].filter((char) => char === ' ').length / 2);
  const depth = tabDepth + spaceDepth;

  const text = line.trim().replace(/^[-*]\s+/, '').trim();
  if (!text) {
    return null;
  }

  return { text, depth };
}

export function parseOutlineText(outlineText: string): OutlineItem[] {
  const lines = outlineText.split('\n');
  const parsed = lines
    .map(parseOutlineLine)
    .filter((item): item is OutlineItem => Boolean(item));

  const normalized: OutlineItem[] = [];
  let previousDepth = 0;

  parsed.forEach((item, index) => {
    if (index === 0) {
      normalized.push({ ...item, depth: 0 });
      previousDepth = 0;
      return;
    }

    const nextDepth = Math.min(item.depth, previousDepth + 1);
    const forcedDepth = Math.max(1, nextDepth);
    normalized.push({ ...item, depth: forcedDepth });
    previousDepth = forcedDepth;
  });

  return normalized;
}

export function outlineToGraph(outline: OutlineItem[]): {
  nodes: MindFlowNode[];
  edges: Edge[];
} {
  if (outline.length === 0) {
    return {
      nodes: [
        {
          id: 'root',
          type: 'mind',
          selected: true,
          position: { x: 40, y: 40 },
          data: { label: 'Central Idea' }
        }
      ],
      edges: []
    };
  }

  const nodes: MindFlowNode[] = outline.map((item, index) => ({
    id: index === 0 ? 'root' : `node-${index}`,
    type: 'mind',
    selected: index === 0,
    position: { x: item.depth * 280 + 40, y: index * 105 + 40 },
    data: { label: item.text }
  }));

  const edges: Edge[] = [];
  const stack: { id: string; depth: number }[] = [];

  nodes.forEach((node, index) => {
    const depth = outline[index].depth;

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      edges.push({
        id: `${parent.id}-${node.id}`,
        source: parent.id,
        target: node.id,
        type: 'smoothstep'
      });
    }

    stack.push({ id: node.id, depth });
  });

  return {
    nodes: positionTree(nodes, edges).map((node) => ({
      ...node,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40
      }
    })),
    edges
  };
}
