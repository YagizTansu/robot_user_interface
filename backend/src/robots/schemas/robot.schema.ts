import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RobotPoseDocument = RobotPose & Document;

@Schema({ collection: 'robots_pose', timestamps: false })
export class RobotPose {
  @Prop({ required: true })
  robot_name!: string;

  @Prop({ required: true })
  x!: number;

  @Prop({ required: true })
  y!: number;

  @Prop({ required: true })
  yaw!: number;

  @Prop({ required: true })
  timestamp!: number;
}

export const RobotPoseSchema = SchemaFactory.createForClass(RobotPose);

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
  capabilities?: {
    maxSpeed: number;
    maxPayload: number;
    sensors: string[];
  };
}

export type RobotDocument = Robot & Document;