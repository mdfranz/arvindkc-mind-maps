export type MindVisualStyle = 'boxed' | 'branch';
export type MindBranchSide = 'left' | 'right' | 'center';

export type MindNodeModelData = {
  label: string;
  side?: MindBranchSide;
};

export type MindNodeViewData = MindNodeModelData & {
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
