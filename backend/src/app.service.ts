import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): { status: string; mongo: string; timestamp: number } {
    const connected = this.connection.readyState === 1;
    return {
      status: connected ? 'ok' : 'degraded',
      mongo: connected ? 'connected' : 'disconnected',
      timestamp: Date.now(),
    };
  }
}
