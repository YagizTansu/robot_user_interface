import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RobotsContent.css';
import PageToast from './PageToast';
import { useRobotWebSocket } from '../contexts/RobotWebSocketContext';
import { useLatestCommands, useRobotCommandDetail } from '../hooks/useRobotCommands';
import { apiFetch, ApiError } from '../api';
import { isRobotOnline } from '../utils/robotTime';
import type {
  LiveRobot,
  RegisteredRobot,
  MapSummary,
  GraphListItem,
  RobotCommand,
} from '../types';
import { COMMAND_STATUS_LABEL, ACTIVE_COMMAND_STATUSES } from '../types';

const MAP_STORAGE_KEY = 'dashboard_selected_map';
const ROBOT_STORAGE_KEY = 'dashboard_selected_robot';

const ACTIVE_STATUSES = ACTIVE_COMMAND_STATUSES;

interface FleetRow {
  robot_name: string;
  map_name: string;
  active_graph_name?: string;
  live?: LiveRobot;
  isOnline: boolean;
  latestCommand?: RobotCommand | null;
}

function buildFleetRows(
  registered: RegisteredRobot[],
  liveRobots: LiveRobot[],
  latestCommands: Record<string, RobotCommand | null>,
  clientLastSeen: Record<string, number>,
): FleetRow[] {
  const names = new Set<string>([
    ...registered.map((r) => r.robot_name),
    ...liveRobots.map((r) => r.id),
  ]);

  return [...names].sort().map((name) => {
    const reg = registered.find((r) => r.robot_name === name);
    const live = liveRobots.find((l) => l.id === name);
    return {
      robot_name: name,
      map_name: reg?.map_name || '—',
      active_graph_name: reg?.active_graph_name,
      live,
      isOnline: isRobotOnline(!!live, clientLastSeen[name], live?.lastSeen),
      latestCommand: latestCommands[name] ?? null,
    };
  });
}

