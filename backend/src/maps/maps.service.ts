import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MapRecord, MapDocument } from './schemas/map.schema';
import { RobotInfo, RobotInfoDocument } from './schemas/robot-info.schema';

@Injectable()
export class MapsService {
  constructor(
    @InjectModel(MapRecord.name) private mapModel: Model<MapDocument>,
    @InjectModel(RobotInfo.name) private robotInfoModel: Model<RobotInfoDocument>,
  ) {}

  async findByRobotName(robotName: string): Promise<MapRecord> {
    const robotInfo = await this.robotInfoModel.findOne({ robot_name: robotName }).exec();
    if (!robotInfo) {
      throw new NotFoundException(`No robots_info entry found for robot: ${robotName}`);
    }

    const mapRecord = await this.mapModel.findOne({ map_name: robotInfo.map_name }).exec();
    if (!mapRecord) {
      throw new NotFoundException(`No map found for map_name: ${robotInfo.map_name}`);
    }

    return mapRecord;
  }

  async findByMapName(mapName: string): Promise<MapRecord> {
    const mapRecord = await this.mapModel.findOne({ map_name: mapName }).exec();
    if (!mapRecord) {
      throw new NotFoundException(`No map found for map_name: ${mapName}`);
    }
    return mapRecord;
  }
}
