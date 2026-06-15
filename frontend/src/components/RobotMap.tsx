import React, { useState, useEffect, useRef } from 'react';
import '../styles/RobotMap.css';
import { BACKEND_URL } from '../config';

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  orientation: number;
  status: string;
  battery: number;
  currentTask?: string;
  speed?: number;
  temperature?: number;
}

interface MapData {
  map_name: string;
  image_png_base64: string;
  width_px: number;
  height_px: number;
  resolution: number;
  origin: number[]; // [x, y, theta]
}

interface RobotMapProps {
  robotName?: string;
  mapName?: string;
  robots?: Robot[];
  coordinateSystem?: {
    type: 'percentage' | 'coordinate';
    maxX?: number;
    maxY?: number;
  };
  enablePolygonDrawing?: boolean;
  restrictedAreas?: RestrictedArea[];
  onRestrictedAreasChange?: (areas: RestrictedArea[]) => void;
  graphData?: GraphData;
  showGraph?: boolean;
  // Graph editing props
  isGraphEditorMode?: boolean;
  onGraphDataChange?: (data: GraphData) => void;
  isAddingNode?: boolean;
  onNodeAdded?: () => void;
  selectedNodeForEdge?: string | null;
  onNodeSelectedForEdge?: (nodeId: string) => void;
  enableSendRobot?: boolean;
  onSendRobotToNode?: (node: GraphNode) => void | Promise<void>;
  sendRobotLoading?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface RestrictedArea {
  id: string;
  name: string;
  startPoint?: Point;
  endPoint?: Point;
  polygonPoints?: number[]; // ROS koordinatları [x1, y1, x2, y2, ...]
  color: string;
  type: 'restricted' | 'docking-pallet' | 'polygon';
  zoneType?: 'restricted' | 'docking-pallet';
  isSelected?: boolean;
  mapName?: string;
}

interface ProhibitedZone {
  _id: string;
  map_name: string;
  zone_name: string;
  zone_type: string;
  polygon_points: number[];
  timestamp: number;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw?: number;
  type: string;
  description: string;
}

interface GraphEdge {
  from: string;
  to: string;
  cost: number;
  bidirectional: boolean;
  max_speed: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface PolygonCreationMode {
  isActive: boolean;
  type: 'restricted' | 'docking-pallet';
  startPoint?: Point;
}

const NODE_R_DEFAULT = 8;
const NODE_R_EDGE = 8;
const NODE_R_ACTIVE = 9;

const getNodeRadius = (isSelected: boolean, isDragging: boolean, isEdgeSelected: boolean) => {
  if (isSelected || isDragging) return NODE_R_ACTIVE;
  if (isEdgeSelected) return NODE_R_EDGE;
  return NODE_R_DEFAULT;
};

const getNodeYaw = (node: GraphNode): number => node.yaw ?? 0;

/** ROS yaw (rad) from SVG pixel offset (Y axis points down). */
const yawFromPixelDelta = (dx: number, dy: number): number => Math.atan2(-dy, dx);

const yawToHandlePos = (yaw: number, distance: number) => ({
  x: distance * Math.cos(yaw),
  y: -distance * Math.sin(yaw),
});

const radToDeg = (rad: number) => (rad * 180) / Math.PI;
const degToRad = (deg: number) => (deg * Math.PI) / 180;

/** ROS yaw (degrees, CCW from +X) → SVG rotate. Map Y is flipped; marker front points +X. */
const rosYawDegToSvgRotate = (yawDeg: number) => -yawDeg;

/** Top-down AGV marker drawn in SVG (front = +X). */
function renderRobotMarker(halfW: number, halfH: number, selected: boolean) {
  const strokeW = Math.max(1.5, halfW * 0.07);
  const bodyFill = selected ? '#1a1a1a' : '#2d2d2d';
  const frontFill = selected ? '#3b82f6' : '#10b981';

  return (
    <g style={{ pointerEvents: 'none' }}>
      {selected && (
        <rect
          x={-halfW - 4}
          y={-halfH - 4}
          width={halfW * 2 + 8}
          height={halfH * 2 + 8}
          rx={halfH * 0.45}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      )}
      <ellipse
        cx={0}
        cy={halfH * 0.15}
        rx={halfW * 0.85}
        ry={halfH * 0.35}
        fill="rgba(0,0,0,0.12)"
      />
      <rect
        x={-halfW}
        y={-halfH}
        width={halfW * 2}
        height={halfH * 2}
        rx={halfH * 0.38}
        fill={bodyFill}
        stroke="#ffffff"
        strokeWidth={strokeW}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
      />
      {/* Front direction wedge (+X) */}
      <path
        d={`M ${halfW * 0.15} 0 L ${halfW * 0.92} ${-halfH * 0.5} L ${halfW * 0.92} ${halfH * 0.5} Z`}
        fill={frontFill}
        stroke="#ffffff"
        strokeWidth={strokeW * 0.6}
      />
      <circle cx={-halfW * 0.25} cy={0} r={halfH * 0.14} fill="rgba(255,255,255,0.35)" />
      <circle cx={halfW * 0.1} cy={0} r={halfH * 0.14} fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

/** Compact chevron arrow drawn inside the node circle. */
function renderInnerNodeArrow(
  yaw: number,
  radius: number,
  options: { opacity?: number; arrowColor?: string } = {}
) {
  const { opacity = 1, arrowColor = '#ffffff' } = options;
  const scale = radius / NODE_R_DEFAULT;
  const svgRotate = -radToDeg(yaw);

  return (
    <g transform={`rotate(${svgRotate})`} style={{ pointerEvents: 'none' }} opacity={opacity}>
      <path
        d={`M ${-0.8 * scale},${-2.8 * scale} L ${3.8 * scale},0 L ${-0.8 * scale},${2.8 * scale} Z`}
        fill={arrowColor}
        fillOpacity={0.95}
      />
      <circle cx={-1.2 * scale} cy={0} r={1.1 * scale} fill={arrowColor} fillOpacity={0.45} />
    </g>
  );
}

const RobotMap: React.FC<RobotMapProps> = ({ 
  robotName,
  mapName,
  robots = [],
  enablePolygonDrawing = false,
  restrictedAreas = [],
  onRestrictedAreasChange,
  graphData,
  showGraph = true,
  // Graph editing props
  isGraphEditorMode = false,
  onGraphDataChange,
  isAddingNode = false,
  onNodeAdded,
  selectedNodeForEdge = null,
  onNodeSelectedForEdge,
  enableSendRobot = false,
  onSendRobotToNode,
  sendRobotLoading = false,
}) => {
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Dynamic map data from backend
  const [mapData, setMapData] = useState<MapData | null>(null);
  
  // Polygon creation states
  const [polygonMode, setPolygonMode] = useState<PolygonCreationMode>({ isActive: false, type: 'restricted' });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [placingNode, setPlacingNode] = useState<{ rosX: number; rosY: number; yaw: number } | null>(null);
  const [rotatingNodeId, setRotatingNodeId] = useState<string | null>(null);
  const didPanRef = useRef(false);
  const panStartClientRef = useRef({ x: 0, y: 0 });

  const closeNodePanel = () => {
    setSelectedNodeId(null);
    setEditingNode(null);
  };

  useEffect(() => {
    if (!isAddingNode) setPlacingNode(null);
  }, [isAddingNode]);

  // Fetch map data from backend (by map name or robot)
  useEffect(() => {
    if (!mapName && !robotName) return;

    const fetchMap = async () => {
      try {
        const url = mapName
          ? `${BACKEND_URL}/maps/${encodeURIComponent(mapName)}`
          : `${BACKEND_URL}/maps/by-robot/${robotName}`;
        const response = await fetch(url);
        if (response.ok) {
          const data: MapData = await response.json();
          setMapData(data);
          console.log(`Map loaded: ${data.map_name} (${data.width_px}x${data.height_px})`);
        } else {
          console.error(`Failed to load map: ${mapName ?? robotName}`);
        }
      } catch (error) {
        console.error('Error fetching map data:', error);
      }
    };

    fetchMap();
  }, [mapName, robotName]);

  // Load prohibited zones for the current map
  useEffect(() => {
    const activeMapName = mapName ?? mapData?.map_name;
    if (!activeMapName) return;

    const loadProhibitedZones = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/zones/map/${encodeURIComponent(activeMapName)}`
        );
        if (response.ok) {
          const zones: ProhibitedZone[] = await response.json();
          const convertedZones: RestrictedArea[] = zones.map((zone) => {
            const zoneType =
              zone.zone_type === 'docking-pallet' ? 'docking-pallet' : 'restricted';
            return {
              id: zone._id,
              name: zone.zone_name,
              polygonPoints: zone.polygon_points,
              color: zoneType === 'docking-pallet' ? '#3b82f6' : '#ef4444',
              type: 'polygon' as const,
              zoneType,
              mapName: zone.map_name,
              isSelected: false,
            };
          });

          onRestrictedAreasChange?.(convertedZones);
        }
      } catch (error) {
        console.error('Error loading prohibited zones:', error);
      }
    };

    loadProhibitedZones();
  }, [mapName, mapData?.map_name]);

  const convertToPixel = (position: { x: number; y: number }) => {
    if (mapData) {
      return convertRosToPixel(position.x, position.y);
    }
    return position;
  };

  // ROS koordinatlarını pixel koordinatlarına dönüştür
  const convertRosToPixel = (rosX: number, rosY: number) => {
    if (!mapData) {
      return { x: 0, y: 0 };
    }
    const pixelX = (rosX - mapData.origin[0]) / mapData.resolution;
    const pixelY = mapData.height_px - (rosY - mapData.origin[1]) / mapData.resolution;
    return { x: pixelX, y: pixelY };
  };

  const convertGraphNodeToPixel = (node: GraphNode) => {
    if (mapData) {
      return convertRosToPixel(node.x, node.y);
    }
    return { x: node.x, y: node.y };
  };

  const getSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM()?.inverse());
  };

  const svgPointToRos = (svgP: { x: number; y: number }) => {
    if (!mapData) return { x: 0, y: 0 };
    return {
      x: svgP.x * mapData.resolution + mapData.origin[0],
      y: (mapData.height_px - svgP.y) * mapData.resolution + mapData.origin[1],
    };
  };

  const commitPlacingNode = () => {
    if (!placingNode || !graphData || !onGraphDataChange) return;
    const newNode: GraphNode = {
      id: `node_${Date.now()}`,
      x: parseFloat(placingNode.rosX.toFixed(2)),
      y: parseFloat(placingNode.rosY.toFixed(2)),
      z: 0.0,
      yaw: parseFloat(placingNode.yaw.toFixed(4)),
      type: 'waypoint',
      description: `Node ${graphData.nodes.length + 1}`,
    };
    onGraphDataChange({
      ...graphData,
      nodes: [...graphData.nodes, newNode],
    });
    setPlacingNode(null);
    onNodeAdded?.();
  };

  const updateNodeYaw = (nodeId: string, yaw: number) => {
    if (!graphData || !onGraphDataChange) return;
    const updatedNodes = graphData.nodes.map(n =>
      n.id === nodeId ? { ...n, yaw: parseFloat(yaw.toFixed(4)) } : n
    );
    onGraphDataChange({ ...graphData, nodes: updatedNodes });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '#10b981';
      case 'idle': return '#f59e0b';
      case 'charging': return '#3b82f6';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (polygonMode.isActive || draggingNodeId || placingNode || rotatingNodeId || isAddingNode) return;
    didPanRef.current = false;
    panStartClientRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const svg = e.currentTarget.querySelector('svg');

    // Rotate existing node via handle
    if (rotatingNodeId && graphData && onGraphDataChange && mapData && svg) {
      const node = graphData.nodes.find(n => n.id === rotatingNodeId);
      if (node) {
        const nodePixel = convertGraphNodeToPixel(node);
        const svgP = getSvgPoint(svg, e.clientX, e.clientY);
        const yaw = yawFromPixelDelta(svgP.x - nodePixel.x, svgP.y - nodePixel.y);
        updateNodeYaw(rotatingNodeId, yaw);
      }
      return;
    }

    // Preview yaw while placing a new node
    if (placingNode && mapData && svg) {
      const nodePixel = convertRosToPixel(placingNode.rosX, placingNode.rosY);
      const svgP = getSvgPoint(svg, e.clientX, e.clientY);
      const yaw = yawFromPixelDelta(svgP.x - nodePixel.x, svgP.y - nodePixel.y);
      setPlacingNode(prev => prev ? { ...prev, yaw } : null);
      return;
    }

    // Node sürükleme
    if (draggingNodeId && graphData && onGraphDataChange && mapData && dragOffset) {
      if (!svg) return;
      
      const svgP = getSvgPoint(svg, e.clientX, e.clientY);
      
      // SVG koordinatlarını ROS koordinatlarına çevir
      const rosX = svgP.x * mapData.resolution + mapData.origin[0];
      const rosYCoord = (mapData.height_px - svgP.y) * mapData.resolution + mapData.origin[1];
      
      // Node pozisyonunu güncelle
      const updatedNodes = graphData.nodes.map(n => 
        n.id === draggingNodeId 
          ? { ...n, x: parseFloat(rosX.toFixed(2)), y: parseFloat(rosYCoord.toFixed(2)) }
          : n
      );
      
      onGraphDataChange({
        ...graphData,
        nodes: updatedNodes
      });
      
      return;
    }
    
    if (polygonMode.isActive && polygonMode.startPoint && mapData) {
      if (!svg) return;
      
      const svgP = getSvgPoint(svg, e.clientX, e.clientY);
      
      // SVG koordinatlarını yüzde değerine çevir
      const x = (svgP.x / mapData.width_px) * 100;
      const y = (svgP.y / mapData.height_px) * 100;
      
      setMousePosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    }
    
    if (!isDragging || polygonMode.isActive || draggingNodeId) return;
    const dx = e.clientX - panStartClientRef.current.x;
    const dy = e.clientY - panStartClientRef.current.y;
    if (Math.hypot(dx, dy) > 4) didPanRef.current = true;
    const newPanOffset = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };
    const maxPan = 200 * Math.max(1, zoomLevel - 1);
    newPanOffset.x = Math.max(-maxPan, Math.min(maxPan, newPanOffset.x));
    newPanOffset.y = Math.max(-maxPan, Math.min(maxPan, newPanOffset.y));
    setPanOffset(newPanOffset);
  };

  const handleMouseUp = () => {
    if (placingNode) {
      commitPlacingNode();
    }
    setIsDragging(false);
    setDraggingNodeId(null);
    setDragOffset(null);
    setRotatingNodeId(null);
  };

  const startPolygonCreation = (type: 'restricted' | 'docking-pallet' = 'restricted') => {
    setPolygonMode({ isActive: true, type });
  };

  const stopPolygonCreation = () => {
    setPolygonMode({ isActive: false, type: 'restricted', startPoint: undefined });
    setMousePosition({ x: 0, y: 0 });
  };

  const selectArea = (areaId: string) => {
    closeNodePanel();
    setSelectedAreaId(selectedAreaId === areaId ? null : areaId);
  };

  const handleMapBackgroundClick = () => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (placingNode || rotatingNodeId || draggingNodeId) return;
    closeNodePanel();
    setSelectedRobotId(null);
  };

  const saveAreaToDatabase = async (area: RestrictedArea): Promise<ProhibitedZone | null> => {
    if (area.type !== 'polygon' || !area.polygonPoints?.length) return null;

    const targetMapName = area.mapName ?? mapName ?? mapData?.map_name;
    if (!targetMapName) {
      console.error('Cannot save zone: no map name');
      return null;
    }
    const zoneType = area.zoneType ?? 'restricted';

    try {
      const response = await fetch(`${BACKEND_URL}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map_name: targetMapName,
          zone_name: area.name,
          zone_type: zoneType,
          polygon_points: area.polygonPoints,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        const savedZone: ProhibitedZone = await response.json();
        console.log('Zone saved to database:', savedZone);
        return savedZone;
      }
      console.error('Failed to save zone to database');
    } catch (error) {
      console.error('Error saving zone to database:', error);
    }
    return null;
  };

  const deleteAreaFromDatabase = async (areaId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/zones/${areaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Zone deleted from database:', areaId);
        return true;
      } else {
        console.error('Failed to delete zone from database');
        return false;
      }
    } catch (error) {
      console.error('Error deleting zone from database:', error);
      return false;
    }
  };

  const deleteSelectedArea = async () => {
    if (!selectedAreaId) return;
    
    const selectedArea = restrictedAreas.find(area => area.id === selectedAreaId);
    
    // Eğer veritabanından gelen bir zone ise (MongoDB ObjectId formatında), veritabanından da sil
    if (selectedArea && selectedArea.type === 'polygon' && selectedArea.id.length === 24) {
      await deleteAreaFromDatabase(selectedArea.id);
    }
    
    const updatedAreas = restrictedAreas.filter((area: RestrictedArea) => area.id !== selectedAreaId);
    onRestrictedAreasChange?.(updatedAreas);
    setSelectedAreaId(null);
  };

  return (
    <div className="robot-map-container">
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button className="zoom-btn" onClick={handleResetZoom} title="Reset Zoom">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        
        {enablePolygonDrawing && (
          <>
            <div style={{ height: '8px', pointerEvents: 'none' }} /> {/* Separator */}
            <button 
              className={`zoom-btn ${polygonMode.isActive && polygonMode.type === 'restricted' ? 'active' : ''}`} 
              onClick={() => polygonMode.isActive ? stopPolygonCreation() : startPolygonCreation('restricted')}
              title={polygonMode.isActive ? "Cancel Drawing" : "Draw Restricted Area"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
              </svg>
            </button>
            <button 
              className={`zoom-btn ${polygonMode.isActive && polygonMode.type === 'docking-pallet' ? 'active docking' : ''}`} 
              onClick={() => polygonMode.isActive ? stopPolygonCreation() : startPolygonCreation('docking-pallet')}
              title={polygonMode.isActive ? "Cancel Drawing" : "Draw Docking/Pallet Area"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </button>
            {selectedAreaId && (
              <button 
                className="zoom-btn" 
                onClick={deleteSelectedArea}
                title="Delete Selected Area"
                style={{ color: '#ef4444' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      <div 
        className="image-map-wrapper"
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8f9fa',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={handleMapBackgroundClick}
      >
        <div 
          className="map-content"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease',
            transformOrigin: 'center center',
            cursor: polygonMode.isActive || isAddingNode || placingNode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Single SVG: base map + all overlays. preserveAspectRatio keeps correct proportions. */}
          <svg
            viewBox={mapData ? `0 0 ${mapData.width_px} ${mapData.height_px}` : '0 0 100 100'}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              borderRadius: '12px',
              pointerEvents: (isGraphEditorMode && (isAddingNode || !!placingNode)) || polygonMode.isActive ? 'auto' : 'none',
              cursor: (isGraphEditorMode && isAddingNode) || placingNode || polygonMode.isActive ? 'crosshair' : 'default'
            }}
            onMouseDown={(e) => {
              if (!mapData || !isGraphEditorMode || !isAddingNode || !graphData || placingNode) return;
              e.stopPropagation();
              const svgP = getSvgPoint(e.currentTarget, e.clientX, e.clientY);
              const ros = svgPointToRos(svgP);
              setPlacingNode({ rosX: ros.x, rosY: ros.y, yaw: 0 });
              setIsDragging(false);
            }}
            onClick={(e) => {
              if (!mapData) return;

              // Polygon drawing mode
              if (polygonMode.isActive) {
                const svg = e.currentTarget;
                
                const svgP = getSvgPoint(svg, e.clientX, e.clientY);
                
                // SVG koordinatlarını yüzde değerine çevir
                const x = (svgP.x / mapData.width_px) * 100;
                const y = (svgP.y / mapData.height_px) * 100;
                
                const clickPoint = { 
                  x: Math.max(0, Math.min(100, x)), 
                  y: Math.max(0, Math.min(100, y)) 
                };
                
                if (!polygonMode.startPoint) {
                  setPolygonMode(prev => ({ ...prev, startPoint: clickPoint }));
                } else {
                  // Yüzde değerlerini SVG pixel koordinatlarına çevir
                  const startX = (polygonMode.startPoint.x / 100) * mapData.width_px;
                  const startY = (polygonMode.startPoint.y / 100) * mapData.height_px;
                  const endX = (clickPoint.x / 100) * mapData.width_px;
                  const endY = (clickPoint.y / 100) * mapData.height_px;
                  
                  // Rectangle'ın 4 köşe noktasını hesapla (saat yönünde)
                  const corners = [
                    { x: Math.min(startX, endX), y: Math.min(startY, endY) },
                    { x: Math.max(startX, endX), y: Math.min(startY, endY) },
                    { x: Math.max(startX, endX), y: Math.max(startY, endY) },
                    { x: Math.min(startX, endX), y: Math.max(startY, endY) },
                  ];
                  
                  // Her köşe noktasını ROS koordinatlarına çevir
                  const rosCoordinates: number[] = [];
                  corners.forEach(corner => {
                    const rosX = corner.x * mapData.resolution + mapData.origin[0];
                    const rosYCoord = (mapData.height_px - corner.y) * mapData.resolution + mapData.origin[1];
                    rosCoordinates.push(parseFloat(rosX.toFixed(2)), parseFloat(rosYCoord.toFixed(2)));
                  });
                  
                  const draftArea: RestrictedArea = {
                    id: `area-${Date.now()}`,
                    name: `${polygonMode.type === 'restricted' ? 'Restricted' : 'Docking'} Area ${restrictedAreas.length + 1}`,
                    startPoint: polygonMode.startPoint,
                    endPoint: clickPoint,
                    polygonPoints: rosCoordinates,
                    color: polygonMode.type === 'restricted' ? '#ef4444' : '#3b82f6',
                    type: 'polygon',
                    zoneType: polygonMode.type,
                    mapName: mapName ?? mapData?.map_name,
                  };

                  void (async () => {
                    const savedZone = await saveAreaToDatabase(draftArea);
                    const newArea: RestrictedArea = savedZone
                      ? { ...draftArea, id: savedZone._id, mapName: savedZone.map_name }
                      : draftArea;
                    onRestrictedAreasChange?.([...restrictedAreas, newArea]);
                  })();
                  stopPolygonCreation();
                }
                return;
              }
            }}
          >
            {/* Base map image */}
            {mapData && (
              <image
                href={`data:image/png;base64,${mapData.image_png_base64}`}
                x={0}
                y={0}
                width={mapData.width_px}
                height={mapData.height_px}
              />
            )}
            {/* Render graph edges (paths) first so they appear behind nodes */}
            {showGraph && graphData?.edges.map((edge, index) => {
              const fromNode = graphData.nodes.find(n => n.id === edge.from);
              const toNode = graphData.nodes.find(n => n.id === edge.to);
              
              if (!fromNode || !toNode) return null;
              
              const fromPos = convertGraphNodeToPixel(fromNode);
              const toPos = convertGraphNodeToPixel(toNode);
              
              return (
                <g key={`edge-${index}`}>
                  {/* Main path line */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeOpacity="0.6"
                    strokeDasharray="5,5"
                  />
                  
                  {/* Arrow indicator for direction */}
                  {!edge.bidirectional && (
                    <defs>
                      <marker
                        id={`arrowhead-${index}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" opacity="0.6" />
                      </marker>
                    </defs>
                  )}
                </g>
              );
            })}
            
            {/* Preview node while placing (click-drag) */}
            {showGraph && placingNode && mapData && (() => {
              const pos = convertRosToPixel(placingNode.rosX, placingNode.rosY);
              const r = NODE_R_ACTIVE;
              return (
                <g transform={`translate(${pos.x}, ${pos.y})`} style={{ pointerEvents: 'none' }}>
                  <circle
                    cx={0} cy={0} r={r}
                    fill="#2563eb" fillOpacity="0.2"
                    stroke="#2563eb" strokeWidth="2" strokeDasharray="4,3"
                  />
                  {renderInnerNodeArrow(placingNode.yaw, r, { arrowColor: '#2563eb', opacity: 0.9 })}
                </g>
              );
            })()}

            {/* Render graph nodes (waypoints) */}
            {showGraph && graphData?.nodes.map((node) => {
              const pos = convertGraphNodeToPixel(node);
              const yaw = getNodeYaw(node);
              const isSelected = selectedNodeId === node.id;
              const isSelectedForEdge = selectedNodeForEdge === node.id;
              const isDraggingThis = draggingNodeId === node.id;
              const nodeColor = isSelected || isDraggingThis ? '#059669' : isSelectedForEdge ? '#f59e0b' : '#10b981';
              const radius = getNodeRadius(isSelected, isDraggingThis, isSelectedForEdge);
              const handlePos = yawToHandlePos(yaw, radius + 2.5);
              const nodeOpacity = isDraggingThis ? 0.75 : 0.95;
              
              return (
                <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                  <circle
                    cx={0}
                    cy={0}
                    r={radius}
                    fill={nodeColor}
                    fillOpacity={nodeOpacity}
                    stroke="#ffffff"
                    strokeWidth={isSelected || isSelectedForEdge || isDraggingThis ? "2.5" : "2"}
                    style={{
                      filter: isSelected || isDraggingThis
                        ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.28))'
                        : 'drop-shadow(0 1px 3px rgba(0,0,0,0.18))',
                      cursor: isGraphEditorMode ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (isGraphEditorMode && selectedNodeForEdge === null && !rotatingNodeId) {
                        setDraggingNodeId(node.id);
                        setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (draggingNodeId || rotatingNodeId) return;
                      if (isGraphEditorMode && selectedNodeForEdge !== null && onNodeSelectedForEdge) {
                        onNodeSelectedForEdge(node.id);
                      } else {
                        setSelectedNodeId(node.id);
                        setSelectedRobotId(null);
                        setEditingNode(null);
                      }
                    }}
                  />

                  {renderInnerNodeArrow(yaw, radius, { opacity: nodeOpacity })}

                  {/* Rotation handle on circle edge */}
                  {isGraphEditorMode && isSelected && selectedNodeForEdge === null && (
                    <circle
                      cx={handlePos.x}
                      cy={handlePos.y}
                      r="5"
                      fill="#1a1a1a"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      style={{ cursor: 'grab', pointerEvents: 'auto' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setRotatingNodeId(node.id);
                        setIsDragging(false);
                      }}
                    />
                  )}
                  
                  {/* Graph editor mode - delete button */}
                  {isGraphEditorMode && isSelected && (
                    <g>
                      <circle
                        cx={radius + 4}
                        cy={-(radius + 4)}
                        r="7"
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (graphData && onGraphDataChange) {
                            const updatedNodes = graphData.nodes.filter(n => n.id !== node.id);
                            const updatedEdges = graphData.edges.filter(ed => ed.from !== node.id && ed.to !== node.id);
                            onGraphDataChange({ nodes: updatedNodes, edges: updatedEdges });
                            setSelectedNodeId(null);
                          }
                        }}
                      />
                      <line x1={radius + 1.5} y1={-(radius + 6.5)} x2={radius + 6.5} y2={-(radius + 1.5)} stroke="#ffffff" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                      <line x1={radius + 6.5} y1={-(radius + 6.5)} x2={radius + 1.5} y2={-(radius + 1.5)} stroke="#ffffff" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Render existing restricted areas */}
            {restrictedAreas.map((area: RestrictedArea) => {
              const isSelected = selectedAreaId === area.id;
              
              // Polygon tipindeki alanlar için
              if (area.type === 'polygon' && area.polygonPoints) {
                // polygon_points'i [x1, y1, x2, y2, ...] formatından SVG points formatına çevir
                const points = area.polygonPoints
                  .reduce((acc, val, idx) => {
                    if (idx % 2 === 0) {
                      const x = val;
                      const y = area.polygonPoints![idx + 1];
                      // ROS koordinatlarını pixel'e çevir
                      if (mapData) {
                        const pixelPos = convertRosToPixel(x, y);
                        acc.push(`${pixelPos.x},${pixelPos.y}`);
                      } else {
                        acc.push(`${x},${y}`);
                      }
                    }
                    return acc;
                  }, [] as string[])
                  .join(' ');

                return (
                  <g key={area.id}>
                    <polygon
                      points={points}
                      fill={area.color}
                      fillOpacity="0.3"
                      stroke={area.color}
                      strokeWidth={isSelected ? "3" : "2"}
                      strokeDasharray={isSelected ? "8,4" : "5,5"}
                      style={{
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        filter: isSelected ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' : 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectArea(area.id);
                      }}
                    />
                    {/* Zone ismi göster */}
                    {area.polygonPoints.length >= 2 && mapData && (
                      <text
                        x={convertRosToPixel(area.polygonPoints[0], area.polygonPoints[1]).x}
                        y={convertRosToPixel(area.polygonPoints[0], area.polygonPoints[1]).y}
                        fill={area.color}
                        fontSize="12"
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                      >
                        {area.name}
                      </text>
                    )}
                  </g>
                );
              }
              
              // Rectangle tipindeki alanlar için (eski format)
              if (area.startPoint && area.endPoint) {
                const startPos = area.startPoint;
                const endPos = area.endPoint;
                
                const x = Math.min(startPos.x, endPos.x);
                const y = Math.min(startPos.y, endPos.y);
                const width = Math.abs(endPos.x - startPos.x);
                const height = Math.abs(endPos.y - startPos.y);
                
                return (
                  <g key={area.id}>
                    <rect
                      x={`${x}%`}
                      y={`${y}%`}
                      width={`${width}%`}
                      height={`${height}%`}
                      fill={area.color}
                      fillOpacity="0.2"
                      stroke={area.color}
                      strokeWidth={isSelected ? "3" : "2"}
                      strokeDasharray={isSelected ? "8,4" : "none"}
                      style={{
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        filter: isSelected ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' : 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectArea(area.id);
                      }}
                    />
                  </g>
                );
              }
              
              return null;
            })}

            {/* Render all robots inside SVG */}
            {robots.map((robot) => {
              const robotPos = convertToPixel(robot.position);
              const isSelected = selectedRobotId === robot.id;

              const robotRealWidth = 1.0;
              const robotRealHeight = 0.8;

              let robotPixelWidth = 36;
              let robotPixelHeight = 28;

              if (mapData) {
                robotPixelWidth = robotRealWidth / mapData.resolution;
                robotPixelHeight = robotRealHeight / mapData.resolution;
                robotPixelWidth = Math.max(robotPixelWidth, 28);
                robotPixelHeight = Math.max(robotPixelHeight, 22);
                robotPixelWidth = Math.min(robotPixelWidth, 72);
                robotPixelHeight = Math.min(robotPixelHeight, 58);
              }

              const halfWidth = robotPixelWidth / 2;
              const halfHeight = robotPixelHeight / 2;
              const labelFontSize = Math.max(9, Math.min(11, halfWidth * 0.38));

              return (
                <g
                  key={`robot-${robot.id}`}
                  transform={`translate(${robotPos.x}, ${robotPos.y}) rotate(${rosYawDegToSvgRotate(robot.orientation)})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeNodePanel();
                    setSelectedRobotId(isSelected ? null : robot.id);
                  }}
                >
                  {renderRobotMarker(halfWidth, halfHeight, isSelected)}

                  <text
                    x={0}
                    y={-halfHeight - 6}
                    textAnchor="middle"
                    fontSize={labelFontSize}
                    fontWeight="600"
                    fill="#1a1a1a"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    transform={`rotate(${rosYawDegToSvgRotate(-robot.orientation)})`}
                  >
                    {robot.id}
                  </text>
                </g>
              );
            })}
            
            {/* Preview rectangle while creating */}
            {polygonMode.isActive && polygonMode.startPoint && mapData && (
              (() => {
                const startX = (polygonMode.startPoint.x / 100) * mapData.width_px;
                const startY = (polygonMode.startPoint.y / 100) * mapData.height_px;
                const currentX = (mousePosition.x / 100) * mapData.width_px;
                const currentY = (mousePosition.y / 100) * mapData.height_px;
                
                const x = Math.min(startX, currentX);
                const y = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                const previewColor = polygonMode.type === 'restricted' ? '#ef4444' : '#3b82f6';
                
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={previewColor}
                    fillOpacity="0.15"
                    stroke={previewColor}
                    strokeWidth="2"
                    strokeDasharray="8,4"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })()
            )}
          </svg>
        </div>
      </div>

      {selectedNodeId && graphData && (() => {
        const selectedNode = graphData.nodes.find(n => n.id === selectedNodeId);
        if (!selectedNode) return null;

        const isEditing = editingNode?.id === selectedNode.id;

        return (
          <div
            className={`node-panel-fixed${isEditing ? ' node-panel-fixed--editing' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="node-panel-header">
              <h4 className="node-panel-title">
                {isEditing ? 'Edit Node' : selectedNode.description}
              </h4>
              <button
                type="button"
                className="node-panel-close"
                onClick={closeNodePanel}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Mini node preview — matches map appearance */}
            <div className="node-panel-preview">
              <svg width="52" height="52" viewBox="-16 -16 32 32" aria-hidden="true">
                <circle
                  r={NODE_R_ACTIVE * 1.35}
                  fill="#059669"
                  fillOpacity={0.95}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                />
                {renderInnerNodeArrow(
                  isEditing ? (editingNode.yaw ?? 0) : getNodeYaw(selectedNode),
                  NODE_R_ACTIVE * 1.35
                )}
              </svg>
            </div>

            {isEditing ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Description:
                  </label>
                  <input
                    type="text"
                    value={editingNode.description}
                    onChange={(e) => setEditingNode({ ...editingNode, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    X (m):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingNode.x}
                    onChange={(e) => setEditingNode({ ...editingNode, x: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Y (m):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingNode.y}
                    onChange={(e) => setEditingNode({ ...editingNode, y: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Type:
                  </label>
                  <input
                    type="text"
                    value={editingNode.type}
                    onChange={(e) => setEditingNode({ ...editingNode, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Yaw (°):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={radToDeg(editingNode.yaw ?? 0).toFixed(1)}
                    onChange={(e) => setEditingNode({ ...editingNode, yaw: degToRad(parseFloat(e.target.value) || 0) })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={() => {
                      if (graphData && onGraphDataChange && editingNode) {
                        const updatedNodes = graphData.nodes.map(n => 
                          n.id === editingNode.id ? editingNode : n
                        );
                        onGraphDataChange({
                          ...graphData,
                          nodes: updatedNodes
                        });
                        setEditingNode(null);
                        setSelectedNodeId(null);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#ffffff',
                      background: '#059669',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingNode(null)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#6b7280',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>ID:</span>
                    <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{selectedNode.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Type:</span>
                    <span style={{ color: '#1a1a1a', fontWeight: '500' }}>{selectedNode.type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Position:</span>
                    <span style={{ color: '#1a1a1a', fontWeight: '500' }}>
                      ({selectedNode.x.toFixed(2)}m, {selectedNode.y.toFixed(2)}m)
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Yaw:</span>
                    <span style={{ color: '#1a1a1a', fontWeight: '500' }}>
                      {radToDeg(getNodeYaw(selectedNode)).toFixed(1)}°
                    </span>
                  </div>
                </div>
                {enableSendRobot && onSendRobotToNode && (
                  <button
                    onClick={() => onSendRobotToNode(selectedNode)}
                    disabled={sendRobotLoading}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#ffffff',
                      background: sendRobotLoading ? '#9ca3af' : '#1a1a1a',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: sendRobotLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14"/>
                      <path d="m12 5 7 7-7 7"/>
                    </svg>
                    {sendRobotLoading ? 'Sending…' : 'Send Robot'}
                  </button>
                )}
                {isGraphEditorMode && (
                  <button
                    onClick={() => setEditingNode({ ...selectedNode, yaw: selectedNode.yaw ?? 0 })}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#059669',
                      background: 'rgba(5, 150, 105, 0.1)',
                      border: '1px solid #059669',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Edit Node
                  </button>
                )}
              </>
            )}
          </div>
        );
      })()}

      {selectedRobotId && (() => {
        const selectedRobot = robots.find(r => r.id === selectedRobotId);
        if (!selectedRobot) return null;
        
        const robotPos = convertToPixel(selectedRobot.position);
        const leftPercent = (robotPos.x / (mapData?.width_px ?? 100)) * 100;
        const topPercent = (robotPos.y / (mapData?.height_px ?? 100)) * 100;

        return (
          <div 
            className="robot-info-popup"
            style={{
              position: 'absolute',
              left: `${leftPercent + 5}%`,
              top: `${topPercent}%`,
              transform: 'translate(0, -50%)',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(26, 26, 26, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              minWidth: '280px',
              maxWidth: '320px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              zIndex: 1000
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
                  {selectedRobot.name}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  ID: {selectedRobot.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedRobotId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Status:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div 
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: getStatusColor(selectedRobot.status) 
                    }} 
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {selectedRobot.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Battery:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '40px',
                    height: '6px',
                    background: '#e5e7eb',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${selectedRobot.battery}%`,
                      height: '100%',
                      background: selectedRobot.battery > 20 ? '#10b981' : '#ef4444',
                      borderRadius: '3px'
                    }} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {selectedRobot.battery}%
                  </span>
                </div>
              </div>

              {selectedRobot.currentTask && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Task:</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {selectedRobot.currentTask}
                  </span>
                </div>
              )}

              {selectedRobot.speed !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Speed:</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                    {selectedRobot.speed} m/s
                  </span>
                </div>
              )}

              <div style={{ 
                marginTop: '12px', 
                paddingTop: '12px', 
                borderTop: '1px solid rgba(26, 26, 26, 0.1)' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Position (ROS):</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a1a' }}>
                    ({selectedRobot.position.x.toFixed(2)}m, {selectedRobot.position.y.toFixed(2)}m)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Position (Pixel):</span>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#1a1a1a' }}>
                    ({robotPos.x.toFixed(0)}px, {robotPos.y.toFixed(0)}px)
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default React.memo(RobotMap);
