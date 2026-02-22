export type MindVisualStyle = 'boxed' | 'branch';

export type MindNodeData = {
  label: string;
  editing?: boolean;
  color?: string;
  visualStyle?: MindVisualStyle;
  onChangeLabel?: (nodeId: string, nextLabel: string) => void;
  onStartEdit?: (nodeId: string) => void;
  onCommitEdit?: (nodeId: string) => void;
};

export type OutlineItem = {
  text: string;
  depth: number;
};
