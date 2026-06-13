import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapsController } from './maps.controller';
import { MapsService } from './maps.service';
import { MapRecord, MapRecordSchema } from './schemas/map.schema';
import { RobotInfo, RobotInfoSchema } from './schemas/robot-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MapRecord.name, schema: MapRecordSchema },
      { name: RobotInfo.name, schema: RobotInfoSchema },
    ]),
  ],
  controllers: [MapsController],
  providers: [MapsService],
})
export class MapsModule {}
