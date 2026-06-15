import { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/DashboardContent.css';
import RobotMap from './RobotMap';
import robotWebSocketService from '../services/robotWebSocketService';
import { BACKEND_URL } from '../config';

interface Robot {
  id: string;
  name: string;
  status: string;
  battery: number;
  position: { x: number; y: number };
  orientation: number;
  currentTask: string;
  speed: number;
  temperature: number;
  capabilities: {
    maxSpeed: number;
    maxPayload: number;
    sensors: string[];
  };
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
  color: string;
  type: 'restricted' | 'docking-pallet' | 'polygon';
  isSelected?: boolean;
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

type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface RobotCommand {
  _id: string;
  robot_name: string;
  command_type: string;
  node_id: string;
  graph_name?: string;
  node_description?: string;
  goal: { x: number; y: number; z: number; yaw: number };
  status: CommandStatus;
  error_message?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

const COMMAND_STATUS_LABEL: Record<CommandStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const MAP_STORAGE_KEY = 'dashboard_selected_map';

interface MapSummary {
  map_name: string;
  width_px: number;
  height_px: number;
  resolution: number;
}

interface MapRobotInfo {
  robot_name: string;
  active_graph_name?: string;
}

function offlineRobot(id: string): Robot {
  return {
    id,
    name: id,
    status: 'offline',
    battery: 0,
    position: { x: 0, y: 0 },
    orientation: 0,
    currentTask: '',
    speed: 0,
    temperature: 0,
    capabilities: { maxSpeed: 0, maxPayload: 0, sensors: [] },
  };
}

function DashboardContent() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null);
  const [mapRobots, setMapRobots] = useState<MapRobotInfo[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [restrictedAreas, setRestrictedAreas] = useState<RestrictedArea[]>([]);
  const [showGraph, setShowGraph] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [activeGraphName, setActiveGraphName] = useState<string | null>(null);
  const [latestCommand, setLatestCommand] = useState<RobotCommand | null>(null);
  const [sendRobotLoading, setSendRobotLoading] = useState(false);
  const [commandToast, setCommandToast] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const mapRobotNames = useMemo(
    () => new Set(mapRobots.map((r) => r.robot_name)),
    [mapRobots]
  );

  const robotsOnMap = useMemo(
    () => robots.filter((r) => mapRobotNames.has(r.id)),
    [robots, mapRobotNames]
  );

  const selectableRobots = useMemo(() => {
    const liveIds = new Set(robotsOnMap.map((r) => r.id));
    const offline = mapRobots
      .filter((mr) => !liveIds.has(mr.robot_name))
      .map((mr) => offlineRobot(mr.robot_name));
    return [...robotsOnMap, ...offline];
  }, [robotsOnMap, mapRobots]);

  const effectiveRobotId = selectedRobotId ?? selectableRobots[0]?.id ?? null;

  const currentRobot = useMemo(() => {
    const id = effectiveRobotId;
    if (!id) return offlineRobot('—');
    return (
      robotsOnMap.find((r) => r.id === id) ??
      selectableRobots.find((r) => r.id === id) ??
      offlineRobot(id)
    );
  }, [effectiveRobotId, robotsOnMap, selectableRobots]);

  // Load available maps
  useEffect(() => {
    const loadMaps = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/maps`);
        if (!res.ok) throw new Error('Failed to load maps');
        const data: MapSummary[] = await res.json();
        setMaps(data);

        if (data.length > 0) {
          const stored = localStorage.getItem(MAP_STORAGE_KEY);
          const validStored = stored && data.some((m) => m.map_name === stored);
          setSelectedMapName(validStored ? stored : data[0].map_name);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load maps');
      } finally {
        setMapsLoading(false);
      }
    };

    loadMaps();
  }, []);

  // Load robots registered on the selected map
  useEffect(() => {
    if (!selectedMapName) {
      setMapRobots([]);
      return;
    }

    localStorage.setItem(MAP_STORAGE_KEY, selectedMapName);

    const loadMapRobots = async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/maps/${encodeURIComponent(selectedMapName)}/robots`
        );
        if (res.ok) {
          setMapRobots(await res.json());
        } else {
          setMapRobots([]);
        }
      } catch {
        setMapRobots([]);
      }
    };

    loadMapRobots();
  }, [selectedMapName]);

  // Keep selected robot id in sync with map filter
  useEffect(() => {
    if (selectableRobots.length === 0) {
      setSelectedRobotId(null);
      return;
    }
    setSelectedRobotId((prev) => {
      if (prev && selectableRobots.some((r) => r.id === prev)) return prev;
      return selectableRobots[0].id;
    });
  }, [selectableRobots, selectedMapName]);

  // Load active graph for the current map / robot
  useEffect(() => {
    if (!selectedMapName) return;

    const loadGraphForMap = async () => {
      try {
        if (effectiveRobotId) {
          const activeRes = await fetch(`${BACKEND_URL}/graphs/active/${effectiveRobotId}`);
          if (activeRes.ok) {
            const text = await activeRes.text();
            if (text) {
              const record = JSON.parse(text);
              if (record?.graph && record.map_name === selectedMapName) {
                setGraphData(record.graph);
                setActiveGraphName(record.graph_name ?? null);
                return;
              }
            }
          }
        }
        setActiveGraphName(null);

        const listRes = await fetch(
          `${BACKEND_URL}/graphs?map_name=${encodeURIComponent(selectedMapName)}`
        );
        if (!listRes.ok) {
          setGraphData({ nodes: [], edges: [] });
          return;
        }
        const graphList: { _id: string; graph_name?: string }[] = await listRes.json();
        if (!graphList.length) {
          setGraphData({ nodes: [], edges: [] });
          return;
        }

        const fullRes = await fetch(`${BACKEND_URL}/graphs/${graphList[0]._id}`);
        if (fullRes.ok) {
          const full = await fullRes.json();
          setGraphData(full.graph ?? { nodes: [], edges: [] });
          setActiveGraphName(full.graph_name ?? graphList[0].graph_name ?? null);
        } else {
          setGraphData({ nodes: [], edges: [] });
          setActiveGraphName(null);
        }
      } catch {
        setGraphData({ nodes: [], edges: [] });
        setActiveGraphName(null);
      }
    };

    loadGraphForMap();
  }, [selectedMapName, effectiveRobotId]);

  // Poll latest robot command for status display
  useEffect(() => {
    if (!effectiveRobotId) return;

    const fetchCommand = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/commands/latest/${effectiveRobotId}`);
        if (res.ok) {
          const text = await res.text();
          setLatestCommand(text ? JSON.parse(text) : null);
        }
      } catch {
        /* ignore poll errors */
      }
    };

    fetchCommand();
    const interval = setInterval(fetchCommand, 2000);
    return () => clearInterval(interval);
  }, [effectiveRobotId]);

  // useMemo before conditional returns
  const robotsWithFullData = useMemo(
    () =>
      robotsOnMap.map((robot) => ({
        id: robot.id,
        name: robot.name,
        position: robot.position,
        orientation: robot.orientation,
        status: robot.status,
        battery: robot.battery,
        currentTask: robot.currentTask,
        speed: robot.speed,
        temperature: robot.temperature,
      })),
    [robotsOnMap]
  );

  // WebSocket bağlantısı ve robot verilerini alma
  useEffect(() => {
    console.log('Setting up WebSocket connection...');
    setLoading(true);

    const handleRobotsData = (robotsData: Robot[]) => {
      console.log('Received robots data via WebSocket:', robotsData.length, 'robots');
      
      // Gereksiz re-render'ları önlemek için data karşılaştırması
      const hasChanged = JSON.stringify(robots) !== JSON.stringify(robotsData);
      if (hasChanged || isInitialLoad.current) {
        setRobots(robotsData);
        console.log('Robot data updated via WebSocket');
      } else {
        console.log('Robot data unchanged - skipping update');
      }
      
      // Sadece ilk yüklemede loading'i kapat
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
        console.log('Initial load completed via WebSocket');
      }
      
      // Hata durumunu temizle
      setError(null);
    };

    const handleError = (errorMessage: string) => {
      console.error('WebSocket error:', errorMessage);
      setError(errorMessage);
      
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    };

    // WebSocket bağlantısını başlat
    robotWebSocketService.connect(handleRobotsData, handleError);

    // Cleanup function
    return () => {
      console.log('Cleaning up WebSocket connection...');
      robotWebSocketService.disconnect();
    };
  }, []); // Boş dependency array - sadece mount/unmount'ta çalışsın

  if (mapsLoading || loading) {
    return (
      <main className="main-content">
        <div className="loading">Loading dashboard...</div>
      </main>
    );
  }

  if (error && maps.length === 0) {
    return (
      <main className="main-content">
        <div className="error">Error: {error}</div>
      </main>
    );
  }

  if (maps.length === 0) {
    return (
      <main className="main-content">
        <div className="no-data">No maps found</div>
      </main>
    );
  }

  const handleMapChange = (mapName: string) => {
    setSelectedMapName(mapName);
    setSelectedRobotId(null);
  };

  const handleRobotChange = (robotId: string) => {
    setSelectedRobotId(robotId);
  };

  const getStatusDotClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active' || s === 'online') return 'online';
    if (s === 'idle') return 'idle';
    if (s === 'charging') return 'charging';
    if (s === 'error') return 'error';
    return 'online';
  };

  const refreshLatestCommand = async () => {
    if (!effectiveRobotId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/commands/latest/${effectiveRobotId}`);
      if (res.ok) {
        const text = await res.text();
        setLatestCommand(text ? JSON.parse(text) : null);
      }
    } catch { /* ignore */ }
  };

  const handleSendRobotToNode = async (node: GraphNode) => {
    setSendRobotLoading(true);
    setCommandToast(null);
    try {
      const res = await fetch(`${BACKEND_URL}/commands/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot_name: currentRobot.id,
          node_id: node.id,
          graph_name: activeGraphName ?? undefined,
          node_description: node.description,
          goal: {
            x: node.x,
            y: node.y,
            z: node.z,
            yaw: node.yaw ?? 0,
          },
        }),
      });

      if (res.status === 409) {
        const err = await res.json();
        setCommandToast(err.message || 'Robot is busy');
        return;
      }

      if (!res.ok) {
        setCommandToast('Failed to send robot');
        return;
      }

      setCommandToast(`Command sent to ${node.description || node.id}`);
      await refreshLatestCommand();
      setTimeout(() => setCommandToast(null), 3000);
    } catch {
      setCommandToast('Failed to send robot');
    } finally {
      setSendRobotLoading(false);
    }
  };

  const getCommandStatusClass = (status: CommandStatus) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'accepted': return 'accepted';
      case 'in_progress': return 'in-progress';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'cancelled': return 'cancelled';
      default: return 'pending';
    }
  };

  return (
    <main className="main-content">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="map-selector">
            <label htmlFor="map-select" className="robot-selector-label">Map</label>
            <select
              id="map-select"
              value={selectedMapName ?? ''}
              onChange={(e) => handleMapChange(e.target.value)}
            >
              {maps.map((map) => (
                <option key={map.map_name} value={map.map_name}>
                  {map.map_name}
                </option>
              ))}
            </select>
          </div>

          <div className="robot-selector">
            <label htmlFor="robot-select" className="robot-selector-label">Robot</label>
            <select
              id="robot-select"
              value={currentRobot.id}
              onChange={(e) => handleRobotChange(e.target.value)}
              disabled={selectableRobots.length === 0}
            >
              {selectableRobots.length === 0 ? (
                <option value="">No robots on map</option>
              ) : (
                selectableRobots.map((robot) => (
                  <option key={robot.id} value={robot.id}>
                    {robot.name || robot.id}
                    {robot.status === 'offline' ? ' (offline)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="status-indicators">
            <div className="status-item">
              <div className={`status-dot ${getStatusDotClass(currentRobot.status)}`}></div>
              <span className="status-text">{currentRobot.status}</span>
            </div>
            <div className="status-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="status-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              <span className="status-text">{currentRobot.currentTask || 'No task'}</span>
            </div>
            <div className="status-item battery-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="status-icon">
                <rect x="1" y="6" width="18" height="12" rx="2"/>
                <line x1="23" y1="11" x2="23" y2="13"/>
              </svg>
              <div className="battery-bar">
                <div
                  className="battery-fill"
                  style={{
                    width: `${currentRobot.battery}%`,
                    background: currentRobot.battery > 20 ? '#10b981' : '#ef4444'
                  }}
                />
              </div>
              <span className="status-text">{currentRobot.battery}%</span>
            </div>
          </div>
        </div>

        <div className="header-controls">
          {commandToast && (
            <span className="command-toast">{commandToast}</span>
          )}
          <button
            className={`control-btn ${showGraph ? 'primary' : ''}`}
            onClick={() => setShowGraph(!showGraph)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            {showGraph ? 'Hide' : 'Show'} Graph
          </button>
        </div>
      </div>

      {latestCommand && (
        <div className={`command-status-bar command-status-bar--${getCommandStatusClass(latestCommand.status)}`}>
          <div className="command-status-main">
            <span className={`command-status-badge command-status-badge--${getCommandStatusClass(latestCommand.status)}`}>
              {COMMAND_STATUS_LABEL[latestCommand.status]}
            </span>
            <span className="command-status-target">
              → {latestCommand.node_description || latestCommand.node_id}
            </span>
            <span className="command-status-goal">
              ({latestCommand.goal.x.toFixed(2)}m, {latestCommand.goal.y.toFixed(2)}m, {((latestCommand.goal.yaw * 180) / Math.PI).toFixed(0)}°)
            </span>
          </div>
          {latestCommand.error_message && (
            <span className="command-status-error">{latestCommand.error_message}</span>
          )}
        </div>
      )}

      <div className="map-container">
        <div className="map-wrapper">
          <RobotMap 
            mapName={selectedMapName ?? undefined}
            robotName={currentRobot.id !== '—' ? currentRobot.id : undefined}
            robots={robotsWithFullData}
            coordinateSystem={{ 
              type: 'coordinate'
            }}
            enablePolygonDrawing={true}
            restrictedAreas={restrictedAreas}
            onRestrictedAreasChange={setRestrictedAreas}
            graphData={graphData || undefined}
            showGraph={showGraph}
            enableSendRobot={true}
            onSendRobotToNode={handleSendRobotToNode}
            sendRobotLoading={sendRobotLoading}
          />
        </div>
      </div>
    </main>
  );
}

export default DashboardContent;