import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommandsController } from './commands.controller';
import { CommandsService } from './commands.service';
import {
  RobotCommand,
  RobotCommandSchema,
} from './schemas/robot-command.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RobotCommand.name, schema: RobotCommandSchema },
    ]),
  ],
  controllers: [CommandsController],
  providers: [CommandsService],
  exports: [CommandsService],
})
export class CommandsModule {}
