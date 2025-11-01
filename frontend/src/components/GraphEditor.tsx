import { useState, useEffect } from 'react';
import '../styles/DashboardContent.css';
import RobotMap from './RobotMap';

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
  resolution: number;
  origin: {
    x: number;
    y: number;
    theta: number;
  };
  width: number;
  height: number;
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

function GraphEditor() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [restrictedAreas, setRestrictedAreas] = useState<RestrictedArea[]>([]);
  const [showGraph, setShowGraph] = useState(true);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [selectedNodeForEdge, setSelectedNodeForEdge] = useState<string | null>(null);

  // ROS map metadata
  const mapMetadata: MapMetadata = {
    resolution: 0.05,
    origin: {
      x: -7.61,
      y: -10.6,
      theta: 0.0
    },
    width: 293,
    height: 429
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
        setGraphData({ nodes: [], edges: [] });
      }
    };

    loadGraphData();
  }, []);

  const handleSaveGraph = () => {
    if (!graphData) return;
    
    // JSON dosyasını indirme
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'waypoints.json';
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('Graph data saved:', graphData);
  };

  const handleAddNode = () => {
    setIsAddingNode(!isAddingNode);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!graphData) return;
    
    // Node'u ve ona bağlı edge'leri sil
    const updatedNodes = graphData.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = graphData.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    
    setGraphData({
      nodes: updatedNodes,
      edges: updatedEdges
    });
  };

  const handleAddEdge = (nodeId: string) => {
    if (!selectedNodeForEdge || selectedNodeForEdge === 'init') {
      // İlk node seçildi
      setSelectedNodeForEdge(nodeId);
    } else {
      // İkinci node seçildi, edge oluştur
      if (nodeId !== selectedNodeForEdge && graphData) {
        const fromNode = graphData.nodes.find(n => n.id === selectedNodeForEdge);
        const toNode = graphData.nodes.find(n => n.id === nodeId);
        
        if (fromNode && toNode) {
          // İki node arasındaki mesafeyi hesapla
          const distance = Math.sqrt(
            Math.pow(toNode.x - fromNode.x, 2) + 
            Math.pow(toNode.y - fromNode.y, 2)
          );
          
          const newEdge: GraphEdge = {
            from: selectedNodeForEdge,
            to: nodeId,
            cost: parseFloat(distance.toFixed(2)),
            bidirectional: true,
            max_speed: 0.5
          };
          
          setGraphData({
            ...graphData,
            edges: [...graphData.edges, newEdge]
          });
          
          console.log('Edge created:', newEdge);
        }
      }
      setSelectedNodeForEdge(null);
    }
  };

  if (!graphData) {
    return (
      <main className="main-content">
        <div className="loading">Loading graph data...</div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="dashboard-header">
        <div className="header-info">
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>
            Graph Editor
          </h2>
          <div className="status-indicators">
            <div className="status-item">
              <div className="status-dot active"></div>
              <span className="status-text">{graphData.nodes.length} Nodes</span>
            </div>
            <div className="status-item">
              <div className="status-dot active"></div>
              <span className="status-text">{graphData.edges.length} Edges</span>
            </div>
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
          <button 
            className={`control-btn ${isAddingNode ? 'primary' : ''}`}
            onClick={handleAddNode}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            {isAddingNode ? 'Cancel' : 'Add Node'}
          </button>
          <button 
            className={`control-btn ${selectedNodeForEdge ? 'primary' : ''}`}
            onClick={() => {
              if (selectedNodeForEdge) {
                setSelectedNodeForEdge(null);
              } else {
                setSelectedNodeForEdge('init'); // Placeholder değer - edge modu başlat
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12,5 19,12 12,19"/>
            </svg>
            {selectedNodeForEdge ? 'Cancel Edge' : 'Add Edge'}
          </button>
          <button className="control-btn primary" onClick={handleSaveGraph}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
            Save Graph
          </button>
        </div>
      </div>
      
      <div className="map-container">
        <div className="map-wrapper">
          <RobotMap 
            robots={[]}
            coordinateSystem={{ 
              type: 'coordinate'
            }}
            enablePolygonDrawing={true}
            restrictedAreas={restrictedAreas}
            onRestrictedAreasChange={setRestrictedAreas}
            graphData={graphData}
            showGraph={showGraph}
            mapMetadata={mapMetadata}
            isGraphEditorMode={true}
            onGraphDataChange={setGraphData}
            isAddingNode={isAddingNode}
            onNodeAdded={() => setIsAddingNode(false)}
            selectedNodeForEdge={selectedNodeForEdge}
            onNodeSelectedForEdge={handleAddEdge}
          />
        </div>
      </div>
    </main>
  );
}

export default GraphEditor;
