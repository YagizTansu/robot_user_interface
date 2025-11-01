import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
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

  @Post()
  async create(@Body() robotData: Partial<Robot>): Promise<Robot> {
    return this.robotsService.create(robotData);
  }

  @Put(':robotName')
  async update(@Param('robotName') robotName: string, @Body() robotData: Partial<Robot>): Promise<Robot> {
    const robot = await this.robotsService.update(robotName, robotData);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Put(':robotName/position')
  async updatePosition(
    @Param('robotName') robotName: string,
    @Body() positionData: { x: number; y: number; orientation?: number }
  ): Promise<Robot> {
    const robot = await this.robotsService.updatePosition(robotName, positionData, positionData.orientation);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Put(':robotName/status')
  async updateStatus(
    @Param('robotName') robotName: string,
    @Body() status: { status: string }
  ): Promise<Robot> {
    const robot = await this.robotsService.updateStatus(robotName, status.status);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Delete(':robotName')
  async delete(@Param('robotName') robotName: string): Promise<{ message: string }> {
    await this.robotsService.delete(robotName);
    return { message: 'Robot deleted successfully' };
  }

  @Post('seed')
  async seedData(): Promise<{ message: string }> {
    await this.robotsService.seedData();
    return { message: 'Sample data seeded successfully' };
  }
}
