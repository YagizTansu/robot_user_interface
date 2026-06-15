import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { RobotsInfoService } from './robots-info.service';
import { RobotInfo } from '../maps/schemas/robot-info.schema';

@Controller('robots-info')
export class RobotsInfoController {
  constructor(private readonly robotsInfoService: RobotsInfoService) {}

  @Get()
  findAll() {
    return this.robotsInfoService.findAll();
  }

  @Get(':robotName')
  async findOne(@Param('robotName') robotName: string) {
    const robot = await this.robotsInfoService.findOne(robotName);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Post()
  create(
    @Body()
    body: {
      robot_name: string;
      map_name: string;
      active_graph_name?: string;
    },
  ) {
    return this.robotsInfoService.create(body);
  }

  @Put(':robotName')
  update(
    @Param('robotName') robotName: string,
    @Body() body: Partial<Pick<RobotInfo, 'map_name' | 'active_graph_name'>>,
  ) {
    return this.robotsInfoService.update(robotName, body);
  }

  @Delete(':robotName')
  async delete(@Param('robotName') robotName: string) {
    await this.robotsInfoService.delete(robotName);
    return { message: `Robot ${robotName} removed from registry` };
  }
}
