import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/RobotMap.css';
import { apiFetch, ApiError } from '../api';
import { fetchMapRenderData } from '../api/mapLoad';
import type { GraphNode, MapData } from '../types';
import type {
  RobotMapProps,
  RestrictedArea,
  ProhibitedZone,
  DockPoseEdit,
  PolygonCreationMode,
  MapViewSettings,
  Point,
} from './robot-map/types';
import { getNodeYaw, NODE_R_ACTIVE } from './robot-map/constants';
import { loadMapViewSettings, saveMapViewSettings } from './robot-map/mapViewStorage';
import {
  yawFromPixelDelta,
  radToDeg,
  degToRad,
  normalizeDockingArea,
  getStatusColor,
} from './robot-map/geometry';
import { renderInnerNodeArrow } from './robot-map/markers';
import RobotMapCanvas from './robot-map/RobotMapCanvas';

const RobotMap: React.FC<RobotMapProps> = ({
  robotName,
  mapName,
  robots = [],
  enablePolygonDrawing = false,
  enableDockingDrawing = false,
  zonesReadOnly = false,
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
  sendRobotDisabled = false,
  sendRobotDisabledReason,
  onSendRobotToNode,
  sendRobotLoading = false,
  onMapNotify,
}) => {
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [mapRotation, setMapRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Dynamic map data from backend
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  
  // Polygon creation states
  const [polygonMode, setPolygonMode] = useState<PolygonCreationMode>({ isActive: false, type: 'restricted' });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState('');
  const [editingDockingAreaId, setEditingDockingAreaId] = useState('');
  const [zoneNameSaving, setZoneNameSaving] = useState(false);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [placingNode, setPlacingNode] = useState<{ rosX: number; rosY: number; yaw: number } | null>(null);
  const [rotatingNodeId, setRotatingNodeId] = useState<string | null>(null);
  const [draggingDockingId, setDraggingDockingId] = useState<string | null>(null);
  const [rotatingDockingId, setRotatingDockingId] = useState<string | null>(null);
  const [editingDockPose, setEditingDockPose] = useState<DockPoseEdit | null>(null);
  const didPanRef = useRef(false);
  const panStartClientRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const mapViewStateRef = useRef<MapViewSettings>({
    rotation: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
  });

  const mapViewKey = mapName ?? mapData?.map_name ?? '';

  mapViewStateRef.current = {
    rotation: mapRotation,
    zoom: zoomLevel,
    pan: panOffset,
  };

  // Restore zoom / pan / rotation per map (survives refresh & navigation)
  useEffect(() => {
    if (!mapViewKey) return;
    const saved = loadMapViewSettings(mapViewKey);
    setMapRotation(saved?.rotation ?? 0);
    setZoomLevel(saved?.zoom ?? 1);
    setPanOffset(saved?.pan ?? { x: 0, y: 0 });
  }, [mapViewKey]);

  // Persist when switching maps or unmounting
  useEffect(() => {
    if (!mapViewKey) return;
    return () => {
      saveMapViewSettings(mapViewKey, mapViewStateRef.current);
    };
  }, [mapViewKey]);

  useEffect(() => {
    if (!mapViewKey || isDragging) return;
    const timer = window.setTimeout(() => {
      saveMapViewSettings(mapViewKey, mapViewStateRef.current);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [mapViewKey, mapRotation, zoomLevel, panOffset, isDragging]);

  const normalizedDockingAreas = useMemo(
    () => (graphData?.docking_areas ?? []).map(normalizeDockingArea),
    [graphData?.docking_areas]
  );

  const dockingAreasForRender = useMemo(
    (): RestrictedArea[] =>
      normalizedDockingAreas.map((d) => ({
        id: d.id,
        name: d.name,
        polygonPoints: d.polygon_points,
        color: '#3b82f6',
        type: 'polygon' as const,
        zoneType: 'docking-pallet' as const,
      })),
    [normalizedDockingAreas]
  );

  const allRenderableAreas = restrictedAreas;

  const dockingZoneOptions = dockingAreasForRender;

  const getAssignedDockingArea = (nodeId: string) =>
    graphData?.docking_areas?.find((a) => a.assigned_node_id === nodeId);

  const assignDockingAreaToNode = (nodeId: string, dockingAreaId: string) => {
    if (!graphData || !onGraphDataChange) return;
    const areas = (graphData.docking_areas ?? []).map((a) => {
      if (!dockingAreaId) {
        if (a.assigned_node_id === nodeId) return { ...a, assigned_node_id: undefined };
        return a;
      }
      if (a.id === dockingAreaId) return { ...a, assigned_node_id: nodeId };
      if (a.assigned_node_id === nodeId) return { ...a, assigned_node_id: undefined };
      return a;
    });
    onGraphDataChange({ ...graphData, docking_areas: areas });
  };

  const isDockingAreaId = (areaId: string) =>
    normalizedDockingAreas.some((a) => a.id === areaId);

  const canEditDockingPose =
    !!isGraphEditorMode && !!enableDockingDrawing && !!onGraphDataChange;

  const updateDockingAreaById = (id: string, patch: Partial<DockPoseEdit> & { name?: string }) => {
    if (!graphData || !onGraphDataChange) return;
    const areas = (graphData.docking_areas ?? []).map((a) => {
      if (a.id !== id) return normalizeDockingArea(a);
      return normalizeDockingArea({ ...a, ...patch });
    });
    onGraphDataChange({ ...graphData, docking_areas: areas });
  };

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
      setMapLoading(true);
      try {
        const data = await fetchMapRenderData({ mapName, robotName });
        setMapData(data);
      } catch (e) {
        setMapData(null);
        onMapNotify?.(
          e instanceof ApiError ? e.message : 'Failed to load map',
          'error',
        );
      } finally {
        setMapLoading(false);
      }
    };

    fetchMap();
  }, [mapName, robotName]);

  const canDrawZones = enablePolygonDrawing || enableDockingDrawing;

  // Load zones from API (Dashboard). Graph Editor loads docking zones in parent.
  useEffect(() => {
    if (!enablePolygonDrawing) return;
    const activeMapName = mapName ?? mapData?.map_name;
    if (!activeMapName) return;

    const loadProhibitedZones = async () => {
      try {
        const zones = await apiFetch<ProhibitedZone[]>(
          `/zones/map/${encodeURIComponent(activeMapName)}`,
        );
        const convertedZones: RestrictedArea[] = zones
          .filter((zone) => zone.zone_type !== 'docking-pallet')
          .map((zone) => ({
            id: zone._id,
            name: zone.zone_name,
            polygonPoints: zone.polygon_points,
            color: '#ef4444',
            type: 'polygon' as const,
            zoneType: 'restricted' as const,
            mapName: zone.map_name,
            isSelected: false,
          }));

        onRestrictedAreasChange?.(convertedZones);
      } catch (e) {
        onMapNotify?.(
          e instanceof ApiError ? e.message : 'Failed to load restricted zones',
          'error',
        );
      }
    };

    loadProhibitedZones();
  }, [mapName, mapData?.map_name, enablePolygonDrawing, onRestrictedAreasChange]);

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

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setMapRotation(0);
  };

  const handleRotateMap = () => {
    setMapRotation((prev) => (prev + 90) % 360);
  };

  const mapViewTransform = useMemo(() => {
    return `rotate(${mapRotation}deg) scale(${zoomLevel})`;
  }, [mapRotation, zoomLevel]);

  // Screen-space pan via window listeners (smooth, works outside map bounds)
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartClientRef.current.x;
      const dy = e.clientY - panStartClientRef.current.y;
      if (Math.hypot(dx, dy) > 3) didPanRef.current = true;
      setPanOffset({
        x: panStartOffsetRef.current.x + dx,
        y: panStartOffsetRef.current.y + dy,
      });
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (polygonMode.isActive || draggingNodeId || placingNode || rotatingNodeId || isAddingNode || draggingDockingId || rotatingDockingId) return;
    e.preventDefault();
    didPanRef.current = false;
    panStartClientRef.current = { x: e.clientX, y: e.clientY };
    panStartOffsetRef.current = { ...panOffset };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const svg = e.currentTarget.querySelector('svg');

    // Rotate docking area via handle
    if (rotatingDockingId && graphData && onGraphDataChange && mapData && svg) {
      const dock = normalizedDockingAreas.find((d) => d.id === rotatingDockingId);
      if (dock) {
        const centerPx = convertRosToPixel(dock.x!, dock.y!);
        const svgP = getSvgPoint(svg, e.clientX, e.clientY);
        const yaw = yawFromPixelDelta(svgP.x - centerPx.x, svgP.y - centerPx.y);
        updateDockingAreaById(rotatingDockingId, { yaw: parseFloat(yaw.toFixed(4)) });
        if (selectedAreaId === rotatingDockingId) {
          setEditingDockPose((prev) => (prev ? { ...prev, yaw } : null));
        }
      }
      return;
    }

    // Drag docking area
    if (draggingDockingId && graphData && onGraphDataChange && mapData && svg) {
      const svgP = getSvgPoint(svg, e.clientX, e.clientY);
      const ros = svgPointToRos(svgP);
      const x = parseFloat(ros.x.toFixed(2));
      const y = parseFloat(ros.y.toFixed(2));
      updateDockingAreaById(draggingDockingId, { x, y });
      if (selectedAreaId === draggingDockingId) {
        setEditingDockPose((prev) => (prev ? { ...prev, x, y } : null));
      }
      return;
    }

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
    
    if (isDragging) return;
  };

  const handleMouseUp = () => {
    if (placingNode) {
      commitPlacingNode();
    }
    setIsDragging(false);
    setDraggingNodeId(null);
    setDragOffset(null);
    setRotatingNodeId(null);
    setDraggingDockingId(null);
    setRotatingDockingId(null);
  };

  const startPolygonCreation = (type: 'restricted' | 'docking-pallet' = 'restricted') => {
    setPolygonMode({ isActive: true, type });
  };

  const stopPolygonCreation = () => {
    setPolygonMode({ isActive: false, type: 'restricted', startPoint: undefined });
    setMousePosition({ x: 0, y: 0 });
  };

  const selectArea = (areaId: string) => {
    if (zonesReadOnly && !isDockingAreaId(areaId)) return;
    closeNodePanel();
    const next = selectedAreaId === areaId ? null : areaId;
    setSelectedAreaId(next);
    if (next) {
      if (isDockingAreaId(next)) {
        const dock = normalizedDockingAreas.find((d) => d.id === next);
        if (dock) {
          setEditingZoneName(dock.name);
          setEditingDockPose({
            x: dock.x!,
            y: dock.y!,
            width: dock.width!,
            height: dock.height!,
            yaw: dock.yaw ?? 0,
          });
        }
      } else {
        const area = restrictedAreas.find((a) => a.id === next);
        setEditingZoneName(area?.name ?? '');
        setEditingDockPose(null);
      }
    } else {
      setEditingDockPose(null);
    }
  };

  const handleMapBackgroundClick = () => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (placingNode || rotatingNodeId || draggingNodeId || draggingDockingId || rotatingDockingId) return;
    closeNodePanel();
    setSelectedRobotId(null);
    if (!zonesReadOnly) setSelectedAreaId(null);
  };

  const saveAreaToDatabase = async (area: RestrictedArea): Promise<ProhibitedZone | null> => {
    if (area.type !== 'polygon' || !area.polygonPoints?.length) return null;

    const targetMapName = area.mapName ?? mapName ?? mapData?.map_name;
    if (!targetMapName) {
      onMapNotify?.('Cannot save zone: no map selected', 'error');
      return null;
    }
    const zoneType = area.zoneType ?? 'restricted';

    try {
      const savedZone = await apiFetch<ProhibitedZone>('/zones', {
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
      onMapNotify?.('Zone saved', 'success');
      return savedZone;
    } catch (e) {
      onMapNotify?.(e instanceof ApiError ? e.message : 'Failed to save zone', 'error');
    }
    return null;
  };

  const updateZoneNameInDatabase = async (areaId: string, name: string) => {
    try {
      await apiFetch(`/zones/${areaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_name: name }),
      });
      return true;
    } catch (e) {
      onMapNotify?.(e instanceof ApiError ? e.message : 'Failed to rename zone', 'error');
      return false;
    }
  };

  const saveSelectedZoneName = async () => {
    if (!selectedAreaId || !editingZoneName.trim()) return;
    setZoneNameSaving(true);

    if (isDockingAreaId(selectedAreaId) && graphData && onGraphDataChange) {
      updateDockingAreaById(selectedAreaId, { name: editingZoneName.trim() });
      setZoneNameSaving(false);
      return;
    }

    const ok = await updateZoneNameInDatabase(selectedAreaId, editingZoneName.trim());
    if (ok && onRestrictedAreasChange) {
      onRestrictedAreasChange(
        restrictedAreas.map((a) =>
          a.id === selectedAreaId ? { ...a, name: editingZoneName.trim() } : a
        )
      );
    }
    setZoneNameSaving(false);
  };

  const deleteAreaFromDatabase = async (areaId: string) => {
    try {
      await apiFetch(`/zones/${areaId}`, { method: 'DELETE' });
      onMapNotify?.('Zone deleted', 'success');
      return true;
    } catch (e) {
      onMapNotify?.(e instanceof ApiError ? e.message : 'Failed to delete zone', 'error');
      return false;
    }
  };

  const deleteSelectedArea = async () => {
    if (!selectedAreaId) return;

    if (isDockingAreaId(selectedAreaId) && graphData && onGraphDataChange) {
      onGraphDataChange({
        ...graphData,
        docking_areas: (graphData.docking_areas ?? []).filter((a) => a.id !== selectedAreaId),
      });
      setSelectedAreaId(null);
      setEditingDockPose(null);
      return;
    }

    const selectedArea = restrictedAreas.find((area) => area.id === selectedAreaId);

    if (selectedArea && selectedArea.type === 'polygon' && selectedArea.id.length === 24) {
      await deleteAreaFromDatabase(selectedArea.id);
    }

    onRestrictedAreasChange?.(restrictedAreas.filter((area) => area.id !== selectedAreaId));
    setSelectedAreaId(null);
  };

  return (
    <div className="robot-map-container">
      {mapLoading && (
        <div className="robot-map-loading">Loading map…</div>
      )}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button className="zoom-btn" onClick={handleResetZoom} title="Reset view (zoom, pan, rotation)">
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
        <div style={{ height: '4px', pointerEvents: 'none' }} />
        <button
          className={`zoom-btn ${mapRotation !== 0 ? 'active rotate' : ''}`}
          onClick={handleRotateMap}
          title={`Rotate map 90° (${mapRotation}°)`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7"/>
            <polyline points="21,3 21,9 15,9"/>
          </svg>
        </button>
        
        {canDrawZones && (
          <>
            <div style={{ height: '8px', pointerEvents: 'none' }} />
            {enablePolygonDrawing && (
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
            )}
            {enableDockingDrawing && (
            <button 
              className={`zoom-btn ${polygonMode.isActive && polygonMode.type === 'docking-pallet' ? 'active docking' : ''}`} 
              onClick={() => polygonMode.isActive ? stopPolygonCreation() : startPolygonCreation('docking-pallet')}
              title={polygonMode.isActive ? "Cancel Drawing" : "Draw Docking Area"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </button>
            )}
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
          className="map-pan-layer"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            transition: isDragging ? 'none' : undefined,
            willChange: isDragging ? 'transform' : undefined,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
        <div 
          className="map-content"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transform: mapViewTransform,
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            transformOrigin: 'center center',
            cursor: polygonMode.isActive || isAddingNode || placingNode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
          }}
        >
          <RobotMapCanvas
            mapData={mapData}
            mapName={mapName}
            graphData={graphData}
            showGraph={showGraph}
            isGraphEditorMode={isGraphEditorMode}
            isAddingNode={isAddingNode}
            placingNode={placingNode}
            polygonMode={polygonMode}
            mousePosition={mousePosition}
            selectedNodeId={selectedNodeId}
            selectedNodeForEdge={selectedNodeForEdge}
            draggingNodeId={draggingNodeId}
            rotatingNodeId={rotatingNodeId}
            selectedAreaId={selectedAreaId}
            draggingDockingId={draggingDockingId}
            normalizedDockingAreas={normalizedDockingAreas}
            allRenderableAreas={allRenderableAreas}
            zonesReadOnly={zonesReadOnly}
            canEditDockingPose={canEditDockingPose}
            robots={robots}
            selectedRobotId={selectedRobotId}
            restrictedAreas={restrictedAreas}
            getSvgPoint={getSvgPoint}
            svgPointToRos={svgPointToRos}
            convertGraphNodeToPixel={convertGraphNodeToPixel}
            convertRosToPixel={convertRosToPixel}
            convertToPixel={convertToPixel}
            getAssignedDockingArea={getAssignedDockingArea}
            setPlacingNode={setPlacingNode}
            setIsDragging={setIsDragging}
            setDraggingNodeId={setDraggingNodeId}
            setDragOffset={setDragOffset}
            setSelectedNodeId={setSelectedNodeId}
            setSelectedRobotId={setSelectedRobotId}
            setEditingNode={setEditingNode}
            setRotatingNodeId={setRotatingNodeId}
            setDraggingDockingId={setDraggingDockingId}
            setRotatingDockingId={setRotatingDockingId}
            setPolygonMode={setPolygonMode}
            stopPolygonCreation={stopPolygonCreation}
            saveAreaToDatabase={saveAreaToDatabase}
            selectArea={selectArea}
            closeNodePanel={closeNodePanel}
            onGraphDataChange={onGraphDataChange}
            onRestrictedAreasChange={onRestrictedAreasChange}
            onNodeSelectedForEdge={onNodeSelectedForEdge}
          />

        </div>
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
                <div>
                  <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Docking Area:
                  </label>
                  <select
                    value={editingDockingAreaId}
                    onChange={(e) => setEditingDockingAreaId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                    }}
                  >
                    <option value="">— None —</option>
                    {dockingZoneOptions.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={() => {
                      if (graphData && onGraphDataChange && editingNode) {
                        const updatedNodes = graphData.nodes.map((n) =>
                          n.id === editingNode.id ? editingNode : n
                        );
                        const areas = (graphData.docking_areas ?? []).map((a) => {
                          if (!editingDockingAreaId) {
                            if (a.assigned_node_id === editingNode.id) {
                              return { ...a, assigned_node_id: undefined };
                            }
                            return a;
                          }
                          if (a.id === editingDockingAreaId) {
                            return { ...a, assigned_node_id: editingNode.id };
                          }
                          if (a.assigned_node_id === editingNode.id) {
                            return { ...a, assigned_node_id: undefined };
                          }
                          return a;
                        });
                        onGraphDataChange({
                          ...graphData,
                          nodes: updatedNodes,
                          docking_areas: areas,
                        });
                        setEditingNode(null);
                        setEditingDockingAreaId('');
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
                  {getAssignedDockingArea(selectedNode.id) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Docking:</span>
                      <span style={{ color: '#2563eb', fontWeight: '500' }}>
                        {getAssignedDockingArea(selectedNode.id)?.name ?? 'Assigned'}
                      </span>
                    </div>
                  )}
                </div>
                {isGraphEditorMode && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                      Docking Area (1 node ↔ 1 area)
                    </label>
                    <select
                      value={getAssignedDockingArea(selectedNode.id)?.id ?? ''}
                      onChange={(e) => assignDockingAreaToNode(selectedNode.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        background: '#fff',
                      }}
                    >
                      <option value="">— None —</option>
                      {dockingZoneOptions.map((z) => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))}
                    </select>
                    {dockingZoneOptions.length === 0 && (
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                        Draw docking areas with the blue map tool (zoom controls).
                      </p>
                    )}
                  </div>
                )}
                {enableSendRobot && onSendRobotToNode && (
                  <button
                    onClick={() => onSendRobotToNode(selectedNode)}
                    disabled={sendRobotLoading || sendRobotDisabled}
                    title={sendRobotDisabled ? (sendRobotDisabledReason ?? 'Cannot send robot') : undefined}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#ffffff',
                      background: sendRobotLoading || sendRobotDisabled ? '#9ca3af' : '#1a1a1a',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: sendRobotLoading || sendRobotDisabled ? 'not-allowed' : 'pointer',
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
                    onClick={() => {
                      setEditingNode({ ...selectedNode, yaw: selectedNode.yaw ?? 0 });
                      setEditingDockingAreaId(getAssignedDockingArea(selectedNode.id)?.id ?? '');
                    }}
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

      {selectedAreaId && (isDockingAreaId(selectedAreaId) || (canDrawZones && !zonesReadOnly)) && (() => {
        const isDocking = isDockingAreaId(selectedAreaId);
        const dock = isDocking ? normalizedDockingAreas.find((d) => d.id === selectedAreaId) : undefined;
        const restrictedArea = !isDocking ? restrictedAreas.find((a) => a.id === selectedAreaId) : undefined;
        if (!dock && !restrictedArea) return null;

        const inputStyle = {
          width: '100%',
          padding: '6px 8px',
          fontSize: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          boxSizing: 'border-box' as const,
        };

        const saveDockPose = () => {
          if (!editingDockPose || !selectedAreaId) return;
          updateDockingAreaById(selectedAreaId, {
            ...editingDockPose,
            name: editingZoneName.trim() || dock?.name,
          });
        };

        return (
          <div className="zone-panel-fixed" onClick={(e) => e.stopPropagation()}>
            <div className="node-panel-header">
              <h4 className="node-panel-title">
                {isDocking ? 'Docking Area' : 'Restricted Zone'}
              </h4>
              <button
                type="button"
                className="node-panel-close"
                onClick={() => {
                  setSelectedAreaId(null);
                  setEditingDockPose(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {isDocking && dock && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  marginBottom: '10px',
                  fontSize: '12px',
                }}
              >
                <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: '11px' }}>Position (m)</div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>X</span>
                  {canEditDockingPose && editingDockPose ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingDockPose.x}
                      onChange={(e) =>
                        setEditingDockPose({ ...editingDockPose, x: parseFloat(e.target.value) || 0 })
                      }
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{dock.x!.toFixed(2)}</div>
                  )}
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Y</span>
                  {canEditDockingPose && editingDockPose ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingDockPose.y}
                      onChange={(e) =>
                        setEditingDockPose({ ...editingDockPose, y: parseFloat(e.target.value) || 0 })
                      }
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{dock.y!.toFixed(2)}</div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
                  Size (m)
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Width</span>
                  {canEditDockingPose && editingDockPose ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={editingDockPose.width}
                      onChange={(e) =>
                        setEditingDockPose({
                          ...editingDockPose,
                          width: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                        })
                      }
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{dock.width!.toFixed(2)}</div>
                  )}
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Height</span>
                  {canEditDockingPose && editingDockPose ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={editingDockPose.height}
                      onChange={(e) =>
                        setEditingDockPose({
                          ...editingDockPose,
                          height: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                        })
                      }
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{dock.height!.toFixed(2)}</div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>Orientation (°)</span>
                  {canEditDockingPose && editingDockPose ? (
                    <input
                      type="number"
                      step="1"
                      value={radToDeg(editingDockPose.yaw).toFixed(1)}
                      onChange={(e) =>
                        setEditingDockPose({
                          ...editingDockPose,
                          yaw: degToRad(parseFloat(e.target.value) || 0),
                        })
                      }
                      style={{ ...inputStyle, marginTop: '2px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, color: '#2563eb' }}>
                      {radToDeg(dock.yaw ?? 0).toFixed(1)}°
                    </div>
                  )}
                </div>
              </div>
            )}

            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Name
            </label>
            <input
              type="text"
              value={editingZoneName}
              onChange={(e) => setEditingZoneName(e.target.value)}
              readOnly={isDocking ? !canEditDockingPose : false}
              style={{ ...inputStyle, marginBottom: '8px' }}
            />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isDocking && canEditDockingPose && (
                <button
                  type="button"
                  onClick={saveDockPose}
                  disabled={!editingDockPose}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#fff',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Apply Pose
                </button>
              )}
              {(!isDocking || canEditDockingPose) && (
                <button
                  type="button"
                  onClick={saveSelectedZoneName}
                  disabled={zoneNameSaving || !editingZoneName.trim()}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#fff',
                    background: '#1a1a1a',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: zoneNameSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {zoneNameSaving ? 'Saving…' : isDocking ? 'Save Name' : 'Save Name'}
                </button>
              )}
              {canEditDockingPose || !isDocking ? (
                <button
                  type="button"
                  onClick={deleteSelectedArea}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
            {isDocking && canEditDockingPose && (
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                Drag to move · use the handle to rotate (like nodes)
              </p>
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
              {selectedRobot.status && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Status:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getStatusColor(selectedRobot.status),
                      }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                      {selectedRobot.status}
                    </span>
                  </div>
                </div>
              )}

              {selectedRobot.battery !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '14px' }}>Battery:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '40px',
                      height: '6px',
                      background: '#e5e7eb',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${selectedRobot.battery}%`,
                        height: '100%',
                        background: selectedRobot.battery > 20 ? '#10b981' : '#ef4444',
                        borderRadius: '3px',
                      }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>
                      {selectedRobot.battery}%
                    </span>
                  </div>
                </div>
              )}

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
