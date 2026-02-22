type OutlinePanelProps = {
  collapsed: boolean;
  width: number;
  outlineDraft: string;
  onToggleCollapsed: () => void;
  onCopyOutline: () => void;
  onOutlineChange: (nextValue: string) => void;
  onOutlineFocusChange: (isFocused: boolean) => void;
};

export default function OutlinePanel(props: OutlinePanelProps) {
  return (
    <aside
      className={`side-panel right-panel ${props.collapsed ? 'is-collapsed' : ''}`}
      style={props.collapsed ? undefined : { width: props.width }}
    >
      <div className="side-header">
        {!props.collapsed ? <h2>Outline</h2> : null}
        <button
          type="button"
          className="collapse-btn"
          onClick={props.onToggleCollapsed}
          aria-label={props.collapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {props.collapsed ? '‹' : '›'}
        </button>
      </div>

      {!props.collapsed ? (
        <div className="side-content">
          <div className="outline-head">
            <h3>Markdown</h3>
            <button
              type="button"
              className="outline-copy"
              title="Copy outline"
              aria-label="Copy outline"
              onClick={props.onCopyOutline}
            >
              ⧉
            </button>
          </div>
          <textarea
            className="outline-editor"
            value={props.outlineDraft}
            onChange={(event) => props.onOutlineChange(event.target.value)}
            onFocus={() => props.onOutlineFocusChange(true)}
            onBlur={() => props.onOutlineFocusChange(false)}
            aria-label="Edit Markdown Outline"
            spellCheck={false}
          />
        </div>
      ) : null}
    </aside>
  );
}

