import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { GraphsService } from './graphs.service';
import { GraphRecord } from './schemas/graph.schema';

@Controller('graphs')
export class GraphsController {
  constructor(private readonly graphsService: GraphsService) {}

  /** Get the currently active graph for a robot. */
  @Get('active/:robotName')
  getActive(@Param('robotName') robotName: string) {
    return this.graphsService.getActiveForRobot(robotName);
  }

  /** List graph metadata for a map (no node/edge data). */
  @Get()
  findByMapName(@Query('map_name') mapName: string) {
    return this.graphsService.findByMapName(mapName);
  }

  /** Get full graph (with nodes/edges) by id. */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.graphsService.findById(id);
  }

  /** Create a new graph. */
  @Post()
  create(
    @Body()
    body: {
      graph_name: string;
      map_name: string;
      graph: GraphRecord['graph'];
    },
  ) {
    return this.graphsService.create(body);
  }

  /** Update graph name or nodes/edges. */
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { graph_name?: string; graph?: GraphRecord['graph'] },
  ) {
    return this.graphsService.update(id, body);
  }

  /** Delete a graph. */
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.graphsService.delete(id);
  }

  /** Set this graph as the active graph for a robot. */
  @Put(':id/activate/:robotName')
  activate(
    @Param('id') id: string,
    @Param('robotName') robotName: string,
  ) {
    return this.graphsService.activate(id, robotName);
  }
}
