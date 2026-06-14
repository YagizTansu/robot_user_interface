import { useState, useEffect, useRef } from 'react';
import '../styles/GraphEditor.css';
import RobotMap from './RobotMap';
import { BACKEND_URL } from '../config';

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
  const [showNewGraphModal, setShowNewGraphModal] = useState(false);
  const [newGraphName, setNewGraphName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const resetEditModes = () => {
    setIsAddingNode(false);
    setSelectedNodeForEdge(null);
  };

  const handleGraphSelect = (id: string | null) => {
    setSelectedGraphId(id);
    resetEditModes();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapName) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
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
    await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`, { method: 'DELETE' });
    setSelectedGraphId(null); setGraphData(null);
    setShowDeleteModal(false);
    showStatus('Deleted'); await fetchGraphList();
  };

  const handleNewGraph = async () => {
    if (!mapName) { showStatus('No map loaded'); return; }
    const name = newGraphName.trim();
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
      setShowNewGraphModal(false);
      setNewGraphName('');
    } else showStatus('Create failed');
  };

  const openNewGraphModal = () => {
    setNewGraphName(`graph_${Date.now()}`);
    setShowNewGraphModal(true);
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
      setSelectedNodeForEdge('init');
    }
  };

  const isEdgeMode = selectedNodeForEdge !== null;
  const edgeStep = selectedNodeForEdge === 'init' ? 'select-from' : selectedNodeForEdge ? 'select-to' : null;

  return (
    <main className="graph-editor-layout">
      {/* Left panel */}
      <aside className="graph-editor-panel">
        <div className="panel-header">
          <h2>Graph Editor</h2>
          <p className="panel-header-sub">Manage navigation graphs</p>
        </div>

        <div className="panel-section">
          <label className="panel-section-label">Select Graph</label>
          <select
            className="panel-select"
            value={selectedGraphId ?? ''}
            onChange={e => handleGraphSelect(e.target.value || null)}
          >
            <option value="">— Select graph —</option>
            {graphList.map(g => (
              <option key={g._id} value={g._id}>
                {g.graph_name === activeGraphName ? '✓ ' : ''}{g.graph_name}
              </option>
            ))}
          </select>

          {selectedGraphId && (
            <input
              className="panel-input"
              type="text"
              value={editingGraphName}
              onChange={e => setEditingGraphName(e.target.value)}
              placeholder="Graph name"
            />
          )}
        </div>

        <div className="panel-section">
          <label className="panel-section-label">Create & Import</label>
          <div className="panel-actions">
            <button className="panel-btn" onClick={openNewGraphModal}>
              <IconPlus /> New Graph
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
            <button className="panel-btn" onClick={() => fileInputRef.current?.click()}>
              <IconUpload /> Import JSON
            </button>
          </div>
        </div>

        {selectedGraphId && (
          <div className="panel-section">
            <label className="panel-section-label">Actions</label>
            <div className="panel-actions">
              <button className="panel-btn primary" onClick={handleSave}>
                <IconSave /> Save
              </button>
              <div className="panel-btn-row">
                <button className="panel-btn" onClick={handleDownload}>
                  <IconDownload /> Export
                </button>
                <button
                  className={`panel-btn ${editingGraphName === activeGraphName ? 'success' : ''}`}
                  onClick={handleActivate}
                >
                  <IconActivate />
                  {editingGraphName === activeGraphName ? 'Active' : 'Activate'}
                </button>
              </div>
              <button className="panel-btn danger" onClick={() => setShowDeleteModal(true)}>
                <IconTrash /> Delete Graph
              </button>
            </div>
          </div>
        )}

        <div className="panel-meta">
          {mapName && (
            <span className="meta-pill">
              <IconMap /> {mapName}
            </span>
          )}
          {activeGraphName && (
            <span className="meta-pill active-graph">
              <IconActivate /> Active: {activeGraphName}
            </span>
          )}
          {graphData && (
            <span className="meta-pill stats">
              {graphData.nodes.length} nodes · {graphData.edges.length} edges
            </span>
          )}
        </div>
      </aside>

      {/* Map + floating tools */}
      <div className="graph-editor-map">
        {statusMsg && <div className="graph-toast">{statusMsg}</div>}

        {(isAddingNode || isEdgeMode) && (
          <div className="mode-hint-bar">
            {isAddingNode ? (
              <>
                <IconNode size={15} />
                Add Node — click and drag on the map to set position and heading. Press <kbd>Add Node</kbd> again to exit.
              </>
            ) : (
              <>
                <IconEdge size={15} />
                Add Edge — {edgeStep === 'select-from' ? 'click the FROM node.' : 'FROM selected. Click the TO node.'}
                {' '}Press <kbd>Add Edge</kbd> again to exit.
              </>
            )}
          </div>
        )}

        {selectedGraphId && (
          <div className="floating-toolbar">
            <button
              className={`float-btn ${showGraph ? 'active' : ''}`}
              onClick={() => setShowGraph(!showGraph)}
              title="Toggle graph visibility"
            >
              <IconGraph /><span>{showGraph ? 'Hide Graph' : 'Show Graph'}</span>
            </button>
            <div className="floating-toolbar-sep" />
            <button
              className={`float-btn ${isAddingNode ? 'active-node' : ''}`}
              onClick={() => { setIsAddingNode(!isAddingNode); setSelectedNodeForEdge(null); }}
              title="Click on map to place nodes"
            >
              <IconNode />
              <span>Add Node</span>
            </button>
            <button
              className={`float-btn ${isEdgeMode ? 'active-edge' : ''}`}
              onClick={() => { setSelectedNodeForEdge(isEdgeMode ? null : 'init'); setIsAddingNode(false); }}
              title="Click two nodes to add an edge"
            >
              <IconEdge />
              <span>{edgeStep === 'select-to' ? 'Pick target…' : 'Add Edge'}</span>
              {edgeStep === 'select-to' && <span className="float-btn-badge">2nd</span>}
              {edgeStep === 'select-from' && <span className="float-btn-badge">1st</span>}
            </button>
          </div>
        )}

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
              onNodeAdded={() => { /* stay in add-node mode */ }}
              selectedNodeForEdge={selectedNodeForEdge}
              onNodeSelectedForEdge={handleAddEdge}
            />
          </div>
        </div>
      </div>

      {/* New graph modal */}
      {showNewGraphModal && (
        <div className="graph-modal-overlay" onClick={() => setShowNewGraphModal(false)}>
          <div className="graph-modal" onClick={e => e.stopPropagation()}>
            <h3>Create New Graph</h3>
            <p>Enter a name for the new navigation graph.</p>
            <input
              className="panel-input"
              type="text"
              value={newGraphName}
              onChange={e => setNewGraphName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNewGraph()}
              autoFocus
            />
            <div className="graph-modal-actions">
              <button className="panel-btn" onClick={() => setShowNewGraphModal(false)}>Cancel</button>
              <button className="panel-btn primary" onClick={handleNewGraph}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="graph-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="graph-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Graph</h3>
            <p>Are you sure you want to delete <strong>{editingGraphName}</strong>? This action cannot be undone.</p>
            <div className="graph-modal-actions">
              <button className="panel-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="panel-btn danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const s = (size = 15) => ({ width: size, height: size } as React.SVGProps<SVGSVGElement>);
const IconPlus    = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconUpload  = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconSave    = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>;
const IconDownload= () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IconActivate= () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IconTrash   = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/></svg>;
const IconGraph   = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
const IconNode    = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
const IconEdge    = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><line x1="8" y1="12" x2="16" y2="12"/><polyline points="13,9 16,12 13,15"/></svg>;
const IconMap     = () => <svg {...s()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;

export default GraphEditor;
