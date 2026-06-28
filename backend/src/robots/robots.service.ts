import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RobotPose, RobotPoseDocument, Robot } from './schemas/robot.schema';
import { normalizeToEpochMs } from '../common/timestamp.util';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(RobotPose.name) private robotPoseModel: Model<RobotPoseDocument>,
  ) {}

  private transformRobotPoseToRobot(robotPose: RobotPose): Robot {
    const yawDegrees = (robotPose.yaw * 180 / Math.PI + 360) % 360;

    return {
      id: robotPose.robot_name,
      name: robotPose.robot_name,
      position: {
        x: robotPose.x,
        y: robotPose.y,
      },
      orientation: yawDegrees,
      lastSeen: normalizeToEpochMs(robotPose.timestamp),
    };
  }

  async findAll(): Promise<Robot[]> {
    // Her robot için en güncel dokümanı al
    const latestPoses = await this.robotPoseModel.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$robot_name', latestPose: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestPose' } },
    ]).exec();

    return latestPoses.map(pose => this.transformRobotPoseToRobot(pose));
  }

  async findOne(robotName: string): Promise<Robot | null> {
    const robotPose = await this.robotPoseModel
      .findOne({ robot_name: robotName })
      .sort({ timestamp: -1 })
      .exec();

    if (!robotPose) return null;
    return this.transformRobotPoseToRobot(robotPose);
  }
}