function RobotsContent() {
  const navigate = useNavigate();
  const { robots: liveRobots, clientLastSeen } = useRobotWebSocket();
  const [registered, setRegistered] = useState<RegisteredRobot[]>([]);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [graphOptions, setGraphOptions] = useState<GraphListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'info' | 'error' | 'success' } | null>(null);
  const [onlineTick, setOnlineTick] = useState(0);

  const [editMap, setEditMap] = useState('');
  const [editGraph, setEditGraph] = useState('');

  const fleetNames = useMemo(() => {
    const names = new Set<string>([
      ...registered.map((r) => r.robot_name),
      ...liveRobots.map((r) => r.id),
    ]);
    return [...names].sort();
  }, [registered, liveRobots]);

  const latestCommands = useLatestCommands(fleetNames);
  const { activeCommand, commandHistory, refreshActiveCommand } =
    useRobotCommandDetail(selectedName);

  const fleetRows = useMemo(
    () => buildFleetRows(registered, liveRobots, latestCommands, clientLastSeen),
    [registered, liveRobots, latestCommands, clientLastSeen, onlineTick]
  );

  const loadRegistered = useCallback(async () => {
    const data = await apiFetch<RegisteredRobot[]>('/robots-info');
    setRegistered(data);
  }, []);

  const loadMaps = useCallback(async () => {
    const data = await apiFetch<MapSummary[]>('/maps');
    setMaps(data);
  }, []);

  useEffect(() => {
    setLoadError(null);
    Promise.all([loadRegistered(), loadMaps()])
      .catch((e) => {
        setLoadError(e instanceof ApiError ? e.message : 'Failed to load fleet data');
      })
      .finally(() => setLoading(false));
  }, [loadRegistered, loadMaps]);

  useEffect(() => {
    const interval = setInterval(() => setOnlineTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const selectedRow = fleetRows.find((r) => r.robot_name === selectedName) ?? null;

  useEffect(() => {
    if (!selectedName) {
      setGraphOptions([]);
      return;
    }

    const row = fleetRows.find((r) => r.robot_name === selectedName);
    if (row) {
      setEditMap(row.map_name !== '—' ? row.map_name : maps[0]?.map_name ?? '');
      setEditGraph(row.active_graph_name ?? '');
    }
  }, [selectedName, fleetRows, maps]);

  useEffect(() => {
    if (!editMap) {
      setGraphOptions([]);
      return;
    }
    apiFetch<GraphListItem[]>(`/graphs?map_name=${encodeURIComponent(editMap)}`)
      .then(setGraphOptions)
      .catch(() => setGraphOptions([]));
  }, [editMap]);

  const stats = useMemo(() => {
    const online = fleetRows.filter((r) => r.isOnline).length;
    const busy = fleetRows.filter((r) =>
      r.latestCommand && ACTIVE_STATUSES.includes(r.latestCommand.status)
    ).length;
    const mapCount = new Set(
      fleetRows.map((r) => r.map_name).filter((m) => m !== '—')
    ).size;
    return { total: fleetRows.length, online, busy, mapCount };
  }, [fleetRows]);

  const showToast = (msg: string, variant: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message: msg, variant });
  };

  const handleSaveConfig = async () => {
    if (!selectedName || !editMap) return;
    setSaving(true);
    try {
      await apiFetch(`/robots-info/${encodeURIComponent(selectedName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map_name: editMap,
          active_graph_name: editGraph || null,
        }),
      });
      await loadRegistered();
      showToast('Configuration saved', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCommand = async () => {
    if (!activeCommand) return;
    setCancelling(true);
    try {
      await apiFetch(`/commands/${activeCommand._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      void refreshActiveCommand();
      showToast('Command cancelled', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Failed to cancel command', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenDashboard = () => {
    if (!selectedRow || selectedRow.map_name === '—') return;
    localStorage.setItem(MAP_STORAGE_KEY, selectedRow.map_name);
    localStorage.setItem(ROBOT_STORAGE_KEY, selectedRow.robot_name);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <main className="main-content robots-page">
        <div className="robots-loading">Loading fleet...</div>
      </main>
    );
  }

  return (
    <main className="main-content robots-page">
      <PageToast
        message={toast?.message ?? null}
        variant={toast?.variant}
        onClear={() => setToast(null)}
      />

      <header className="robots-header">
        <div>
          <h1 className="robots-title">Robots</h1>
          <p className="robots-subtitle">Live fleet status and configuration</p>
        </div>
      </header>

      {loadError && (
        <div className="robots-banner robots-banner--error">{loadError}</div>
      )}

      <div className="robots-stats">
        <div className="robots-stat">
          <span className="robots-stat-value">{stats.total}</span>
          <span className="robots-stat-label">Total</span>
        </div>
        <div className="robots-stat">
          <span className="robots-stat-value robots-stat-value--success">{stats.online}</span>
          <span className="robots-stat-label">Online</span>
        </div>
        <div className="robots-stat">
          <span className="robots-stat-value robots-stat-value--warning">{stats.busy}</span>
          <span className="robots-stat-label">Busy</span>
        </div>
        <div className="robots-stat">
          <span className="robots-stat-value">{stats.mapCount}</span>
          <span className="robots-stat-label">Maps</span>
        </div>
      </div>

      <div className="robots-layout">
        <div className="robots-table-wrap">
          <table className="robots-table">
            <thead>
              <tr>
                <th>Robot</th>
                <th>Map</th>
                <th>Status</th>
                <th>Position</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {fleetRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="robots-empty">
                    No robots detected. Robots appear here when they start sending pose data.
                  </td>
                </tr>
              ) : (
                fleetRows.map((row) => (
                  <tr
                    key={row.robot_name}
                    className={selectedName === row.robot_name ? 'selected' : ''}
                    onClick={() => setSelectedName(row.robot_name)}
                  >
                    <td className="robots-td-name">{row.robot_name}</td>
                    <td>{row.map_name}</td>
                    <td>
                      <span className={`robots-status-pill ${row.isOnline ? 'online' : 'offline'}`}>
                        {row.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="robots-td-mono">
                      {row.live
                        ? `${row.live.position.x.toFixed(2)}, ${row.live.position.y.toFixed(2)}`
                        : '—'}
                    </td>
                    <td>
                      {row.latestCommand && ACTIVE_STATUSES.includes(row.latestCommand.status) ? (
                        <span className={`robots-cmd-pill robots-cmd-pill--${row.latestCommand.status.replace('_', '-')}`}>
                          {COMMAND_STATUS_LABEL[row.latestCommand.status]}
                        </span>
                      ) : (
                        <span className="robots-cmd-pill robots-cmd-pill--idle">Idle</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className={`robots-detail ${selectedRow ? 'open' : ''}`}>
          {!selectedRow ? (
            <div className="robots-detail-empty">
              <p>Select a robot to view details and configuration.</p>
            </div>
          ) : (
            <>
              <div className="robots-detail-header">
                <h2>{selectedRow.robot_name}</h2>
              </div>

              <section className="robots-detail-section">
                <h3>Configuration</h3>
                <label className="robots-field">
                  <span>Map</span>
                  <select value={editMap} onChange={(e) => setEditMap(e.target.value)}>
                    {maps.map((m) => (
                      <option key={m.map_name} value={m.map_name}>{m.map_name}</option>
                    ))}
                  </select>
                </label>
                <label className="robots-field">
                  <span>Active Graph</span>
                  <select
                    value={editGraph}
                    onChange={(e) => setEditGraph(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {graphOptions.map((g) => (
                      <option key={g._id} value={g.graph_name ?? ''}>
                        {g.graph_name ?? g._id}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="robots-btn robots-btn--primary"
                  onClick={handleSaveConfig}
                  disabled={saving || !editMap}
                >
                  {saving ? 'Saving…' : 'Save Configuration'}
                </button>
              </section>

              <section className="robots-detail-section">
                <h3>Live Status</h3>
                <dl className="robots-kv">
                  <dt>Connection</dt>
                  <dd>
                    <span className={`robots-status-pill ${selectedRow.isOnline ? 'online' : 'offline'}`}>
                      {selectedRow.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </dd>
                  <dt>Position</dt>
                  <dd className="robots-td-mono">
                    {selectedRow.live
                      ? `(${selectedRow.live.position.x.toFixed(2)}m, ${selectedRow.live.position.y.toFixed(2)}m)`
                      : '—'}
                  </dd>
                  <dt>Orientation</dt>
                  <dd>
                    {selectedRow.live ? `${selectedRow.live.orientation.toFixed(1)}°` : '—'}
                  </dd>
                </dl>
              </section>

              <section className="robots-detail-section">
                <h3>Active Command</h3>
                {activeCommand ? (
                  <div className="robots-command-card">
                    <span className={`robots-cmd-pill robots-cmd-pill--${activeCommand.status.replace('_', '-')}`}>
                      {COMMAND_STATUS_LABEL[activeCommand.status]}
                    </span>
                    <p className="robots-command-target">
                      → {activeCommand.node_description || activeCommand.node_id}
                    </p>
                    <p className="robots-command-goal">
                      ({activeCommand.goal.x.toFixed(2)}m, {activeCommand.goal.y.toFixed(2)}m)
                    </p>
                    {activeCommand.error_message && (
                      <p className="robots-command-error">{activeCommand.error_message}</p>
                    )}
                    {ACTIVE_STATUSES.includes(activeCommand.status) && (
                      <button
                        className="robots-btn robots-btn--danger"
                        onClick={handleCancelCommand}
                        disabled={cancelling}
                      >
                        {cancelling ? 'Cancelling…' : 'Cancel Command'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="robots-muted">No active command</p>
                )}
              </section>

              {commandHistory.length > 0 && (
                <section className="robots-detail-section">
                  <h3>Recent Commands</h3>
                  <ul className="robots-history">
                    {commandHistory.slice(0, 8).map((cmd) => (
                      <li key={cmd._id}>
                        <span className={`robots-cmd-pill robots-cmd-pill--${cmd.status.replace('_', '-')}`}>
                          {COMMAND_STATUS_LABEL[cmd.status]}
                        </span>
                        <span>{cmd.node_description || cmd.node_id}</span>
                        <time>{new Date(cmd.created_at).toLocaleTimeString()}</time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <button
                className="robots-btn robots-btn--secondary robots-open-dash"
                onClick={handleOpenDashboard}
                disabled={selectedRow.map_name === '—'}
              >
                Open on Dashboard
              </button>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export default RobotsContent;
