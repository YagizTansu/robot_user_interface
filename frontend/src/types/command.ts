export type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RobotCommand {
  _id: string;
  robot_name: string;
  command_type: string;
  node_id: string;
  graph_name?: string;
  node_description?: string;
  goal: { x: number; y: number; z: number; yaw: number };
  status: CommandStatus;
  error_message?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export const COMMAND_STATUS_LABEL: Record<CommandStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const ACTIVE_COMMAND_STATUSES: CommandStatus[] = [
  'pending',
  'accepted',
  'in_progress',
];

export const ACTIVE_COMMAND_STATUS_SET = new Set<CommandStatus>(ACTIVE_COMMAND_STATUSES);
