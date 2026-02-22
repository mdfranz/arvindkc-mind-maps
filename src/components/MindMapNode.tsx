import { memo, useEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { MindNodeData } from '../types';

function MindMapNode({ id, data, selected }: NodeProps<MindNodeData>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data.editing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [data.editing]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      data.onCommitEdit?.(id);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      data.onCommitEdit?.(id);
    }
  };

  const isBranch = data.visualStyle === 'branch';
  const color = data.color ?? '#1f5ce1';

  const nodeStyle = {
    '--mind-color': color
  } as CSSProperties;

  return (
    <div
      className={`mind-node ${selected ? 'is-selected' : ''} ${isBranch ? 'is-branch' : 'is-boxed'}`}
      style={nodeStyle}
    >
      <Handle type="target" position={Position.Left} />
      {data.editing ? (
        <input
          ref={inputRef}
          data-node-input-id={id}
          autoFocus
          className={`mind-node-input nodrag ${isBranch ? 'is-branch' : ''}`}
          value={data.label}
          onChange={(event) => data.onChangeLabel?.(id, event.target.value)}
          onBlur={() => data.onCommitEdit?.(id)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          type="button"
          className={`mind-node-label ${isBranch ? 'is-branch' : ''}`}
          onDoubleClick={() => data.onStartEdit?.(id)}
        >
          {data.label}
        </button>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(MindMapNode);
