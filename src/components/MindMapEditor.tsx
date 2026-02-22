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
import { positionTree } from '../lib/layout';
import {
  addChildNode,
  createBranchColorLookup,
  getParentId,
  getRootId,
  getTraversalOrder,
  removeNodeAndAdoptChildren
} from '../lib/graphOps';
import type { MindNodeModelData, MindNodeViewData, MindVisualStyle } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

type MindMapEditorProps = {
  loadGraph: { nodes: MindModelNode[]; edges: Edge[] } | null;
  loadVersion: number;
  organizeVersion: number;
  onCreateNewMap: () => void;
  onSnapshotReady: (container: HTMLElement | null) => void;
  onStateChange: (nodes: MindModelNode[], edges: Edge[]) => void;
  onExportPng: () => void;
  focusOnLoad?: boolean;
};

const BRANCH_COLORS = ['#1f5ce1', '#03a66a', '#c26000', '#ab47bc', '#0d7a88', '#d83b4e'];

const initialNodes: MindModelNode[] = [
  {
    id: 'root',
    type: 'mind',
    position: { x: 600, y: 360 },
    selected: true,
    data: { label: 'Central Idea', side: 'center' }
  }
];

const initialEdges: Edge[] = [];

const nodeTypes = {
  mind: MindMapNode
} as const;

