import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RobotInfo, RobotInfoDocument } from '../maps/schemas/robot-info.schema';

@Injectable()
export class RobotsInfoService {
  constructor(
    @InjectModel(RobotInfo.name)
    private robotInfoModel: Model<RobotInfoDocument>,
  ) {}

  async findAll(): Promise<RobotInfo[]> {
    return this.robotInfoModel.find().sort({ robot_name: 1 }).exec();
  }

  async findOne(robotName: string): Promise<RobotInfo | null> {
    return this.robotInfoModel.findOne({ robot_name: robotName }).exec();
  }

  async create(body: {
    robot_name: string;
    map_name: string;
    active_graph_name?: string;
  }): Promise<RobotInfo> {
    const existing = await this.robotInfoModel
      .findOne({ robot_name: body.robot_name })
      .exec();
    if (existing) {
      throw new ConflictException(`Robot already registered: ${body.robot_name}`);
    }
    const created = new this.robotInfoModel(body);
    return created.save();
  }

  async update(
    robotName: string,
    body: { map_name?: string; active_graph_name?: string | null },
  ): Promise<RobotInfo> {
    const update: Record<string, unknown> = {};
    if (body.map_name !== undefined) update.map_name = body.map_name;
    if (body.active_graph_name !== undefined) {
      update.active_graph_name = body.active_graph_name || null;
    }

    const updated = await this.robotInfoModel
      .findOneAndUpdate(
        { robot_name: robotName },
        {
          $set: update,
          $setOnInsert: { robot_name: robotName, map_name: body.map_name ?? '' },
        },
        { new: true, upsert: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Robot not found: ${robotName}`);
    }
    return updated;
  }

  async delete(robotName: string): Promise<void> {
    const result = await this.robotInfoModel
      .deleteOne({ robot_name: robotName })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Robot not found: ${robotName}`);
    }
  }
}
