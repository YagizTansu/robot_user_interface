import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RobotsController } from './robots.controller';
import { RobotsService } from './robots.service';
import { RobotPose, RobotPoseSchema } from './schemas/robot.schema';
import { RobotsGateway } from '../websocket/robots.gateway';
import {
  RobotCommand,
  RobotCommandSchema,
} from '../commands/schemas/robot-command.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RobotPose.name, schema: RobotPoseSchema },
      { name: RobotCommand.name, schema: RobotCommandSchema },
    ]),
  ],
  controllers: [RobotsController],
  providers: [RobotsService, RobotsGateway],
  exports: [RobotsService]
})
export class RobotsModule {}
