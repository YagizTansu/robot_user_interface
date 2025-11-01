import React, { useState, useEffect } from 'react';
import '../styles/RobotMap.css';

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

interface MapMetadata {
  resolution: number;  // meter/pixel
  origin: {
    x: number;  // meter
    y: number;  // meter
    theta: number;  // radyan
  };
  width: number;  // pixel
  height: number;  // pixel
}

interface RobotMapProps {
  mapImagePath?: string;
  robots?: Robot[];
  coordinateSystem?: {
    type: 'percentage' | 'coordinate';
    maxX?: number;
    maxY?: number;
  };
  robotSvgPath?: string;
  enablePolygonDrawing?: boolean;
  restrictedAreas?: RestrictedArea[];
  onRestrictedAreasChange?: (areas: RestrictedArea[]) => void;
  graphData?: GraphData;
  showGraph?: boolean;
  mapMetadata?: MapMetadata;  // ROS map metadata
  // Graph editing props
  isGraphEditorMode?: boolean;
  onGraphDataChange?: (data: GraphData) => void;
  isAddingNode?: boolean;
  onNodeAdded?: () => void;
  selectedNodeForEdge?: string | null;
  onNodeSelectedForEdge?: (nodeId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface RestrictedArea {
  id: string;
  name: string;
  startPoint: Point;
  endPoint: Point;
  color: string;
  type: 'restricted' | 'docking-pallet';
  isSelected?: boolean;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
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

const RobotMap: React.FC<RobotMapProps> = ({ 
  mapImagePath = '/maps/aws_warehouse.svg',
  robots = [],
  robotSvgPath = '/robots/robot.svg',
  enablePolygonDrawing = false,
  restrictedAreas = [],
  onRestrictedAreasChange,
  graphData,
  showGraph = true,
  mapMetadata,
  // Graph editing props
  isGraphEditorMode = false,
  onGraphDataChange,
  isAddingNode = false,
  onNodeAdded,
  selectedNodeForEdge = null,
  onNodeSelectedForEdge
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
  
  // Polygon creation states
  const [polygonMode, setPolygonMode] = useState<PolygonCreationMode>({ isActive: false, type: 'restricted' });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number }>({ width: 100, height: 100 });

  // SVG boyutlarını otomatik oku
  useEffect(() => {
    const loadSvgDimensions = async () => {
      try {
        const response = await fetch(mapImagePath);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (svgElement) {
          const viewBox = svgElement.getAttribute('viewBox');
          if (viewBox) {
            const [, , width, height] = viewBox.split(' ').map(Number);
            setSvgDimensions({ width, height });
            console.log(`SVG dimensions detected: ${width}x${height}`);
          } else {
            // viewBox yoksa width/height attribute'lerini kontrol et
            const width = parseFloat(svgElement.getAttribute('width') || '100');
            const height = parseFloat(svgElement.getAttribute('height') || '100');
            setSvgDimensions({ width, height });
            console.log(`SVG dimensions from attributes: ${width}x${height}`);
          }
        }
      } catch (error) {
        console.error('Error loading SVG dimensions:', error);
        // Hata durumunda default değerleri kullan
        setSvgDimensions({ width: 100, height: 100 });
      }
    };

    loadSvgDimensions();
  }, [mapImagePath]);

  const convertToPixel = (position: { x: number; y: number }) => {
    // ROS koordinatlarını direkt pixel'e çeviriyoruz
    if (mapMetadata) {
      return convertRosToPixel(position.x, position.y);
    }
    
    // Fallback: Direkt coordinate kullan
    return position;
  };

  // ROS koordinatlarını pixel koordinatlarına dönüştür
  const convertRosToPixel = (rosX: number, rosY: number) => {
    if (!mapMetadata) {
      return { x: svgDimensions.width / 2, y: svgDimensions.height / 2 }; // Fallback to center
    }

    // ROS koordinatlarını pixel koordinatlarına dönüştür
    const pixelX = (rosX - mapMetadata.origin.x) / mapMetadata.resolution;
    const pixelY = (rosY - mapMetadata.origin.y) / mapMetadata.resolution;
    
    // ROS'ta Y ekseni yukarı, image'lerde Y ekseni aşağı
    const imageY = mapMetadata.height - pixelY;
    
    // Debug log - daha detaylı bilgi
    console.log(`ROS->Pixel Conversion:
      Input ROS: (${rosX.toFixed(2)}, ${rosY.toFixed(2)})
      Map Origin: (${mapMetadata.origin.x}, ${mapMetadata.origin.y})
      Resolution: ${mapMetadata.resolution} m/px
      Map Size: ${mapMetadata.width}x${mapMetadata.height} px
      Calculated pixel: (${pixelX.toFixed(1)}, ${pixelY.toFixed(1)})
      Final image coords: (${pixelX.toFixed(1)}, ${imageY.toFixed(1)})`);
    
    return {
      x: pixelX,
      y: imageY
    };
  };

  const convertGraphNodeToPixel = (node: GraphNode) => {
    // Graph node'ları için de direkt pixel koordinatları kullan
    if (mapMetadata) {
      return convertRosToPixel(node.x, node.y);
    }
    
    // Fallback: Direkt coordinate kullan
    return { x: node.x, y: node.y };
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
    if (polygonMode.isActive || draggingNodeId) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Node sürükleme
    if (draggingNodeId && graphData && onGraphDataChange && mapMetadata && dragOffset) {
      const svg = e.currentTarget.querySelector('svg');
      if (!svg) return;
      
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // SVG koordinatlarını ROS koordinatlarına çevir
      const rosY = mapMetadata.height - svgP.y;
      const rosX = (svgP.x * mapMetadata.resolution) + mapMetadata.origin.x;
      const rosYCoord = (rosY * mapMetadata.resolution) + mapMetadata.origin.y;
      
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
    
    if (polygonMode.isActive && polygonMode.startPoint) {
      const svg = e.currentTarget.querySelector('svg');
      if (!svg) return;
      
      // SVG koordinat sistemine dönüştür
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // SVG koordinatlarını yüzde değerine çevir
      const x = (svgP.x / svgDimensions.width) * 100;
      const y = (svgP.y / svgDimensions.height) * 100;
      
      setMousePosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    }
    
    if (!isDragging || polygonMode.isActive || draggingNodeId) return;
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
    setIsDragging(false);
    setDraggingNodeId(null);
    setDragOffset(null);
  };

  const startPolygonCreation = (type: 'restricted' | 'docking-pallet' = 'restricted') => {
    setPolygonMode({ isActive: true, type });
  };

  const stopPolygonCreation = () => {
    setPolygonMode({ isActive: false, type: 'restricted', startPoint: undefined });
    setMousePosition({ x: 0, y: 0 });
  };

  const selectArea = (areaId: string) => {
    setSelectedAreaId(selectedAreaId === areaId ? null : areaId);
  };

  const deleteSelectedArea = () => {
    if (!selectedAreaId) return;
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
            cursor: polygonMode.isActive ? 'crosshair' : (isDragging ? 'grabbing' : 'grab')
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            src={mapImagePath}
            alt="Warehouse Map"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              borderRadius: '12px',
              userSelect: 'none'
            }}
          />

          {/* SVG overlay for polygons and graph */}
          <svg
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: (isGraphEditorMode && isAddingNode) || polygonMode.isActive ? 'auto' : 'none',
              zIndex: 5,
              cursor: (isGraphEditorMode && isAddingNode) || polygonMode.isActive ? 'crosshair' : 'default'
            }}
            onClick={(e) => {
              // Polygon drawing mode
              if (polygonMode.isActive) {
                const svg = e.currentTarget;
                
                // SVG koordinat sisteminde tıklanan noktayı al
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                
                // Screen koordinatlarını SVG koordinatlarına çevir
                const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                
                // SVG koordinatlarını yüzde değerine çevir
                const x = (svgP.x / svgDimensions.width) * 100;
                const y = (svgP.y / svgDimensions.height) * 100;
                
                const clickPoint = { 
                  x: Math.max(0, Math.min(100, x)), 
                  y: Math.max(0, Math.min(100, y)) 
                };
                
                if (!polygonMode.startPoint) {
                  setPolygonMode(prev => ({ ...prev, startPoint: clickPoint }));
                } else {
                  const newArea: RestrictedArea = {
                    id: `area-${Date.now()}`,
                    name: `${polygonMode.type === 'restricted' ? 'Restricted' : 'Docking'} Area ${restrictedAreas.length + 1}`,
                    startPoint: polygonMode.startPoint,
                    endPoint: clickPoint,
                    color: polygonMode.type === 'restricted' ? '#ef4444' : '#3b82f6',
                    type: polygonMode.type
                  };
                  
                  const updatedAreas = [...restrictedAreas, newArea];
                  onRestrictedAreasChange?.(updatedAreas);
                  stopPolygonCreation();
                }
                return;
              }
              
              // Graph editor mode - SVG içinde node ekleme
              if (isGraphEditorMode && isAddingNode && graphData && onGraphDataChange && mapMetadata) {
                const svg = e.currentTarget;
                
                // SVG koordinat sisteminde tıklanan noktayı al
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                
                // Screen koordinatlarını SVG koordinatlarına çevir
                const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                
                // SVG koordinatlarını ROS koordinatlarına çevir
                const rosY = mapMetadata.height - svgP.y;
                const rosX = (svgP.x * mapMetadata.resolution) + mapMetadata.origin.x;
                const rosYCoord = (rosY * mapMetadata.resolution) + mapMetadata.origin.y;
                
                // Yeni node oluştur
                const newNode: GraphNode = {
                  id: `node_${Date.now()}`,
                  x: parseFloat(rosX.toFixed(2)),
                  y: parseFloat(rosYCoord.toFixed(2)),
                  z: 0.0,
                  type: 'waypoint',
                  description: `Node ${graphData.nodes.length + 1}`
                };
                
                onGraphDataChange({
                  ...graphData,
                  nodes: [...graphData.nodes, newNode]
                });
                
                onNodeAdded?.();
                console.log('Node added at SVG:', { x: svgP.x.toFixed(1), y: svgP.y.toFixed(1) }, 'ROS:', { x: rosX.toFixed(2), y: rosYCoord.toFixed(2) });
              }
            }}
          >
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
            
            {/* Render graph nodes (waypoints) */}
            {showGraph && graphData?.nodes.map((node) => {
              const pos = convertGraphNodeToPixel(node);
              const isSelected = selectedNodeId === node.id;
              const isSelectedForEdge = selectedNodeForEdge === node.id;
              const isDraggingThis = draggingNodeId === node.id;
              
              return (
                <g key={node.id}>
                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSelected || isDraggingThis ? "7" : isSelectedForEdge ? "6" : "5"}
                    fill={isSelected || isDraggingThis ? "#059669" : isSelectedForEdge ? "#f59e0b" : "#10b981"}
                    stroke="#ffffff"
                    strokeWidth={isSelected || isSelectedForEdge || isDraggingThis ? "2" : "1.5"}
                    opacity={isDraggingThis ? "0.7" : "0.9"}
                    style={{
                      filter: isSelected || isDraggingThis ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                      cursor: isGraphEditorMode ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (isGraphEditorMode && selectedNodeForEdge === null) {
                        // Graph editor mode - node sürükleme başlat
                        setDraggingNodeId(node.id);
                        setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (draggingNodeId) {
                        // Sürükleme bitince tıklama olayını ignore et
                        return;
                      }
                      if (isGraphEditorMode && selectedNodeForEdge !== null && onNodeSelectedForEdge) {
                        // Graph editor mode - edge oluşturma modu aktifse edge için node seçimi
                        onNodeSelectedForEdge(node.id);
                      } else {
                        // Normal mode veya edge modu değilse - node bilgilerini göster
                        setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
                        setEditingNode(null);
                      }
                    }}
                  />
                  
                  {/* Graph editor mode - delete button */}
                  {isGraphEditorMode && isSelected && (
                    <g>
                      <circle
                        cx={pos.x + 12}
                        cy={pos.y - 12}
                        r="8"
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        style={{
                          cursor: 'pointer',
                          pointerEvents: 'auto'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (graphData && onGraphDataChange) {
                            // Node'u ve bağlı edge'leri sil
                            const updatedNodes = graphData.nodes.filter(n => n.id !== node.id);
                            const updatedEdges = graphData.edges.filter(e => e.from !== node.id && e.to !== node.id);
                            onGraphDataChange({
                              nodes: updatedNodes,
                              edges: updatedEdges
                            });
                            setSelectedNodeId(null);
                          }
                        }}
                      />
                      <line
                        x1={pos.x + 9}
                        y1={pos.y - 15}
                        x2={pos.x + 15}
                        y2={pos.y - 9}
                        stroke="#ffffff"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                      <line
                        x1={pos.x + 15}
                        y1={pos.y - 15}
                        x2={pos.x + 9}
                        y2={pos.y - 9}
                        stroke="#ffffff"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Render existing restricted areas */}
            {restrictedAreas.map((area: RestrictedArea) => {
              const startPos = area.startPoint;
              const endPos = area.endPoint;
              
              const x = Math.min(startPos.x, endPos.x);
              const y = Math.min(startPos.y, endPos.y);
              const width = Math.abs(endPos.x - startPos.x);
              const height = Math.abs(endPos.y - startPos.y);
              
              const isSelected = selectedAreaId === area.id;
              
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
                  {/* Area label */}
                  <text
                    x={`${x + width/2}%`}
                    y={`${y + height/2}%`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={area.color}
                    fontSize="12"
                    fontWeight="600"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {area.name}
                  </text>
                </g>
              );
            })}

            {/* Render all robots inside SVG */}
            {robots.map((robot) => {
              const robotPos = convertToPixel(robot.position);
              
              // Debug: Robot pozisyonları
              console.log(`Robot ${robot.id} positioning:
                Original position: (${robot.position.x}, ${robot.position.y})
                Converted pixel: (${robotPos.x.toFixed(1)}, ${robotPos.y.toFixed(1)})
                SVG dimensions: ${svgDimensions.width}x${svgDimensions.height}`);
              
              // Robot gerçek boyutları: 100cm x 80cm
              const robotRealWidth = 1.0; // 100cm = 1.0m
              const robotRealHeight = 0.8; // 80cm = 0.8m
              
              // Map metadata varsa gerçek boyutları pixel'e çevir
              let robotPixelWidth = 50; // Default fallback
              let robotPixelHeight = 40; // Default fallback
              
              if (mapMetadata) {
                robotPixelWidth = robotRealWidth / mapMetadata.resolution;
                robotPixelHeight = robotRealHeight / mapMetadata.resolution;
                
                // Minimum boyut kontrolü (çok küçük görünmesin)
                robotPixelWidth = Math.max(robotPixelWidth, 20);
                robotPixelHeight = Math.max(robotPixelHeight, 16);
                
                // Maximum boyut kontrolü (çok büyük görünmesin)
                robotPixelWidth = Math.min(robotPixelWidth, 80);
                robotPixelHeight = Math.min(robotPixelHeight, 64);
              }
              
              const halfWidth = robotPixelWidth / 2;
              const halfHeight = robotPixelHeight / 2;
              
              return (
                <g 
                  key={`robot-${robot.id}`} 
                  transform={`translate(${robotPos.x}, ${robotPos.y}) rotate(${robot.orientation})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRobotId(selectedRobotId === robot.id ? null : robot.id);
                  }}
                >
                  {/* Robot image using foreignObject */}
                  <foreignObject 
                    x={-halfWidth} 
                    y={-halfHeight} 
                    width={robotPixelWidth} 
                    height={robotPixelHeight}
                    style={{ overflow: 'visible' }}
                  >
                    <img 
                      src={robotSvgPath}
                      alt={`Robot ${robot.id}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                        pointerEvents: 'none',
                        overflow: 'visible',
                        objectFit: 'contain'
                      }}
                    />
                  </foreignObject>
                  
                  {/* Robot label */}
                  <foreignObject 
                    x={-halfWidth-4} 
                    y={-halfHeight + 4} 
                    width={robotPixelWidth} 
                    height="14"
                    style={{ overflow: 'visible' }}
                  >
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.75)',
                        color: 'white',
                        padding: '1px 3px',
                        borderRadius: '3px',
                        fontSize: '4px',
                        fontWeight: '500',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        transform: 'rotate(90deg)',
                        transformOrigin: 'center center'
                      }}
                    >
                      {robot.id}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
            
            {/* Preview rectangle while creating */}
            {polygonMode.isActive && polygonMode.startPoint && (
              (() => {
                const startX = polygonMode.startPoint.x;
                const startY = polygonMode.startPoint.y;
                const currentX = mousePosition.x;
                const currentY = mousePosition.y;
                
                const x = Math.min(startX, currentX);
                const y = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                const previewColor = polygonMode.type === 'restricted' ? '#ef4444' : '#3b82f6';
                
                return (
                  <rect
                    x={`${x}%`}
                    y={`${y}%`}
                    width={`${width}%`}
                    height={`${height}%`}
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
        
        const nodePos = convertGraphNodeToPixel(selectedNode);
        const leftPercent = (nodePos.x / svgDimensions.width) * 100;
        const topPercent = (nodePos.y / svgDimensions.height) * 100;

        // Edit mode için
        const isEditing = editingNode?.id === selectedNode.id;

        return (
          <div 
            className="node-info-popup"
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              transform: 'translate(-50%, calc(-100% - 12px))',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              minWidth: isEditing ? '240px' : '180px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 1000,
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                {isEditing ? 'Edit Node' : selectedNode.description}
              </h4>
              <button
                onClick={() => {
                  setSelectedNodeId(null);
                  setEditingNode(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
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
                </div>
                {isGraphEditorMode && (
                  <button
                    onClick={() => setEditingNode({ ...selectedNode })}
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
        const leftPercent = (robotPos.x / svgDimensions.width) * 100;
        const topPercent = (robotPos.y / svgDimensions.height) * 100;

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
