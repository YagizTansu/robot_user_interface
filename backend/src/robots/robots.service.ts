import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RobotPose, RobotPoseDocument, Robot } from './schemas/robot.schema';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(RobotPose.name) private robotPoseModel: Model<RobotPoseDocument>,
  ) {}

  // Yeni veri yapısından frontend için uygun formata çevir
  private transformRobotPoseToRobot(robotPose: RobotPose): Robot {
    // Quaternion'dan Euler açıya çevrim (basit z-axis rotation)
    const { x, y, z, w } = robotPose.pose.pose.orientation;
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    const yawDegrees = (yaw * 180 / Math.PI + 360) % 360;

    const transformedRobot = {
      id: robotPose.robot_name,
      name: robotPose.robot_name,
      status: 'Active', // Default status - gerçek status için ayrı collection gerekebilir
      battery: 85, // Default battery - gerçek battery için ayrı collection gerekebilir
      position: {
        x: robotPose.pose.pose.position.x,
        y: robotPose.pose.pose.position.y
      },
      orientation: yawDegrees,
      currentTask: 'Navigation', // Default task
      speed: 1.0, // Default speed
      temperature: 25, // Default temperature
      capabilities: {
        maxSpeed: 2.5,
        maxPayload: 500,
        sensors: ['LiDAR', 'Camera', 'IMU']
      }
    };

    // Debug log
    console.log(`Transforming robot pose for ${robotPose.robot_name}:
      Input ROS position: (${robotPose.pose.pose.position.x}, ${robotPose.pose.pose.position.y})
      Input quaternion: (${x}, ${y}, ${z}, ${w})
      Output position: (${transformedRobot.position.x}, ${transformedRobot.position.y})
      Output orientation: ${transformedRobot.orientation.toFixed(1)}°`);

    return transformedRobot;
  }

  async findAll(): Promise<Robot[]> {
    // En son pose verilerini al (her robot için en güncel timestamp)
    const latestPoses = await this.robotPoseModel.aggregate([
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: '$robot_name',
          latestPose: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestPose' }
      }
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

  async create(robotData: Partial<Robot>): Promise<Robot> {
    // Frontend'den gelen Robot data'sını RobotPose formatına çevir
    const robotPoseData = {
      robot_name: robotData.id || robotData.name,
      header: {
        stamp: {
          sec: Math.floor(Date.now() / 1000),
          nanosec: (Date.now() % 1000) * 1000000
        },
        frame_id: 'map'
      },
      pose: {
        pose: {
          position: {
            x: robotData.position?.x || 0,
            y: robotData.position?.y || 0,
            z: 0
          },
          orientation: {
            x: 0,
            y: 0,
            z: Math.sin((robotData.orientation || 0) * Math.PI / 360),
            w: Math.cos((robotData.orientation || 0) * Math.PI / 360)
          }
        }
      },
      timestamp: Date.now()
    };

    const createdRobotPose = new this.robotPoseModel(robotPoseData);
    const savedPose = await createdRobotPose.save();
    return this.transformRobotPoseToRobot(savedPose);
  }

  async update(robotName: string, robotData: Partial<Robot>): Promise<Robot | null> {
    // Yeni pose kaydı oluştur (update yerine insert - pose history için)
    if (robotData.position || robotData.orientation !== undefined) {
      return this.updatePosition(robotName, robotData.position || { x: 0, y: 0 }, robotData.orientation);
    }
    
    // Pozisyon güncellemesi yoksa mevcut robot'u döndür
    return this.findOne(robotName);
  }

  async updatePosition(robotName: string, position: { x: number; y: number }, orientation?: number): Promise<Robot | null> {
    const robotPoseData = {
      robot_name: robotName,
      header: {
        stamp: {
          sec: Math.floor(Date.now() / 1000),
          nanosec: (Date.now() % 1000) * 1000000
        },
        frame_id: 'map'
      },
      pose: {
        pose: {
          position: {
            x: position.x,
            y: position.y,
            z: 0
          },
          orientation: {
            x: 0,
            y: 0,
            z: Math.sin((orientation || 0) * Math.PI / 360),
            w: Math.cos((orientation || 0) * Math.PI / 360)
          }
        }
      },
      timestamp: Date.now()
    };

    const newPose = new this.robotPoseModel(robotPoseData);
    const savedPose = await newPose.save();
    return this.transformRobotPoseToRobot(savedPose);
  }

  async updateStatus(robotName: string, status: string): Promise<Robot | null> {
    // Status güncellemesi için ayrı logic gerekebilir
    // Şimdilik mevcut robot'u döndür
    return this.findOne(robotName);
  }

  async delete(robotName: string): Promise<void> {
    await this.robotPoseModel.deleteMany({ robot_name: robotName }).exec();
  }

  // Test verisi oluştur
  async seedData(): Promise<void> {
    const existingRobots = await this.robotPoseModel.countDocuments();
    if (existingRobots === 0) {
      const samplePoses = [
        {
          robot_name: 'agv001',
          header: {
            stamp: {
              sec: 1346,
              nanosec: 930000000
            },
            frame_id: 'map'
          },
          pose: {
            pose: {
              position: { x: -4.0, y: 2.0, z: 0 }, // Harita içinde sol kısım
              orientation: { x: 0, y: 0, z: 0.707, w: 0.707 } // 90 derece
            }
          },
          timestamp: Date.now()
        },
        {
          robot_name: 'agv002',
          header: {
            stamp: {
              sec: 1347,
              nanosec: 120000000
            },
            frame_id: 'map'
          },
          pose: {
            pose: {
              position: { x: 2.0, y: -3.0, z: 0 }, // Harita içinde sağ alt kısım
              orientation: { x: 0, y: 0, z: 0.0, w: 1.0 } // 0 derece
            }
          },
          timestamp: Date.now() + 1000
        }
      ];

      await this.robotPoseModel.insertMany(samplePoses);
    }
  }
}
