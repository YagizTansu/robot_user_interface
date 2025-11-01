import { Injectable, OnModuleInit } from '@nestjs/common';
import { RobotsService } from './robots/robots.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly robotsService: RobotsService) {}

  async onModuleInit() {
    // Uygulama başladığında seed data'yı çalıştır
    await this.robotsService.seedData();
  }

  getHello(): string {
    return 'Hello World!';
  }
}
