import { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/DashboardContent.css';
import RobotMap from './RobotMap';
import robotWebSocketService from '../services/robotWebSocketService';
import { BACKEND_URL } from '../config';
import { isRobotOnline } from '../utils/robotTime';

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
  lastSeen?: number;
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

interface DockingArea {
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

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  docking_areas?: DockingArea[];
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
const ROBOT_STORAGE_KEY = 'dashboard_selected_robot';
const GRAPH_STORAGE_KEY_PREFIX = 'dashboard_graph_id_';

const ACTIVE_COMMAND_STATUSES = new Set<CommandStatus>([
  'pending',
  'accepted',
  'in_progress',
]);

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

interface GraphListItem {
  _id: string;
  graph_name?: string;
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
  const [wsConnected, setWsConnected] = useState(false);
  const [mapsLoading, setMapsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null);
  const [mapRobots, setMapRobots] = useState<MapRobotInfo[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [graphList, setGraphList] = useState<GraphListItem[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [restrictedAreas, setRestrictedAreas] = useState<RestrictedArea[]>([]);
  const [showGraph, setShowGraph] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [displayGraphName, setDisplayGraphName] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<RobotCommand | null>(null);
  const [sendRobotLoading, setSendRobotLoading] = useState(false);
  const [commandToast, setCommandToast] = useState<string | null>(null);
  const [clientLastSeen, setClientLastSeen] = useState<Record<string, number>>({});
  const [onlineTick, setOnlineTick] = useState(0);
  const userPickedGraphRef = useRef(false);

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

  const isRobotOnlineOnDashboard = (robotId: string): boolean => {
    const live = robotsOnMap.find((r) => r.id === robotId);
    if (!live) return false;
    return isRobotOnline(true, clientLastSeen[robotId], live.lastSeen);
  };

  const robotOnlineMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const robot of selectableRobots) {
      map[robot.id] = isRobotOnlineOnDashboard(robot.id);
    }
    return map;
    // onlineTick: re-evaluate 30s offline threshold
  }, [selectableRobots, robotsOnMap, clientLastSeen, onlineTick]);

  const currentRobotIsOnline = effectiveRobotId
    ? (robotOnlineMap[effectiveRobotId] ?? false)
    : false;

  const robotActiveGraphName = useMemo(() => {
    if (!effectiveRobotId) return null;
    return mapRobots.find((r) => r.robot_name === effectiveRobotId)?.active_graph_name ?? null;
  }, [effectiveRobotId, mapRobots]);

  const isDisplayedGraphRobotActive = Boolean(
    displayGraphName && robotActiveGraphName && displayGraphName === robotActiveGraphName
  );

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
          const data = await res.json();
          setMapRobots(data);
          const storedRobot = localStorage.getItem(ROBOT_STORAGE_KEY);
          if (storedRobot && data.some((r: MapRobotInfo) => r.robot_name === storedRobot)) {
            setSelectedRobotId(storedRobot);
            localStorage.removeItem(ROBOT_STORAGE_KEY);
          }
        } else {
          setMapRobots([]);
        }
      } catch {
        setMapRobots([]);
      }
    };

    loadMapRobots();
    setRestrictedAreas([]);
    userPickedGraphRef.current = false;
  }, [selectedMapName]);

  // Load graph list for the selected map
  useEffect(() => {
    if (!selectedMapName) {
      setGraphList([]);
      setSelectedGraphId(null);
      return;
    }

    const loadGraphList = async () => {
      try {
        const listRes = await fetch(
          `${BACKEND_URL}/graphs?map_name=${encodeURIComponent(selectedMapName)}`
        );
        if (!listRes.ok) {
          setGraphList([]);
          setSelectedGraphId(null);
          return;
        }

        const list: GraphListItem[] = await listRes.json();
        setGraphList(list);

        if (!list.length) {
          setSelectedGraphId(null);
          return;
        }

        if (userPickedGraphRef.current) {
          setSelectedGraphId((prev) =>
            prev && list.some((g) => g._id === prev) ? prev : list[0]._id
          );
          return;
        }

        const storageKey = `${GRAPH_STORAGE_KEY_PREFIX}${selectedMapName}`;
        const stored = localStorage.getItem(storageKey);
        if (stored && list.some((g) => g._id === stored)) {
          setSelectedGraphId(stored);
          return;
        }

        if (robotActiveGraphName) {
          const match = list.find((g) => g.graph_name === robotActiveGraphName);
          if (match) {
            setSelectedGraphId(match._id);
            return;
          }
        }

        setSelectedGraphId(list[0]._id);
      } catch {
        setGraphList([]);
        setSelectedGraphId(null);
      }
    };

    loadGraphList();
  }, [selectedMapName, robotActiveGraphName]);

  // Load full graph when selection changes
  useEffect(() => {
    if (!selectedGraphId) {
      setGraphData({ nodes: [], edges: [] });
      setDisplayGraphName(null);
      return;
    }

    const loadGraph = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`);
        if (res.ok) {
          const full = await res.json();
          const g = full.graph ?? { nodes: [], edges: [] };
          setGraphData({
            nodes: g.nodes ?? [],
            edges: g.edges ?? [],
            docking_areas: g.docking_areas ?? [],
          });
          setDisplayGraphName(full.graph_name ?? null);
          if (selectedMapName) {
            localStorage.setItem(
              `${GRAPH_STORAGE_KEY_PREFIX}${selectedMapName}`,
              selectedGraphId
            );
          }
        } else {
          setGraphData({ nodes: [], edges: [] });
          setDisplayGraphName(null);
        }
      } catch {
        setGraphData({ nodes: [], edges: [] });
        setDisplayGraphName(null);
      }
    };

    loadGraph();
  }, [selectedGraphId, selectedMapName]);

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

  // Poll active robot command (pending / accepted / in_progress only)
  useEffect(() => {
    if (!effectiveRobotId) {
      setActiveCommand(null);
      return;
    }

    const fetchCommand = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/commands/active/${effectiveRobotId}`);
        if (res.ok) {
          const text = await res.text();
          const cmd: RobotCommand | null = text ? JSON.parse(text) : null;
          if (cmd && ACTIVE_COMMAND_STATUSES.has(cmd.status)) {
            setActiveCommand(cmd);
          } else {
            setActiveCommand(null);
          }
        }
      } catch {
        /* ignore poll errors */
      }
    };

    fetchCommand();
    const interval = setInterval(fetchCommand, 2000);
    return () => clearInterval(interval);
  }, [effectiveRobotId]);

  // Re-check online threshold periodically (same as Robots page)
  useEffect(() => {
    const interval = setInterval(() => setOnlineTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

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

    const handleRobotsData = (robotsData: Robot[]) => {
      const now = Date.now();
      setWsConnected(true);
      console.log('Received robots data via WebSocket:', robotsData.length, 'robots');

      setClientLastSeen((prev) => {
        const next = { ...prev };
        robotsData.forEach((r) => {
          next[r.id] = now;
        });
        return next;
      });

      const hasChanged = JSON.stringify(robots) !== JSON.stringify(robotsData);
      if (hasChanged) {
        setRobots(robotsData);
        console.log('Robot data updated via WebSocket');
      }
      
      // Hata durumunu temizle
      setError(null);
    };

    const handleError = (errorMessage: string) => {
      console.error('WebSocket error:', errorMessage);
      setError(errorMessage);
    };

    // WebSocket bağlantısını başlat
    robotWebSocketService.connect(handleRobotsData, handleError);

    // Cleanup function
    return () => {
      console.log('Cleaning up WebSocket connection...');
      robotWebSocketService.disconnect();
    };
  }, []); // Boş dependency array - sadece mount/unmount'ta çalışsın

  if (mapsLoading) {
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
    userPickedGraphRef.current = false;
  };

  const handleRobotChange = (robotId: string) => {
    setSelectedRobotId(robotId);
    userPickedGraphRef.current = false;
  };

  const handleGraphChange = (graphId: string) => {
    userPickedGraphRef.current = true;
    setSelectedGraphId(graphId || null);
  };

  const refreshActiveCommand = async () => {
    if (!effectiveRobotId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/commands/active/${effectiveRobotId}`);
      if (res.ok) {
        const text = await res.text();
        const cmd: RobotCommand | null = text ? JSON.parse(text) : null;
        if (cmd && ACTIVE_COMMAND_STATUSES.has(cmd.status)) {
          setActiveCommand(cmd);
        } else {
          setActiveCommand(null);
        }
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
          graph_name: displayGraphName ?? undefined,
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
      await refreshActiveCommand();
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
      {!wsConnected && (
        <div className="ws-connecting-banner">
          Connecting to robots… Live position may be unavailable.
        </div>
      )}

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
                    {!robotOnlineMap[robot.id] ? ' (offline)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="graph-selector">
            <label htmlFor="graph-select" className="robot-selector-label">Graph</label>
            <select
              id="graph-select"
              value={selectedGraphId ?? ''}
              onChange={(e) => handleGraphChange(e.target.value)}
              disabled={graphList.length === 0}
            >
              {graphList.length === 0 ? (
                <option value="">No graphs</option>
              ) : (
                graphList.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.graph_name === robotActiveGraphName ? '✓ ' : ''}
                    {g.graph_name ?? g._id}
                  </option>
                ))
              )}
            </select>
          </div>

          {displayGraphName && (
            <span className={`graph-pill ${isDisplayedGraphRobotActive ? 'active' : ''}`}>
              {displayGraphName}
              {isDisplayedGraphRobotActive ? ' · robot active' : ''}
            </span>
          )}

          <div className="status-indicators">
            <div className="status-item">
              <div className={`status-dot ${currentRobotIsOnline ? 'online' : 'offline'}`}></div>
              <span className="status-text">{currentRobotIsOnline ? 'Online' : 'Offline'}</span>
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

      {mapRobots.length === 0 && (
        <div className="dashboard-hint">
          No robots registered on this map. Add robots in the Robots page.
        </div>
      )}

      {graphList.length === 0 && selectedMapName && (
        <div className="dashboard-hint">
          No navigation graphs for this map. Create one in Graph Editor.
        </div>
      )}

      {activeCommand && (
        <div className={`command-status-bar command-status-bar--${getCommandStatusClass(activeCommand.status)}`}>
          <div className="command-status-main">
            <span className={`command-status-badge command-status-badge--${getCommandStatusClass(activeCommand.status)}`}>
              {COMMAND_STATUS_LABEL[activeCommand.status]}
            </span>
            <span className="command-status-target">
              → {activeCommand.node_description || activeCommand.node_id}
            </span>
            <span className="command-status-goal">
              ({activeCommand.goal.x.toFixed(2)}m, {activeCommand.goal.y.toFixed(2)}m, {((activeCommand.goal.yaw * 180) / Math.PI).toFixed(0)}°)
            </span>
          </div>
          {activeCommand.error_message && (
            <span className="command-status-error">{activeCommand.error_message}</span>
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
            sendRobotDisabled={!currentRobotIsOnline}
            sendRobotDisabledReason="Robot is offline"
            onSendRobotToNode={handleSendRobotToNode}
            sendRobotLoading={sendRobotLoading}
          />
        </div>
      </div>
    </main>
  );
}

export default DashboardContent;