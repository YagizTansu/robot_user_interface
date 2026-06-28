export interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  orientation: number;
  lastSeen?: number;
  status?: string;
  battery?: number;
  currentTask?: string;
  speed?: number;
  temperature?: number;
}

/** Alias used on the Robots page (same shape as live WebSocket robot). */
export type LiveRobot = Robot;

export interface RegisteredRobot {
  robot_name: string;
  map_name: string;
  active_graph_name?: string;
}
