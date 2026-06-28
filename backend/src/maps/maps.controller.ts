import { Controller, Get, Param } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get()
  findAll() {
    return this.mapsService.findAllSummaries();
  }

  @Get('by-robot/:robotName')
  findByRobot(@Param('robotName') robotName: string) {
    return this.mapsService.findByRobotName(robotName);
  }

  @Get('by-robot/:robotName/meta')
  findMetaByRobot(@Param('robotName') robotName: string) {
    return this.mapsService.findMetaByRobotName(robotName);
  }

  @Get(':mapName/robots')
  findRobotsByMap(@Param('mapName') mapName: string) {
    return this.mapsService.findRobotsByMapName(mapName);
  }

  @Get(':mapName/thumbnail')
  findThumbnail(@Param('mapName') mapName: string) {
    return this.mapsService.findThumbnailByMapName(mapName);
  }

  @Get(':mapName/meta')
  findMeta(@Param('mapName') mapName: string) {
    return this.mapsService.findMetaByMapName(mapName);
  }

  @Get(':mapName')
  findByMapName(@Param('mapName') mapName: string) {
    return this.mapsService.findByMapName(mapName);
  }
}
