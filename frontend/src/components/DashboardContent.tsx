import { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/DashboardContent.css';
import RobotMap from './RobotMap';
import robotWebSocketService from '../services/robotWebSocketService';

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

function DashboardContent() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [restrictedAreas, setRestrictedAreas] = useState<RestrictedArea[]>([]);
  const [showGraph, setShowGraph] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const isInitialLoad = useRef(true);

  // ROS map metadata - YAML dosyanızdan gelen değerler
  // Bu değerleri YAML dosyanızdan okuyarak güncelleyin
  const mapMetadata: MapMetadata = {
    resolution: 0.05,  // meter/pixel - YAML'daki resolution değeri
    origin: {
      x: -7.61,  // meter - YAML'daki origin x değeri
      y: -10.6,  // meter - YAML'daki origin y değeri
      theta: 0.0  // radyan - YAML'daki origin theta değeri
    },
    width: 293,  // pixel - PGM dosyasının genişliği
    height: 429  // pixel - PGM dosyasının yüksekliği
  };

  // Graph data'yı JSON dosyasından yükle
  useEffect(() => {
    const loadGraphData = async () => {
      try {
        const response = await fetch('/graph/waypoints.json');
        if (!response.ok) {
          throw new Error('Failed to load graph data');
        }
        const data: GraphData = await response.json();
        setGraphData(data);
        console.log('Graph data loaded successfully:', data.nodes.length, 'nodes,', data.edges.length, 'edges');
      } catch (error) {
        console.error('Error loading graph data:', error);
        // Hata durumunda boş graph data kullan
        setGraphData({ nodes: [], edges: [] });
      }
    };

    loadGraphData();
  }, []);

  // useMemo'yu conditional return'lerden önce kullanmalıyız
  const robotsWithFullData = useMemo(() => 
    robots.map(robot => ({
      id: robot.id,
      name: robot.name,
      position: robot.position,
      orientation: robot.orientation,
      status: robot.status,
      battery: robot.battery,
      currentTask: robot.currentTask,
      speed: robot.speed,
      temperature: robot.temperature
    }))
  , [robots]);

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
        
        // İlk robotu sadece ilk yüklemede seç
        if (robotsData.length > 0 && !selectedRobot && isInitialLoad.current) {
          setSelectedRobot(robotsData[0]);
        }
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

  if (loading) {
    return (
      <main className="main-content">
        <div className="loading">Loading robots...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content">
        <div className="error">Error: {error}</div>
      </main>
    );
  }

  if (robots.length === 0) {
    return (
      <main className="main-content">
        <div className="no-data">No robots found</div>
      </main>
    );
  }

  const currentRobot = selectedRobot || robots[0];

  return (
    <main className="main-content">
      <div className="dashboard-header">
        <div className="header-info">
          <div className="status-indicators">
            {robots.length > 0 && (
              <>
                <div className="status-item">
                  <div className={`status-dot ${currentRobot.status.toLowerCase()}`}></div>
                  <span className="status-text">{currentRobot.id} {currentRobot.status}</span>
                </div>
                <div className="status-item">
                  <div className="status-dot active"></div>
                  <span className="status-text">{currentRobot.currentTask}</span>
                </div>
                <div className="status-item">
                  <div className="status-dot battery"></div>
                  <span className="status-text">Battery {currentRobot.battery}%</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="header-controls">
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
      
      <div className="map-container">
        <div className="map-wrapper">
          <RobotMap 
            robots={robotsWithFullData}
            coordinateSystem={{ 
              type: 'coordinate'
            }}
            enablePolygonDrawing={true}
            restrictedAreas={restrictedAreas}
            onRestrictedAreasChange={setRestrictedAreas}
            graphData={graphData || undefined}
            showGraph={showGraph}
            mapMetadata={mapMetadata}
          />
        </div>
      </div>
    </main>
  );
}

export default DashboardContent;