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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Robot> {
    const robot = await this.robotsService.findOne(id);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Post()
  async create(@Body() robotData: Partial<Robot>): Promise<Robot> {
    return this.robotsService.create(robotData);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() robotData: Partial<Robot>): Promise<Robot> {
    const robot = await this.robotsService.update(id, robotData);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Put(':id/position')
  async updatePosition(
    @Param('id') id: string,
    @Body() position: { x: number; y: number }
  ): Promise<Robot> {
    const robot = await this.robotsService.updatePosition(id, position);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() status: { status: string }
  ): Promise<Robot> {
    const robot = await this.robotsService.updateStatus(id, status.status);
    if (!robot) {
      throw new HttpException('Robot not found', HttpStatus.NOT_FOUND);
    }
    return robot;
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.robotsService.delete(id);
    return { message: 'Robot deleted successfully' };
  }

  @Post('seed')
  async seedData(): Promise<{ message: string }> {
    await this.robotsService.seedData();
    return { message: 'Sample data seeded successfully' };
  }
}
