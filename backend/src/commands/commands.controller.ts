import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandsService } from './commands.service';
import { CommandStatus } from './schemas/robot-command.schema';

@Controller('commands')
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  /** Dashboard: send robot to a graph node. */
  @Post('navigate')
  createNavigate(
    @Body()
    body: {
      robot_name: string;
      node_id: string;
      graph_name?: string;
      node_description?: string;
      goal: { x: number; y: number; z: number; yaw: number };
    },
  ) {
    return this.commandsService.createNavigate(body);
  }

  /** Dashboard: latest command for status display (active or most recent). */
  @Get('latest/:robotName')
  getLatest(@Param('robotName') robotName: string) {
    return this.commandsService.getLatest(robotName);
  }

  /** Dashboard: currently active command (pending/accepted/in_progress). */
  @Get('active/:robotName')
  getActive(@Param('robotName') robotName: string) {
    return this.commandsService.getActive(robotName);
  }

  /** Robot: fetch next pending command. */
  @Get('pending/:robotName')
  getPending(@Param('robotName') robotName: string) {
    return this.commandsService.getPending(robotName);
  }

  /** Command history for a robot. */
  @Get()
  findByRobot(@Query('robot_name') robotName: string) {
    if (!robotName) return [];
    return this.commandsService.findByRobotName(robotName);
  }

  /** Robot: update command lifecycle status. */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: CommandStatus; error_message?: string },
  ) {
    return this.commandsService.updateStatus(
      id,
      body.status,
      body.error_message,
    );
  }
}
