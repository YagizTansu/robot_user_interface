import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RobotCommandDocument = RobotCommand & Document;

export type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const ACTIVE_COMMAND_STATUSES: CommandStatus[] = [
  'pending',
  'accepted',
  'in_progress',
];

@Schema({ collection: 'robot_commands', timestamps: false })
export class RobotCommand {
  @Prop({ required: true })
  robot_name!: string;

  @Prop({ required: true, default: 'navigate_to_node' })
  command_type!: string;

  @Prop({ required: true })
  node_id!: string;

  @Prop()
  graph_name?: string;

  @Prop()
  node_description?: string;

  @Prop({
    type: {
      x: Number,
      y: Number,
      z: Number,
      yaw: Number,
    },
    required: true,
  })
  goal!: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };

  @Prop({ required: true, default: 'pending' })
  status!: CommandStatus;

  @Prop()
  error_message?: string;

  @Prop({ required: true })
  created_at!: number;

  @Prop({ required: true })
  updated_at!: number;

  @Prop()
  completed_at?: number;
}

export const RobotCommandSchema = SchemaFactory.createForClass(RobotCommand);
