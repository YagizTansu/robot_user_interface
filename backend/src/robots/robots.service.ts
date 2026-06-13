import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RobotPose, RobotPoseDocument, Robot } from './schemas/robot.schema';

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
      status: 'Active',
      battery: 85,
      position: {
        x: robotPose.x,
        y: robotPose.y,
      },
      orientation: yawDegrees,
      currentTask: 'Navigation',
      speed: 1.0,
      temperature: 25,
      capabilities: {
        maxSpeed: 2.5,
        maxPayload: 500,
        sensors: ['LiDAR', 'Camera', 'IMU'],
      },
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
