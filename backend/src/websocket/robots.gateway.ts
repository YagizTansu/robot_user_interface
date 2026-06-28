import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
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
    origin: true, // Yerel ağdaki tüm cihazlardan erişime izin ver
    credentials: true,
  },
})
export class RobotsGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
    console.log(`Client connected: ${client.id}`);
    
    // Yeni bağlanan istemciye mevcut robot verilerini gönder
    this.sendCurrentRobotData(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  private async sendCurrentRobotData(client: Socket) {
    try {
      const robots = await this.robotsService.findAll();
      client.emit('robots-data', robots);
    } catch (error) {
      console.error('Error sending current robot data:', error);
      client.emit('robots-error', { message: 'Failed to fetch robot data' });
    }
  }

  private initChangeStreams() {
    try {
      // MongoDB Change Streams'i robots_pose koleksiyonu için başlat
      this.changeStream = this.robotPoseModel.watch([], {
        fullDocument: 'updateLookup',
      });

      this.changeStream.on('change', async (change) => {
        console.log('Robot pose collection change detected:', change.operationType);
        
        try {
          // Her değişiklikte güncel tüm robot verilerini gönder
          const robots = await this.robotsService.findAll();
          this.server.emit('robots-data', robots);
          
          // Ayrıca spesifik değişiklik tipini de bildir
          this.server.emit('robots-change', {
            operationType: change.operationType,
            documentKey: change.documentKey,
            fullDocument: change.fullDocument
          });
        } catch (error) {
          console.error('Error handling change stream event:', error);
          this.server.emit('robots-error', { message: 'Failed to process robot data change' });
        }
      });

      this.changeStream.on('error', (error) => {
        console.error('Change stream error:', error);
        this.server.emit('robots-error', { message: 'Real-time connection error' });
        
        // Hata durumunda change stream'i yeniden başlat
        setTimeout(() => {
          console.log('Attempting to restart change stream...');
          this.initChangeStreams();
        }, 5000);
      });

      console.log('MongoDB Change Streams initialized for robots_pose collection');
    } catch (error) {
      console.error('Error initializing change streams:', error);
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
        console.error('Command change stream error:', error);
        setTimeout(() => {
          console.log('Attempting to restart command change stream...');
          this.initCommandChangeStream();
        }, 5000);
      });

      console.log('MongoDB Change Streams initialized for robot_commands collection');
    } catch (error) {
      console.error('Error initializing command change streams:', error);
    }
  }

  private serializeCommand(doc: RobotCommandDocument) {
    const obj = doc.toObject();
    return {
      ...obj,
      _id: String(obj._id),
    };
  }

  // Manuel olarak robot verilerini yayınlamak için kullanılabilir
  async broadcastRobotData() {
    try {
      const robots = await this.robotsService.findAll();
      this.server.emit('robots-data', robots);
    } catch (error) {
      console.error('Error broadcasting robot data:', error);
      this.server.emit('robots-error', { message: 'Failed to broadcast robot data' });
    }
  }
}