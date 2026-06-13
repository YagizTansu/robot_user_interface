import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RobotInfoDocument = RobotInfo & Document;

@Schema({ collection: 'robots_info', timestamps: false })
export class RobotInfo {
  @Prop({ required: true })
  robot_name: string = '';

  @Prop({ required: true })
  map_name: string = '';

  @Prop({ default: null })
  active_graph_name?: string;
}

export const RobotInfoSchema = SchemaFactory.createForClass(RobotInfo);