export default function MindMapEditor({
  loadGraph,
  loadVersion,
  organizeVersion,
  onCreateNewMap,
  onSnapshotReady,
  onStateChange,
  onExportPng,
  focusOnLoad = true
}: MindMapEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindModelNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [visualStyle] = useState<MindVisualStyle>('branch');
  const editorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const didInitialLayoutRef = useRef(false);

  useEffect(() => {
    onSnapshotReady(canvasRef.current);
  }, [onSnapshotReady]);

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
      window.setTimeout(() => {
        editorRef.current?.focus();
      }, 0);
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

  const resolveEdgeHandles = useCallback(
    (
      sourceId: string,
      targetSide: 'left' | 'right',
      rootId: string | null
    ): Pick<Edge, 'sourceHandle' | 'targetHandle'> => {
      const sourceHandle =
        sourceId === rootId ? (targetSide === 'left' ? 'source-left' : 'source-right') : undefined;
      const targetHandle = targetSide === 'left' ? 'target-right' : 'target-left';
      return { sourceHandle, targetHandle };
    },
    []
  );

  const applyLayout = useCallback(
    (nextNodes: MindModelNode[], nextEdges: Edge[], selectedId: string | null) => {
      const { width, height } = canvasRef.current?.getBoundingClientRect() ?? { width: 1200, height: 720 };
      const arrangedNodes = positionTree(nextNodes, nextEdges, {
        centerX: width * 0.5,
        centerY: height * 0.5,
        canvasWidth: width
      }).map((node) => ({
        ...node,
        selected: selectedId ? node.id === selectedId : false
      }));

      const rootId = getRootId(arrangedNodes, nextEdges);
      const arrangedEdges = nextEdges.map((edge) => {
        const targetNode = arrangedNodes.find((node) => node.id === edge.target);
        const targetSide = targetNode?.data.side === 'left' ? 'left' : 'right';
        return {
          ...edge,
          ...resolveEdgeHandles(edge.source, targetSide, rootId)
        };
      });

      return { arrangedNodes, arrangedEdges };
    },
    [resolveEdgeHandles]
  );

  const addChild = useCallback(
    (parentId: string, startEditing: boolean) => {
      const { width, height } = canvasRef.current?.getBoundingClientRect() ?? { width: 1200, height: 720 };
      const next = addChildNode({
        nodes,
        edges,
        parentId,
        canvasWidth: width,
        canvasHeight: height,
        createNodeId: () => `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      });

      const { arrangedNodes, arrangedEdges } = applyLayout(next.nodes, next.edges, next.newNodeId);
      setNodes(arrangedNodes);
      setEdges(arrangedEdges);

      if (startEditing) {
        setEditingNodeId(next.newNodeId);
        setPendingFocusNodeId(next.newNodeId);
      }
    },
    [applyLayout, edges, nodes, setEdges, setNodes]
  );

  useEffect(() => {
    if (loadVersion === 0 || !loadGraph) {
      return;
    }

    const nextNodes = loadGraph.nodes.length > 0 ? loadGraph.nodes : initialNodes;
    const nextEdges = loadGraph.edges;
    const { arrangedNodes, arrangedEdges } = applyLayout(nextNodes, nextEdges, getRootId(nextNodes, nextEdges));
    setNodes(arrangedNodes);
    setEdges(arrangedEdges);
    setEditingNodeId(null);
    setPendingFocusNodeId(null);
    if (focusOnLoad) {
      window.setTimeout(() => {
        editorRef.current?.focus();
      }, 0);
    }
  }, [applyLayout, loadGraph, loadVersion, setEdges, setNodes, focusOnLoad]);

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

    const next = removeNodeAndAdoptChildren({ nodes, edges, nodeId: selectedNodeId });
    const { arrangedNodes, arrangedEdges } = applyLayout(next.nodes, next.edges, next.selectedAfterDeleteId);
    setNodes(arrangedNodes);
    setEdges(arrangedEdges);
    setEditingNodeId(null);
  }, [applyLayout, edges, nodes, selectedNodeId, setEdges, setNodes]);

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

  const organizeMap = useCallback(() => {
    if (nodes.length === 0) {
      return;
    }

    const rootId = getRootId(nodes, edges);
    const keepSelectedId = selectedNodeId ?? rootId;
    const { arrangedNodes, arrangedEdges } = applyLayout(nodes, edges, keepSelectedId);
    setNodes(arrangedNodes);
    setEdges(arrangedEdges);
    setEditingNodeId(null);
    setPendingFocusNodeId(null);
  }, [applyLayout, edges, nodes, selectedNodeId, setEdges, setNodes]);

  useEffect(() => {
    if (organizeVersion === 0) {
      return;
    }

    organizeMap();
  }, [organizeMap, organizeVersion]);

  useEffect(() => {
    if (didInitialLayoutRef.current || nodes.length === 0) {
      return;
    }

    didInitialLayoutRef.current = true;
    const rootId = getRootId(nodes, edges);
    const { arrangedNodes, arrangedEdges } = applyLayout(nodes, edges, rootId);
    setNodes(arrangedNodes);
    setEdges(arrangedEdges);
  }, [applyLayout, edges, nodes, setEdges, setNodes]);

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const typingTarget =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onExportPng();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onCreateNewMap();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        organizeMap();
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
    [addChild, addSibling, moveSelection, onExportPng, onCreateNewMap, organizeMap, removeSelected, selectedNodeId]
  );

  useEffect(() => {
    onStateChange(nodes, edges);
  }, [edges, nodes, onStateChange]);

  const colorLookup = useMemo(
    () => createBranchColorLookup(nodes, edges, BRANCH_COLORS),
    [edges, nodes]
  );

  const displayNodes = useMemo<MindModelNode[]>(
    () =>
      nodes.map((node) => {
        const viewData = {
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
        } satisfies MindNodeViewData;

        return {
          ...node,
          type: 'mind' as const,
          selected: node.selected ?? false,
          data: viewData as unknown as MindNodeModelData
        };
      }),
    [colorLookup, commitEdit, editingNodeId, nodes, selectNode, updateLabel, visualStyle]
  );

  const displayEdges = useMemo(() => {
    const isBranch = visualStyle === 'branch';

    return edges.map((edge) => {
      const edgeColor = colorLookup.get(edge.target) ?? '#1f5ce1';
      return {
        ...edge,
        type: isBranch ? 'default' : 'smoothstep',
        animated: false,
        pathOptions: isBranch ? undefined : { borderRadius: 14, offset: 20 },
        style: {
          stroke: edgeColor,
          strokeWidth: isBranch ? 3 : 2
        }
      };
    });
  }, [colorLookup, edges, visualStyle]);

  return (
    <div className="editor-shell" onKeyDown={handleEditorKeyDown} tabIndex={0} ref={editorRef}>
      <div className="editor-canvas" ref={canvasRef}>
        <ReactFlow<MindModelNode, Edge>
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          deleteKeyCode={null}
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
