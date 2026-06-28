import type { GraphNode } from '../../types';

export const MAP_VIEW_STORAGE_KEY = 'robot_map_view_settings';

export const NODE_R_DEFAULT = 8;
export const NODE_R_EDGE = 8;
export const NODE_R_ACTIVE = 9;

export const getNodeRadius = (
  isSelected: boolean,
  isDragging: boolean,
  isEdgeSelected: boolean,
) => {
  if (isSelected || isDragging) return NODE_R_ACTIVE;
  if (isEdgeSelected) return NODE_R_EDGE;
  return NODE_R_DEFAULT;
};

export const getNodeYaw = (node: GraphNode): number => node.yaw ?? 0;
