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
import { Robot, RobotDocument } from '../robots/schemas/robot.schema';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  },
})
export class RobotsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private changeStream: any;

  constructor(
    @InjectModel(Robot.name) private robotModel: Model<RobotDocument>,
  ) {}

  async onModuleInit() {
    // MongoDB Change Streams'i başlat
    this.initChangeStreams();
  }

  async onModuleDestroy() {
    // Change Streams'i temizle
    if (this.changeStream) {
      await this.changeStream.close();
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
      const robots = await this.robotModel.find().exec();
      client.emit('robots-data', robots);
    } catch (error) {
      console.error('Error sending current robot data:', error);
      client.emit('robots-error', { message: 'Failed to fetch robot data' });
    }
  }

  private initChangeStreams() {
    try {
      // MongoDB Change Streams'i robot koleksiyonu için başlat
      this.changeStream = this.robotModel.watch([], {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      });

      this.changeStream.on('change', async (change) => {
        console.log('Robot collection change detected:', change.operationType);
        
        try {
          // Her değişiklikte güncel tüm robot verilerini gönder
          const robots = await this.robotModel.find().exec();
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

      console.log('MongoDB Change Streams initialized for robots collection');
    } catch (error) {
      console.error('Error initializing change streams:', error);
    }
  }

  // Manuel olarak robot verilerini yayınlamak için kullanılabilir
  async broadcastRobotData() {
    try {
      const robots = await this.robotModel.find().exec();
      this.server.emit('robots-data', robots);
    } catch (error) {
      console.error('Error broadcasting robot data:', error);
      this.server.emit('robots-error', { message: 'Failed to broadcast robot data' });
    }
  }
}