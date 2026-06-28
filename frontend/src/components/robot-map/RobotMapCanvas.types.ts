import type React from 'react';
import type { DockingArea, GraphData, GraphNode, MapData, Robot } from '../../types';
import type {
  Point,
  PolygonCreationMode,
  ProhibitedZone,
  RestrictedArea,
} from './types';

export type NormalizedDockingArea = Required<
  Pick<DockingArea, 'x' | 'y' | 'width' | 'height'>
> &
  DockingArea;

export type PlacingNodeState = { rosX: number; rosY: number; yaw: number };

export interface RobotMapCanvasProps {
  mapData: MapData | null;
  mapName?: string;
  graphData?: GraphData;
  showGraph: boolean;
  isGraphEditorMode: boolean;
  isAddingNode: boolean;
  placingNode: PlacingNodeState | null;
  polygonMode: PolygonCreationMode;
  mousePosition: Point;
  selectedNodeId: string | null;
  selectedNodeForEdge: string | null;
  draggingNodeId: string | null;
  rotatingNodeId: string | null;
  selectedAreaId: string | null;
  draggingDockingId: string | null;
  normalizedDockingAreas: NormalizedDockingArea[];
  allRenderableAreas: RestrictedArea[];
  zonesReadOnly: boolean;
  canEditDockingPose: boolean;
  robots: Robot[];
  selectedRobotId: string | null;
  restrictedAreas: RestrictedArea[];

  getSvgPoint: (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ) => { x: number; y: number };
  svgPointToRos: (svgP: { x: number; y: number }) => { x: number; y: number };
  convertGraphNodeToPixel: (node: GraphNode) => { x: number; y: number };
  convertRosToPixel: (rosX: number, rosY: number) => { x: number; y: number };
  convertToPixel: (position: { x: number; y: number }) => { x: number; y: number };
  getAssignedDockingArea: (nodeId: string) => DockingArea | undefined;

  setPlacingNode: React.Dispatch<React.SetStateAction<PlacingNodeState | null>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setDraggingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setDragOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRobotId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingNode: React.Dispatch<React.SetStateAction<GraphNode | null>>;
  setRotatingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setDraggingDockingId: React.Dispatch<React.SetStateAction<string | null>>;
  setRotatingDockingId: React.Dispatch<React.SetStateAction<string | null>>;
  setPolygonMode: React.Dispatch<React.SetStateAction<PolygonCreationMode>>;

  stopPolygonCreation: () => void;
  saveAreaToDatabase: (area: RestrictedArea) => Promise<ProhibitedZone | null>;
  selectArea: (areaId: string) => void;
  closeNodePanel: () => void;

  onGraphDataChange?: (data: GraphData) => void;
  onRestrictedAreasChange?: (areas: RestrictedArea[]) => void;
  onNodeSelectedForEdge?: (nodeId: string) => void;
}
