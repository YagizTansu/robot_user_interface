import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ACTIVE_COMMAND_STATUSES,
  CommandStatus,
  RobotCommand,
  RobotCommandDocument,
} from './schemas/robot-command.schema';

@Injectable()
export class CommandsService {
  constructor(
    @InjectModel(RobotCommand.name)
    private commandModel: Model<RobotCommandDocument>,
  ) {}

  async createNavigate(body: {
    robot_name: string;
    node_id: string;
    graph_name?: string;
    node_description?: string;
    goal: { x: number; y: number; z: number; yaw: number };
  }): Promise<RobotCommand> {
    const busy = await this.commandModel
      .findOne({
        robot_name: body.robot_name,
        status: { $in: ACTIVE_COMMAND_STATUSES },
      })
      .exec();

    if (busy) {
      throw new ConflictException(
        `Robot "${body.robot_name}" is busy (${busy.status}). Wait for the current command to finish.`,
      );
    }

    const now = Date.now();
    const created = new this.commandModel({
      robot_name: body.robot_name,
      command_type: 'navigate_to_node',
      node_id: body.node_id,
      graph_name: body.graph_name,
      node_description: body.node_description,
      goal: body.goal,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });

    return created.save();
  }

  async getPending(robotName: string): Promise<RobotCommand | null> {
    return this.commandModel
      .findOne({ robot_name: robotName, status: 'pending' })
      .sort({ created_at: 1 })
      .exec();
  }

  async getLatest(robotName: string): Promise<RobotCommand | null> {
    return this.commandModel
      .findOne({ robot_name: robotName })
      .sort({ created_at: -1 })
      .exec();
  }

  async getActive(robotName: string): Promise<RobotCommand | null> {
    return this.commandModel
      .findOne({
        robot_name: robotName,
        status: { $in: ACTIVE_COMMAND_STATUSES },
      })
      .sort({ created_at: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: CommandStatus,
    error_message?: string,
  ): Promise<RobotCommand> {
    const terminal: CommandStatus[] = ['completed', 'failed', 'cancelled'];
    const now = Date.now();
    const update: Partial<RobotCommand> = {
      status,
      updated_at: now,
      error_message,
    };

    if (terminal.includes(status)) {
      update.completed_at = now;
    }

    const updated = await this.commandModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();

    if (!updated) throw new NotFoundException(`Command not found: ${id}`);
    return updated;
  }

  async findByRobotName(robotName: string, limit = 20): Promise<RobotCommand[]> {
    return this.commandModel
      .find({ robot_name: robotName })
      .sort({ created_at: -1 })
      .limit(limit)
      .exec();
  }
}
