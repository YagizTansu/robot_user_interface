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

  // Edge mode: after completing an edge, stay in edge mode (reset to 'init' not null)
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
      // Stay in edge mode — wait for next first node
      setSelectedNodeForEdge('init');
    }
  };

  const isEdgeMode = selectedNodeForEdge !== null;
  const edgeStep = selectedNodeForEdge === 'init' ? 'select-from' : selectedNodeForEdge ? 'select-to' : null;

  const toolbarSep = (
    <div style={{ width: '1px', background: '#e5e7eb', alignSelf: 'stretch', margin: '0 2px' }} />
  );

  return (
    <main className="main-content">
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb',
        gap: '12px', flexWrap: 'wrap', minHeight: '56px'
      }}>
        {/* Title + status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#111827', letterSpacing: '-0.3px' }}>
            Graph Editor
          </h2>
          {mapName && (
            <span style={{ fontSize: '12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '20px', padding: '2px 10px', fontWeight: 500 }}>
              {mapName}
            </span>
          )}
          {activeGraphName && (
            <span style={{ fontSize: '12px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '2px 10px', fontWeight: 500 }}>
              ✓ {activeGraphName}
            </span>
          )}
          {graphData && (
            <span style={{ fontSize: '12px', background: '#fafafa', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '2px 10px' }}>
              {graphData.nodes.length} nodes · {graphData.edges.length} edges
            </span>
          )}
          {statusMsg && (
            <span style={{ fontSize: '12px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: '20px', padding: '2px 10px', fontWeight: 500 }}>
              {statusMsg}
            </span>
          )}
        </div>

        {/* Right-side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

          {/* ── Group 1: Graph selection ── */}
          <select
            value={selectedGraphId ?? ''}
            onChange={e => { setSelectedGraphId(e.target.value || null); setIsAddingNode(false); setSelectedNodeForEdge(null); }}
            style={{
              padding: '6px 10px', borderRadius: '7px', border: '1px solid #d1d5db',
              fontSize: '13px', background: '#fff', cursor: 'pointer', color: '#374151',
              fontWeight: 500, outline: 'none', minWidth: '160px'
            }}
          >
            <option value="">— Select graph —</option>
            {graphList.map(g => (
              <option key={g._id} value={g._id}>
                {g.graph_name === activeGraphName ? '✓ ' : ''}{g.graph_name}
              </option>
            ))}
          </select>

          <Btn icon={<IconPlus/>} label="New" onClick={handleNewGraph} title="Create empty graph" />
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleUpload} />
          <Btn icon={<IconUpload/>} label="Import" onClick={() => fileInputRef.current?.click()} title="Import from JSON file" />

          {selectedGraphId && (
            <>
              {toolbarSep}

              {/* ── Group 2: Edit tools ── */}
              <Btn
                icon={<IconGraph/>}
                label={showGraph ? 'Hide Graph' : 'Show Graph'}
                onClick={() => setShowGraph(!showGraph)}
                active={showGraph}
                title="Toggle graph visibility"
              />
              <Btn
                icon={<IconNode/>}
                label="Add Node"
                onClick={() => { setIsAddingNode(!isAddingNode); setSelectedNodeForEdge(null); }}
                active={isAddingNode}
                activeColor="#2563eb"
                title="Click on map to place nodes (stays active)"
              />
              <Btn
                icon={<IconEdge/>}
                label={edgeStep === 'select-to' ? 'Pick target…' : 'Add Edge'}
                onClick={() => { setSelectedNodeForEdge(isEdgeMode ? null : 'init'); setIsAddingNode(false); }}
                active={isEdgeMode}
                activeColor="#7c3aed"
                badge={edgeStep === 'select-to' ? '2nd' : edgeStep === 'select-from' ? '1st' : undefined}
                title="Click first node then second node to add edge (stays active)"
              />

              {toolbarSep}

              {/* ── Group 3: Save / Export / Manage ── */}
              <Btn icon={<IconSave/>} label="Save" onClick={handleSave} variant="primary" title="Save to database" />
              <Btn icon={<IconDownload/>} label="Export" onClick={handleDownload} title="Download JSON" />
              <Btn
                icon={<IconActivate/>}
                label={editingGraphName === activeGraphName ? 'Active ✓' : 'Activate'}
                onClick={handleActivate}
                variant={editingGraphName === activeGraphName ? 'success' : 'default'}
                title="Set as active graph for robot"
              />
              <Btn icon={<IconTrash/>} label="Delete" onClick={handleDelete} variant="danger" title="Delete this graph" />
            </>
          )}
        </div>
      </div>

      {/* ── Mode hint banner ── */}
      {(isAddingNode || isEdgeMode) && (
        <div style={{
          background: isAddingNode ? '#eff6ff' : '#f5f3ff',
          borderBottom: `2px solid ${isAddingNode ? '#93c5fd' : '#c4b5fd'}`,
          color: isAddingNode ? '#1d4ed8' : '#6d28d9',
          fontSize: '13px', fontWeight: 500,
          padding: '7px 20px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {isAddingNode ? (
            <>
              <IconNode size={15}/>
              <span>Add Node mode — click anywhere on the map to place nodes. Press <kbd style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '4px', padding: '1px 5px', fontSize: '11px' }}>Add Node</kbd> again to exit.</span>
            </>
          ) : (
            <>
              <IconEdge size={15}/>
              <span>
                Add Edge mode —&nbsp;
                {edgeStep === 'select-from' ? 'click the FROM node on the map.' : `FROM node selected. Click the TO node.`}
                &nbsp;Press <kbd style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '4px', padding: '1px 5px', fontSize: '11px' }}>Add Edge</kbd> again to exit.
              </span>
            </>
          )}
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
    </main>
  );
}

// ── Small reusable button ────────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'success' | 'danger';
function Btn({
  icon, label, onClick, active = false, activeColor, variant = 'default', badge, title
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  active?: boolean; activeColor?: string; variant?: BtnVariant;
  badge?: string; title?: string;
}) {
  const variantStyle: React.CSSProperties =
    variant === 'primary' ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } :
    variant === 'success' ? { background: '#059669', color: '#fff', borderColor: '#059669' } :
    variant === 'danger'  ? { background: '#fff', color: '#dc2626', borderColor: '#fca5a5' } :
    active && activeColor ? { background: activeColor, color: '#fff', borderColor: activeColor } :
    active ? { background: '#f0f9ff', color: '#0369a1', borderColor: '#7dd3fc' } :
    { background: '#fff', color: '#374151', borderColor: '#d1d5db' };

  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 11px', borderRadius: '7px', border: '1px solid',
        fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
        whiteSpace: 'nowrap', lineHeight: 1.4, position: 'relative',
        transition: 'all 0.15s',
        ...variantStyle,
      }}
    >
      {icon}{label}
      {badge && (
        <span style={{
          position: 'absolute', top: '-6px', right: '-6px',
          background: '#7c3aed', color: '#fff', fontSize: '9px',
          borderRadius: '20px', padding: '1px 5px', fontWeight: 700, lineHeight: 1.4
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
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

export default GraphEditor;
