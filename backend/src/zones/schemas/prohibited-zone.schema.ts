import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProhibitedZoneDocument = ProhibitedZone & Document;

@Schema({ collection: 'prohibited_zones' })
export class ProhibitedZone {
  @Prop({ required: true })
  robot_name: string;

  @Prop({ required: true })
  zone_name: string;

  @Prop({ required: true })
  zone_type: string;

  @Prop({ type: [Number], required: true })
  polygon_points: number[];

  @Prop({ default: 0 })
  timestamp: number;
}

export const ProhibitedZoneSchema = SchemaFactory.createForClass(ProhibitedZone);
