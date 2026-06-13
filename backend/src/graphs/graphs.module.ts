import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphsController } from './graphs.controller';
import { GraphsService } from './graphs.service';
import { GraphRecord, GraphRecordSchema } from './schemas/graph.schema';
import { RobotInfo, RobotInfoSchema } from '../maps/schemas/robot-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GraphRecord.name, schema: GraphRecordSchema },
      { name: RobotInfo.name, schema: RobotInfoSchema },
    ]),
  ],
  controllers: [GraphsController],
  providers: [GraphsService],
})
export class GraphsModule {}
