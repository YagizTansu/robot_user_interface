import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { RobotsService } from './robots.service';
import { Robot } from './schemas/robot.schema';

@Controller('api/robots')
export class RobotsController {
  constructor(private readonly robotsService: RobotsService) {}

  @Get()
  async findAll(): Promise<Robot[]> {
    return this.robotsService.findAll();
  }

  @Get(':robotName')
  async findOne(@Param('robotName') robotName: string): Promise<Robot> {
    const robot = await this.robotsService.findOne(robotName);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }
}
