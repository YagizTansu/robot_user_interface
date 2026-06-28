import { useState, useEffect, useCallback, useMemo } from 'react';
import '../styles/MapsContent.css';
import { BACKEND_URL } from '../config';
import type { MapSummary, MapDetail, RegisteredRobot, GraphMeta } from '../types';

const GRAPH_EDITOR_MAP_KEY = 'graph_editor_selected_map';

interface MapsContentProps {
  onOpenDashboard?: (mapName: string) => void;
  onOpenGraphEditor?: (mapName: string) => void;
}

function formatMeters(px: number, resolution: number) {
  return (px * resolution).toFixed(2);
}

function MapsContent({ onOpenDashboard, onOpenGraphEditor }: MapsContentProps) {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [robotCounts, setRobotCounts] = useState<Record<string, number>>({});
  const [graphCounts, setGraphCounts] = useState<Record<string, number>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detail, setDetail] = useState<MapDetail | null>(null);
  const [robots, setRobots] = useState<RegisteredRobot[]>([]);
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMaps = useCallback(async () => {
    const [mapsRes, robotsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/maps`),
      fetch(`${BACKEND_URL}/robots-info`),
    ]);

    if (mapsRes.ok) {
      const list: MapSummary[] = await mapsRes.json();
      setMaps(list);
      if (list.length > 0) {
        setSelectedName((prev) =>
          prev && list.some((m) => m.map_name === prev) ? prev : list[0].map_name
        );
      }

      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (m) => {
          try {
            const res = await fetch(
              `${BACKEND_URL}/graphs?map_name=${encodeURIComponent(m.map_name)}`
            );
            counts[m.map_name] = res.ok ? (await res.json()).length : 0;
          } catch {
            counts[m.map_name] = 0;
          }
        })
      );
      setGraphCounts(counts);
    } else {
      setMaps([]);
    }

    if (robotsRes.ok) {
      const registered: RegisteredRobot[] = await robotsRes.json();
      const counts: Record<string, number> = {};
      registered.forEach((r) => {
        counts[r.map_name] = (counts[r.map_name] ?? 0) + 1;
      });
      setRobotCounts(counts);
    }
  }, []);

  useEffect(() => {
    loadMaps().finally(() => setLoading(false));
  }, [loadMaps]);

  useEffect(() => {
    if (!selectedName) {
      setDetail(null);
      setRobots([]);
      setGraphs([]);
      return;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const [mapRes, robotsRes, graphsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/maps/${encodeURIComponent(selectedName)}`),
          fetch(`${BACKEND_URL}/maps/${encodeURIComponent(selectedName)}/robots`),
          fetch(`${BACKEND_URL}/graphs?map_name=${encodeURIComponent(selectedName)}`),
        ]);

        if (mapRes.ok) setDetail(await mapRes.json());
        else setDetail(null);

        if (robotsRes.ok) setRobots(await robotsRes.json());
        else setRobots([]);

        if (graphsRes.ok) setGraphs(await graphsRes.json());
        else setGraphs([]);
      } catch {
        setDetail(null);
        setRobots([]);
        setGraphs([]);
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedName]);

  const stats = useMemo(() => {
    const totalRobots = Object.values(robotCounts).reduce((a, b) => a + b, 0);
    const totalGraphs = Object.values(graphCounts).reduce((a, b) => a + b, 0);
    return { maps: maps.length, robots: totalRobots, graphs: totalGraphs };
  }, [maps.length, robotCounts, graphCounts]);

  const openDashboard = (mapName: string) => {
    onOpenDashboard?.(mapName);
  };

  const openGraphEditor = (mapName: string) => {
    localStorage.setItem(GRAPH_EDITOR_MAP_KEY, mapName);
    onOpenGraphEditor?.(mapName);
  };

  if (loading) {
    return (
      <main className="maps-page">
        <div className="maps-loading">Loading maps…</div>
      </main>
    );
  }

  return (
    <main className="maps-page">
      <header className="maps-header">
        <div>
          <h1 className="maps-title">Maps</h1>
          <p className="maps-subtitle">Browse floor maps, assigned robots, and navigation graphs</p>
        </div>
      </header>

      <div className="maps-stats">
        <div className="maps-stat">
          <span className="maps-stat-value">{stats.maps}</span>
          <span className="maps-stat-label">Maps</span>
        </div>
        <div className="maps-stat">
          <span className="maps-stat-value maps-stat-value--accent">{stats.robots}</span>
          <span className="maps-stat-label">Robots</span>
        </div>
        <div className="maps-stat">
          <span className="maps-stat-value">{stats.graphs}</span>
          <span className="maps-stat-label">Graphs</span>
        </div>
      </div>

      {maps.length === 0 ? (
        <div className="maps-empty">No maps in the database.</div>
      ) : (
        <div className="maps-layout">
          <div className="maps-table-wrap">
            <table className="maps-table">
              <thead>
                <tr>
                  <th>Map</th>
                  <th>Size (m)</th>
                  <th>Resolution</th>
                  <th>Robots</th>
                  <th>Graphs</th>
                </tr>
              </thead>
              <tbody>
                {maps.map((map) => {
                  const selected = selectedName === map.map_name;
                  const wM = formatMeters(map.width_px, map.resolution);
                  const hM = formatMeters(map.height_px, map.resolution);
                  return (
                    <tr
                      key={map.map_name}
                      className={selected ? 'selected' : ''}
                      onClick={() => setSelectedName(map.map_name)}
                    >
                      <td className="maps-table-name">{map.map_name}</td>
                      <td>{wM} × {hM}</td>
                      <td>{map.resolution} m/px</td>
                      <td>{robotCounts[map.map_name] ?? 0}</td>
                      <td>{graphCounts[map.map_name] ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="maps-detail">
            {!selectedName ? (
              <p className="maps-detail-empty">Select a map</p>
            ) : detailLoading ? (
              <p className="maps-detail-empty">Loading…</p>
            ) : (
              <>
                <h2 className="maps-detail-title">{selectedName}</h2>

                {detail?.image_png_base64 && (
                  <div className="maps-preview">
                    <img
                      src={`data:image/png;base64,${detail.image_png_base64}`}
                      alt={selectedName}
                    />
                  </div>
                )}

                {detail && (
                  <dl className="maps-meta">
                    <div>
                      <dt>Pixels</dt>
                      <dd>{detail.width_px} × {detail.height_px}</dd>
                    </div>
                    <div>
                      <dt>Physical size</dt>
                      <dd>
                        {formatMeters(detail.width_px, detail.resolution)} m ×{' '}
                        {formatMeters(detail.height_px, detail.resolution)} m
                      </dd>
                    </div>
                    <div>
                      <dt>Resolution</dt>
                      <dd>{detail.resolution} m/px</dd>
                    </div>
                    <div>
                      <dt>Origin</dt>
                      <dd>
                        [{detail.origin.map((v) => v.toFixed(2)).join(', ')}]
                      </dd>
                    </div>
                    {detail.mode && (
                      <div>
                        <dt>Mode</dt>
                        <dd>{detail.mode}</dd>
                      </div>
                    )}
                  </dl>
                )}

                <section className="maps-detail-section">
                  <h3>Robots on this map</h3>
                  {robots.length === 0 ? (
                    <p className="maps-detail-muted">No robots assigned</p>
                  ) : (
                    <ul className="maps-list">
                      {robots.map((r) => (
                        <li key={r.robot_name}>
                          <span className="maps-list-primary">{r.robot_name}</span>
                          {r.active_graph_name && (
                            <span className="maps-list-secondary">
                              graph: {r.active_graph_name}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="maps-detail-section">
                  <h3>Navigation graphs</h3>
                  {graphs.length === 0 ? (
                    <p className="maps-detail-muted">No graphs for this map</p>
                  ) : (
                    <ul className="maps-list">
                      {graphs.map((g) => (
                        <li key={g._id}>
                          <span className="maps-list-primary">{g.graph_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="maps-detail-actions">
                  <button
                    type="button"
                    className="maps-btn maps-btn--primary"
                    onClick={() => openDashboard(selectedName)}
                  >
                    Open Dashboard
                  </button>
                  <button
                    type="button"
                    className="maps-btn"
                    onClick={() => openGraphEditor(selectedName)}
                  >
                    Open Graph Editor
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

export default MapsContent;
