import { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/RobotsContent.css';
import robotWebSocketService from '../services/robotWebSocketService';
import { BACKEND_URL } from '../config';
import { isRobotOnline } from '../utils/robotTime';

const MAP_STORAGE_KEY = 'dashboard_selected_map';
const ROBOT_STORAGE_KEY = 'dashboard_selected_robot';

type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

const ACTIVE_STATUSES: CommandStatus[] = ['pending', 'accepted', 'in_progress'];

const COMMAND_LABEL: Record<CommandStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

interface LiveRobot {
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
}

interface RegisteredRobot {
  robot_name: string;
  map_name: string;
  active_graph_name?: string;
}

interface MapSummary {
  map_name: string;
}

interface GraphSummary {
  _id: string;
  graph_name?: string;
}

interface RobotCommand {
  _id: string;
  robot_name: string;
  command_type: string;
  node_id: string;
  node_description?: string;
  graph_name?: string;
  goal: { x: number; y: number; z: number; yaw: number };
  status: CommandStatus;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

interface FleetRow {
  robot_name: string;
  map_name: string;
  active_graph_name?: string;
  live?: LiveRobot;
  isOnline: boolean;
  latestCommand?: RobotCommand | null;
}

interface RobotsContentProps {
  onOpenDashboard?: (mapName: string, robotName: string) => void;
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

function RobotsContent({ onOpenDashboard }: RobotsContentProps) {
  const [registered, setRegistered] = useState<RegisteredRobot[]>([]);
  const [liveRobots, setLiveRobots] = useState<LiveRobot[]>([]);
  const [clientLastSeen, setClientLastSeen] = useState<Record<string, number>>({});
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [latestCommands, setLatestCommands] = useState<Record<string, RobotCommand | null>>({});
  const [activeCommand, setActiveCommand] = useState<RobotCommand | null>(null);
  const [commandHistory, setCommandHistory] = useState<RobotCommand[]>([]);
  const [graphOptions, setGraphOptions] = useState<GraphSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [onlineTick, setOnlineTick] = useState(0);

  const [editMap, setEditMap] = useState('');
  const [editGraph, setEditGraph] = useState('');

  const fleetRows = useMemo(
    () => buildFleetRows(registered, liveRobots, latestCommands, clientLastSeen),
    [registered, liveRobots, latestCommands, clientLastSeen, onlineTick]
  );

  const fleetNames = useMemo(
    () => fleetRows.map((r) => r.robot_name),
    [fleetRows]
  );

  const loadRegistered = useCallback(async () => {
    const res = await fetch(`${BACKEND_URL}/robots-info`);
    if (res.ok) setRegistered(await res.json());
  }, []);

  const loadMaps = useCallback(async () => {
    const res = await fetch(`${BACKEND_URL}/maps`);
    if (res.ok) setMaps(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([loadRegistered(), loadMaps()]).finally(() => setLoading(false));
  }, [loadRegistered, loadMaps]);

  useEffect(() => {
    const interval = setInterval(() => setOnlineTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    robotWebSocketService.connect(
      (data) => {
        const now = Date.now();
        setLiveRobots(data);
        setClientLastSeen((prev) => {
          const next = { ...prev };
          data.forEach((r) => {
            next[r.id] = now;
          });
          return next;
        });
      },
      () => { /* ignore */ }
    );
    return () => robotWebSocketService.disconnect();
  }, []);

  useEffect(() => {
    if (!fleetNames.length) {
      setLatestCommands({});
      return;
    }

    const poll = async () => {
      const entries = await Promise.all(
        fleetNames.map(async (name) => {
          try {
            const res = await fetch(`${BACKEND_URL}/commands/latest/${name}`);
            if (!res.ok) return [name, null] as const;
            const text = await res.text();
            return [name, text ? JSON.parse(text) : null] as const;
          } catch {
            return [name, null] as const;
          }
        })
      );
      setLatestCommands(Object.fromEntries(entries));
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [fleetNames.join(',')]);

  const selectedRow = fleetRows.find((r) => r.robot_name === selectedName) ?? null;

  useEffect(() => {
    if (!selectedName) {
      setActiveCommand(null);
      setCommandHistory([]);
      setGraphOptions([]);
      return;
    }

    const row = fleetRows.find((r) => r.robot_name === selectedName);
    if (row) {
      setEditMap(row.map_name !== '—' ? row.map_name : maps[0]?.map_name ?? '');
      setEditGraph(row.active_graph_name ?? '');
    }

    const loadDetail = async () => {
      try {
        const [activeRes, histRes] = await Promise.all([
          fetch(`${BACKEND_URL}/commands/active/${selectedName}`),
          fetch(`${BACKEND_URL}/commands?robot_name=${encodeURIComponent(selectedName)}`),
        ]);
        if (activeRes.ok) {
          const text = await activeRes.text();
          setActiveCommand(text ? JSON.parse(text) : null);
        }
        if (histRes.ok) setCommandHistory(await histRes.json());
      } catch { /* ignore */ }
    };

    loadDetail();
    const interval = setInterval(loadDetail, 3000);
    return () => clearInterval(interval);
  }, [selectedName, fleetRows, maps]);

  useEffect(() => {
    if (!editMap) {
      setGraphOptions([]);
      return;
    }
    fetch(`${BACKEND_URL}/graphs?map_name=${encodeURIComponent(editMap)}`)
      .then((r) => (r.ok ? r.json() : []))
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveConfig = async () => {
    if (!selectedName || !editMap) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/robots-info/${encodeURIComponent(selectedName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            map_name: editMap,
            active_graph_name: editGraph || null,
          }),
        }
      );
      if (!res.ok) throw new Error('Save failed');
      await loadRegistered();
      showToast('Configuration saved');
    } catch {
      showToast('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCommand = async () => {
    if (!activeCommand) return;
    setCancelling(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/commands/${activeCommand._id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );
      if (!res.ok) throw new Error('Cancel failed');
      setActiveCommand(null);
      showToast('Command cancelled');
    } catch {
      showToast('Failed to cancel command');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenDashboard = () => {
    if (!selectedRow || selectedRow.map_name === '—') return;
    localStorage.setItem(MAP_STORAGE_KEY, selectedRow.map_name);
    localStorage.setItem(ROBOT_STORAGE_KEY, selectedRow.robot_name);
    onOpenDashboard?.(selectedRow.map_name, selectedRow.robot_name);
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
      <header className="robots-header">
        <div>
          <h1 className="robots-title">Robots</h1>
          <p className="robots-subtitle">Live fleet status and configuration</p>
        </div>
        {toast && (
          <div className="robots-header-actions">
            <span className="robots-toast">{toast}</span>
          </div>
        )}
      </header>

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
                          {COMMAND_LABEL[row.latestCommand.status]}
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
                  <dt>Battery</dt>
                  <dd>{selectedRow.live ? `${selectedRow.live.battery}%` : '—'}</dd>
                </dl>
              </section>

              <section className="robots-detail-section">
                <h3>Active Command</h3>
                {activeCommand ? (
                  <div className="robots-command-card">
                    <span className={`robots-cmd-pill robots-cmd-pill--${activeCommand.status.replace('_', '-')}`}>
                      {COMMAND_LABEL[activeCommand.status]}
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
                          {COMMAND_LABEL[cmd.status]}
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
