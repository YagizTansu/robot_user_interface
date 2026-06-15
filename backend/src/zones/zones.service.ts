import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProhibitedZone, ProhibitedZoneDocument } from './schemas/prohibited-zone.schema';
import { RobotInfo, RobotInfoDocument } from '../maps/schemas/robot-info.schema';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(ProhibitedZone.name)
    private prohibitedZoneModel: Model<ProhibitedZoneDocument>,
    @InjectModel(RobotInfo.name)
    private robotInfoModel: Model<RobotInfoDocument>,
  ) {}

  async create(createZoneDto: Partial<ProhibitedZone>): Promise<ProhibitedZone> {
    const createdZone = new this.prohibitedZoneModel({
      ...createZoneDto,
      timestamp: createZoneDto.timestamp || Date.now(),
    });
    return createdZone.save();
  }

  async findAll(): Promise<ProhibitedZone[]> {
    return this.prohibitedZoneModel.find().sort({ map_name: 1, timestamp: -1 }).exec();
  }

  async findById(id: string): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel.findById(id).exec();
  }

  async findByMapName(mapName: string): Promise<ProhibitedZone[]> {
    return this.prohibitedZoneModel
      .find({ map_name: mapName })
      .sort({ timestamp: -1 })
      .exec();
  }

  /** Convenience: resolve robot → map via robots_info, return map zones. */
  async findByRobotName(robotName: string): Promise<ProhibitedZone[]> {
    const robotInfo = await this.robotInfoModel.findOne({ robot_name: robotName }).exec();
    if (!robotInfo) {
      throw new NotFoundException(`No robots_info entry found for robot: ${robotName}`);
    }
    return this.findByMapName(robotInfo.map_name);
  }

  async update(id: string, updateZoneDto: Partial<ProhibitedZone>): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel
      .findByIdAndUpdate(id, updateZoneDto, { new: true })
      .exec();
  }

  async delete(id: string): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel.findByIdAndDelete(id).exec();
  }

  async deleteByMapName(mapName: string): Promise<{ deletedCount: number }> {
    const result = await this.prohibitedZoneModel.deleteMany({ map_name: mapName }).exec();
    return { deletedCount: result.deletedCount };
  }
}
