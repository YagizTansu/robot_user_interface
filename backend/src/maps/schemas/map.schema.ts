import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MapDocument = MapRecord & Document;

@Schema({ collection: 'maps', timestamps: false })
export class MapRecord {
  @Prop({ required: true })
  map_name: string = '';

  @Prop({ required: true })
  image_png_base64: string = '';

  @Prop({ required: true })
  width_px: number = 0;

  @Prop({ required: true })
  height_px: number = 0;

  @Prop({ required: true })
  resolution: number = 0;

  @Prop({ type: [Number], required: true })
  origin: number[] = [];

  @Prop()
  negate?: number;

  @Prop()
  occupied_thresh?: number;

  @Prop()
  free_thresh?: number;

  @Prop()
  mode?: string;

  @Prop()
  timestamp?: number;
}

export const MapRecordSchema = SchemaFactory.createForClass(MapRecord);
