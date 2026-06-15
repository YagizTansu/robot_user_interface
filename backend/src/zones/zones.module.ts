import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { ProhibitedZone, ProhibitedZoneSchema } from './schemas/prohibited-zone.schema';
import { RobotInfo, RobotInfoSchema } from '../maps/schemas/robot-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProhibitedZone.name, schema: ProhibitedZoneSchema },
      { name: RobotInfo.name, schema: RobotInfoSchema },
    ]),
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
