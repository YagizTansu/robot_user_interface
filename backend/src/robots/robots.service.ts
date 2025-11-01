import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Robot, RobotDocument } from './schemas/robot.schema';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(Robot.name) private robotModel: Model<RobotDocument>,
  ) {}

  async findAll(): Promise<Robot[]> {
    return this.robotModel.find().exec();
  }

  async findOne(id: string): Promise<Robot | null> {
    return this.robotModel.findOne({ id }).exec();
  }

  async create(robotData: Partial<Robot>): Promise<Robot> {
    const createdRobot = new this.robotModel(robotData);
    return createdRobot.save();
  }

  async update(id: string, robotData: Partial<Robot>): Promise<Robot | null> {
    return this.robotModel.findOneAndUpdate({ id }, robotData, { new: true }).exec();
  }

  async updatePosition(id: string, position: { x: number; y: number }): Promise<Robot | null> {
    return this.robotModel.findOneAndUpdate(
      { id },
      { position, lastSeen: new Date() },
      { new: true }
    ).exec();
  }

  async updateStatus(id: string, status: string): Promise<Robot | null> {
    return this.robotModel.findOneAndUpdate(
      { id },
      { status, lastSeen: new Date() },
      { new: true }
    ).exec();
  }

  async delete(id: string): Promise<void> {
    await this.robotModel.findOneAndDelete({ id }).exec();
  }

  // Seed some initial data for testing
  async seedData(): Promise<void> {
    const existingRobots = await this.robotModel.countDocuments();
    if (existingRobots === 0) {
      const sampleRobots = [
        {
          id: 'AGV-001',
          name: 'Warehouse Bot Alpha',
          status: 'Active',
          battery: 89,
          position: { x: 20, y: 50 },
          orientation: 45,
          currentTask: 'Moving to Zone C',
          speed: 1.2,
          temperature: 24,
          capabilities: {
            maxSpeed: 2.5,
            maxPayload: 500,
            sensors: ['LiDAR', 'Camera', 'Ultrasonic']
          }
        },
        {
          id: 'AGV-002',
          name: 'Warehouse Bot Beta',
          status: 'Charging',
          battery: 25,
          position: { x: 80, y: 30 },
          orientation: 180,
          currentTask: 'Charging',
          speed: 0,
          temperature: 22,
          capabilities: {
            maxSpeed: 2.0,
            maxPayload: 300,
            sensors: ['LiDAR', 'Ultrasonic']
          }
        }
      ];

      await this.robotModel.insertMany(sampleRobots);
    }
  }
}
