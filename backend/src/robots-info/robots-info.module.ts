import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RobotsInfoController } from './robots-info.controller';
import { RobotsInfoService } from './robots-info.service';
import { RobotInfo, RobotInfoSchema } from '../maps/schemas/robot-info.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RobotInfo.name, schema: RobotInfoSchema },
    ]),
  ],
  controllers: [RobotsInfoController],
  providers: [RobotsInfoService],
  exports: [RobotsInfoService],
})
export class RobotsInfoModule {}
