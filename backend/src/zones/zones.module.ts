import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { ProhibitedZone, ProhibitedZoneSchema } from './schemas/prohibited-zone.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProhibitedZone.name, schema: ProhibitedZoneSchema },
    ]),
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
