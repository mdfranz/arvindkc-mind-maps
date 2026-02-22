import type { Edge, Node } from '@xyflow/react';
import type { StoredMindMap } from './localStore';
import type { MindNodeModelData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

export function createEmptyMap(): { nodes: MindModelNode[]; edges: Edge[] } {
  return {
    nodes: [
      {
        id: 'root',
        type: 'mind',
        position: { x: 40, y: 40 },
        selected: true,
        data: { label: 'Central Idea' }
      }
    ],
    edges: []
  };
}

export function sortMapsByUpdatedAt(maps: StoredMindMap[]): StoredMindMap[] {
  return [...maps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertMap(maps: StoredMindMap[], map: StoredMindMap): StoredMindMap[] {
  const index = maps.findIndex((item) => item.id === map.id);
  const next = [...maps];

  if (index >= 0) {
    next[index] = map;
  } else {
    next.push(map);
  }

  return sortMapsByUpdatedAt(next);
}

export function formatRelativeTime(updatedAtIso: string, nowMs: number): string {
  const deltaMs = Math.max(0, nowMs - new Date(updatedAtIso).getTime());
  const seconds = Math.floor(deltaMs / 1000);

  if (seconds < 45) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
