import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState
} from '@xyflow/react';
import MindMapNode from './MindMapNode';
import type { MindNodeData, MindVisualStyle } from '../types';

type MindMapEditorProps = {
  nodes: Node<MindNodeData>[];
  edges: Edge[];
  graphVersion: number;
  onSnapshotReady: (container: HTMLElement | null) => void;
  onStateChange: (nodes: Node<MindNodeData>[], edges: Edge[]) => void;
  onExportPng: () => void;
  onExportDoc: () => void;
};

const CHILD_X_OFFSET = 260;
const CHILD_Y_OFFSET = 105;
const BRANCH_COLORS = ['#1f5ce1', '#03a66a', '#c26000', '#ab47bc', '#0d7a88', '#d83b4e'];

const initialNodes: Node<MindNodeData>[] = [
  {
    id: 'root',
    type: 'mind',
    position: { x: 40, y: 40 },
    selected: true,
    data: { label: 'Central Idea' }
  }
];

const initialEdges: Edge[] = [];

const nodeTypes = {
  mind: MindMapNode
};

function getParentId(nodeId: string, edges: Edge[]): string | null {
  return edges.find((edge) => edge.target === nodeId)?.source ?? null;
}

function getChildrenOf(parentId: string, edges: Edge[]): string[] {
  return edges.filter((edge) => edge.source === parentId).map((edge) => edge.target);
}

function getTraversalOrder(nodes: Node<MindNodeData>[], edges: Edge[]): string[] {
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

function collectSubtree(nodeId: string, edges: Edge[]): Set<string> {
  const childrenMap = new Map<string, string[]>();

  edges.forEach((edge) => {
    const children = childrenMap.get(edge.source) ?? [];
    children.push(edge.target);
    childrenMap.set(edge.source, children);
  });

  const targets = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || targets.has(current)) {
      continue;
    }

    targets.add(current);
    const children = childrenMap.get(current) ?? [];
    children.forEach((child) => queue.push(child));
  }

  return targets;
}

function computeNewChildPosition(
  parentId: string,
  nodes: Node<MindNodeData>[],
  edges: Edge[],
  direction: 'left' | 'right'
): { x: number; y: number } {
  const parentNode = nodes.find((node) => node.id === parentId);
  if (!parentNode) {
    return { x: 0, y: 0 };
  }

  const children = getChildrenOf(parentId, edges)
    .map((childId) => nodes.find((node) => node.id === childId))
    .filter((node): node is Node<MindNodeData> => Boolean(node))
    .sort((a, b) => a.position.y - b.position.y);

  const sign = direction === 'left' ? -1 : 1;
  const x = parentNode.position.x + sign * CHILD_X_OFFSET;
  const y =
    children.length === 0
      ? parentNode.position.y
      : children[children.length - 1].position.y + CHILD_Y_OFFSET;

  return { x, y };
}

function createBranchColorLookup(nodes: Node<MindNodeData>[], edges: Edge[]): Map<string, string> {
  const targets = new Set(edges.map((edge) => edge.target));
  const root = nodes.find((node) => !targets.has(node.id)) ?? nodes[0];
  const lookup = new Map<string, string>();

  if (!root) {
    return lookup;
  }

  lookup.set(root.id, '#111827');

  const rootChildren = getChildrenOf(root.id, edges)
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Node<MindNodeData> => Boolean(node))
    .sort((a, b) => a.position.y - b.position.y);

  const parentByNode = new Map<string, string>();
  edges.forEach((edge) => {
    parentByNode.set(edge.target, edge.source);
  });

  rootChildren.forEach((childNode, index) => {
    lookup.set(childNode.id, BRANCH_COLORS[index % BRANCH_COLORS.length]);
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
      lookup.set(node.id, lookup.get(current) ?? BRANCH_COLORS[0]);
    } else {
      lookup.set(node.id, '#1f5ce1');
    }
  });

  return lookup;
}

