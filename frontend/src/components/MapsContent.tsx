import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MapsContent.css';
import PageToast from './PageToast';
import { apiFetch, ApiError } from '../api';
import type { MapSummary, MapMeta, MapThumbnail, RegisteredRobot, GraphMeta } from '../types';

const GRAPH_EDITOR_MAP_KEY = 'graph_editor_selected_map';
const DASHBOARD_MAP_KEY = 'dashboard_selected_map';

function formatMeters(px: number, resolution: number) {
  return (px * resolution).toFixed(2);
}

function MapsContent() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [robotCounts, setRobotCounts] = useState<Record<string, number>>({});
  const [graphCounts, setGraphCounts] = useState<Record<string, number>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detail, setDetail] = useState<MapMeta | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [robots, setRobots] = useState<RegisteredRobot[]>([]);
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'info' | 'error' | 'success' } | null>(null);

  const loadMaps = useCallback(async () => {
    setLoadError(null);
    try {
      const [mapList, registered] = await Promise.all([
        apiFetch<MapSummary[]>('/maps'),
        apiFetch<RegisteredRobot[]>('/robots-info'),
      ]);

      setMaps(mapList);
      if (mapList.length > 0) {
        setSelectedName((prev) =>
          prev && mapList.some((m) => m.map_name === prev) ? prev : mapList[0].map_name
        );
      }

      const robotCountMap: Record<string, number> = {};
      registered.forEach((r) => {
        robotCountMap[r.map_name] = (robotCountMap[r.map_name] ?? 0) + 1;
      });
      setRobotCounts(robotCountMap);

      const graphCountEntries = await Promise.all(
        mapList.map(async (m) => {
          try {
            const list = await apiFetch<GraphMeta[]>(
              `/graphs?map_name=${encodeURIComponent(m.map_name)}`,
            );
            return [m.map_name, list.length] as const;
          } catch {
            return [m.map_name, 0] as const;
          }
        }),
      );
      setGraphCounts(Object.fromEntries(graphCountEntries));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Failed to load maps');
      setMaps([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadMaps().finally(() => setLoading(false));
  }, [loadMaps]);

  useEffect(() => {
    if (!selectedName) {
      setDetail(null);
      setThumbnail(null);
      setRobots([]);
      setGraphs([]);
      setDetailError(null);
      return;
    }

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [mapMeta, mapThumb, mapRobots, mapGraphs] = await Promise.all([
          apiFetch<MapMeta>(`/maps/${encodeURIComponent(selectedName)}/meta`),
          apiFetch<MapThumbnail>(`/maps/${encodeURIComponent(selectedName)}/thumbnail`),
          apiFetch<RegisteredRobot[]>(`/maps/${encodeURIComponent(selectedName)}/robots`),
          apiFetch<GraphMeta[]>(`/graphs?map_name=${encodeURIComponent(selectedName)}`),
        ]);

        setDetail(mapMeta);
        setThumbnail(mapThumb.image_png_base64);
        setRobots(mapRobots);
        setGraphs(mapGraphs);
      } catch (e) {
        setDetail(null);
        setThumbnail(null);
        setRobots([]);
        setGraphs([]);
        setDetailError(e instanceof ApiError ? e.message : 'Failed to load map details');
      } finally {
        setDetailLoading(false);
      }
    };

    void loadDetail();
  }, [selectedName]);

  const stats = useMemo(() => {
    const totalRobots = Object.values(robotCounts).reduce((a, b) => a + b, 0);
    const totalGraphs = Object.values(graphCounts).reduce((a, b) => a + b, 0);
    return { maps: maps.length, robots: totalRobots, graphs: totalGraphs };
  }, [maps.length, robotCounts, graphCounts]);

  const openDashboard = (mapName: string) => {
    localStorage.setItem(DASHBOARD_MAP_KEY, mapName);
    navigate('/dashboard');
  };

  const openGraphEditor = (mapName: string) => {
    localStorage.setItem(GRAPH_EDITOR_MAP_KEY, mapName);
    navigate('/graph-editor');
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadMaps();
    setLoading(false);
    setToast({ message: 'Maps refreshed', variant: 'success' });
  };

  if (loading && maps.length === 0 && !loadError) {
    return (
      <main className="maps-page">
        <div className="maps-loading">Loading maps…</div>
      </main>
    );
  }

  return (
    <main className="maps-page">
      <PageToast
        message={toast?.message ?? null}
        variant={toast?.variant}
        onClear={() => setToast(null)}
      />

      <div className="maps-toolbar">
        <button type="button" className="maps-btn maps-btn--refresh" onClick={() => void handleRefresh()}>
          Refresh
        </button>
      </div>

      {loadError && (
        <div className="maps-banner maps-banner--error">{loadError}</div>
      )}

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
            ) : detailError ? (
              <p className="maps-detail-error">{detailError}</p>
            ) : (
              <>
                <h2 className="maps-detail-title">{selectedName}</h2>

                {thumbnail && (
                  <div className="maps-preview">
                    <img
                      src={`data:image/png;base64,${thumbnail}`}
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
