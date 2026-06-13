import { Controller, Get, Param } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('by-robot/:robotName')
  findByRobot(@Param('robotName') robotName: string) {
    return this.mapsService.findByRobotName(robotName);
  }

  @Get(':mapName')
  findByMapName(@Param('mapName') mapName: string) {
    return this.mapsService.findByMapName(mapName);
  }
}