export default function MindMapEditor({
  nodes: externalNodes,
  edges: externalEdges,
  graphVersion,
  onSnapshotReady,
  onStateChange,
  onExportPng,
  onExportDoc
}: MindMapEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeData>(
    externalNodes.length > 0 ? externalNodes : initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(externalEdges.length > 0 ? externalEdges : initialEdges);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [visualStyle, setVisualStyle] = useState<MindVisualStyle>('boxed');
  const [growthDirection, setGrowthDirection] = useState<'left' | 'right'>('right');
  const [showHelp, setShowHelp] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onSnapshotReady(canvasRef.current);
  }, [onSnapshotReady]);

  useEffect(() => {
    if (graphVersion === 0) {
      return;
    }

    if (externalNodes.length === 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    } else {
      setNodes(externalNodes);
      setEdges(externalEdges);
    }

    setEditingNodeId(null);
    setPendingFocusNodeId(null);
  }, [externalEdges, externalNodes, graphVersion, setEdges, setNodes]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pendingFocusNodeId || editingNodeId !== pendingFocusNodeId) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const focusInput = () => {
      if (cancelled) {
        return;
      }

      const input = canvasRef.current?.querySelector<HTMLInputElement>(
        `[data-node-input-id="${pendingFocusNodeId}"]`
      );

      if (input) {
        input.focus();
        input.select();
        setPendingFocusNodeId(null);
        return;
      }

      attempts += 1;
      if (attempts < 6) {
        window.setTimeout(focusInput, 16);
      }
    };

    focusInput();

    return () => {
      cancelled = true;
    };
  }, [editingNodeId, pendingFocusNodeId]);

  const selectedNodeId = useMemo(
    () => nodes.find((node) => node.selected)?.id ?? nodes[0]?.id ?? null,
    [nodes]
  );

  const selectNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: node.id === nodeId
        }))
      );
    },
    [setNodes]
  );

  const commitEdit = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: node.data.label.trim() || 'New Topic'
                }
              }
            : node
        )
      );
      setEditingNodeId((current) => (current === nodeId ? null : current));
    },
    [setNodes]
  );

  const updateLabel = useCallback(
    (nodeId: string, nextLabel: string) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  label: nextLabel
                }
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const addChild = useCallback(
    (parentId: string, startEditing: boolean) => {
      const newId = `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const position = computeNewChildPosition(parentId, nodes, edges, growthDirection);

      const newNode: Node<MindNodeData> = {
        id: newId,
        type: 'mind',
        selected: true,
        data: { label: 'New Topic' },
        position
      };

      setNodes((currentNodes) =>
        currentNodes.map((node) => ({ ...node, selected: false })).concat(newNode)
      );
      setEdges((currentEdges) =>
        currentEdges.concat({
          id: `${parentId}-${newId}`,
          source: parentId,
          target: newId,
          type: 'smoothstep'
        })
      );

      if (startEditing) {
        setEditingNodeId(newId);
        setPendingFocusNodeId(newId);
      }
    },
    [edges, growthDirection, nodes, setEdges, setNodes]
  );

  const addSibling = useCallback(
    (nodeId: string, startEditing: boolean) => {
      const parentId = getParentId(nodeId, edges);
      if (!parentId) {
        return;
      }

      addChild(parentId, startEditing);
    },
    [addChild, edges]
  );

  const removeSelected = useCallback(() => {
    if (!selectedNodeId || selectedNodeId === 'root') {
      return;
    }

    const parentId = getParentId(selectedNodeId, edges);
    const subtree = collectSubtree(selectedNodeId, edges);

    const nextNodes = nodes.filter((node) => !subtree.has(node.id));
    const nextEdges = edges.filter(
      (edge) => !subtree.has(edge.source) && !subtree.has(edge.target)
    );

    setNodes(
      nextNodes.map((node) => ({
        ...node,
        selected: parentId ? node.id === parentId : node.id === nextNodes[0]?.id
      }))
    );
    setEdges(nextEdges);
    setEditingNodeId(null);
  }, [edges, nodes, selectedNodeId, setEdges, setNodes]);

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (nodes.length === 0) {
        return;
      }

      const order = getTraversalOrder(nodes, edges);
      if (order.length === 0) {
        return;
      }

      const currentId = selectedNodeId ?? order[0];
      const currentIndex = Math.max(0, order.indexOf(currentId));
      const nextIndex = Math.min(order.length - 1, Math.max(0, currentIndex + delta));
      selectNode(order[nextIndex]);
    },
    [edges, nodes, selectNode, selectedNodeId]
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('.toolbar')) {
        return;
      }

      const typingTarget =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          onExportDoc();
        } else {
          onExportPng();
        }
        return;
      }

      if (typingTarget) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (selectedNodeId) {
          addChild(selectedNodeId, true);
        }
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        if (!selectedNodeId) {
          return;
        }
        addSibling(selectedNodeId, true);
        return;
      }

      if (event.key === 'F2' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e')) {
        event.preventDefault();
        if (selectedNodeId) {
          setEditingNodeId(selectedNodeId);
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
      }
    },
    [addChild, addSibling, moveSelection, onExportDoc, onExportPng, removeSelected, selectedNodeId]
  );

  useEffect(() => {
    onStateChange(nodes, edges);
  }, [edges, nodes, onStateChange]);

  const colorLookup = useMemo(() => createBranchColorLookup(nodes, edges), [edges, nodes]);

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        type: 'mind',
        data: {
          ...node.data,
          editing: editingNodeId === node.id,
          visualStyle,
          color: colorLookup.get(node.id),
          onChangeLabel: updateLabel,
          onStartEdit: (id: string) => {
            selectNode(id);
            setEditingNodeId(id);
          },
          onCommitEdit: commitEdit
        }
      })),
    [colorLookup, commitEdit, editingNodeId, nodes, selectNode, updateLabel, visualStyle]
  );

  const displayEdges = useMemo(() => {
    const isBranch = visualStyle === 'branch';

    return edges.map((edge) => {
      const edgeColor = colorLookup.get(edge.target) ?? '#1f5ce1';
      return {
        ...edge,
        type: isBranch ? 'bezier' : 'smoothstep',
        animated: false,
        style: {
          stroke: edgeColor,
          strokeWidth: isBranch ? 3 : 2
        }
      };
    });
  }, [colorLookup, edges, visualStyle]);

  return (
    <div className="editor-shell" onKeyDown={handleEditorKeyDown} tabIndex={0} ref={editorRef}>
      <div className="toolbar">
        <button
          type="button"
          onClick={() => {
            if (selectedNodeId) {
              addChild(selectedNodeId, true);
            }
          }}
        >
          Add Child (Enter)
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedNodeId) {
              addSibling(selectedNodeId, true);
            }
          }}
        >
          Add Sibling (Tab)
        </button>
        <button type="button" onClick={() => setShowHelp((current) => !current)} aria-label="Help">
          ?
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedNodeId) {
              setEditingNodeId(selectedNodeId);
            }
          }}
        >
          Rename (F2)
        </button>
        <button type="button" onClick={removeSelected}>
          Delete (Del)
        </button>
        <label className="toolbar-field">
          Style
          <select
            value={visualStyle}
            onChange={(event) => setVisualStyle(event.target.value as MindVisualStyle)}
          >
            <option value="boxed">Boxed</option>
            <option value="branch">Branch</option>
          </select>
        </label>
        <label className="toolbar-field">
          Growth
          <select
            value={growthDirection}
            onChange={(event) => setGrowthDirection(event.target.value as 'left' | 'right')}
          >
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </label>
      </div>
      {showHelp ? (
        <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts">
          <strong>Shortcuts</strong>
          <span><code>Enter</code>: Add child</span>
          <span><code>Tab</code>: Add sibling</span>
          <span><code>F2</code> or <code>Ctrl/Cmd+E</code>: Rename</span>
          <span><code>Delete</code>/<code>Backspace</code>: Delete selected subtree</span>
          <span><code>ArrowUp</code>/<code>ArrowDown</code>: Move selection</span>
          <span><code>Ctrl/Cmd+S</code>: Export PNG</span>
          <span><code>Ctrl/Cmd+Shift+S</code>: Export Google Doc</span>
        </div>
      ) : null}
      <div className="editor-canvas" ref={canvasRef}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(connection) => {
            setEdges((currentEdges) => addEdge(connection, currentEdges));
          }}
          onNodeClick={(_, node) => {
            selectNode(node.id);
          }}
          nodeTypes={nodeTypes}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
