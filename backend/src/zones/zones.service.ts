import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProhibitedZone, ProhibitedZoneDocument } from './schemas/prohibited-zone.schema';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(ProhibitedZone.name)
    private prohibitedZoneModel: Model<ProhibitedZoneDocument>,
  ) {}

  async create(createZoneDto: Partial<ProhibitedZone>): Promise<ProhibitedZone> {
    const createdZone = new this.prohibitedZoneModel({
      ...createZoneDto,
      timestamp: createZoneDto.timestamp || Date.now(),
    });
    return createdZone.save();
  }

  async findAll(): Promise<ProhibitedZone[]> {
    return this.prohibitedZoneModel.find().exec();
  }

  async findById(id: string): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel.findById(id).exec();
  }

  async findByRobotName(robotName: string): Promise<ProhibitedZone[]> {
    return this.prohibitedZoneModel.find({ robot_name: robotName }).exec();
  }

  async update(id: string, updateZoneDto: Partial<ProhibitedZone>): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel
      .findByIdAndUpdate(id, updateZoneDto, { new: true })
      .exec();
  }

  async delete(id: string): Promise<ProhibitedZone | null> {
    return this.prohibitedZoneModel.findByIdAndDelete(id).exec();
  }

  async deleteByRobotName(robotName: string): Promise<{ deletedCount: number }> {
    const result = await this.prohibitedZoneModel.deleteMany({ robot_name: robotName }).exec();
    return { deletedCount: result.deletedCount };
  }
}
