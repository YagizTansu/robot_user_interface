import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GraphRecord, GraphDocument } from './schemas/graph.schema';
import { RobotInfo, RobotInfoDocument } from '../maps/schemas/robot-info.schema';

@Injectable()
export class GraphsService {
  constructor(
    @InjectModel(GraphRecord.name) private graphModel: Model<GraphDocument>,
    @InjectModel(RobotInfo.name) private robotInfoModel: Model<RobotInfoDocument>,
  ) {}

  async findByMapName(mapName: string): Promise<Omit<GraphRecord, 'graph'>[]> {
    return this.graphModel
      .find({ map_name: mapName }, { graph: 0 })
      .sort({ timestamp: -1 })
      .exec();
  }

  async findById(id: string): Promise<GraphRecord> {
    const record = await this.graphModel.findById(id).exec();
    if (!record) throw new NotFoundException(`Graph not found: ${id}`);
    return record;
  }

  async create(body: {
    graph_name: string;
    map_name: string;
    graph: GraphRecord['graph'];
  }): Promise<GraphRecord> {
    const created = new this.graphModel({
      ...body,
      timestamp: Date.now(),
    });
    return created.save();
  }

  async update(
    id: string,
    body: { graph_name?: string; graph?: GraphRecord['graph'] },
  ): Promise<GraphRecord> {
    const updated = await this.graphModel
      .findByIdAndUpdate(
        id,
        { ...body, timestamp: Date.now() },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException(`Graph not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.graphModel.findByIdAndDelete(id).exec();
  }

  async activate(id: string, robotName: string): Promise<{ active_graph_name: string }> {
    const graph = await this.findById(id);
    const robotInfo = await this.robotInfoModel
      .findOne({ robot_name: robotName })
      .exec();
    if (!robotInfo) {
      throw new NotFoundException(`Robot not found: ${robotName}`);
    }
    if (robotInfo.map_name && graph.map_name !== robotInfo.map_name) {
      throw new BadRequestException(
        `Graph "${graph.graph_name}" belongs to map "${graph.map_name}", not "${robotInfo.map_name}"`,
      );
    }
    await this.robotInfoModel.updateOne(
      { robot_name: robotName },
      { $set: { active_graph_name: graph.graph_name } },
    );
    return { active_graph_name: graph.graph_name };
  }

  async getActiveForRobot(robotName: string): Promise<GraphRecord | null> {
    const robotInfo = await this.robotInfoModel
      .findOne({ robot_name: robotName })
      .exec();
    if (!robotInfo?.active_graph_name) {
      return null;
    }
    const query: { graph_name: string; map_name?: string } = {
      graph_name: robotInfo.active_graph_name,
    };
    if (robotInfo.map_name) {
      query.map_name = robotInfo.map_name;
    }
    return this.graphModel.findOne(query).exec();
  }
}
