import type { GraphNode, GraphData, Robot } from '../../types';

export interface RobotMapProps {
  robotName?: string;
  mapName?: string;
  robots?: Robot[];
  coordinateSystem?: {
    type: 'percentage' | 'coordinate';
    maxX?: number;
    maxY?: number;
  };
  enablePolygonDrawing?: boolean;
  /** Dashboard: restricted + docking. Graph Editor: docking only (no red zones). */
  enableDockingDrawing?: boolean;
  zonesReadOnly?: boolean;
  restrictedAreas?: RestrictedArea[];
  onRestrictedAreasChange?: (areas: RestrictedArea[]) => void;
  graphData?: GraphData;
  showGraph?: boolean;
  isGraphEditorMode?: boolean;
  onGraphDataChange?: (data: GraphData) => void;
  isAddingNode?: boolean;
  onNodeAdded?: () => void;
  selectedNodeForEdge?: string | null;
  onNodeSelectedForEdge?: (nodeId: string) => void;
  enableSendRobot?: boolean;
  sendRobotDisabled?: boolean;
  sendRobotDisabledReason?: string;
  onSendRobotToNode?: (node: GraphNode) => void | Promise<void>;
  sendRobotLoading?: boolean;
  onMapNotify?: (message: string, variant?: 'info' | 'error' | 'success') => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface RestrictedArea {
  id: string;
  name: string;
  startPoint?: Point;
  endPoint?: Point;
  polygonPoints?: number[];
  color: string;
  type: 'restricted' | 'docking-pallet' | 'polygon';
  zoneType?: 'restricted' | 'docking-pallet';
  isSelected?: boolean;
  mapName?: string;
}

export interface ProhibitedZone {
  _id: string;
  map_name: string;
  zone_name: string;
  zone_type: string;
  polygon_points: number[];
  timestamp: number;
}

export interface DockPoseEdit {
  x: number;
  y: number;
  width: number;
  height: number;
  yaw: number;
}

export interface PolygonCreationMode {
  isActive: boolean;
  type: 'restricted' | 'docking-pallet';
  startPoint?: Point;
}

export interface MapViewSettings {
  rotation: number;
  zoom: number;
  pan: { x: number; y: number };
}
