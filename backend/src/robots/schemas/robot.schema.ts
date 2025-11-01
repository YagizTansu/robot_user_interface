import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RobotPoseDocument = RobotPose & Document;

@Schema({ collection: 'robots_pose', timestamps: false })
export class RobotPose {
  @Prop({ required: true })
  robot_name: string;

  @Prop({ type: Object, required: true })
  header: {
    stamp: {
      sec: number;
      nanosec: number;
    };
    frame_id: string;
  };

  @Prop({ type: Object, required: true })
  pose: {
    pose: {
      position: {
        x: number;
        y: number;
        z: number;
      };
      orientation: {
        x: number;
        y: number;
        z: number;
        w: number;
      };
    };
  };

  @Prop({ required: true })
  timestamp: number;
}

export const RobotPoseSchema = SchemaFactory.createForClass(RobotPose);

// Backward compatibility için eski Robot interface'ini koruyoruz (frontend için)
export interface Robot {
  id: string;
  name: string;
  status: string;
  battery: number;
  position: { x: number; y: number };
  orientation: number;
  currentTask: string;
  speed: number;
  temperature: number;
  capabilities: {
    maxSpeed: number;
    maxPayload: number;
    sensors: string[];
  };
}

export type RobotDocument = Robot & Document;