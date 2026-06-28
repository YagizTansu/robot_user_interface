export interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  type: string;
  description: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  cost: number;
  bidirectional: boolean;
  max_speed: number;
}

export interface DockingArea {
  id: string;
  name: string;
  x?: number;
  y?: number;
  yaw?: number;
  width?: number;
  height?: number;
  polygon_points: number[];
  assigned_node_id?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  docking_areas?: DockingArea[];
}

export interface GraphMeta {
  _id: string;
  graph_name: string;
  map_name: string;
  timestamp: number;
}

export interface GraphListItem {
  _id: string;
  graph_name?: string;
}

export interface GraphRecord extends GraphMeta {
  graph: GraphData;
}
