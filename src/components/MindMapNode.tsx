import { memo, useEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { MindNodeModelData, MindNodeViewData } from '../types';

type MindModelNode = Node<MindNodeModelData, 'mind'>;

function MindMapNode({ id, data, selected }: NodeProps<MindModelNode>) {
  const viewData = data as MindNodeViewData;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewData.editing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [viewData.editing]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      viewData.onCommitEdit?.(id);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      viewData.onCommitEdit?.(id);
    }
  };

  const isBranch = viewData.visualStyle === 'branch';
  const color = viewData.color ?? '#1f5ce1';
  const side = viewData.side ?? 'right';

  const nodeStyle = {
    '--mind-color': color
  } as CSSProperties;

  const renderHandles = () => {
    if (side === 'center') {
      return (
        <>
          <Handle type="source" id="source-left" position={Position.Left} />
          <Handle type="source" id="source-right" position={Position.Right} />
          <Handle type="target" id="target-left" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
          <Handle type="target" id="target-right" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />
        </>
      );
    }

    if (side === 'left') {
      return (
        <>
          <Handle type="target" id="target-right" position={Position.Right} />
          <Handle type="source" id="source-left" position={Position.Left} />
        </>
      );
    }

    return (
      <>
        <Handle type="target" id="target-left" position={Position.Left} />
        <Handle type="source" id="source-right" position={Position.Right} />
      </>
    );
  };

  return (
    <div
      className={`mind-node ${selected ? 'is-selected' : ''} ${isBranch ? 'is-branch' : 'is-boxed'}`}
      style={nodeStyle}
    >
      {renderHandles()}
      {viewData.editing ? (
        <input
          ref={inputRef}
          data-node-input-id={id}
          autoFocus
          className={`mind-node-input nodrag ${isBranch ? 'is-branch' : ''}`}
          value={viewData.label}
          onChange={(event) => viewData.onChangeLabel?.(id, event.target.value)}
          onBlur={() => viewData.onCommitEdit?.(id)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          type="button"
          className={`mind-node-label ${isBranch ? 'is-branch' : ''}`}
          onDoubleClick={() => viewData.onStartEdit?.(id)}
        >
          {viewData.label}
        </button>
      )}
    </div>
  );
}

export default memo(MindMapNode);
