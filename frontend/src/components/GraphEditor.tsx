import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

interface GraphMeta {
  _id: string;
  graph_name: string;
  map_name: string;
  timestamp: number;
}

const GRAPH_EDITOR_MAP_KEY = 'graph_editor_selected_map';
const GRAPH_EDITOR_ROBOT_KEY = 'graph_editor_selected_robot';

interface MapSummary {
  map_name: string;
}

interface MapRobotInfo {
  robot_name: string;
  active_graph_name?: string;
}

function GraphEditor() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [mapName, setMapName] = useState<string | null>(null);
  const [mapRobots, setMapRobots] = useState<MapRobotInfo[]>([]);
  const [selectedRobotName, setSelectedRobotName] = useState<string | null>(null);
  const [graphList, setGraphList] = useState<GraphMeta[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [activeGraphName, setActiveGraphName] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [editingGraphName, setEditingGraphName] = useState('');
  const [showGraph, setShowGraph] = useState(true);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [selectedNodeForEdge, setSelectedNodeForEdge] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showNewGraphModal, setShowNewGraphModal] = useState(false);
  const [newGraphName, setNewGraphName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<{ name: string; data: GraphData } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = useMemo(() => {
    if (!selectedGraphId || !graphData || !savedSnapshot) return false;
    return (
      editingGraphName !== savedSnapshot.name ||
      JSON.stringify(graphData) !== JSON.stringify(savedSnapshot.data)
    );
  }, [selectedGraphId, graphData, editingGraphName, savedSnapshot]);

  const confirmDiscardChanges = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }, [isDirty]);

  const requestMapChange = (newMap: string | null) => {
    if (!confirmDiscardChanges()) return;
    setMapName(newMap);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const mapsRes = await fetch(`${BACKEND_URL}/maps`);
        if (!mapsRes.ok) return;
        const mapList: MapSummary[] = await mapsRes.json();
        setMaps(mapList);
        if (mapList.length === 0) return;

        const storedMap = localStorage.getItem(GRAPH_EDITOR_MAP_KEY);
        const validMap = storedMap && mapList.some((m) => m.map_name === storedMap);
        const initialMap = validMap ? storedMap! : mapList[0].map_name;
        setMapName(initialMap);

        const storedRobot = localStorage.getItem(GRAPH_EDITOR_ROBOT_KEY);
        if (storedRobot) setSelectedRobotName(storedRobot);
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!mapName) {
      setMapRobots([]);
      return;
    }
    localStorage.setItem(GRAPH_EDITOR_MAP_KEY, mapName);

    const loadMapRobots = async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/maps/${encodeURIComponent(mapName)}/robots`
        );
        if (res.ok) {
          const robots: MapRobotInfo[] = await res.json();
          setMapRobots(robots);
          setSelectedRobotName((prev) => {
            if (prev && robots.some((r) => r.robot_name === prev)) return prev;
            return robots[0]?.robot_name ?? null;
          });
        } else {
          setMapRobots([]);
          setSelectedRobotName(null);
        }
      } catch {
        setMapRobots([]);
        setSelectedRobotName(null);
      }
    };
    loadMapRobots();

    setSelectedGraphId(null);
    setGraphData(null);
    setIsAddingNode(false);
    setSelectedNodeForEdge(null);
  }, [mapName]);

  useEffect(() => {
    if (selectedRobotName) {
      localStorage.setItem(GRAPH_EDITOR_ROBOT_KEY, selectedRobotName);
    }
  }, [selectedRobotName]);

  useEffect(() => {
    if (!selectedRobotName) {
      setActiveGraphName(null);
      return;
    }
    const loadActive = async () => {
      try {
        const activeRes = await fetch(`${BACKEND_URL}/graphs/active/${selectedRobotName}`);
        if (activeRes.ok) {
          const text = await activeRes.text();
          if (text) {
            const activeGraph = JSON.parse(text);
            if (activeGraph?.graph_name) {
              setActiveGraphName(activeGraph.graph_name);
              return;
            }
          }
        }
        setActiveGraphName(null);
      } catch {
        setActiveGraphName(null);
      }
    };
    loadActive();
  }, [selectedRobotName, mapName]);

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
    if (!selectedGraphId) {
      setGraphData(null);
      setEditingGraphName('');
      setSavedSnapshot(null);
      setLastSavedAt(null);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`);
        if (res.ok) {
          const record = await res.json();
          const g = record.graph ?? { nodes: [], edges: [] };
          const normalized: GraphData = {
            nodes: g.nodes ?? [],
            edges: g.edges ?? [],
            docking_areas: g.docking_areas ?? [],
          };
          setGraphData(normalized);
          setEditingGraphName(record.graph_name);
          setSavedSnapshot({ name: record.graph_name, data: normalized });
          setLastSavedAt(record.timestamp ?? Date.now());
        }
      } catch (e) {
        console.error('Failed to load graph:', e);
      }
    };
    load();
  }, [selectedGraphId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const resetEditModes = () => {
    setIsAddingNode(false);
    setSelectedNodeForEdge(null);
  };

  const handleGraphSelect = (id: string | null) => {
    if (id !== selectedGraphId && !confirmDiscardChanges()) return;
    setSelectedGraphId(id);
    resetEditModes();
  };

  const handleSave = async (): Promise<boolean> => {
    if (!selectedGraphId || !graphData) return false;
    const res = await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph_name: editingGraphName, graph: graphData }),
    });
    if (res.ok) {
      setSavedSnapshot({ name: editingGraphName, data: graphData });
      setLastSavedAt(Date.now());
      showStatus('Saved');
      await fetchGraphList();
      return true;
    }
    showStatus('Save failed');
    return false;
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
        const normalized: GraphData = {
          nodes: inner.nodes,
          edges: inner.edges,
          docking_areas: inner.docking_areas ?? [],
        };
        const graphName = file.name.replace(/\.json$/i, '');
        const res = await fetch(`${BACKEND_URL}/graphs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graph_name: graphName, map_name: mapName, graph: normalized }),
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


  const handleDownload = () => {
    if (!graphData) return;
    const blob = new Blob([JSON.stringify({ graph: graphData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${editingGraphName || 'graph'}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleActivate = async () => {
    if (!selectedGraphId || !selectedRobotName) {
      showStatus('Select a robot to activate this graph');
      return;
    }
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    const res = await fetch(
      `${BACKEND_URL}/graphs/${selectedGraphId}/activate/${encodeURIComponent(selectedRobotName)}`,
      { method: 'PUT' }
    );
    if (res.ok) {
      setActiveGraphName(editingGraphName);
      showStatus(`"${editingGraphName}" activated on ${selectedRobotName}`);
    } else showStatus('Activation failed');
  };

  const handleDelete = async () => {
    if (!selectedGraphId) return;
    await fetch(`${BACKEND_URL}/graphs/${selectedGraphId}`, { method: 'DELETE' });
    setSelectedGraphId(null);
    setGraphData(null);
    setSavedSnapshot(null);
    setLastSavedAt(null);
    setShowDeleteModal(false);
    showStatus('Deleted');
    await fetchGraphList();
  };

  const handleNewGraph = async () => {
    if (!mapName) { showStatus('Select a map first'); return; }
    const name = newGraphName.trim();
    if (!name) return;
    const res = await fetch(`${BACKEND_URL}/graphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph_name: name,
        map_name: mapName,
        graph: { nodes: [], edges: [], docking_areas: [] },
      }),
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
  const dockingCount = graphData?.docking_areas?.length ?? 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) void handleSave();
      } else if (e.key === 'Escape') {
        resetEditModes();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirty, selectedGraphId, graphData, editingGraphName]);

  const formatSavedTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="graph-editor-layout">
      {/* Left panel */}
      <aside className="graph-editor-panel">
        <div className="panel-header">
          <h2>Graph Editor</h2>
          <p className="panel-header-sub">Manage navigation graphs</p>
        </div>

        <div className="panel-section">
          <label className="panel-section-label">Map</label>
          <select
            className="panel-select"
            value={mapName ?? ''}
            onChange={(e) => requestMapChange(e.target.value || null)}
            disabled={maps.length === 0}
          >
            {maps.length === 0 ? (
              <option value="">No maps available</option>
            ) : (
              maps.map((m) => (
                <option key={m.map_name} value={m.map_name}>{m.map_name}</option>
              ))
            )}
          </select>
          {mapName && (
            <p className="panel-map-hint">
              Graphs and nodes are created on <strong>{mapName}</strong>
            </p>
          )}
        </div>

        <div className="panel-section">
          <label className="panel-section-label">Robot (for activate)</label>
          <select
            className="panel-select"
            value={selectedRobotName ?? ''}
            onChange={(e) => setSelectedRobotName(e.target.value || null)}
            disabled={mapRobots.length === 0}
          >
            {mapRobots.length === 0 ? (
              <option value="">No robots on this map</option>
            ) : (
              mapRobots.map((r) => (
                <option key={r.robot_name} value={r.robot_name}>{r.robot_name}</option>
              ))
            )}
          </select>
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
              <button
                className={`panel-btn primary ${isDirty ? 'unsaved' : ''}`}
                onClick={() => void handleSave()}
              >
                <IconSave /> {isDirty ? 'Save *' : 'Save'}
              </button>
              {!isDirty && lastSavedAt && (
                <span className="panel-save-hint">Saved at {formatSavedTime(lastSavedAt)}</span>
              )}
              {isDirty && (
                <span className="panel-save-hint unsaved">Unsaved changes</span>
              )}
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
              {dockingCount > 0 ? ` · ${dockingCount} docking` : ''}
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

        {selectedGraphId && !isAddingNode && !isEdgeMode && (
          <div className="mode-hint-bar mode-hint-bar--info">
            Use the blue docking tool in the map zoom controls to draw docking areas.
          </div>
        )}

        {!selectedGraphId && (
          <div className="graph-empty-state">
            <h3>Select or create a graph</h3>
            <p>Choose a graph from the left panel, or create a new one to start editing nodes and edges.</p>
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
              mapName={mapName ?? undefined}
              robots={[]}
              coordinateSystem={{ type: 'coordinate' }}
              enableDockingDrawing={!!selectedGraphId && !!mapName}
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
            <p>
              Create an empty graph on map <strong>{mapName}</strong>.
            </p>
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
