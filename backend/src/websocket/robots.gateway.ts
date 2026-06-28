import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RobotPose, RobotPoseDocument } from '../robots/schemas/robot.schema';
import {
  RobotCommand,
  RobotCommandDocument,
} from '../commands/schemas/robot-command.schema';
import { RobotsService } from '../robots/robots.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RobotsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RobotsGateway.name);

  @WebSocketServer()
  server: Server;

  private changeStream: any;
  private commandChangeStream: any;

  constructor(
    @InjectModel(RobotPose.name) private robotPoseModel: Model<RobotPoseDocument>,
    @InjectModel(RobotCommand.name)
    private commandModel: Model<RobotCommandDocument>,
    private robotsService: RobotsService,
  ) {}

  async onModuleInit() {
    this.initChangeStreams();
    this.initCommandChangeStream();
  }

  async onModuleDestroy() {
    if (this.changeStream) {
      await this.changeStream.close();
    }
    if (this.commandChangeStream) {
      await this.commandChangeStream.close();
    }
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    this.sendCurrentRobotData(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  private async sendCurrentRobotData(client: Socket) {
    try {
      const robots = await this.robotsService.findAll();
      client.emit('robots-data', robots);
    } catch (error) {
      this.logger.error('Error sending current robot data', error);
      client.emit('robots-error', { message: 'Failed to fetch robot data' });
    }
  }

  private initChangeStreams() {
    try {
      this.changeStream = this.robotPoseModel.watch([], {
        fullDocument: 'updateLookup',
      });

      this.changeStream.on('change', async () => {
        try {
          const robots = await this.robotsService.findAll();
          this.server.emit('robots-data', robots);
        } catch (error) {
          this.logger.error('Error handling robot pose change', error);
          this.server.emit('robots-error', { message: 'Failed to process robot data change' });
        }
      });

      this.changeStream.on('error', (error: Error) => {
        this.logger.error('Robot pose change stream error', error);
        this.server.emit('robots-error', { message: 'Real-time connection error' });
        setTimeout(() => this.initChangeStreams(), 5000);
      });

      this.logger.log('Change stream active: robots_pose');
    } catch (error) {
      this.logger.error('Error initializing robot pose change stream', error);
    }
  }

  private initCommandChangeStream() {
    try {
      this.commandChangeStream = this.commandModel.watch([], {
        fullDocument: 'updateLookup',
      });

      this.commandChangeStream.on('change', (change: { fullDocument?: RobotCommandDocument }) => {
        const doc = change.fullDocument;
        if (!doc) return;
        this.server.emit('command-update', this.serializeCommand(doc));
      });

      this.commandChangeStream.on('error', (error: Error) => {
        this.logger.error('Command change stream error', error);
        setTimeout(() => this.initCommandChangeStream(), 5000);
      });

      this.logger.log('Change stream active: robot_commands');
    } catch (error) {
      this.logger.error('Error initializing command change stream', error);
    }
  }

  private serializeCommand(doc: RobotCommandDocument) {
    const obj = doc.toObject();
    return {
      ...obj,
      _id: String(obj._id),
    };
  }

  async broadcastRobotData() {
    try {
      const robots = await this.robotsService.findAll();
      this.server.emit('robots-data', robots);
    } catch (error) {
      this.logger.error('Error broadcasting robot data', error);
      this.server.emit('robots-error', { message: 'Failed to broadcast robot data' });
    }
  }
}
