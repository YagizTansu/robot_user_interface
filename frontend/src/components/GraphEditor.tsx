import { useState, useEffect, useRef } from 'react';
import '../styles/DashboardContent.css';
import RobotMap from './RobotMap';
import { BACKEND_URL } from '../config';

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

interface GraphMeta {
  _id: string;
  graph_name: string;
  map_name: string;
  timestamp: number;
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

const ROBOT_NAME = 'agv001';

function GraphEditor() {
  const [mapName, setMapName] = useState<string | null>(null);
  const [graphList, setGraphList] = useState<GraphMeta[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [activeGraphName, setActiveGraphName] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [editingGraphName, setEditingGraphName] = useState('');
  const [restrictedAreas, setRestrictedAreas] = useState<RestrictedArea[]>([]);
  const [showGraph, setShowGraph] = useState(true);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [selectedNodeForEdge, setSelectedNodeForEdge] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load map name and active graph for the robot
  useEffect(() => {
    const init = async () => {
      try {
        const mapRes = await fetch(`${BACKEND_URL}/maps/by-robot/${ROBOT_NAME}`);
        if (!mapRes.ok) return;
        const mapData = await mapRes.json();
        setMapName(mapData.map_name);

        const activeRes = await fetch(`${BACKEND_URL}/graphs/active/${ROBOT_NAME}`);
        if (activeRes.ok) {
          const activeGraph = await activeRes.json();
          if (activeGraph) setActiveGraphName(activeGraph.graph_name);
        }
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, []);

  // Load graph list when mapName is known
  useEffect(() => {
    if (!mapName) return;
    fetchGraphList();
  }, [mapName]);

  const fetchGraphList = async () => {
    if (!mapName) return;
    try {
      const res = await fetch(`${BACKEND_URL}/graphs?map_name=${encodeURIComponent(mapName)}`);
      if (res.ok) setGraphList(await res.json());
    } catch (e) {
      console.error('Failed to fetch graph list:', e);
    }
  };

  // Load full graph when selection changes
  useEffect(() => {
    if (!selectedGraphId) { setGraphData(null); setEditingGraphName(''); return; }
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`);
        if (res.ok) {
          const record = await res.json();
          setGraphData(record.graph);
          setEditingGraphName(record.graph_name);
        }
      } catch (e) {
        console.error('Failed to load graph:', e);
      }
    };
    load();
  }, [selectedGraphId]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapName) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Support both { graph: { nodes, edges } } and { nodes, edges }
        const inner: GraphData = json.graph ?? json;
        if (!Array.isArray(inner.nodes) || !Array.isArray(inner.edges)) {
          showStatus('Invalid graph JSON'); return;
        }
        const graphName = file.name.replace(/\.json$/i, '');
        const res = await fetch(`${BACKEND_URL}/graphs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graph_name: graphName, map_name: mapName, graph: inner }),
        });
        if (res.ok) {
          const saved = await res.json();
          showStatus(`Uploaded "${graphName}"`);
          await fetchGraphList();
          setSelectedGraphId(saved._id);
        } else showStatus('Upload failed');
      } catch { showStatus('Could not parse JSON'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!selectedGraphId || !graphData) return;
    const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_name: editingGraphName, graph: graphData }),
    });
    if (res.ok) { showStatus('Saved'); await fetchGraphList(); }
    else showStatus('Save failed');
  };

  const handleDownload = () => {
    if (!graphData) return;
    const blob = new Blob([JSON.stringify({ graph: graphData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${editingGraphName || 'graph'}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleActivate = async () => {
    if (!selectedGraphId) return;
    const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}/activate/${ROBOT_NAME}`, { method: 'PUT' });
    if (res.ok) { setActiveGraphName(editingGraphName); showStatus(`"${editingGraphName}" activated on ${ROBOT_NAME}`); }
    else showStatus('Activation failed');
  };

  const handleDelete = async () => {
    if (!selectedGraphId) return;
    if (!confirm(`Delete "${editingGraphName}"?`)) return;
    await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`, { method: 'DELETE' });
    setSelectedGraphId(null); setGraphData(null);
    showStatus('Deleted'); await fetchGraphList();
  };

  const handleNewGraph = async () => {
    if (!mapName) { showStatus('No map loaded'); return; }
    const name = prompt('Graph name:', `graph_${Date.now()}`);
    if (!name) return;
    const res = await fetch(`${BACKEND_URL}/graphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_name: name, map_name: mapName, graph: { nodes: [], edges: [] } }),
    });
    if (res.ok) {
      const saved = await res.json();
      showStatus(`Created "${name}"`);
      await fetchGraphList();
      setSelectedGraphId(saved._id);
    } else showStatus('Create failed');
  };

  const handleAddEdge = (nodeId: string) => {
    if (!selectedNodeForEdge || selectedNodeForEdge === 'init') {
      setSelectedNodeForEdge(nodeId);
    } else {
      if (nodeId !== selectedNodeForEdge && graphData) {
        const fromNode = graphData.nodes.find(n => n.id === selectedNodeForEdge);
        const toNode = graphData.nodes.find(n => n.id === nodeId);
        if (fromNode && toNode) {
          const distance = Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2));
          setGraphData({
            ...graphData,
            edges: [...graphData.edges, { from: selectedNodeForEdge, to: nodeId, cost: parseFloat(distance.toFixed(2)), bidirectional: true, max_speed: 0.5 }],
          });
        }
      }
      setSelectedNodeForEdge(null);
    }
  };

  return (
    <main className="main-content">
      <div className="dashboard-header">
        <div className="header-info">
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>
            Graph Editor
          </h2>
          <div className="status-indicators">
            {mapName && (
              <div className="status-item">
                <div className="status-dot active" />
                <span className="status-text">Map: {mapName}</span>
              </div>
            )}
            {activeGraphName && (
              <div className="status-item">
                <div className="status-dot active" />
                <span className="status-text">Active: {activeGraphName}</span>
              </div>
            )}
            {graphData && (
              <>
                <div className="status-item">
                  <div className="status-dot active" />
                  <span className="status-text">{graphData.nodes.length} nodes</span>
                </div>
                <div className="status-item">
                  <div className="status-dot active" />
                  <span className="status-text">{graphData.edges.length} edges</span>
                </div>
              </>
            )}
            {statusMsg && (
              <div className="status-item">
                <div className="status-dot battery" />
                <span className="status-text">{statusMsg}</span>
              </div>
            )}
          </div>
        </div>

        <div className="header-controls" style={{ flexWrap: 'wrap', gap: '8px' }}>
          {/* Graph selector */}
          <select
            value={selectedGraphId ?? ''}
            onChange={e => setSelectedGraphId(e.target.value || null)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#fff', cursor: 'pointer', maxWidth: '200px' }}
          >
            <option value="">— select graph —</option>
            {graphList.map(g => (
              <option key={g._id} value={g._id}>
                {g.graph_name}{g.graph_name === activeGraphName ? ' ✓' : ''}
              </option>
            ))}
          </select>

          {/* New Graph */}
          <button className="control-btn" onClick={handleNewGraph}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            New Graph
          </button>

          {/* Upload */}
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="control-btn" onClick={() => fileInputRef.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload
          </button>

          {selectedGraphId && (
            <>
              <button className={`control-btn ${showGraph ? 'primary' : ''}`} onClick={() => setShowGraph(!showGraph)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {showGraph ? 'Hide' : 'Show'}
              </button>

              <button className={`control-btn ${isAddingNode ? 'primary' : ''}`} onClick={() => setIsAddingNode(!isAddingNode)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                {isAddingNode ? 'Cancel' : 'Add Node'}
              </button>

              <button className={`control-btn ${selectedNodeForEdge ? 'primary' : ''}`} onClick={() => setSelectedNodeForEdge(selectedNodeForEdge ? null : 'init')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                </svg>
                {selectedNodeForEdge ? 'Cancel Edge' : 'Add Edge'}
              </button>

              <button className="control-btn primary" onClick={handleSave}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/>
                </svg>
                Save
              </button>

              <button className="control-btn" onClick={handleDownload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>

              <button
                className="control-btn"
                onClick={handleActivate}
                style={{ color: editingGraphName === activeGraphName ? '#059669' : undefined, borderColor: editingGraphName === activeGraphName ? '#059669' : undefined }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {editingGraphName === activeGraphName ? 'Active ✓' : 'Activate on Robot'}
              </button>

              <button className="control-btn" onClick={handleDelete} style={{ color: '#ef4444' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                </svg>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="map-container">
        <div className="map-wrapper">
          <RobotMap
            robotName={ROBOT_NAME}
            robots={[]}
            coordinateSystem={{ type: 'coordinate' }}
            enablePolygonDrawing={false}
            restrictedAreas={restrictedAreas}
            onRestrictedAreasChange={setRestrictedAreas}
            graphData={graphData ?? undefined}
            showGraph={showGraph}
            isGraphEditorMode={!!selectedGraphId}
            onGraphDataChange={data => setGraphData(data)}
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
