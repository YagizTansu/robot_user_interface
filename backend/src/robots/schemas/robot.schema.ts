import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RobotDocument = Robot & Document;

@Schema({ timestamps: true })
export class Robot {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['Active', 'Idle', 'Charging', 'Maintenance', 'Error'] })
  status: string;

  @Prop({ required: true, min: 0, max: 100 })
  battery: number;

  @Prop({ type: Object, required: true })
  position: {
    x: number;
    y: number;
  };

  @Prop({ default: 0 })
  orientation: number;

  @Prop()
  currentTask?: string;

  @Prop({ default: 0 })
  speed: number;

  @Prop({ default: 25 })
  temperature: number;

  @Prop({ default: '/robots/boa.svg' })
  svgPath: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastSeen?: Date;

  @Prop({ type: Object })
  capabilities?: {
    maxSpeed: number;
    maxPayload: number;
    sensors: string[];
  };
}

export const RobotSchema = SchemaFactory.createForClass(Robot);