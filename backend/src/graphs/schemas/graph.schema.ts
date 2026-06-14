import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GraphDocument = GraphRecord & Document;

@Schema({ collection: 'graphs', timestamps: false })
export class GraphRecord {
  @Prop({ required: true })
  graph_name: string = '';

  @Prop({ required: true })
  map_name: string = '';

  @Prop({ type: Object, required: true })
  graph: {
    nodes: {
      id: string;
      x: number;
      y: number;
      z: number;
      yaw?: number;
      type: string;
      description: string;
    }[];
    edges: {
      from: string;
      to: string;
      cost: number;
      bidirectional: boolean;
      max_speed: number;
    }[];
  } = { nodes: [], edges: [] };

  @Prop({ required: true })
  timestamp: number = 0;
}

export const GraphRecordSchema = SchemaFactory.createForClass(GraphRecord);
