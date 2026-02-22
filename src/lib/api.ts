import type { Edge, Node } from '@xyflow/react';
import type { MindNodeModelData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type MindMap = {
  id: number;
  title: string;
  nodes: Node<MindNodeModelData, 'mind'>[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
};

export type MindMapCreate = {
  title: string;
  nodes: Node<MindNodeModelData, 'mind'>[];
  edges: Edge[];
};

export type MindMapUpdate = Partial<MindMapCreate>;

export async function listMindMaps(): Promise<MindMap[]> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/`);
  if (!response.ok) {
    throw new Error('Failed to fetch mind maps');
  }
  return response.json();
}

export async function getMindMap(id: number): Promise<MindMap> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch mind map');
  }
  return response.json();
}

export async function createMindMap(data: MindMapCreate): Promise<MindMap> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error('Failed to create mind map');
  }
  return response.json();
}

export async function updateMindMap(id: number, data: MindMapUpdate): Promise<MindMap> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error('Failed to update mind map');
  }
  return response.json();
}

export async function deleteMindMap(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete mind map');
  }
}

export async function exportMindMapToSql(id: number): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/mindmaps/${id}/export/sql`);
  if (!response.ok) {
    throw new Error('Failed to export mind map as SQL');
  }
  return response.text();
}
