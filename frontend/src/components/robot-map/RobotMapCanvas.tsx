import React from 'react';
import type { RestrictedArea } from './types';
import type { RobotMapCanvasProps } from './RobotMapCanvas.types';
import { getNodeRadius, getNodeYaw, NODE_R_ACTIVE } from './constants';
import {
  yawToHandlePos,
  radToDeg,
  deriveDockingFromPolygon,
  normalizeDockingArea,
  rosYawDegToSvgRotate,
} from './geometry';
import { renderRobotMarker, renderInnerNodeArrow } from './markers';

const RobotMapCanvas: React.FC<RobotMapCanvasProps> = ({
  mapData,
  mapName,
  graphData,
  showGraph,
  isGraphEditorMode,
  isAddingNode,
  placingNode,
  polygonMode,
  mousePosition,
  selectedNodeId,
  selectedNodeForEdge,
  draggingNodeId,
  rotatingNodeId,
  selectedAreaId,
  draggingDockingId,
  normalizedDockingAreas,
  allRenderableAreas,
  zonesReadOnly,
  canEditDockingPose,
  robots,
  selectedRobotId,
  restrictedAreas,
  getSvgPoint,
  svgPointToRos,
  convertGraphNodeToPixel,
  convertRosToPixel,
  convertToPixel,
  getAssignedDockingArea,
  setPlacingNode,
  setIsDragging,
  setDraggingNodeId,
  setDragOffset,
  setSelectedNodeId,
  setSelectedRobotId,
  setEditingNode,
  setRotatingNodeId,
  setDraggingDockingId,
  setRotatingDockingId,
  setPolygonMode,
  stopPolygonCreation,
  saveAreaToDatabase,
  selectArea,
  closeNodePanel,
  onGraphDataChange,
  onRestrictedAreasChange,
  onNodeSelectedForEdge,
}) => {
  return (
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
            
            const isDockingDraw = polygonMode.type === 'docking-pallet';
            const draftArea: RestrictedArea = {
              id: `area-${Date.now()}`,
              name: `${isDockingDraw ? 'Docking' : 'Restricted'} Area ${
                isDockingDraw
                  ? (graphData?.docking_areas?.length ?? 0) + 1
                  : restrictedAreas.length + 1
              }`,
              startPoint: polygonMode.startPoint,
              endPoint: clickPoint,
              polygonPoints: rosCoordinates,
              color: isDockingDraw ? '#3b82f6' : '#ef4444',
              type: 'polygon',
              zoneType: polygonMode.type,
              mapName: mapName ?? mapData?.map_name,
            };

            if (isDockingDraw) {
              if (graphData && onGraphDataChange) {
                const pose = deriveDockingFromPolygon(rosCoordinates);
                const newDock = normalizeDockingArea({
                  id: `dock_${Date.now()}`,
                  name: draftArea.name,
                  polygon_points: rosCoordinates,
                  ...pose,
                });
                onGraphDataChange({
                  ...graphData,
                  docking_areas: [...(graphData.docking_areas ?? []), newDock],
                });
              }
              stopPolygonCreation();
              return;
            }

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
      <defs>
        <marker
          id="dock-link-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />
        </marker>
      </defs>
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
        const hasDocking = !!getAssignedDockingArea(node.id);
        const nodeColor = isSelected || isDraggingThis ? '#059669' : isSelectedForEdge ? '#f59e0b' : hasDocking ? '#2563eb' : '#10b981';
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
                      const updatedDocking = (graphData.docking_areas ?? []).map((a) =>
                        a.assigned_node_id === node.id
                          ? { ...a, assigned_node_id: undefined }
                          : a
                      );
                      onGraphDataChange({
                        ...graphData,
                        nodes: updatedNodes,
                        edges: updatedEdges,
                        docking_areas: updatedDocking,
                      });
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

      {/* Render restricted areas */}
      {allRenderableAreas.map((area: RestrictedArea) => {
        const isSelected = selectedAreaId === area.id;
        const glowColor = 'rgba(239, 68, 68, 0.4)';
        if (area.type === 'polygon' && area.polygonPoints) {
          const points = area.polygonPoints
            .reduce((acc, val, idx) => {
              if (idx % 2 === 0) {
                const x = val;
                const y = area.polygonPoints![idx + 1];
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
                fillOpacity={0.3}
                stroke={area.color}
                strokeWidth={isSelected ? '3' : '2'}
                strokeDasharray={isSelected ? '8,4' : '5,5'}
                style={{
                  pointerEvents: zonesReadOnly ? 'none' : 'auto',
                  cursor: zonesReadOnly ? 'default' : 'pointer',
                  filter: isSelected ? `drop-shadow(0 0 8px ${glowColor})` : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectArea(area.id);
                }}
              />
              {area.polygonPoints.length >= 2 && mapData && (
                <text
                  x={convertRosToPixel(area.polygonPoints[0], area.polygonPoints[1]).x}
                  y={convertRosToPixel(area.polygonPoints[0], area.polygonPoints[1]).y - 6}
                  fill={area.color}
                  fontSize="12"
                  fontWeight="bold"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {area.name}
                </text>
              )}
            </g>
          );
        }
        
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

      {/* Render docking areas (graph-owned) */}
      {normalizedDockingAreas.map((dock) => {
        if (!mapData) return null;
        const isSelected = selectedAreaId === dock.id;
        const isDraggingThis = draggingDockingId === dock.id;
        const assignedNode = dock.assigned_node_id
          ? graphData?.nodes.find((n) => n.id === dock.assigned_node_id)
          : undefined;
        const centerPx = convertRosToPixel(dock.x!, dock.y!);
        const wPx = dock.width! / mapData.resolution;
        const hPx = dock.height! / mapData.resolution;
        const yaw = dock.yaw ?? 0;
        const svgRotate = -radToDeg(yaw);
        const handleLocalX = wPx / 2 + 8;
        const canInteract = canEditDockingPose;

        return (
          <g
            key={dock.id}
            transform={`translate(${centerPx.x}, ${centerPx.y}) rotate(${svgRotate})`}
          >
            <rect
              x={-wPx / 2}
              y={-hPx / 2}
              width={wPx}
              height={hPx}
              fill="#3b82f6"
              fillOpacity={assignedNode ? 0.4 : 0.3}
              stroke="#3b82f6"
              strokeWidth={isSelected || assignedNode ? 3 : 2}
              strokeDasharray={isSelected ? '8,4' : '4,3'}
              style={{
                pointerEvents: 'auto',
                cursor: canInteract ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                filter: isSelected ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
              }}
              onMouseDown={(e) => {
                if (!canInteract) return;
                e.stopPropagation();
                setDraggingDockingId(dock.id);
                setIsDragging(false);
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectArea(dock.id);
              }}
            />
            {/* Orientation arrow at center */}
            <g style={{ pointerEvents: 'none' }}>
              {renderInnerNodeArrow(0, Math.min(wPx, hPx) * 0.18, {
                arrowColor: '#1d4ed8',
                opacity: 0.95,
              })}
            </g>
            {canInteract && isSelected && (
              <circle
                cx={handleLocalX}
                cy={0}
                r="5"
                fill="#1a1a1a"
                stroke="#ffffff"
                strokeWidth="1.5"
                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setRotatingDockingId(dock.id);
                  setIsDragging(false);
                }}
              />
            )}
            <text
              x={-wPx / 2}
              y={-hPx / 2 - 6}
              fill="#3b82f6"
              fontSize="12"
              fontWeight="bold"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
              transform={`rotate(${-svgRotate})`}
            >
              {dock.name}
              {assignedNode ? ` → ${assignedNode.description || assignedNode.id}` : ''}
            </text>
          </g>
        );
      })}

      {/* Node ↔ docking area links (on top of zones & nodes) */}
      {(showGraph || isGraphEditorMode) &&
        normalizedDockingAreas.map((dock) => {
          if (!dock.assigned_node_id || !mapData) return null;
          const node = graphData?.nodes.find((n) => n.id === dock.assigned_node_id);
          if (!node) return null;
          const nodePos = convertGraphNodeToPixel(node);
          const zonePos = convertRosToPixel(dock.x!, dock.y!);
          const isHighlighted = selectedNodeId === node.id || selectedAreaId === dock.id;
          return (
            <g key={`dock-link-${dock.id}`} style={{ pointerEvents: 'none' }}>
              <line
                x1={nodePos.x}
                y1={nodePos.y}
                x2={zonePos.x}
                y2={zonePos.y}
                stroke="#2563eb"
                strokeWidth={isHighlighted ? 3.5 : 2.5}
                strokeDasharray="8,5"
                opacity={0.95}
                markerEnd="url(#dock-link-arrow)"
              />
              <circle cx={nodePos.x} cy={nodePos.y} r={4} fill="#2563eb" fillOpacity={0.9} />
              <circle cx={zonePos.x} cy={zonePos.y} r={5} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />
            </g>
          );
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
  );
};

export default RobotMapCanvas;
